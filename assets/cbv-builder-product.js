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

    // --- DOM ELEMENTS ---
    // Builder Inputs
    const waxInputs = builderEl.querySelectorAll('[data-cbv-wax-input]');
    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');
    
    // Hidden Fields & State
    const waxProp = builderEl.querySelector('[data-cbv-prop-wax]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    
    // Buttons & Display
    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn.querySelector('.cbv-btn-price');
    const variantAvailable = submitBtn.dataset.cbvVariantAvailable === 'true';

    // Visual Groups
    const waxGroup = builderEl.querySelector('[data-cbv-step="wax"]');
    const scentGroup = builderEl.querySelector('[data-cbv-step="scent"]');
    
    // Ticket Elements
    const ticketEl = builderEl.querySelector('[data-cbv-ticket]');
    const ticketWaxEl = builderEl.querySelector('[data-cbv-ticket-wax]');
    const ticketScentEl = builderEl.querySelector('[data-cbv-ticket-scent]');
    const ticketSwatchEl = builderEl.querySelector('[data-cbv-ticket-swatch]');

    // Jar Selector Elements
    const jarInputs = builderEl.querySelectorAll('[data-cbv-jar-input]');
    const variantIdInput = builderEl.querySelector('[data-cbv-variant-id]');
    const mainImageEl = document.getElementById('CBV-Main-Image');

    // Pricing & Subscription Elements
    const purchaseOptions = builderEl.querySelectorAll('[data-cbv-option]');
    const freqSelector = builderEl.querySelector('[data-cbv-frequency]');
    const freqSelectInput = builderEl.querySelector('.cbv-freq-select'); 
    const mainPriceEl = builderEl.querySelector('[data-cbv-price-display]');
    const onetimePriceDisplay = builderEl.querySelector('[data-cbv-onetime-price]');
    const subOldPriceDisplay = builderEl.querySelector('[data-cbv-sub-old]');
    const subNewPriceDisplay = builderEl.querySelector('[data-cbv-sub-new]');

    // State Variables
    let purchaseType = 'onetime';
    let selectedFamily = 'All';
    let selectedScent = null;

    const families = ['All', ...new Set(allScents.map((s) => normalizeFamily(s.family)))].sort((a, b) =>
      a.localeCompare(b)
    );
    families.unshift(families.splice(families.indexOf('All'), 1)[0]);

    // --- CORE BUILDER FUNCTIONS ---

    function getFilteredScents(query = '') {
      return allScents.filter((scent) => {
        const scentFamily = normalizeFamily(scent.family);
        const matchesFamily = selectedFamily === 'All' || normalize(scentFamily) === normalize(selectedFamily);
        if (!matchesFamily) return false;
        if (!query) return true;
        return normalize(scent.name).includes(query) || normalize(scentFamily).includes(query);
      });
    }

    function updateTicket() {
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      
      // Toggle Green Light Classes
      if (waxGroup) hasWax ? waxGroup.classList.add('is-completed') : waxGroup.classList.remove('is-completed');
      if (scentGroup) hasScent ? scentGroup.classList.add('is-completed') : scentGroup.classList.remove('is-completed');

      if (hasWax && hasScent) {
        ticketEl.hidden = false;
        ticketWaxEl.textContent = waxProp.value;
        ticketScentEl.textContent = scentProp.value;
        
        // Update Ticket Swatch Color
        const activeWaxInput = Array.from(waxInputs).find(i => i.checked);
        if(activeWaxInput && ticketSwatchEl) {
           ticketSwatchEl.style.backgroundColor = activeWaxInput.dataset.hex;
        }
      } else {
        ticketEl.hidden = true;
      }

      validate();
    }

    function validate() {
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      const ready = hasWax && hasScent && variantAvailable;

      submitBtn.disabled = !ready;
    }

    function selectScent(scent) {
      selectedScent = scent;
      scentProp.value = scent.name;
      familyProp.value = scent.family || '';
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

    // --- PRICING & SUBSCRIPTION LOGIC ---

    function updatePricingUI() {
      // Get base price from the main price element (updated by Jar Switcher)
      const basePriceCents = parseFloat(mainPriceEl.dataset.cbvBasePrice);
      
      // Calculate Sub Price (10% off)
      const subPriceCents = basePriceCents * 0.9;

      // Update Option Card Text
      if(onetimePriceDisplay) onetimePriceDisplay.textContent = formatMoney(basePriceCents);
      if(subOldPriceDisplay) subOldPriceDisplay.textContent = formatMoney(basePriceCents);
      if(subNewPriceDisplay) subNewPriceDisplay.textContent = formatMoney(subPriceCents);

      // Determine Final Button Price
      let finalPriceCents = basePriceCents;
      
      if (purchaseType === 'sub') {
        finalPriceCents = subPriceCents;
        freqSelector.hidden = false;
        
        // ENABLE subscription input so it submits to Shopify
        if(freqSelectInput) freqSelectInput.disabled = false;
        
        btnTitleEl.textContent = variantAvailable ? "Join The Club & Pour" : "Sold Out";
      } else {
        freqSelector.hidden = true;
        
        // DISABLE subscription input so it DOES NOT submit (Fixes Add to Cart error)
        if(freqSelectInput) freqSelectInput.disabled = true;
        
        btnTitleEl.textContent = variantAvailable ? "Pour My Candle" : "Sold Out";
      }

      // Update Button Price Text
      if(btnPriceEl) btnPriceEl.textContent = ` - ${formatMoney(finalPriceCents)}`;
    }

    // --- EVENT LISTENERS ---

    // 1. Subscription Toggles
    purchaseOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        // Handle visual selection
        purchaseOptions.forEach(o => o.classList.remove('is-selected'));
        option.classList.add('is-selected');
        
        // Update state
        purchaseType = option.dataset.cbvOption;
        
        // Find radio inside and check it
        const radio = option.querySelector('input[type="radio"]');
        if(radio) radio.checked = true;

        updatePricingUI();
      });
    });

    // 2. Jar Switcher Logic
    if (jarInputs.length > 0) {
      jarInputs.forEach(input => {
        input.addEventListener('change', () => {
          if (!input.checked) return;

          // Visual Selection
          builderEl.querySelectorAll('.cbv-jar-card').forEach(c => c.classList.remove('is-selected'));
          input.closest('.cbv-jar-card').classList.add('is-selected');

          // Update Hidden Form ID (Critical for adding correct item to cart)
          if (variantIdInput) variantIdInput.value = input.value;

          // Swap Main Image
          const newImageSrc = input.dataset.imageSrc;
          if (mainImageEl && newImageSrc) {
            mainImageEl.src = newImageSrc;
            mainImageEl.srcset = newImageSrc;
          }

          // Update Base Price Data
          const newPriceCents = parseFloat(input.dataset.price);
          if (mainPriceEl) {
            mainPriceEl.dataset.cbvBasePrice = newPriceCents;
            mainPriceEl.textContent = formatMoney(newPriceCents);
          }
          
          // Recalculate Subscription Math
          updatePricingUI(); 
        });
      });
    }

    // 3. Builder Inputs
    waxInputs.forEach((input) => {
      input.addEventListener('change', () => {
        waxProp.value = input.value;
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

    // --- INITIALIZATION ---
    renderFamilyFilters();
    updateTicket();
    renderResults();
    updatePricingUI(); // Set initial state
  }

  function init() {
    document.querySelectorAll('[data-cbv-builder]').forEach((builderEl) => {
      setupBuilder(builderEl);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();