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

  async function setupBuilder(builderEl) {
    const fragranceScript = builderEl.querySelector('[data-cbv-fragrance-data]');
    if (!fragranceScript) return;

    // --- FRAGRANCE LOADING ---
    function parseFragrancePayload(scriptEl) {
      try { return JSON.parse(scriptEl.textContent || '[]'); } 
      catch (error) { console.error('CBV Builder: invalid fragrance data', error); return []; }
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

    // --- DOM ELEMENTS ---
    const jarGroup = builderEl.querySelector('[data-cbv-step="jar"]');
    const waxGroup = builderEl.querySelector('[data-cbv-step="wax"]');
    const scentGroup = builderEl.querySelector('[data-cbv-step="scent"]');

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
    
    const ticketEl = builderEl.querySelector('[data-cbv-ticket]');
    const ticketJarEl = builderEl.querySelector('[data-cbv-ticket-jar]');
    const ticketWaxEl = builderEl.querySelector('[data-cbv-ticket-wax]');
    const ticketScentEl = builderEl.querySelector('[data-cbv-ticket-scent]');
    const ticketSwatchEl = builderEl.querySelector('[data-cbv-ticket-swatch]');

    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn.querySelector('.cbv-btn-price');
    const variantAvailable = submitBtn.dataset.cbvVariantAvailable === 'true';

    const purchaseOptions = builderEl.querySelectorAll('[data-cbv-option]');
    const freqSelector = builderEl.querySelector('[data-cbv-frequency]');
    const freqSelectInput = builderEl.querySelector('.cbv-freq-select'); 
    const mainPriceEl = builderEl.querySelector('[data-cbv-price-display]');
    const onetimePriceDisplay = builderEl.querySelector('[data-cbv-onetime-price]');
    const subOldPriceDisplay = builderEl.querySelector('[data-cbv-sub-old]');
    const subNewPriceDisplay = builderEl.querySelector('[data-cbv-sub-new]');

    const groupHeaders = builderEl.querySelectorAll('[data-cbv-accordion-toggle]');
    const continueBtns = builderEl.querySelectorAll('[data-cbv-continue]');

    let purchaseType = 'onetime';
    let selectedFamily = 'All';
    let selectedScent = null;

    const families = ['All', ...new Set(allScents.map((s) => normalizeFamily(s.family)))].sort((a, b) =>
      a.localeCompare(b)
    );
    families.unshift(families.splice(families.indexOf('All'), 1)[0]);

    // --- LOGIC ---

    function toggleGroup(group) {
      if (!group) return;
      group.classList.toggle('is-collapsed');
    }

    function collapseGroup(group) {
      if (group) group.classList.add('is-collapsed');
    }

    function expandGroup(group) {
      if (group) group.classList.remove('is-collapsed');
    }

    function updateStepHeader(group, text) {
      if (!group) return;
      const titleSpan = group.querySelector('[data-cbv-step-title]');
      if (!titleSpan) return;
      let summary = group.querySelector('.cbv-selection-summary');
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'cbv-selection-summary';
        titleSpan.appendChild(summary);
      }
      summary.textContent = text;
    }

    function updateTicket() {
      const hasJar = jarInputs.length > 0 ? Boolean(builderEl.querySelector('[data-cbv-jar-input]:checked')) : true;
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      
      if(jarGroup) hasJar ? jarGroup.classList.add('is-completed') : jarGroup.classList.remove('is-completed');
      if(waxGroup) hasWax ? waxGroup.classList.add('is-completed') : waxGroup.classList.remove('is-completed');
      if(scentGroup) hasScent ? scentGroup.classList.add('is-completed') : scentGroup.classList.remove('is-completed');

      if (ticketWaxEl) ticketWaxEl.textContent = waxProp.value || '--';
      if (ticketScentEl) ticketScentEl.textContent = scentProp.value || '--';
      
      if (ticketJarEl && jarInputs.length > 0) {
          const activeJar = builderEl.querySelector('[data-cbv-jar-input]:checked');
          if(activeJar) ticketJarEl.textContent = activeJar.dataset.title;
      }

      const activeWaxInput = Array.from(waxInputs).find(i => i.checked);
      if(activeWaxInput && ticketSwatchEl) {
         ticketSwatchEl.style.backgroundColor = activeWaxInput.dataset.hex;
      }

      if (hasWax && hasScent) ticketEl.hidden = false;
      else ticketEl.hidden = true;

      const ready = hasJar && hasWax && hasScent && variantAvailable;
      submitBtn.disabled = !ready;
    }

    function updatePricingUI() {
      const basePriceCents = parseFloat(mainPriceEl.dataset.cbvBasePrice);
      const subPriceCents = basePriceCents * 0.9; 

      if(onetimePriceDisplay) onetimePriceDisplay.textContent = formatMoney(basePriceCents);
      if(subOldPriceDisplay) subOldPriceDisplay.textContent = formatMoney(basePriceCents);
      if(subNewPriceDisplay) subNewPriceDisplay.textContent = formatMoney(subPriceCents);

      let finalPriceCents = basePriceCents;
      if (purchaseType === 'sub') {
        finalPriceCents = subPriceCents;
        freqSelector.hidden = false;
        if(freqSelectInput) freqSelectInput.disabled = false;
        btnTitleEl.textContent = variantAvailable ? "Join The Club & Pour" : "Sold Out";
      } else {
        freqSelector.hidden = true;
        if(freqSelectInput) freqSelectInput.disabled = true;
        btnTitleEl.textContent = variantAvailable ? "Pour My Candle" : "Sold Out";
      }
      if(btnPriceEl) btnPriceEl.textContent = ` - ${formatMoney(finalPriceCents)}`;
    }

    function selectScent(scent) {
      selectedScent = scent;
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';
      
      updateStepHeader(scentGroup, scent.name);
      updateTicket();
      renderResults(); 
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

    function getFilteredScents(query = '') {
      return allScents.filter((scent) => {
        const scentFamily = normalizeFamily(scent.family);
        const matchesFamily = selectedFamily === 'All' || normalize(scentFamily) === normalize(selectedFamily);
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scentFamily).includes(query);
      });
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
            updateTicket();
          }

          renderFamilyFilters();
          renderResults();
        });
        familyFiltersEl.appendChild(chip);
      });
    }

    // --- LISTENERS ---

    continueBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const nextStep = btn.dataset.cbvContinue;
        const currentGroup = btn.closest('.cbv-builder__group');
        collapseGroup(currentGroup);
        const targetGroup = builderEl.querySelector(`[data-cbv-step="${nextStep}"]`);
        expandGroup(targetGroup);
      });
    });

    groupHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.cbv-builder__group');
        toggleGroup(group);
      });
    });

    purchaseOptions.forEach(option => {
      option.addEventListener('click', () => {
        purchaseOptions.forEach(o => o.classList.remove('is-selected'));
        option.classList.add('is-selected');
        purchaseType = option.dataset.cbvOption;
        const radio = option.querySelector('input[type="radio"]');
        if(radio) radio.checked = true;
        updatePricingUI();
      });
    });

    // Jar Logic
    if (jarInputs.length > 0) {
      // 1. Changes
      jarInputs.forEach(input => {
        input.addEventListener('change', () => {
          if (!input.checked) return;
          handleJarSelection(input);
        });
      });

      // 2. Click-to-Confirm
      const jarCards = builderEl.querySelectorAll('[data-cbv-jar-card]');
      jarCards.forEach(card => {
        card.addEventListener('click', (e) => {
          const input = card.querySelector('input');
          if (input && input.checked) {
             setTimeout(() => {
                collapseGroup(jarGroup);
                expandGroup(waxGroup);
             }, 100);
          }
        });
      });

      function handleJarSelection(input) {
          builderEl.querySelectorAll('.cbv-jar-card').forEach(c => c.classList.remove('is-selected'));
          input.closest('.cbv-jar-card').classList.add('is-selected');

          if (variantIdInput) variantIdInput.value = input.value;
          const newImageSrc = input.dataset.imageSrc;
          if (mainImageEl && newImageSrc) {
            mainImageEl.src = newImageSrc;
            mainImageEl.srcset = newImageSrc;
          }
          const newPriceCents = parseFloat(input.dataset.price);
          if (mainPriceEl) {
            mainPriceEl.dataset.cbvBasePrice = newPriceCents;
            mainPriceEl.textContent = formatMoney(newPriceCents);
          }
          
          updateStepHeader(jarGroup, input.dataset.title);
          setTimeout(() => {
            collapseGroup(jarGroup);
            expandGroup(waxGroup);
          }, 400);
          updateTicket();
          updatePricingUI(); 
      }

      const checkedJar = builderEl.querySelector('[data-cbv-jar-input]:checked');
      if(checkedJar) updateStepHeader(jarGroup, checkedJar.dataset.title);
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

    scentInput.addEventListener('input', () => {
      if (selectedScent && normalize(scentInput.value) !== normalize(selectedScent.name)) {
        selectedScent = null;
        scentProp.value = '';
        familyProp.value = '';
        updateTicket();
      }
      renderResults();
    });

    // --- INIT ---
    renderFamilyFilters();
    updateTicket();
    
    // Safety check: trigger input event to force render
    scentInput.dispatchEvent(new Event('input'));
    renderResults(); 
    
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