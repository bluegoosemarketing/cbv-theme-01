(() => {
  const sections = document.querySelectorAll('[data-cbv-bundle]');

  const formatMoney = (cents) => {
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, window.theme?.settings?.money_with_currency_format || window.shopMoneyFormat);
    }
    return `$${(Number(cents || 0) / 100).toFixed(2)}`;
  };

  const clean = (value) => (value || '').toString().trim();

  sections.forEach((section) => {
    const variantsNode = section.querySelector('[data-cbv-variants]');
    const variants = variantsNode ? JSON.parse(variantsNode.textContent || '[]') : [];

    const bundleMode = section.dataset.bundleMode || 'multi_slot';
    const requiredSlots = Number(section.dataset.requiredSlots || 0);
    const requireScent = section.dataset.requireScent === 'true';
    const requireCategory = section.dataset.requireCategory === 'true';
    const requireColor = section.dataset.requireColor === 'true';

    const optionInputs = Array.from(section.querySelectorAll('[data-cbv-option]'));
    const variantIdInput = section.querySelector('[data-cbv-variant-id]');
    const priceTarget = section.querySelector('[data-cbv-price]');

    const slotSelects = Array.from(section.querySelectorAll('[data-cbv-slot-select]'));
    const slotProps = Array.from(section.querySelectorAll('[data-cbv-prop-slot]'));

    const categoryButtons = Array.from(section.querySelectorAll('[data-cbv-category]'));
    const colorButtons = Array.from(section.querySelectorAll('[data-cbv-color]'));

    const categoryProp = section.querySelector('[data-cbv-prop-category]');
    const colorProp = section.querySelector('[data-cbv-prop-color]');
    const summaryProp = section.querySelector('[data-cbv-prop-summary]');

    const submitButton = section.querySelector('[data-cbv-submit]');
    const submitLabel = section.querySelector('[data-cbv-submit-label]');
    const validationMessage = section.querySelector('[data-cbv-validation]');
    const summaryStatus = section.querySelector('[data-cbv-summary-status]');
    const summaryList = section.querySelector('[data-cbv-summary-list]');

    let selectedVariant = variants.find((variant) => String(variant.id) === variantIdInput?.value) || variants[0] || null;

    const findVariant = () => {
      if (!optionInputs.length) return selectedVariant;
      return variants.find((variant) => optionInputs.every((input) => variant[`option${Number(input.dataset.optionPosition)}`] === input.value));
    };

    const syncVariant = () => {
      const variant = findVariant();
      if (!variant) return;
      selectedVariant = variant;

      if (variantIdInput) {
        variantIdInput.value = variant.id;
        variantIdInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (priceTarget) priceTarget.textContent = formatMoney(variant.price);
      if (submitLabel) {
        submitLabel.textContent = variant.available ? `${submitLabel.textContent.split('·')[0].trim()} · ${formatMoney(variant.price)}` : 'Sold out';
      }

      validate();
    };

    const selectedSlots = () => slotSelects.map((select) => clean(select.value)).filter(Boolean);

    const renderSummary = () => {
      if (!summaryList) return;
      summaryList.innerHTML = '';
      const items = [];

      if (bundleMode === 'multi_slot' && requireScent) {
        const selected = selectedSlots();
        items.push(`Fragrance slots: ${selected.length}/${requiredSlots}`);
        selected.forEach((slot, index) => items.push(`Slot ${index + 1}: ${slot}`));
      }

      if (requireCategory && categoryProp) {
        items.push(`Category: ${clean(categoryProp.value) || 'Not selected'}`);
      }

      if (requireColor && colorProp) {
        items.push(`Color: ${clean(colorProp.value) || 'Not selected'}`);
      }

      if (bundleMode === 'fixed') {
        items.push('Bundle type: Fixed curated kit');
      }

      items.forEach((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        summaryList.appendChild(li);
      });

      if (summaryProp) summaryProp.value = items.join(' | ');
    };

    const getMissing = () => {
      const missing = [];

      if (bundleMode === 'multi_slot' && requireScent && selectedSlots().length < requiredSlots) {
        missing.push(`Select ${requiredSlots} fragrances`);
      }

      if (requireCategory && !clean(categoryProp?.value)) {
        missing.push('Choose a category');
      }

      if (requireColor && !clean(colorProp?.value)) {
        missing.push('Choose a color');
      }

      return missing;
    };

    const validate = () => {
      const missing = getMissing();
      const variantAvailable = Boolean(selectedVariant?.available);

      if (submitButton) submitButton.disabled = missing.length > 0 || !variantAvailable;
      if (validationMessage) validationMessage.textContent = missing.length ? `Required: ${missing.join(' • ')}` : '';
      if (summaryStatus) summaryStatus.textContent = missing.length ? 'Complete selections to unlock add to cart.' : 'Ready to add this bundle to cart.';

      renderSummary();
    };

    slotSelects.forEach((select, index) => {
      select.addEventListener('change', () => {
        const value = clean(select.value);
        const slot = select.closest('[data-cbv-slot]');
        if (slot) {
          slot.classList.toggle('is-complete', Boolean(value));
          const state = slot.querySelector('[data-cbv-slot-state]');
          if (state) state.textContent = value ? 'Complete' : 'Required';
        }

        const prop = slotProps.find((input) => Number(input.dataset.cbvPropSlot) === Number(index + 1));
        if (prop) prop.value = value;
        validate();
      });
    });

    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        categoryButtons.forEach((chip) => chip.classList.remove('is-selected'));
        button.classList.add('is-selected');
        if (categoryProp) categoryProp.value = clean(button.dataset.cbvCategory);
        validate();
      });
    });

    colorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        colorButtons.forEach((chip) => chip.classList.remove('is-selected'));
        button.classList.add('is-selected');
        if (colorProp) colorProp.value = clean(button.dataset.cbvColor);
        validate();
      });
    });

    optionInputs.forEach((input) => input.addEventListener('change', syncVariant));

    syncVariant();
    validate();
  });
})();
