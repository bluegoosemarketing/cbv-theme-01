class StickyAddToCartOptions extends HTMLElement {
  constructor() {
    super();
    this.resizeTimeout = null;
    this._onResize = null;

    this._data = null;
    this._meta = null;
    this._allLoaded = false;
    this._loadingAllVariants = false;
  }

  getMainProductRoot() {
    const stickyRoot = this.closest('sticky-add-to-cart');
    const sid = stickyRoot?.dataset?.mainSectionId;
    if (sid) return document.getElementById(`MainProduct-${sid}`) || document;
    return document.querySelector('section[id^="MainProduct-"]') || document;
  }

  getStickyRoot() {
    return this.closest('sticky-add-to-cart') || document;
  }

  connectedCallback() {
    this.generateOptions();
    this.setupListeners();

    setTimeout(() => this.synchronizeWithMainForm(), 100);

    this._onResize = this.debouncedResizeHandler.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  debouncedResizeHandler() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.synchronizeWithMainForm(), 250);
  }

  setupListeners() {
    const stickyRoot = this.getStickyRoot();
    const mainSid = stickyRoot?.dataset?.mainSectionId;

    const stickySelect = this.querySelector('select[name="id"]');
    if (stickySelect) {
      const triggerLazyLoad = () => this.ensureAllVariantsLoaded();
      stickySelect.addEventListener('focus', triggerLazyLoad, { once: true });
      stickySelect.addEventListener('mousedown', triggerLazyLoad, { once: true });
      stickySelect.addEventListener('touchstart', triggerLazyLoad, { once: true });

      stickySelect.addEventListener('change', (e) => {
        this.handleStickyVariantChange(e.target.value);
      });
    }

    const root = this.getMainProductRoot();
    const mainIdInput = root.querySelector('.product-form input[name="id"]');
    if (mainIdInput) {
      mainIdInput.addEventListener('change', (e) => {
        const variant = this.getVariantById(e.target.value);
        if (variant) {
          this.updateStickyDisplay(variant);
          this.updateStickySelect(variant.id);
        }
      });
    }

    document.addEventListener('shopify:variant:change', (event) => {
      if (event.detail?.sectionId && String(event.detail.sectionId) !== String(mainSid)) return;
      const variantId = event.detail?.variantId;
      if (variantId) {
        const variant = this.getVariantById(variantId);
        if (variant) {
          this.updateStickyDisplay(variant);
          this.updateStickySelect(variant.id);
        }
      } else {
        this.synchronizeWithMainForm();
      }
    });

    document.addEventListener('variant:change', (event) => {
      if (event.detail?.sectionId && String(event.detail.sectionId) !== String(mainSid)) return;
      const variant = event.detail?.variant;
      if (variant && variant.id) {
        const v = this.getVariantById(variant.id);
        if (v) {
          this.updateStickyDisplay(v);
          this.updateStickySelect(v.id);
        }
      }
    });

    document.addEventListener('shopify:section:load', (event) => {
      const sid = String(event.detail?.sectionId || '');
      if (sid.includes('product-')) {
        setTimeout(() => this.synchronizeWithMainForm(), 200);
      }
      if (sid.includes('sticky-add-to-cart')) {
        const el = event.target.querySelector('sticky-add-to-cart-options');
        el?.generateOptions?.();
      }
    });

    document.addEventListener('shopify:section:select', (event) => {
      if (String(event.detail?.sectionId || '').includes('product-')) {
        setTimeout(() => this.synchronizeWithMainForm(), 200);
      }
    });
  }

  synchronizeWithMainForm() {
    const root = this.getMainProductRoot();
    const mainInput  = root.querySelector('.product-form input[name="id"]');
    const mainSelect = root.querySelector('.product-form select[name="id"]');
    const currentVariantId = (mainInput && mainInput.value) || (mainSelect && mainSelect.value);

    if (currentVariantId) {
      const variant = this.getVariantById(currentVariantId);
      if (variant) {
        this.updateStickyDisplay(variant);
        this.updateStickySelect(variant.id);
      }
    }
  }

  async handleStickyVariantChange(variantId) {
    const variant = this.getVariantById(variantId);
    if (!variant) {
      console.warn('Variant not found in local data; skipping.');
      return;
    }

    try {
      const productData = this.getProductData();
      const optionsMeta = productData?.options || [];
      const root = this.getMainProductRoot();

      optionsMeta.forEach((opt, idx) => {
        const value = variant[`option${idx + 1}`];
        if (!value) return;

        const prefix = `options[${opt.name}]`;
        const escapedPrefix = CSS.escape(prefix);

        const selects = root.querySelectorAll(`select[name^="${escapedPrefix}"]`);
        selects.forEach((sel) => {
          if (sel.value !== value) {
            sel.value = value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        const radios = root.querySelectorAll(`input[type="radio"][name^="${escapedPrefix}"][value="${CSS.escape(value)}"]`);
        radios.forEach((radio) => {
          if (!radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });

      this.updateStickyDisplay(variant);
      this.updateStickySelect(variant.id);

      const stickyRoot = this.getStickyRoot();
      const mainSid = stickyRoot?.dataset?.mainSectionId;
      document.dispatchEvent(new CustomEvent('shopify:variant:change', {
        detail: { sectionId: mainSid, variantId: variant.id, variant }
      }));
    } catch (error) {
      console.error('Error handling sticky variant change:', error);
    }
  }

  generateOptions() {
    const selectField = this.querySelector('select[name="id"]');
    if (!selectField) return;

    const productData = this.getProductData();
    if (!productData || !Array.isArray(productData.variant_options)) return;

    let currentVariant = productData.current_variant;

    const root = this.getMainProductRoot();
    const mainSelect = root.querySelector('.product-form select[name="id"]');
    const mainInput  = root.querySelector('.product-form input[name="id"]');
    const mainVariantId = (mainSelect && mainSelect.value) || (mainInput && mainInput.value);
    if (mainVariantId) {
      const mainVariant = productData.variant_options.find(v => String(v.id) === String(mainVariantId));
      if (mainVariant) currentVariant = mainVariant;
    }

    this.populateSelectOptions(productData.variant_options, selectField, currentVariant);

    const meta = this.getVariantMeta();
    if (meta && meta.variants_count && productData.variant_options.length < meta.variants_count) {
      this.insertLoadingPlaceholder(selectField);
    }

    if (currentVariant) {
      selectField.value = currentVariant.id;
      this.updateStickyDisplay(currentVariant);
    }
  }

  insertLoadingPlaceholder(selectField) {
    if (selectField.querySelector('option[data-loading]')) return;
    const opt = document.createElement('option');
    opt.value = '';
    opt.setAttribute('data-loading', 'true');
    opt.textContent = 'Loading variants…';
    selectField.appendChild(opt);
  }

  removeLoadingPlaceholder(selectField) {
    selectField.querySelectorAll('option[data-loading]').forEach(o => o.remove());
  }

  getProductData() {
    if (this._data) return this._data;
    try {
      const el = document.querySelector('[data-sticky-product-options]');
      this._data = el ? JSON.parse(el.textContent) : null;
      if (!this._data) return null;
      this._data.variant_options = Array.isArray(this._data.variant_options) ? this._data.variant_options : [];
      return this._data;
    } catch (e) {
      console.error('Cannot parse sticky product data', e);
      return null;
    }
  }

  getVariantMeta() {
    if (this._meta) return this._meta;
    try {
      const el = document.querySelector('[data-sticky-variant-data]');
      this._meta = el ? JSON.parse(el.textContent) : null;
      return this._meta;
    } catch (e) {
      console.warn('No sticky meta or parse error', e);
      return null;
    }
  }

  getVariantById(variantId) {
    const data = this.getProductData();
    if (!data) return null;
    return (data.variant_options || []).find(v => String(v.id) === String(variantId)) || null;
  }

  async ensureAllVariantsLoaded() {
    if (this._allLoaded || this._loadingAllVariants) return;

    const data = this.getProductData();
    const meta = this.getVariantMeta();
    if (!data || !meta) return;

    const have = data.variant_options.length;
    const total = meta.variants_count || have;
    if (have >= total) {
      this._allLoaded = true;
      return;
    }

    this._loadingAllVariants = true;
    const selectField = this.querySelector('select[name="id"]');
    this.insertLoadingPlaceholder(selectField);

    try {
      let all = null;
      if (meta.custom_endpoint || window.stickyVariantEndpoint) {
        const endpoint = meta.custom_endpoint || window.stickyVariantEndpoint;
        all = await this.fetchAllVariantsFromCustomEndpoint(endpoint, meta);
      }
      if (!all) {
        all = await this.fetchAllVariantsFromProductJS(meta.product_handle);
      }
      if (Array.isArray(all) && all.length) {
        const existingIds = new Set((data.variant_options || []).map(v => String(v.id)));
        const merged = data.variant_options.slice();
        for (const v of all) {
          if (!existingIds.has(String(v.id))) {
            merged.push(v);
            existingIds.add(String(v.id));
          }
        }
        this._data.variant_options = merged;

        const current = this.getCurrentVariant() || data.current_variant;
        this.populateSelectOptions(merged, selectField, current);
        if (current) this.updateStickySelect(current.id);

        this._allLoaded = merged.length >= total;
      }
    } catch (err) {
      console.error('Error loading all variants:', err);
    } finally {
      this._loadingAllVariants = false;
      this.removeLoadingPlaceholder(selectField);
    }
  }

  async fetchAllVariantsFromCustomEndpoint(endpoint, meta) {
    try {
      const url = new URL(endpoint, window.location.origin);
      if (meta.product_id) url.searchParams.set('product_id', meta.product_id);
      if (meta.product_handle) url.searchParams.set('handle', meta.product_handle);
      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) throw new Error(`Custom endpoint failed: ${res.status}`);
      const json = await res.json();
      return this.normalizeVariantArray(json);
    } catch (e) {
      console.warn('Custom endpoint fetch failed, falling back to product.js', e);
      return null;
    }
  }

  async fetchAllVariantsFromProductJS(handle) {
    try {
      if (!handle) return null;
      const res = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!res.ok) throw new Error(`product.js fetch failed: ${res.status}`);
      const product = await res.json();
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      return variants.map(v => {
        const img = v.featured_image || null;
        let imgObj = null;
        if (img) {
          if (typeof img === 'string') {
            imgObj = { src: img, alt: v.title || '' };
          } else if (typeof img === 'object') {
            imgObj = { src: img.src || img.url || '', alt: v.alt || v.title || '' };
          }
        }
        return {
          id: v.id,
          title: v.title,
          price: v.price,
          available: !!v.available,
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          featured_image: imgObj
        };
      });
    } catch (e) {
      console.error('fetchAllVariantsFromProductJS error', e);
      return null;
    }
  }

  normalizeVariantArray(input) {
    if (!Array.isArray(input)) return null;
    return input
      .map(v => {
        if (!v) return null;
        const img = v.featured_image || v.image || null;
        let imgObj = null;
        if (img) {
          if (typeof img === 'string') imgObj = { src: img, alt: v.title || '' };
          else if (typeof img === 'object') imgObj = { src: img.src || img.url || '', alt: v.alt || v.title || '' };
        }
        let price = v.price;
        if (typeof price === 'number' && price < 1000 && ('' + price).indexOf('.') >= 0) {
          price = Math.round(price * 100);
        }
        return {
          id: v.id,
          title: v.title,
          price: price,
          available: (typeof v.available === 'boolean') ? v.available : !!v.available,
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          featured_image: imgObj
        };
      })
      .filter(Boolean);
  }

  updateStickySelect(variantId) {
    const stickySelect = this.querySelector('select[name="id"]');
    if (stickySelect && String(stickySelect.value) !== String(variantId)) {
      stickySelect.value = String(variantId);
    }
  }

  async updateStickyPriceFromServer(variantId) {
    try {
      const stickyRoot = this.getStickyRoot();
      const priceWrap = stickyRoot.querySelector('[id^="price-"]');
      if (!priceWrap) return;

      const stickySectionId = priceWrap.id.replace('price-', '');
      const handle = this.getProductData()?.handle;
      if (!handle) return;

      const url = new URL(`/products/${encodeURIComponent(handle)}`, window.location.origin);
      url.searchParams.set('variant', variantId);
      url.searchParams.set('section_id', stickySectionId);

      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const src = doc.getElementById(`price-${stickySectionId}`);
      if (src) priceWrap.innerHTML = src.innerHTML;
    } catch (e) {
      console.warn('Sticky price refresh failed', e);
    }
  }

  updateStickyDisplay(variant) {
    try {
      const stickyRoot = this.getStickyRoot();

      const stickyImage = stickyRoot.querySelector('img');
      if (stickyImage) {
        const imgSrc =
          (variant.featured_image &&
            (variant.featured_image.src || variant.featured_image.url || variant.featured_image)) || null;
        if (imgSrc) {
          const url = imgSrc.includes('cdn.shopify.com') ? imgSrc.split('?')[0] + '?width=200' : imgSrc;
          stickyImage.src = url;
          stickyImage.setAttribute('src', url);
        }
      }

      this.updateStickyPriceFromServer(variant.id);

      const btn = stickyRoot.querySelector('button[name="add"]');
      if (btn) {
        const span = btn.querySelector('span');
        if (variant.available) {
          btn.removeAttribute('disabled');
          if (span) span.textContent = window.variantStrings?.addToCart || 'Add to cart';
        } else {
          btn.setAttribute('disabled', 'disabled');
          if (span) span.textContent = window.variantStrings?.soldOut || 'Sold out';
        }
      }
    } catch (e) {
      console.error('Sticky display update error', e);
    }
  }

  populateSelectOptions(variants, selectField, currentVariant) {
    selectField.innerHTML = '';
    const unavailableText =
      (window.variantStrings && (window.variantStrings.unavailable || window.variantStrings.soldOut)) ||
      'Unavailable';

    variants.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;

      let imageUrl = '';
      if (v.featured_image) imageUrl = v.featured_image.src || v.featured_image.url || v.featured_image;
      if (imageUrl && imageUrl.includes('cdn.shopify.com')) imageUrl = imageUrl.split('?')[0] + '?width=80';
      if (imageUrl) opt.setAttribute('data-img', imageUrl);

      opt.setAttribute('data-available', !!v.available);
      if (currentVariant && String(v.id) === String(currentVariant.id)) opt.selected = true;

      const label = v.available ? `${v.title}` : `${v.title} - ${unavailableText}`;
      opt.textContent = label;

      if (!v.available) opt.classList.add('option-disabled');

      selectField.appendChild(opt);
    });
  }

  formatPrice(price) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(price);
    }
    if (typeof price === 'number') return `$${(price / 100).toFixed(2)}`;
    return price || '';
  }

  refresh() { this.generateOptions(); }
  getCurrentVariant() {
    const selectField = this.querySelector('select[name="id"]');
    return selectField ? this.getVariantById(selectField.value) : null;
  }
}

customElements.define('sticky-add-to-cart-options', StickyAddToCartOptions);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('sticky-add-to-cart-options').forEach(el => el.generateOptions?.());
});
document.addEventListener('shopify:section:load', (event) => {
  if ((event.detail?.sectionId || '').includes('sticky-add-to-cart')) {
    const el = event.target.querySelector('sticky-add-to-cart-options');
    el?.generateOptions?.();
  }
});