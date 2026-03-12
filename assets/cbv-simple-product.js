(() => {
  const sections = document.querySelectorAll('[data-cbv-simple-product]');

  sections.forEach((section) => {
    const variantsNode = section.querySelector('[data-cbv-variants]');
    if (!variantsNode) return;

    const variants = JSON.parse(variantsNode.textContent || '[]');
    if (!variants.length) return;

    const optionInputs = Array.from(section.querySelectorAll('[data-cbv-option]'));
    const variantIdInput = section.querySelector('[data-cbv-variant-id]');
    const priceTarget = section.querySelector('[data-cbv-price]');
    const submitButton = section.querySelector('[data-cbv-submit]');
    const submitLabel = submitButton?.querySelector('span');
    const mainImage = section.querySelector('.cbv-simple-product__main-image');
    const thumbButtons = Array.from(section.querySelectorAll('[data-cbv-thumb]'));

    const formatMoney = (cents) => {
      if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
        return Shopify.formatMoney(cents, window.theme?.settings?.money_with_currency_format || window.shopMoneyFormat);
      }
      return `$${(cents / 100).toFixed(2)}`;
    };

    const updateThumbState = (imageSrc) => {
      thumbButtons.forEach((thumb) => {
        const isActive = thumb.dataset.imageSrc === imageSrc;
        thumb.classList.toggle('is-active', isActive);
      });
    };

    const findVariant = () => {
      if (!optionInputs.length) return variants[0];

      return variants.find((variant) => {
        return optionInputs.every((input) => {
          const position = Number(input.dataset.optionPosition);
          return variant[`option${position}`] === input.value;
        });
      });
    };

    const syncVariant = () => {
      const variant = findVariant();
      if (!variant || !variantIdInput) return;

      variantIdInput.value = variant.id;
      variantIdInput.dispatchEvent(new Event('change', { bubbles: true }));

      if (priceTarget) priceTarget.textContent = formatMoney(variant.price);

      if (submitButton && submitLabel) {
        if (variant.available) {
          submitButton.disabled = false;
          const base = submitLabel.textContent.split('·')[0].trim() || 'Add to cart';
          submitLabel.textContent = `${base} · ${formatMoney(variant.price)}`;
        } else {
          submitButton.disabled = true;
          submitLabel.textContent = 'Sold out';
        }
      }

      const imageSrc = variant.featured_image?.src;
      if (imageSrc && mainImage) {
        mainImage.src = imageSrc;
        updateThumbState(imageSrc);
      }
    };

    optionInputs.forEach((input) => input.addEventListener('change', syncVariant));

    thumbButtons.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const imageSrc = thumb.dataset.imageSrc;
        if (!imageSrc || !mainImage) return;
        mainImage.src = imageSrc;
        updateThumbState(imageSrc);
      });
    });

    syncVariant();
  });
})();
