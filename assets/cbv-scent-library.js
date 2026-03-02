(() => {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => fn(...args), delay);
    };
  }

  function normalize(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function escHtml(value) {
    return (value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function parsePayload(scriptEl) {
    try {
      return JSON.parse(scriptEl.textContent || '[]');
    } catch (error) {
      console.error('CBV Scent Library: invalid scent payload', error);
      return [];
    }
  }

  function buildCardMarkup(item) {
    const name = escHtml(item.name || 'Scent');
    const family = escHtml(item.family || 'Uncategorized');
    const url = escHtml(item.url || '#');

    return `
      <article class="cbv-scent-card" data-cbv-card>
        <a class="cbv-scent-card__link" href="${url}">
          <p class="cbv-scent-card__family">${family}</p>
          <h3 class="cbv-scent-card__name">${name}</h3>
          <span class="cbv-scent-card__cta">View scent <span aria-hidden="true">→</span></span>
        </a>
      </article>
    `;
  }

  async function loadAllScents(root, scriptEl) {
    const firstPage = parsePayload(scriptEl);
    const totalPages = Number(scriptEl.dataset.cbvFragrancePages || 1);
    const currentPage = Number(scriptEl.dataset.cbvFragrancePage || 1);
    const pageParam = scriptEl.dataset.cbvFragrancePageParam;

    if (!totalPages || totalPages <= 1 || !pageParam) return firstPage;

    const requests = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === currentPage) continue;
      const url = new URL(window.location.href);
      url.searchParams.set('section_id', root.dataset.sectionId || '');
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
          const pageScript = doc.querySelector('[data-cbv-scent-data]');
          if (!pageScript) return [];
          return parsePayload(pageScript);
        } catch (error) {
          console.warn('CBV Scent Library: failed to load scent page', error);
          return [];
        }
      })
    );

    return [...firstPage, ...loadedPages.flat()];
  }

  async function initLibrary(root) {
    const dataScript = root.querySelector('[data-cbv-scent-data]');
    const searchInput = root.querySelector('[data-cbv-scent-search]');
    const familyFilters = root.querySelector('[data-cbv-family-filters]');
    const letterFilters = root.querySelector('[data-cbv-letter-filters]');
    const countEl = root.querySelector('[data-cbv-scent-count]');
    const resultsEl = root.querySelector('[data-cbv-scent-results]');
    const emptyEl = root.querySelector('[data-cbv-no-results]');

    if (!dataScript || !resultsEl || !searchInput || !familyFilters || !letterFilters) return;

    const allScentsRaw = await loadAllScents(root, dataScript);
    if (!allScentsRaw.length) return;

    const scentMap = new Map();
    allScentsRaw.forEach((item) => {
      const name = (item?.name || '').toString().trim();
      const family = (item?.family || 'Uncategorized').toString().trim() || 'Uncategorized';
      const url = (item?.url || '').toString().trim();
      if (!name || !url) return;

      const key = normalize(item.handle || `${name}-${family}`);
      if (!scentMap.has(key)) {
        scentMap.set(key, {
          name,
          family,
          url,
          handle: item.handle,
          firstLetter: name.charAt(0).toUpperCase()
        });
      }
    });

    const allScents = [...scentMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const families = ['All', ...new Set(allScents.map((item) => item.family).sort((a, b) => a.localeCompare(b)))];

    let activeFamily = 'All';
    let activeLetter = 'All';
    let query = '';

    function renderFamilies() {
      familyFilters.innerHTML = families
        .map((family) => `
          <button
            type="button"
            class="cbv-filter-chip${family === activeFamily ? ' is-active' : ''}"
            data-family="${escHtml(family)}"
            aria-pressed="${family === activeFamily ? 'true' : 'false'}"
          >${escHtml(family)}</button>
        `)
        .join('');
    }

    function renderLetters() {
      const letters = ['All', ...ALPHABET];
      letterFilters.innerHTML = letters
        .map((letter) => `
          <button
            type="button"
            class="cbv-letter-chip${letter === activeLetter ? ' is-active' : ''}"
            data-letter="${letter}"
            aria-pressed="${letter === activeLetter ? 'true' : 'false'}"
          >${letter}</button>
        `)
        .join('');
    }

    function applyFilters() {
      const filtered = allScents.filter((item) => {
        const matchesQuery = !query || normalize(item.name).includes(query);
        const matchesFamily = activeFamily === 'All' || item.family === activeFamily;
        const matchesLetter = activeLetter === 'All' || item.firstLetter === activeLetter;
        return matchesQuery && matchesFamily && matchesLetter;
      });

      countEl.textContent = `Showing ${filtered.length} scent${filtered.length === 1 ? '' : 's'}`;
      emptyEl.hidden = filtered.length > 0;

      if (!filtered.length) {
        resultsEl.innerHTML = '';
        return;
      }

      const markup = filtered.map((item) => buildCardMarkup(item)).join('');
      window.requestAnimationFrame(() => {
        resultsEl.innerHTML = markup;
      });
    }

    const onSearch = debounce((event) => {
      query = normalize(event.target.value);
      applyFilters();
    }, 120);

    searchInput.addEventListener('input', onSearch);

    familyFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-family]');
      if (!button) return;
      activeFamily = button.dataset.family || 'All';
      renderFamilies();
      applyFilters();
    });

    letterFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-letter]');
      if (!button) return;
      activeLetter = button.dataset.letter || 'All';
      renderLetters();
      applyFilters();
    });

    renderFamilies();
    renderLetters();
    applyFilters();
  }

  document.querySelectorAll('[data-cbv-scent-library]').forEach((root) => {
    initLibrary(root);
  });
})();
