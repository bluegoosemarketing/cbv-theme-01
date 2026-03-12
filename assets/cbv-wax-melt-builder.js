(() => {
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
    return emojiMap[key] ? `${emojiMap[key]} ${family}` : family;
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function getUrlScent() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('scent') || '').toString().trim();
  }

  function collapseGroup(group) {
    if (!group) return;
    group.classList.add('is-collapsed');
  }

  function expandGroup(group) {
    if (!group) return;
    group.classList.remove('is-collapsed');
  }

  function toggleGroup(group) {
    if (!group) return;
    group.classList.toggle('is-collapsed');
  }

  function syncChoiceCards(inputs) {
    inputs.forEach((input) => {
      const card = input.closest('.cbv-choice-card');
      if (card) card.classList.toggle('is-selected', input.checked);
    });
  }

  function updateStepHeader(group, text) {
    if (!group) return;
    const target = group.querySelector('[data-cbv-step-title]');
    if (target) target.textContent = text;
  }

  async function setupBuilder(builderEl) {
    const fragranceScript = builderEl.querySelector('[data-cbv-fragrance-data]');
    if (!fragranceScript) return;

    function parseFragrancePayload(scriptEl) {
      try {
        return JSON.parse(scriptEl.textContent || '[]');
      } catch (error) {
        console.error('CBV Wax Builder: invalid fragrance data', error);
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
            console.warn('CBV Wax Builder: failed to load a fragrance page', error);
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
    const families = ['All', ...new Set(allScents.map((scent) => normalizeFamily(scent.family)))];

    const vesselGroup = builderEl.querySelector('[data-cbv-step="vessel"]');
    const scentGroup = builderEl.querySelector('[data-cbv-step="scent"]');

    const variantScript = builderEl.querySelector('[data-cbv-variants]');
    const allVariants = variantScript ? JSON.parse(variantScript.textContent || '[]') : [];

    const vesselInputs = builderEl.querySelectorAll('[data-cbv-vessel-input]');
    const variantIdInput = builderEl.querySelector('[data-cbv-variant-id]');
    const mainImageEl = builderEl.querySelector('[data-cbv-main-image]');

    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    const vesselProp = builderEl.querySelector('[data-cbv-prop-vessel]');
    const selectedScentBanner = builderEl.querySelector('[data-cbv-selected-scent]');

    const secondaryInputs = builderEl.querySelectorAll('[data-cbv-secondary-input]');
    const secondaryProp = builderEl.querySelector('[data-cbv-prop-secondary]');

    const ticketVesselEl = builderEl.querySelector('[data-cbv-ticket-vessel]');
    const ticketScentEl = builderEl.querySelector('[data-cbv-ticket-scent]');
    const ticketSecondaryEl = builderEl.querySelector('[data-cbv-ticket-secondary]');

    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn?.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn?.querySelector('[data-cbv-btn-price]');
    const mainPriceEl = builderEl.querySelector('[data-cbv-price-display]');

    const groupHeaders = builderEl.querySelectorAll('[data-cbv-accordion-toggle]');
    const continueBtns = builderEl.querySelectorAll('[data-cbv-continue]');

    let selectedFamily = 'All';
    let selectedScent = null;
    let variantAvailable = true;

    let selectedVariant = allVariants.find((variant) => String(variant.id) === variantIdInput?.value) || allVariants[0] || null;
    let selectedVessel = selectedVariant?.option1 || vesselInputs[0]?.value || '';
    let selectedSecondary = selectedVariant?.option2 || secondaryInputs[0]?.value || '';

    function findVariant(vessel, secondaryValue) {
      return (
        allVariants.find((variant) => {
          if (variant.option1 !== vessel) return false;
          if (secondaryInputs.length > 0) return variant.option2 === secondaryValue;
          return true;
        }) || null
      );
    }

    function applyVariant(variant) {
      if (!variant) return;
      selectedVariant = variant;
      variantAvailable = Boolean(variant.available);

      if (variantIdInput) {
        variantIdInput.value = variant.id;
        variantIdInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (mainPriceEl) {
        mainPriceEl.dataset.cbvBasePrice = variant.price;
        mainPriceEl.textContent = formatMoney(variant.price);
      }

      if (btnPriceEl) btnPriceEl.textContent = ` - ${formatMoney(variant.price)}`;
      if (btnTitleEl) btnTitleEl.textContent = variantAvailable ? 'Add Wax Melts' : 'Sold Out';

      if (submitBtn) submitBtn.disabled = !isReadyToPurchase();

      if (ticketVesselEl) ticketVesselEl.textContent = selectedVessel || 'Not selected';
      if (ticketSecondaryEl && secondaryInputs.length > 0) {
        ticketSecondaryEl.textContent = selectedSecondary || 'Not selected';
      }

      if (vesselProp) vesselProp.value = selectedVessel;
      if (secondaryProp && secondaryInputs.length > 0) secondaryProp.value = selectedSecondary;

      if (mainImageEl && variant.featured_image?.src) {
        mainImageEl.src = variant.featured_image.src;
      }
    }

    function isReadyToPurchase() {
      const hasVessel = Boolean(selectedVessel);
      const hasScent = Boolean(scentProp?.value);
      return hasVessel && hasScent && variantAvailable;
    }

    function updateTicket() {
      const hasVessel = Boolean(selectedVessel);
      const hasScent = Boolean(scentProp?.value);

      if (vesselGroup) vesselGroup.classList.toggle('is-completed', hasVessel);
      if (scentGroup) scentGroup.classList.toggle('is-completed', hasScent);

      if (ticketVesselEl) ticketVesselEl.textContent = selectedVessel || 'Not selected';
      if (ticketScentEl) ticketScentEl.textContent = scentProp?.value || 'Make selection';
      if (ticketSecondaryEl && secondaryInputs.length > 0) ticketSecondaryEl.textContent = selectedSecondary || 'Not selected';

      if (submitBtn) submitBtn.disabled = !isReadyToPurchase();
    }

    function selectScent(scent) {
      selectedScent = scent;
      if (scentInput) scentInput.value = scent.name;
      if (scentProp) scentProp.value = scent.name;
      if (familyProp) familyProp.value = scent.family || '';

      if (selectedScentBanner) {
        selectedScentBanner.textContent = `Selected fragrance: ${scent.name}`;
        selectedScentBanner.hidden = false;
      }

      updateStepHeader(scentGroup, scent.name);
      updateTicket();
      renderResults();
    }

    function clearSelectedScent() {
      selectedScent = null;
      if (scentProp) scentProp.value = '';
      if (familyProp) familyProp.value = '';
      if (selectedScentBanner) selectedScentBanner.hidden = true;
      updateStepHeader(scentGroup, 'Choose Scent');
      updateTicket();
      renderResults();
    }

    function getFilteredScents(query = '') {
      return allScents.filter((scent) => {
        const scentFamily = normalizeFamily(scent.family);
        const matchesFamily = selectedFamily === 'All' || normalize(scentFamily) === normalize(selectedFamily);
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scentFamily).includes(query);
      });
    }

    function renderResults() {
      if (!resultsEl) return;
      const query = normalize(scentInput?.value);
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
      if (!familyFiltersEl) return;
      familyFiltersEl.innerHTML = '';
      families.forEach((family) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `cbv-scent__chip${family === selectedFamily ? ' is-active' : ''}`;
        chip.textContent = family === 'All' ? 'All scents' : familyWithEmoji(family);
        chip.addEventListener('click', () => {
          selectedFamily = family;
          renderFamilyFilters();
          renderResults();
        });
        familyFiltersEl.appendChild(chip);
      });
    }

    continueBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextStep = btn.dataset.cbvContinue;
        collapseGroup(btn.closest('.cbv-builder__group'));
        expandGroup(builderEl.querySelector(`[data-cbv-step="${nextStep}"]`));
      });
    });

    groupHeaders.forEach((header) => {
      header.addEventListener('click', () => toggleGroup(header.closest('.cbv-builder__group')));
    });

    vesselInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedVessel = input.dataset.cbvVesselValue || input.value;
        const variant = findVariant(selectedVessel, selectedSecondary);
        applyVariant(variant);
        setTimeout(() => {
          collapseGroup(vesselGroup);
          expandGroup(scentGroup);
        }, 400);
      });
    });

    secondaryInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked || input.disabled) return;
        selectedSecondary = input.value;
        syncChoiceCards(secondaryInputs);
        const variant = findVariant(selectedVessel, selectedSecondary);
        applyVariant(variant);
        updateTicket();
      });
    });

    if (scentInput) {
      scentInput.addEventListener('input', renderResults);
      scentInput.addEventListener('search', () => {
        if (normalize(scentInput.value)) return;
        renderResults();
      });
    }

    const clearScentBtn = builderEl.querySelector('[data-cbv-clear-scent]');
    if (clearScentBtn) {
      clearScentBtn.addEventListener('click', () => {
        if (scentInput) scentInput.value = '';
        clearSelectedScent();
      });
    }

    renderFamilyFilters();
    if (secondaryInputs.length > 0) syncChoiceCards(secondaryInputs);

    applyVariant(findVariant(selectedVessel, selectedSecondary));

    const requestedScent = getUrlScent();
    if (requestedScent) {
      const matchedScent = allScents.find((scent) => normalize(scent.name) === normalize(requestedScent));
      if (matchedScent) selectScent(matchedScent);
    }

    if (scentInput) scentInput.value = '';
    renderResults();
    updateTicket();
  }

  function init() {
    document.querySelectorAll('[data-cbv-wax-builder]').forEach((builderEl) => {
      setupBuilder(builderEl);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
