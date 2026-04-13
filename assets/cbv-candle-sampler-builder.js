(() => {
  const MAX_RESULTS = 300;

  const normalize = (value) => (value || '').toString().trim().toLowerCase();
  const normalizeFamily = (value) => (value || '').toString().trim() || 'Uncategorized';
  const formatMoney = (cents) => '$' + (cents / 100).toFixed(2);

  const familyWithEmoji = (family) => {
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
  };

  const readPackSize = (label) => {
    const match = (label || '').toString().match(/(\d+)/);
    if (match) return Number(match[1]);
    return normalize(label).includes('single') ? 1 : 1;
  };

  function relocatePourTicketForMobile(builderEl) {
    const ticketEl = builderEl.querySelector('.cbv-builder__media [data-cbv-ticket]');
    const ctaWrap = builderEl.querySelector('.product-form__buttons');
    if (!ticketEl || !ctaWrap || !ticketEl.parentNode) return;

    const anchor = document.createComment('cbv-ticket-anchor');
    ticketEl.parentNode.insertBefore(anchor, ticketEl);
    const mediaQuery = window.matchMedia('(max-width: 989px)');

    const moveTicket = () => {
      if (mediaQuery.matches) {
        ctaWrap.parentNode.insertBefore(ticketEl, ctaWrap);
        ticketEl.classList.add('cbv-pour-ticket--mobile-relocated');
      } else {
        anchor.parentNode.insertBefore(ticketEl, anchor);
        ticketEl.classList.remove('cbv-pour-ticket--mobile-relocated');
      }
    };

    moveTicket();
    mediaQuery.addEventListener('change', moveTicket);
  }

  async function setupBuilder(builderEl) {
    relocatePourTicketForMobile(builderEl);

    const fragranceScript = builderEl.querySelector('[data-cbv-fragrance-data]');
    if (!fragranceScript) return;

    const parseFragrancePayload = (scriptEl) => {
      try {
        return JSON.parse(scriptEl.textContent || '[]');
      } catch (error) {
        console.error('CBV Candle Sampler Builder: invalid fragrance data', error);
        return [];
      }
    };

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
            console.warn('CBV Candle Sampler Builder: failed loading fragrances', error);
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
    const families = [...new Set(allScents.map((scent) => normalizeFamily(scent.family)))].sort((a, b) => a.localeCompare(b));

    const variantScript = builderEl.querySelector('[data-cbv-variants]');
    const allVariants = variantScript ? JSON.parse(variantScript.textContent || '[]') : [];

    const packInputs = builderEl.querySelectorAll('[data-cbv-pack-input]');
    const variantIdInput = builderEl.querySelector('[data-cbv-variant-id]');
    const mainImageEl = builderEl.querySelector('[data-cbv-main-image]');

    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');

    const traySlotsEl = builderEl.querySelector('[data-cbv-slot-list]');
    const trayProgressEl = builderEl.querySelector('[data-cbv-tray-progress]');
    const trayHintEl = builderEl.querySelector('[data-cbv-tray-hint]');
    const slotPropertiesEl = builderEl.querySelector('[data-cbv-slot-properties]');
    const waxInputs = builderEl.querySelectorAll('[data-cbv-wax-input]');
    const waxHelperEl = builderEl.querySelector('[data-cbv-wax-helper]');

    const secondaryInputs = builderEl.querySelectorAll('[data-cbv-secondary-input]');
    const secondaryProp = builderEl.querySelector('[data-cbv-prop-secondary]');
    const packProp = builderEl.querySelector('[data-cbv-prop-pack]');

    const ticketPackEl = builderEl.querySelector('[data-cbv-ticket-pack]');
    const ticketProgressEl = builderEl.querySelector('[data-cbv-ticket-progress]');
    const ticketSecondaryEl = builderEl.querySelector('[data-cbv-ticket-secondary]');
    const ticketWaxEl = builderEl.querySelector('[data-cbv-ticket-wax]');
    const ticketWaxSwatchEl = builderEl.querySelector('[data-cbv-ticket-swatch]');

    const validationMessage = builderEl.querySelector('[data-cbv-validation-message]');
    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn?.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn?.querySelector('[data-cbv-btn-price]');
    const mainPriceEl = builderEl.querySelector('[data-cbv-price-display]');

    const groupHeaders = builderEl.querySelectorAll('[data-cbv-accordion-toggle]');
    const continueBtns = builderEl.querySelectorAll('[data-cbv-continue]');

    let selectedFamily = 'All';
    let variantAvailable = true;

    let selectedVariant = allVariants.find((variant) => String(variant.id) === variantIdInput?.value) || allVariants[0] || null;
    let selectedPack = selectedVariant?.option1 || packInputs[0]?.value || '';
    let selectedSecondary = selectedVariant?.option2 || secondaryInputs[0]?.value || '';
    let selectedSlots = [];
    let selectedWax = '';
    let selectedWaxHex = '';

    function requiredSlots() {
      return Math.max(1, readPackSize(selectedPack));
    }

    function findVariant(pack, secondaryValue) {
      return (
        allVariants.find((variant) => {
          if (variant.option1 !== pack) return false;
          if (secondaryInputs.length > 0) return variant.option2 === secondaryValue;
          return true;
        }) || null
      );
    }

    function syncChoiceCards(inputs) {
      inputs.forEach((input) => {
        const card = input.closest('.cbv-choice-card');
        if (card) card.classList.toggle('is-selected', input.checked);
      });
    }

    function syncPackCards() {
      packInputs.forEach((input) => {
        const packValue = input.dataset.cbvPackValue || input.value;
        const isSelected = packValue === selectedPack;
        input.checked = isSelected;

        const card = input.closest('[data-cbv-pack-card]');
        if (card) card.classList.toggle('is-selected', isSelected);
      });
    }

    function updateSlotProperties() {
      if (!slotPropertiesEl) return;
      slotPropertiesEl.innerHTML = '';
      selectedSlots.forEach((slot, index) => {
        const scentInput = document.createElement('input');
        scentInput.type = 'hidden';
        scentInput.name = `properties[_Candle_${index + 1}_Scent]`;
        scentInput.value = slot?.scent || '';
        slotPropertiesEl.appendChild(scentInput);

        const waxInput = document.createElement('input');
        waxInput.type = 'hidden';
        waxInput.name = `properties[_Candle_${index + 1}_Wax]`;
        waxInput.value = slot?.wax || '';
        slotPropertiesEl.appendChild(waxInput);
      });
    }

    function isReadyToPurchase() {
      if (!variantAvailable) return false;
      const slotsRequired = requiredSlots();
      return selectedSlots.filter((slot) => Boolean(slot?.scent) && Boolean(slot?.wax)).length === slotsRequired;
    }

    function updateValidation() {
      const ready = isReadyToPurchase();
      if (submitBtn) submitBtn.disabled = !ready;

      const slotsRequired = requiredSlots();
      const filled = selectedSlots.filter((slot) => Boolean(slot?.scent) && Boolean(slot?.wax)).length;
      const waxMessage = selectedWax ? `Next candle wax: ${selectedWax}` : 'Select a wax color for the next candle.';

      if (validationMessage) {
        validationMessage.textContent = ready
          ? 'All candle slots filled — ready to add to cart.'
          : `Select ${slotsRequired} candle scents to continue.`;
      }
      if (ticketProgressEl) ticketProgressEl.textContent = `${filled} / ${slotsRequired} scents selected`;
      if (trayHintEl) trayHintEl.textContent = ready ? 'All candle slots filled.' : `Select ${slotsRequired} scents to continue.`;
      if (ticketWaxEl) ticketWaxEl.textContent = selectedWax || 'Make selection';
      if (ticketWaxSwatchEl) {
        ticketWaxSwatchEl.style.setProperty('--cbv-wax-color', selectedWaxHex || 'transparent');
        ticketWaxSwatchEl.classList.toggle('is-filled', Boolean(selectedWaxHex));
      }
      if (waxHelperEl) waxHelperEl.textContent = waxMessage;
    }

    function renderTray() {
      if (!traySlotsEl || !trayProgressEl) return;
      const slotsRequired = requiredSlots();

      traySlotsEl.innerHTML = '';
      trayProgressEl.textContent = `${selectedSlots.filter((slot) => Boolean(slot?.scent) && Boolean(slot?.wax)).length} / ${slotsRequired} filled`;

      for (let index = 0; index < slotsRequired; index += 1) {
        const slotSelection = selectedSlots[index];
        const scent = slotSelection?.scent;
        const wax = slotSelection?.wax;
        const waxHex = slotSelection?.hex;
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `cbv-scent-slot${scent ? ' is-filled' : ''}`;
        slot.setAttribute('aria-label', scent ? `Remove ${scent}` : `Empty slot ${index + 1}`);
        slot.innerHTML = scent
          ? `<span class="cbv-scent-slot__name">${scent}</span><span class="cbv-scent-slot__meta">${wax || ''}</span><span class="cbv-scent-slot__remove">×</span>`
          : `<span class="cbv-scent-slot__empty">${index + 1}</span>`;

        if (scent && waxHex) {
          slot.style.borderColor = waxHex;
        }

        if (scent) {
          slot.addEventListener('click', () => {
            selectedSlots[index] = null;
            updateSlotProperties();
            renderTray();
            updateValidation();
          });
        }

        traySlotsEl.appendChild(slot);
      }
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

      syncPackCards();

      if (btnPriceEl) btnPriceEl.textContent = ` - ${formatMoney(variant.price)}`;
      if (btnTitleEl) btnTitleEl.textContent = variantAvailable ? 'Add Candles' : 'Sold Out';
      if (ticketPackEl) ticketPackEl.textContent = selectedPack;
      if (ticketSecondaryEl && secondaryInputs.length > 0) ticketSecondaryEl.textContent = selectedSecondary;
      if (packProp) packProp.value = selectedPack;
      if (secondaryProp && secondaryInputs.length > 0) secondaryProp.value = selectedSecondary;

      if (mainImageEl && variant.featured_image?.src) mainImageEl.src = variant.featured_image.src;

      selectedSlots = new Array(requiredSlots()).fill(null);

      updateSlotProperties();
      renderTray();
      updateValidation();
      renderResults();
    }

    function addScentToTray(scentName) {
      if (!selectedWax) {
        if (validationMessage) validationMessage.textContent = 'Choose a wax color before adding a candle scent.';
        return;
      }

      const nextIndex = selectedSlots.findIndex((slot) => !slot?.scent);
      if (nextIndex === -1) return;
      selectedSlots[nextIndex] = { scent: scentName, wax: selectedWax, hex: selectedWaxHex };
      updateSlotProperties();
      renderTray();
      updateValidation();
    }

    function renderResults() {
      if (!resultsEl) return;
      const query = normalize(scentInput?.value);
      const filtered = allScents.filter((scent) => {
        const scentFamily = normalizeFamily(scent.family);
        const matchesFamily = selectedFamily === 'All' || normalize(selectedFamily) === normalize(scentFamily);
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scentFamily).includes(query);
      });

      const visible = filtered.slice(0, MAX_RESULTS);
      resultsEl.innerHTML = '';

      visible.forEach((scent) => {
        const alreadyAdded = selectedSlots.some((selected) => normalize(selected?.scent) === normalize(scent.name));
        const card = document.createElement('div');
        card.className = 'cbv-scent-shot-result';
        card.innerHTML = `
          <div>
            <p class="cbv-scent-shot-result__name">${scent.name}</p>
            <p class="cbv-scent-shot-result__family">${scent.family}</p>
          </div>
          <div class="cbv-scent-shot-result__actions">
            <button type="button" class="cbv-scent-shot-result__btn" data-action="add">Add</button>
            ${
              alreadyAdded
                ? '<button type="button" class="cbv-scent-shot-result__btn is-ghost" data-action="again">+ Add again</button>'
                : ''
            }
          </div>
        `;

        card.querySelectorAll('[data-action]').forEach((button) => {
          button.addEventListener('click', () => addScentToTray(scent.name));
        });

        resultsEl.appendChild(card);
      });

      if (noResultsEl) noResultsEl.hidden = visible.length > 0;
    }

    function renderFamilyFilters() {
      if (!familyFiltersEl) return;
      familyFiltersEl.innerHTML = '';
      const chips = ['All', ...families];

      chips.forEach((family) => {
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
        btn.closest('.cbv-builder__group')?.classList.add('is-collapsed');
        builderEl.querySelector(`[data-cbv-step="${nextStep}"]`)?.classList.remove('is-collapsed');
      });
    });

    groupHeaders.forEach((header) => {
      header.addEventListener('click', () => header.closest('.cbv-builder__group')?.classList.toggle('is-collapsed'));
    });

    packInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedPack = input.dataset.cbvPackValue || input.value;
        const variant = findVariant(selectedPack, selectedSecondary);
        applyVariant(variant);
      });
    });

    secondaryInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked || input.disabled) return;
        selectedSecondary = input.value;
        syncChoiceCards(secondaryInputs);
        applyVariant(findVariant(selectedPack, selectedSecondary));
      });
    });

    scentInput?.addEventListener('input', renderResults);
    waxInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedWax = input.value;
        selectedWaxHex = input.dataset.hex || '';
        updateValidation();
      });
    });

    renderFamilyFilters();
    syncPackCards();
    if (secondaryInputs.length > 0) syncChoiceCards(secondaryInputs);
    applyVariant(findVariant(selectedPack, selectedSecondary));
  }

  function init() {
    document.querySelectorAll('[data-cbv-candle-sampler-builder]').forEach((builderEl) => setupBuilder(builderEl));
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
