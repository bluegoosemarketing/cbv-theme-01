(() => {
  const RECENT_KEY = 'cbv-builder-recent-scent';
  const MAX_RESULTS = 300;

  function normalize(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeFamily(value) {
    return (value || '').toString().trim() || 'Uncategorized';
  }

  function familyWithEmoji(family) {
    const emojiMap = {
      bakery: '🧁',
      fruity: '🍓',
      floral: '🌸',
      clean: '🧼',
      earthy: '🌿',
      christmas: '🎄',
      perfume: '💄'
    };

    const key = normalize(family);
    const emoji = emojiMap[key];
    return emoji ? `${emoji} ${family}` : family;
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

    const waxInputs = builderEl.querySelectorAll('[data-cbv-wax-input]');
    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const helperEl = builderEl.querySelector('[data-cbv-helper]');
    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const waxProp = builderEl.querySelector('[data-cbv-prop-wax]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');
    const waxSelectionEl = builderEl.querySelector('[data-cbv-wax-selection]');
    const scentSelectionEl = builderEl.querySelector('[data-cbv-scent-selection]');
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

    function updateSelectionsLabel() {
      if (waxSelectionEl) waxSelectionEl.textContent = waxProp.value ? `: ${waxProp.value}` : '';
      if (scentSelectionEl) scentSelectionEl.textContent = scentProp.value ? `: ${scentProp.value}` : '';
    }

    function validate() {
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      const ready = hasWax && hasScent && variantAvailable;

      submitBtn.disabled = !ready;
      if (ready) {
        helperEl.textContent = `Great choices! Ready to add ${waxProp.value} wax + ${scentProp.value}.`;
        helperEl.classList.add('is-valid');
      } else if (!hasWax) {
        helperEl.textContent = 'Please select a wax color.';
        helperEl.classList.remove('is-valid');
      } else {
        helperEl.textContent = 'Please select a scent.';
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

    function selectScent(scent) {
      selectedScent = scent;
      // CHANGE: We no longer auto-fill the search input with the full name
      // scentInput.value = scent.name; 
      
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';
      saveRecent(scent);
      updateSelectionsLabel();
      renderResults();
      validate();
    }

    function renderResults() {
      const query = normalize(scentInput.value);
      const filtered = getFilteredScents(query);
      const visible = filtered.slice(0, MAX_RESULTS);
      resultsEl.innerHTML = '';

      visible.forEach((scent) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cbv-scent__result';
        if (selectedScent && normalize(selectedScent.name) === normalize(scent.name)) {
          button.classList.add('is-selected');
        }
        button.innerHTML = `<span>${scent.name}</span><span class="cbv-scent__family">${scent.family || 'Uncategorized'}</span>`;
        button.addEventListener('click', () => selectScent(scent));
        resultsEl.appendChild(button);
      });

      if (noResultsEl) noResultsEl.hidden = visible.length > 0;
    }

    function renderFamilyFilters() {
      familyFiltersEl.innerHTML = '';
      families.forEach((family) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `cbv-scent__chip${family === selectedFamily ? ' is-active' : ''}`;
        chip.textContent = family === 'All' ? 'All scents' : familyWithEmoji(family);
        chip.addEventListener('click', () => {
          selectedFamily = family;

          if (selectedScent && family !== 'All' && normalize(selectedScent.family) !== normalize(family)) {
            selectedScent = null;
            scentProp.value = '';
            familyProp.value = '';
            updateSelectionsLabel();
          }

          renderFamilyFilters();
          renderResults();
          validate();
        });
        familyFiltersEl.appendChild(chip);
      });
    }

    waxInputs.forEach((input) => {
      input.addEventListener('change', () => {
        waxProp.value = input.value;
        updateSelectionsLabel();
        validate();
      });
    });

    scentInput.addEventListener('input', () => {
      if (selectedScent && normalize(scentInput.value) !== normalize(selectedScent.name)) {
        selectedScent = null;
        scentProp.value = '';
        familyProp.value = '';
        updateSelectionsLabel();
      }
      renderResults();
      validate();
    });

    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null');
      if (recent?.name) {
        const found = allScents.find((s) => normalize(s.name) === normalize(recent.name));
        if (found) {
          selectedScent = found;
          // CHANGE: Do not pre-fill input on load either, just select the item
          // scentInput.value = found.name;
          scentProp.value = found.name;
          familyProp.value = found.family || '';
        }
      }
    } catch (_error) {
      // Ignore localStorage issues.
    }

    renderFamilyFilters();
    updateSelectionsLabel();
    renderResults();
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