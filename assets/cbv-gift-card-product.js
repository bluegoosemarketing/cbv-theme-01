(() => {
  const sections = document.querySelectorAll('[data-cbv-gift-card-product]');

  const formatMoney = (cents) => {
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, window.theme?.settings?.money_with_currency_format || window.shopMoneyFormat);
    }
    return `$${(cents / 100).toFixed(2)}`;
  };

  sections.forEach((section) => {
    const variantsNode = section.querySelector('[data-cbv-variants]');
    if (!variantsNode) return;

    const variants = JSON.parse(variantsNode.textContent || '[]');
    if (!variants.length) return;

    const optionInputs = Array.from(section.querySelectorAll('[data-cbv-option-input]'));
    const variantIdInput = section.querySelector('[data-cbv-variant-id]');
    const priceTarget = section.querySelector('[data-cbv-price]');
    const submitButton = section.querySelector('[data-cbv-submit]');
    const submitText = section.querySelector('[data-cbv-submit-text]');
    const priceCards = Array.from(section.querySelectorAll('[data-cbv-price-card]'));

    const getOptionValue = (position) => {
      const optionGroup = optionInputs.filter((input) => Number(input.dataset.optionPosition) === position);
      const checkedRadio = optionGroup.find((input) => input.type === 'radio' && input.checked);
      if (checkedRadio) return checkedRadio.value;

      const select = optionGroup.find((input) => input.tagName === 'SELECT');
      return select ? select.value : null;
    };

    const findVariant = () => {
      return variants.find((variant) => {
        if (variant.option1 !== getOptionValue(1)) return false;
        if (variant.option2 && variant.option2 !== getOptionValue(2)) return false;
        if (variant.option3 && variant.option3 !== getOptionValue(3)) return false;
        return true;
      });
    };

    const syncPriceCardState = () => {
      priceCards.forEach((card) => {
        const input = card.querySelector('[data-cbv-option-input]');
        card.classList.toggle('is-selected', Boolean(input?.checked));
      });
    };

    const syncVariant = () => {
      const variant = findVariant();
      if (!variant || !variantIdInput) return;

      variantIdInput.value = variant.id;
      variantIdInput.dispatchEvent(new Event('change', { bubbles: true }));

      if (priceTarget) priceTarget.textContent = formatMoney(variant.price);

      if (submitButton && submitText) {
        if (variant.available) {
          submitButton.disabled = false;
          const actionLabel = submitText.textContent.split('·')[0].trim() || 'Add gift card';
          submitText.textContent = `${actionLabel} · ${formatMoney(variant.price)}`;
        } else {
          submitButton.disabled = true;
          submitText.textContent = 'Sold out';
        }
      }

      syncPriceCardState();
    };

    optionInputs.forEach((input) => {
      input.addEventListener('change', syncVariant);
    });

    syncVariant();
  });
})();
