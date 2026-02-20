(() => {
  const RECENT_KEY = 'cbv-builder-recent-scent';
  const MAX_RESULTS = 40;

  function normalize(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function setupBuilder(builderEl) {
    const fragranceScript = builderEl.querySelector('[data-cbv-fragrance-data]');
    if (!fragranceScript) return;

    let scents = [];
    try {
      scents = JSON.parse(fragranceScript.textContent || '[]');
    } catch (error) {
      console.error('CBV Builder: invalid fragrance data', error);
      return;
    }

    if (!scents.length) return;

    scents.sort((a, b) => a.name.localeCompare(b.name));

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

    const families = ['All', ...new Set(scents.map((s) => s.family || 'Uncategorized'))].sort((a, b) =>
      a.localeCompare(b)
    );
    families.unshift(families.splice(families.indexOf('All'), 1)[0]);

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

    function loadSuggested() {
      const suggestions = [];
      try {
        const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null');
        if (recent?.name) suggestions.push(recent);
      } catch (_error) {
        // no-op
      }

      scents.slice(0, 5).forEach((scent) => {
        if (!suggestions.find((entry) => normalize(entry.name) === normalize(scent.name))) suggestions.push(scent);
      });

      suggestedEl.innerHTML = '';
      suggestions.slice(0, 6).forEach((scent) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cbv-scent__suggestion';
        btn.textContent = scent.name;
        btn.addEventListener('click', () => selectScent(scent));
        suggestedEl.appendChild(btn);
      });
    }

    function selectScent(scent) {
      selectedScent = scent;
      scentInput.value = scent.name;
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';
      resultsEl.hidden = true;
      scentInput.setAttribute('aria-expanded', 'false');
      saveRecent(scent);
      loadSuggested();
      validate();
    }

    function renderResults() {
      const query = normalize(scentInput.value);

      const filtered = scents.filter((scent) => {
        const matchesFamily = selectedFamily === 'All' || (scent.family || 'Uncategorized') === selectedFamily;
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scent.family).includes(query);
      });

      const visible = filtered.slice(0, MAX_RESULTS);
      resultsEl.innerHTML = '';

      if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'cbv-scent__result';
        empty.textContent = 'No fragrances found. Try another search.';
        resultsEl.appendChild(empty);
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
          selectedFamily = family;
          renderFamilyFilters();
          renderResults();
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
    loadSuggested();
    validate();
  }

  function init() {
    document.querySelectorAll('[data-cbv-builder]').forEach((builderEl) => setupBuilder(builderEl));
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
