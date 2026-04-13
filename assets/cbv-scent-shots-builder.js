(() => {
  const MAX_RESULTS = 300;
  const BULK_MIN_SIZE = 8;

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

  const getUrlScent = () => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('scent') || '').toString().trim();
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
        console.error('CBV Scent Shots Builder: invalid fragrance data', error);
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
            console.warn('CBV Scent Shots Builder: failed loading fragrances', error);
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

    const requestedScent = getUrlScent();
    const requestedScentMatch = requestedScent
      ? allScents.find((scent) => normalize(scent.name) === normalize(requestedScent)) || null
      : null;

    const variantScript = builderEl.querySelector('[data-cbv-variants]');
    const allVariants = variantScript ? JSON.parse(variantScript.textContent || '[]') : [];

    const packInputs = builderEl.querySelectorAll('[data-cbv-pack-input]');
    const variantIdInput = builderEl.querySelector('[data-cbv-variant-id]');
    const mainImageEl = builderEl.querySelector('[data-cbv-main-image]');

    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');

    const trayWrap = builderEl.querySelector('[data-cbv-tray-wrapper]');
    const traySlotsEl = builderEl.querySelector('[data-cbv-slot-list]');
    const trayProgressEl = builderEl.querySelector('[data-cbv-tray-progress]');
    const trayHintEl = builderEl.querySelector('[data-cbv-tray-hint]');
    const slotPropertiesEl = builderEl.querySelector('[data-cbv-slot-properties]');

    const bulkFamilyWrap = builderEl.querySelector('[data-cbv-bulk-family]');
    const familySelect = builderEl.querySelector('[data-cbv-family-select]');
    const scentPickerEl = builderEl.querySelector('[data-cbv-scent-picker]');

    const secondaryInputs = builderEl.querySelectorAll('[data-cbv-secondary-input]');
    const secondaryProp = builderEl.querySelector('[data-cbv-prop-secondary]');
    const packProp = builderEl.querySelector('[data-cbv-prop-pack]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');

    const ticketPackEl = builderEl.querySelector('[data-cbv-ticket-pack]');
    const ticketProgressEl = builderEl.querySelector('[data-cbv-ticket-progress]');
    const ticketSecondaryEl = builderEl.querySelector('[data-cbv-ticket-secondary]');

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
    let pinnedScent = requestedScentMatch?.name || '';

    function isBulkPack() {
      return readPackSize(selectedPack) >= BULK_MIN_SIZE;
    }

    function requiredSlots() {
      return isBulkPack() ? 0 : readPackSize(selectedPack);
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
      selectedSlots.forEach((scent, index) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `properties[_Scent_${index + 1}]`;
        input.value = scent || '';
        slotPropertiesEl.appendChild(input);
      });
    }

    function isReadyToPurchase() {
      if (!variantAvailable) return false;
      if (isBulkPack()) return Boolean(familySelect?.value);
      const slotsRequired = requiredSlots();
      if (!slotsRequired) return false;
      return selectedSlots.filter(Boolean).length === slotsRequired;
    }

    function updateValidation() {
      const ready = isReadyToPurchase();
      if (submitBtn) submitBtn.disabled = !ready;

      const slotsRequired = requiredSlots();
      const filled = selectedSlots.filter(Boolean).length;

      if (isBulkPack()) {
        const hasFamily = Boolean(familySelect?.value);
        if (validationMessage) {
          validationMessage.textContent = hasFamily ? 'Bulk scent family selected.' : 'Select a scent family to continue.';
        }
        if (ticketProgressEl) ticketProgressEl.textContent = hasFamily ? familySelect.value : 'Choose family';
        if (trayHintEl) trayHintEl.textContent = 'Bulk packs use one scent family instead of individual slots.';
      } else {
        if (validationMessage) {
          validationMessage.textContent = ready ? 'All slots filled — ready to add to cart.' : 'Fill all slots to continue.';
        }
        if (ticketProgressEl) ticketProgressEl.textContent = `${filled} / ${slotsRequired} scents selected`;
        if (trayHintEl) trayHintEl.textContent = ready ? 'All slots filled.' : 'Fill all slots to continue.';
      }
    }

    function renderTray() {
      if (!traySlotsEl || !trayProgressEl) return;
      const slotsRequired = requiredSlots();

      traySlotsEl.innerHTML = '';
      if (isBulkPack()) {
        trayProgressEl.textContent = 'Bulk family mode';
        trayWrap?.classList.add('is-bulk');
        return;
      }

      trayWrap?.classList.remove('is-bulk');
      trayProgressEl.textContent = `${selectedSlots.filter(Boolean).length} / ${slotsRequired} filled`;

      for (let index = 0; index < slotsRequired; index += 1) {
        const scent = selectedSlots[index];
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `cbv-scent-slot${scent ? ' is-filled' : ''}`;
        slot.setAttribute('aria-label', scent ? `Remove ${scent}` : `Empty slot ${index + 1}`);
        slot.innerHTML = scent
          ? `<span class="cbv-scent-slot__name">${scent}</span><span class="cbv-scent-slot__remove">×</span>`
          : `<span class="cbv-scent-slot__empty">${index + 1}</span>`;

        if (scent) {
          slot.addEventListener('click', () => {
            selectedSlots[index] = '';
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
      const previousSlots = selectedSlots.filter(Boolean);
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
      if (btnTitleEl) btnTitleEl.textContent = variantAvailable ? 'Add Scent Shots' : 'Sold Out';
      if (ticketPackEl) ticketPackEl.textContent = selectedPack;
      if (ticketSecondaryEl && secondaryInputs.length > 0) ticketSecondaryEl.textContent = selectedSecondary;
      if (packProp) packProp.value = selectedPack;
      if (secondaryProp && secondaryInputs.length > 0) secondaryProp.value = selectedSecondary;

      if (mainImageEl && variant.featured_image?.src) mainImageEl.src = variant.featured_image.src;

      if (isBulkPack()) {
        selectedSlots = [];
      } else {
        const slotsRequired = requiredSlots();
        selectedSlots = previousSlots.slice(0, slotsRequired);

        if (pinnedScent) {
          selectedSlots = selectedSlots.filter((slot) => normalize(slot) !== normalize(pinnedScent));
          selectedSlots.unshift(pinnedScent);
        }

        selectedSlots = selectedSlots.slice(0, slotsRequired);
        while (selectedSlots.length < slotsRequired) selectedSlots.push('');
      }

      if (bulkFamilyWrap) bulkFamilyWrap.hidden = !isBulkPack();
      if (scentPickerEl) scentPickerEl.hidden = isBulkPack();
      if (!isBulkPack() && familySelect) familySelect.value = '';
      if (isBulkPack() && familySelect && !familySelect.value && requestedScentMatch?.family) {
        familySelect.value = normalizeFamily(requestedScentMatch.family);
      }
      if (familyProp) familyProp.value = isBulkPack() ? familySelect?.value || '' : '';

      updateSlotProperties();
      renderTray();
      updateValidation();
      renderResults();
    }

    function addScentToTray(scentName) {
      if (isBulkPack()) return;
      const nextIndex = selectedSlots.findIndex((slot) => !slot);
      if (nextIndex === -1) return;
      selectedSlots[nextIndex] = scentName;
      updateSlotProperties();
      renderTray();
      updateValidation();
    }

    function renderResults() {
      if (!resultsEl || isBulkPack()) return;
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
        const alreadyAdded = selectedSlots.some((selected) => normalize(selected) === normalize(scent.name));
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

    function populateFamilySelect() {
      if (!familySelect) return;
      families.forEach((family) => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = familyWithEmoji(family);
        familySelect.appendChild(option);
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

    familySelect?.addEventListener('change', () => {
      if (familyProp) familyProp.value = familySelect.value;
      updateValidation();
    });

    populateFamilySelect();
    renderFamilyFilters();
    syncPackCards();
    if (secondaryInputs.length > 0) syncChoiceCards(secondaryInputs);
    applyVariant(findVariant(selectedPack, selectedSecondary));
  }

  function init() {
    document.querySelectorAll('[data-cbv-scent-shots-builder]').forEach((builderEl) => setupBuilder(builderEl));
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
