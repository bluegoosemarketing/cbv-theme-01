(() => {
  const RECENT_KEY = 'cbv-builder-recent-scent';
  const MAX_RESULTS = 40;

  function normalize(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeFamily(value) {
    return (value || '').toString().trim() || 'Uncategorized';
  }

  async function setupBuilder(builderEl) {
    const fragranceScript = builderEl.querySelector('[data-cbv-fragrance-data]');
    if (!fragranceScript) return;

    function parseFragrancePayload(scriptEl) {
      try {
        return JSON.parse(scriptEl.textContent || '[]');
      } catch (error) {
        console.error('CBV Builder: invalid fragrance data', error);
        return [];
      }
    }

    async function loadAllScents(scriptEl) {
      const firstPage = parseFragrancePayload(scriptEl);
      const totalPages = Number(scriptEl.dataset.cbvFragrancePages || 1);
      const currentPage = Number(scriptEl.dataset.cbvFragrancePage || 1);
      const pageParam = scriptEl.dataset.cbvFragrancePageParam;

      if (!totalPages || totalPages <= 1 || !pageParam) return firstPage;

      const requests = [];
      for (let page = 1; page <= totalPages; page += 1) {
        if (page === currentPage) continue;

        const url = new URL(window.location.href);
        url.searchParams.set('section_id', builderEl.dataset.sectionId || '');
        url.searchParams.set(pageParam, page);
        requests.push(fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } }));
      }

      const loadedPages = await Promise.all(
        requests.map(async (request) => {
          try {
            const response = await request;
            if (!response.ok) return [];
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const script = doc.querySelector('[data-cbv-fragrance-data]');
            if (!script) return [];
            return parseFragrancePayload(script);
          } catch (error) {
            console.warn('CBV Builder: failed to load a fragrance page', error);
            return [];
          }
        })
      );

      return [...firstPage, ...loadedPages.flat()];
    }

    const scents = await loadAllScents(fragranceScript);

    if (!scents.length) return;

    const scentByHandle = new Map();
    scents.forEach((scent) => {
      if (!scent?.name) return;
      const family = normalizeFamily(scent.family);
      const key = normalize(scent.handle || scent.name);
      if (!scentByHandle.has(key)) scentByHandle.set(key, { ...scent, family });
    });

    const allScents = [...scentByHandle.values()].sort((a, b) => a.name.localeCompare(b.name));

    const waxSelect = builderEl.querySelector('[data-cbv-wax-select]');
    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const suggestedEl = builderEl.querySelector('[data-cbv-suggested]');
    const helperEl = builderEl.querySelector('[data-cbv-helper]');
    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const waxProp = builderEl.querySelector('[data-cbv-prop-wax]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    const variantAvailable = submitBtn.dataset.cbvVariantAvailable === 'true';

    let selectedFamily = 'All';
    let selectedScent = null;

    const families = ['All', ...new Set(allScents.map((s) => normalizeFamily(s.family)))].sort((a, b) =>
      a.localeCompare(b)
    );
    families.unshift(families.splice(families.indexOf('All'), 1)[0]);

    function getFilteredScents(query = '') {
      return allScents.filter((scent) => {
        const scentFamily = normalizeFamily(scent.family);
        const matchesFamily = selectedFamily === 'All' || normalize(scentFamily) === normalize(selectedFamily);
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scentFamily).includes(query);
      });
    }

    function validate() {
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      const ready = hasWax && hasScent && variantAvailable;

      submitBtn.disabled = !ready;
      if (ready) {
        helperEl.textContent = `Ready to add: ${waxProp.value} wax + ${scentProp.value}.`;
        helperEl.classList.add('is-valid');
      } else {
        helperEl.textContent = 'Choose a wax color and scent to continue.';
        helperEl.classList.remove('is-valid');
      }
    }

    function saveRecent(scent) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(scent));
      } catch (_error) {
        // Ignore localStorage issues.
      }
    }

    function renderBrowsableScents() {
      const filteredByFamily = getFilteredScents();
      
      // LOGIC FIX:
      // If a specific family is selected, show ALL of them.
      // If 'All' is selected, limit to 80 to prevent DOM lag, but allow searching.
      let scentsToDisplay = [];
      
      if (selectedFamily === 'All') {
        scentsToDisplay = filteredByFamily.slice(0, 80);
      } else {
        // Show everything for specific families
        scentsToDisplay = filteredByFamily;
      }

      suggestedEl.innerHTML = '';
      
      scentsToDisplay.forEach((scent) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cbv-scent__suggestion';
        btn.textContent = scent.name;
        btn.addEventListener('click', () => selectScent(scent));
        suggestedEl.appendChild(btn);
      });

      if (!scentsToDisplay.length) {
        const empty = document.createElement('div');
        empty.className = 'cbv-scent__family';
        empty.textContent = 'No scents found in this category.';
        suggestedEl.appendChild(empty);
      }
    }

    function selectScent(scent) {
      selectedScent = scent;
      scentInput.value = scent.name;
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';
      resultsEl.hidden = true;
      scentInput.setAttribute('aria-expanded', 'false');
      saveRecent(scent);
      renderBrowsableScents();
      validate();
    }

    function renderResults() {
      const query = normalize(scentInput.value);

      const filtered = getFilteredScents(query);

      const visible = filtered.slice(0, MAX_RESULTS);
      resultsEl.innerHTML = '';

      if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'cbv-scent__result';
        empty.innerHTML = query
          ? 'No fragrances found in this family. <button type="button" class="cbv-scent__clear" data-cbv-clear-search>Clear search</button>'
          : 'No fragrances found in this family yet. Try another family.';
        resultsEl.appendChild(empty);

        const clearButton = resultsEl.querySelector('[data-cbv-clear-search]');
        if (clearButton) {
          clearButton.addEventListener('click', () => {
            scentInput.value = '';
            selectedScent = null;
            scentProp.value = '';
            familyProp.value = '';
            renderResults();
            validate();
            scentInput.focus();
          });
        }
      } else {
        visible.forEach((scent) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'cbv-scent__result';
          button.innerHTML = `<span>${scent.name}</span><span class="cbv-scent__family">${scent.family || 'Uncategorized'}</span>`;
          button.addEventListener('click', () => selectScent(scent));
          resultsEl.appendChild(button);
        });
      }

      resultsEl.hidden = false;
      scentInput.setAttribute('aria-expanded', 'true');
    }

    function renderFamilyFilters() {
      familyFiltersEl.innerHTML = '';
      families.forEach((family) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `cbv-scent__chip${family === selectedFamily ? ' is-active' : ''}`;
        chip.textContent = family;
        chip.addEventListener('click', () => {
          const previousFamily = selectedFamily;
          selectedFamily = family;

          const familyChanged = previousFamily !== family;

          if (familyChanged && scentInput.value) {
            scentInput.value = '';
          }

          if (selectedScent && family !== 'All' && normalize(selectedScent.family) !== normalize(family)) {
            selectedScent = null;
            scentProp.value = '';
            familyProp.value = '';
          }

          renderFamilyFilters();
          renderBrowsableScents();
          renderResults();
          validate();

          if (familyChanged && window.innerWidth < 750) {
            // Optional: scroll suggested area into view on mobile
            // suggestedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
        familyFiltersEl.appendChild(chip);
      });
    }

    waxSelect.addEventListener('change', () => {
      waxProp.value = waxSelect.value;
      validate();
    });

    scentInput.addEventListener('focus', renderResults);
    scentInput.addEventListener('input', () => {
      if (selectedScent && normalize(scentInput.value) !== normalize(selectedScent.name)) {
        selectedScent = null;
        scentProp.value = '';
        familyProp.value = '';
      }
      renderResults();
      validate();
    });

    document.addEventListener('click', (event) => {
      if (!builderEl.contains(event.target)) {
        resultsEl.hidden = true;
        scentInput.setAttribute('aria-expanded', 'false');
      }
    });

    renderFamilyFilters();
    renderBrowsableScents();
    validate();
  }

  function init() {
    document.querySelectorAll('[data-cbv-builder]').forEach((builderEl) => {
      setupBuilder(builderEl);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();