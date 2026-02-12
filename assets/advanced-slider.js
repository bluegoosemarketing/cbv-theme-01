class AdvancedSlider extends HTMLElement {
  constructor() {
    super();
    this.debounceTimer = null;
  }

  connectedCallback() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    // Load Swiper if not already present
    if (typeof Swiper === 'undefined') {
      const script = document.createElement('script');
      script.src = '{{ "swiper.min.js" | asset_url }}'; // Liquid-compatible path
      script.onload = () => this.initializeMainSlider();
      document.head.appendChild(script);
    } else {
      this.initializeMainSlider();
    }
  }

  debounce(func, delay) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, delay);
  }

 updateAllSliderHeights() {

  const sliders = this.querySelectorAll(".main-slider.slider--adapt-to-image");

  if (!sliders.length) {
    console.warn('No .main-slider.slider--adapt-to-image elements found');
  }

  sliders.forEach(slider => {
    const img = slider.querySelector(".swiper-slide:not(.swiper-slide-duplicate) img");
    
    if (!img) {
      return;
    }

    const setHeight = () => {
      const ratio = img.naturalHeight / img.naturalWidth;
      const width = slider.offsetWidth;
      const realHeight = ratio * width;
      slider.style.height = realHeight + "px";
    };

    if (img.complete) {
      setHeight();
    } else {
      img.addEventListener("load", () => {
        setHeight();
      }, { once: true });
    }

    window.addEventListener("resize", () => {
      setHeight();
    });
  });
}



 initializeMainSlider() {
  const sliderElement = this.querySelector(".main-slider");
  if (!sliderElement) return;

  const enableImageAdaptation = sliderElement.dataset.adaptToImage === "true";
  const enableAutoplay = sliderElement.dataset.enableAutoplay === "true";
  const autoplaySpeedSeconds = parseFloat(sliderElement.dataset.autoplaySpeed) || 3;
  const autoplaySpeedMilliseconds = autoplaySpeedSeconds * 1000;
  const sliderDirection = sliderElement.dataset.sliderDirection || "horizontal";
  const sliderLoop = sliderElement.dataset.sliderLoop === "true";
  const component = this; 
   
  const mainSliderOptions = {
    loop: sliderLoop,
    speed: 1000,
    parallax: true,
    direction: sliderDirection,
    grabCursor: true,
    watchSlidesProgress: true,
    autoplay: enableAutoplay
      ? { delay: autoplaySpeedMilliseconds, disableOnInteraction: false }
      : false,
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    pagination: {
      el: ".swiper-pagination",
      type: "progressbar",
    },
    on: {
      init: function () {
        if (!this.slides || !this.slides.length) return;

        const activeSlide = this.slides[this.activeIndex];
        if (!activeSlide) return;

        activeSlide.querySelectorAll(".title, .caption-box, .caption, .banner-buttons")
          .forEach(el => el?.classList.add("show"));

        if (this.autoplay && enableAutoplay) {
          this.autoplay.start();
        }

        if (enableImageAdaptation) {
          component.updateAllSliderHeights();
        }
      },
      slideChangeTransitionEnd: function () {
        const activeSlide = this.slides[this.activeIndex];
        if (!activeSlide) return;

        this.el.querySelectorAll(".caption, .banner-buttons, .title, .caption-box")
          .forEach(el => el.classList.remove("show"));

        activeSlide.querySelectorAll(".title, .caption-box, .caption, .banner-buttons")
          .forEach(el => el?.classList.add("show"));
      },
      touchStart: function () {
        this.slides.forEach(slide => {
          slide.style.transition = "";
        });
      },
    },
  };

  new Swiper(sliderElement, mainSliderOptions);
}

}

customElements.define('advanced-slider', AdvancedSlider);