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
    const emoji = emojiMap[key];
    return emoji ? `${emoji} ${family}` : family;
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function getUrlScent() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('scent') || '').toString().trim();
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

    const jarGroup = builderEl.querySelector('[data-cbv-step="jar"]');
    const waxGroup = builderEl.querySelector('[data-cbv-step="wax"]');
    const scentGroup = builderEl.querySelector('[data-cbv-step="scent"]');

    const variantScript = builderEl.querySelector('[data-cbv-variants]');
    const allVariants = variantScript ? JSON.parse(variantScript.textContent || '[]') : [];

    const jarInputs = builderEl.querySelectorAll('[data-cbv-jar-input]');
    const variantIdInput = builderEl.querySelector('[data-cbv-variant-id]');
    const mainImageEl = document.getElementById('CBV-Main-Image');

    const waxInputs = builderEl.querySelectorAll('[data-cbv-wax-input]');
    const waxProp = builderEl.querySelector('[data-cbv-prop-wax]');

    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    const selectedScentBanner = builderEl.querySelector('[data-cbv-selected-scent]');
    const wickUpgradeProp = builderEl.querySelector('[data-cbv-prop-wick-upgrade]');
    const wickUpgradeGroup = builderEl.querySelector('[data-cbv-wick-upgrade-group]');
    const wickUpgradeInputs = builderEl.querySelectorAll('[data-cbv-wick-upgrade-input]');

    const ticketEl = builderEl.querySelector('[data-cbv-ticket]');
    const ticketJarEl = builderEl.querySelector('[data-cbv-ticket-jar]');
    const ticketWaxEl = builderEl.querySelector('[data-cbv-ticket-wax]');
    const ticketScentEl = builderEl.querySelector('[data-cbv-ticket-scent]');
    const ticketWickEl = builderEl.querySelector('[data-cbv-ticket-wick]');
    const ticketSwatchEl = builderEl.querySelector('[data-cbv-ticket-swatch]');

    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn.querySelector('.cbv-btn-price');

    const mainPriceEl = builderEl.querySelector('[data-cbv-price-display]');

    const groupHeaders = builderEl.querySelectorAll('[data-cbv-accordion-toggle]');
    const continueBtns = builderEl.querySelectorAll('[data-cbv-continue]');

    let selectedFamily = 'All';
    let selectedScent = null;

    let selectedVariant = allVariants.find((variant) => String(variant.id) === variantIdInput?.value) || allVariants[0] || null;
    let selectedJar = selectedVariant?.option1 || jarInputs[0]?.dataset.cbvJarValue || '';
    let selectedWickUpgrade = selectedVariant?.option2 || wickUpgradeInputs[0]?.value || 'Standard';
    let variantAvailable = selectedVariant ? Boolean(selectedVariant.available) : true;

    const families = ['All', ...new Set(allScents.map((s) => normalizeFamily(s.family)))].sort((a, b) => a.localeCompare(b));
    families.unshift(families.splice(families.indexOf('All'), 1)[0]);

    function toggleGroup(group) {
      if (!group) return;
      group.classList.toggle('is-collapsed');
    }

    function collapseGroup(group) {
      if (!group) return;
      group.classList.add('is-collapsed');
    }

    function expandGroup(group) {
      if (!group) return;
      group.classList.remove('is-collapsed');
    }

    function updateStepHeader(group, text) {
      const summary = group?.querySelector('[data-cbv-step-title]');
      if (!summary) return;
      summary.textContent = text;
    }

    function findVariant(jarValue, wickUpgradeValue) {
      if (!allVariants.length) return null;
      const normalizedJar = normalize(jarValue);
      const normalizedUpgrade = normalize(wickUpgradeValue || 'Standard');

      let matched = allVariants.find((variant) => normalize(variant.option1) === normalizedJar && normalize(variant.option2) === normalizedUpgrade);
      if (matched) return matched;

      if (normalizedUpgrade !== 'standard') {
        matched = allVariants.find((variant) => normalize(variant.option1) === normalizedJar && normalize(variant.option2) === 'standard');
        if (matched) return matched;
      }

      matched = allVariants.find((variant) => normalize(variant.option1) === normalizedJar);
      return matched || allVariants[0];
    }

    function syncChoiceCards(inputs) {
      inputs.forEach((input) => {
        const card = input.closest('.cbv-choice-card');
        if (!card) return;
        card.classList.toggle('is-selected', input.checked);
      });
    }

    function applyVariant(variant) {
      if (!variant) return;
      selectedVariant = variant;
      variantAvailable = Boolean(variant.available);
      selectedJar = variant.option1 || selectedJar;
      if (variant.option2) selectedWickUpgrade = variant.option2;

      if (variantIdInput) {
        variantIdInput.value = variant.id;
        variantIdInput.dispatchEvent(new Event('input', { bubbles: true }));
        variantIdInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (wickUpgradeProp) wickUpgradeProp.value = selectedWickUpgrade;

      const variantImage = variant.featured_image?.src || variant.featured_media?.src || '';
      if (mainImageEl && variantImage) {
        mainImageEl.src = variantImage;
        mainImageEl.srcset = variantImage;
      }

      if (mainPriceEl) {
        mainPriceEl.dataset.cbvBasePrice = variant.price;
        mainPriceEl.textContent = formatMoney(variant.price);
      }

      submitBtn.dataset.cbvVariantAvailable = String(variantAvailable);

      if (jarInputs.length > 0) {
        jarInputs.forEach((input) => {
          const isSelected = normalize(input.dataset.cbvJarValue) === normalize(selectedJar);
          input.checked = isSelected;
          const card = input.closest('.cbv-jar-card');
          if (card) card.classList.toggle('is-selected', isSelected);
        });
      }

      if (wickUpgradeInputs.length > 0) {
        wickUpgradeInputs.forEach((input) => {
          input.checked = normalize(input.value) === normalize(selectedWickUpgrade);
        });
        syncChoiceCards(wickUpgradeInputs);
      }

      updateStepHeader(jarGroup, selectedJar);
      updateTicket();
      updatePricingUI();
      builderEl.dispatchEvent(
        new CustomEvent('cbv:variant:change', {
          bubbles: true,
          detail: {
            variant
          }
        })
      );
    }

    function updateTicket() {
      const hasJar = jarInputs.length > 0 ? Boolean(builderEl.querySelector('[data-cbv-jar-input]:checked')) : true;
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);

      if (jarGroup) jarGroup.classList.toggle('is-completed', hasJar);
      if (waxGroup) waxGroup.classList.toggle('is-completed', hasWax);
      if (scentGroup) scentGroup.classList.toggle('is-completed', hasScent);

      if (ticketWaxEl) ticketWaxEl.textContent = waxProp.value || '--';
      if (ticketScentEl) ticketScentEl.textContent = scentProp.value || '--';
      if (ticketWickEl) ticketWickEl.textContent = selectedWickUpgrade || '--';
      if (ticketJarEl) ticketJarEl.textContent = selectedJar || '--';

      const activeWaxInput = Array.from(waxInputs).find((input) => input.checked);
      if (activeWaxInput && ticketSwatchEl) {
        ticketSwatchEl.style.backgroundColor = activeWaxInput.dataset.hex;
      }

      ticketEl.hidden = !(hasWax && hasScent);

      const ready = hasJar && hasWax && hasScent && variantAvailable;
      submitBtn.disabled = !ready;
    }

    function updatePricingUI() {
      const basePriceCents = parseFloat(mainPriceEl.dataset.cbvBasePrice || '0');
      btnTitleEl.textContent = variantAvailable ? 'Pour My Candle' : 'Sold Out';
      if (btnPriceEl) btnPriceEl.textContent = ` - ${formatMoney(basePriceCents)}`;
    }

    function selectScent(scent) {
      selectedScent = scent;
      scentInput.value = scent.name;
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';

      if (selectedScentBanner) {
        selectedScentBanner.textContent = `Selected fragrance: ${scent.name}`;
        selectedScentBanner.hidden = false;
      }

      updateStepHeader(scentGroup, scent.name);
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
            if (selectedScentBanner) selectedScentBanner.hidden = true;
            updateTicket();
          }

          renderFamilyFilters();
          renderResults();
        });
        familyFiltersEl.appendChild(chip);
      });
    }

    continueBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextStep = btn.dataset.cbvContinue;
        const currentGroup = btn.closest('.cbv-builder__group');
        collapseGroup(currentGroup);
        const targetGroup = builderEl.querySelector(`[data-cbv-step="${nextStep}"]`);
        expandGroup(targetGroup);
      });
    });

    groupHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const group = header.closest('.cbv-builder__group');
        toggleGroup(group);
      });
    });

    if (jarInputs.length > 0) {
      jarInputs.forEach((input) => {
        input.addEventListener('change', () => {
          if (!input.checked) return;
          selectedJar = input.dataset.cbvJarValue || input.value;
          const variant = findVariant(selectedJar, selectedWickUpgrade);
          applyVariant(variant);
          setTimeout(() => {
            collapseGroup(jarGroup);
            expandGroup(waxGroup);
          }, 400);
        });
      });

      const jarCards = builderEl.querySelectorAll('[data-cbv-jar-card]');
      jarCards.forEach((card) => {
        card.addEventListener('click', () => {
          const input = card.querySelector('input');
          if (input && input.checked) {
            setTimeout(() => {
              collapseGroup(jarGroup);
              expandGroup(waxGroup);
            }, 100);
          }
        });
      });
    }

    waxInputs.forEach((input) => {
      input.addEventListener('change', () => {
        waxProp.value = input.value;
        updateStepHeader(waxGroup, input.value);
        setTimeout(() => {
          collapseGroup(waxGroup);
          expandGroup(scentGroup);
        }, 400);
        updateTicket();
      });
    });

    wickUpgradeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked || input.disabled) return;
        selectedWickUpgrade = input.value;
        syncChoiceCards(wickUpgradeInputs);
        const variant = findVariant(selectedJar, selectedWickUpgrade);
        applyVariant(variant);
      });
    });

    scentInput.addEventListener('input', () => {
      if (selectedScent && normalize(scentInput.value) !== normalize(selectedScent.name)) {
        selectedScent = null;
        scentProp.value = '';
        familyProp.value = '';
        if (selectedScentBanner) selectedScentBanner.hidden = true;
        updateTicket();
      }
      renderResults();
    });

    renderFamilyFilters();

    if (wickUpgradeGroup) syncChoiceCards(wickUpgradeInputs);

    applyVariant(findVariant(selectedJar, selectedWickUpgrade));

    const requestedScent = getUrlScent();
    if (requestedScent) {
      const matchedScent = allScents.find((scent) => normalize(scent.name) === normalize(requestedScent));
      if (matchedScent) {
        selectScent(matchedScent);
      }
    }

    scentInput.dispatchEvent(new Event('input'));
    renderResults();
    updateTicket();
    updatePricingUI();
  }

  function init() {
    document.querySelectorAll('[data-cbv-builder]').forEach((builderEl) => {
      setupBuilder(builderEl);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
