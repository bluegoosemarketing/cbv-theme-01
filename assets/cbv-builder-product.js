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

    // Elements
    const waxInputs = builderEl.querySelectorAll('[data-cbv-wax-input]');
    const scentInput = builderEl.querySelector('[data-cbv-scent-input]');
    const resultsEl = builderEl.querySelector('[data-cbv-results]');
    const familyFiltersEl = builderEl.querySelector('[data-cbv-family-filters]');
    const submitBtn = builderEl.querySelector('[data-cbv-submit]');
    const btnTitleEl = submitBtn.querySelector('.cbv-btn-title');
    const btnPriceEl = submitBtn.querySelector('.cbv-btn-price');
    const waxProp = builderEl.querySelector('[data-cbv-prop-wax]');
    const scentProp = builderEl.querySelector('[data-cbv-prop-scent]');
    const familyProp = builderEl.querySelector('[data-cbv-prop-family]');
    const noResultsEl = builderEl.querySelector('[data-cbv-no-results]');
    const variantAvailable = submitBtn.dataset.cbvVariantAvailable === 'true';

    // Groups & Visuals
    const waxGroup = builderEl.querySelector('[data-cbv-step="wax"]');
    const scentGroup = builderEl.querySelector('[data-cbv-step="scent"]');
    
    // Ticket Elements
    const ticketEl = builderEl.querySelector('[data-cbv-ticket]');
    const ticketWaxEl = builderEl.querySelector('[data-cbv-ticket-wax]');
    const ticketScentEl = builderEl.querySelector('[data-cbv-ticket-scent]');
    const ticketSwatchEl = builderEl.querySelector('[data-cbv-ticket-swatch]');

    // Subscription Elements
    const purchaseOptions = builderEl.querySelectorAll('[data-cbv-option]');
    const freqSelector = builderEl.querySelector('[data-cbv-frequency]');
    const mainPriceEl = builderEl.querySelector('[data-cbv-main-price]');
    let purchaseType = 'onetime';

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

    function updateTicket() {
      // 1. Update Hidden Inputs
      const hasWax = Boolean(waxProp.value);
      const hasScent = Boolean(scentProp.value);
      
      // 2. Visual Group Classes
      if (waxGroup) hasWax ? waxGroup.classList.add('is-completed') : waxGroup.classList.remove('is-completed');
      if (scentGroup) hasScent ? scentGroup.classList.add('is-completed') : scentGroup.classList.remove('is-completed');

      // 3. Update Ticket UI
      if (hasWax && hasScent) {
        ticketEl.hidden = false;
        ticketWaxEl.textContent = waxProp.value;
        ticketScentEl.textContent = scentProp.value;
        
        // Find selected wax hex
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
      
      // Button Text Update handled in Subscription Logic generally, but here we enable/disable
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

    // --- SUBSCRIPTION LOGIC ---
    function updatePricingUI() {
      // Base Price logic (assuming raw price is in cents or standard money format)
      // This is a simplified frontend visual update. Real cart logic relies on form data.
      const basePrice = parseFloat(mainPriceEl.dataset.cbvMainPrice) / 100;
      let finalPrice = basePrice;
      
      if (purchaseType === 'sub') {
        finalPrice = basePrice * 0.9; // 10% off
        freqSelector.hidden = false;
        btnTitleEl.textContent = variantAvailable ? "Join The Club & Pour" : "Sold Out";
      } else {
        freqSelector.hidden = true;
        btnTitleEl.textContent = variantAvailable ? "Pour My Candle" : "Sold Out";
      }

      const formatted = '$' + finalPrice.toFixed(2);
      if(btnPriceEl) btnPriceEl.textContent = ` - ${formatted}`;
    }

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

    // --- EVENTS ---
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

    renderFamilyFilters();
    updateTicket();
    renderResults();
    updatePricingUI(); // Set initial button state
  }

  function init() {
    document.querySelectorAll('[data-cbv-builder]').forEach((builderEl) => {
      setupBuilder(builderEl);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();