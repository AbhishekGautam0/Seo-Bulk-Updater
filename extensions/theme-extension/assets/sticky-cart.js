document.addEventListener("DOMContentLoaded", () => {
  const stickyBar = document.getElementById("shopify-block-sticky-add-to-cart");
  if (!stickyBar) return;

  // Move sticky bar to body to ensure fixed position is relative to viewport,
  // escaping any parent container transforms or relative positioning.
  document.body.appendChild(stickyBar);

  const priceDisplay = document.getElementById("sticky-cart-price");
  const imgDisplay = document.getElementById("sticky-cart-product-img");
  const variantIdInput = document.getElementById("sticky-cart-variant-id");
  const submitBtn = document.getElementById("sticky-cart-submit");

  // Dynamically locate the main Buy Button on the product page
  const mainAtcBtn = document.querySelector('form[action*="/cart/add"] button[name="add"], form[action*="/cart/add"] [type="submit"], .product-form__submit, #AddToCart');

  // Money formatter helper
  function formatMoney(cents, format) {
    if (typeof cents === "string") cents = parseFloat(cents);
    const amount = (cents / 100).toFixed(2);
    const moneyFormat = format || window.stickyCartMoneyFormat || "${{amount}}";
    return moneyFormat.replace("{{amount}}", amount);
  }

  const toggleStickyBar = () => {
    let showSticky = false;
    if (mainAtcBtn) {
      const rect = mainAtcBtn.getBoundingClientRect();
      // Show sticky bar only when the main ATC button scrolls out of view (above the top of screen)
      showSticky = rect.bottom < 0;
    } else {
      // Fallback threshold if main ATC button is not found
      showSticky = window.scrollY > 450;
    }

    if (showSticky) {
      stickyBar.style.display = "block";
      setTimeout(() => {
        stickyBar.classList.add("visible");
      }, 10);
    } else {
      stickyBar.classList.remove("visible");
      setTimeout(() => {
        if (!stickyBar.classList.contains("visible")) {
          stickyBar.style.display = "none";
        }
      }, 300);
    }
  };

  window.addEventListener("scroll", toggleStickyBar);
  toggleStickyBar(); // Run initial check

  // Swatch click handlers
  const swatches = document.querySelectorAll(".sticky-cart-swatch");
  
  function updateSelectedVariant() {
    if (!window.stickyCartProductVariants) return;
    
    // Find all active options
    const optionRows = document.querySelectorAll(".sticky-cart-option-row");
    const selectedOptions = [];
    
    optionRows.forEach(row => {
      const activeSwatch = row.querySelector(".sticky-cart-swatch.active");
      if (activeSwatch) {
        selectedOptions.push(activeSwatch.getAttribute("data-value"));
      }
    });
    
    // Find matching variant
    const matchedVariant = window.stickyCartProductVariants.find(variant => {
      return variant.options.every((opt, idx) => opt === selectedOptions[idx]);
    });
    
    if (matchedVariant) {
      // Update variant ID
      if (variantIdInput) variantIdInput.value = matchedVariant.id;
      
      // Update price
      const priceFormatted = formatMoney(matchedVariant.price, window.stickyCartMoneyFormat);
      if (priceDisplay) priceDisplay.textContent = priceFormatted;
      
      // Update compare-at price & savings badge
      const comparePriceEl = document.getElementById("sticky-cart-compare-price");
      const savingsEl = document.getElementById("sticky-cart-savings");
      
      if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price) {
        const compareFormatted = formatMoney(matchedVariant.compare_at_price, window.stickyCartMoneyFormat);
        const savingsFormatted = formatMoney(matchedVariant.compare_at_price - matchedVariant.price, window.stickyCartMoneyFormat);
        
        if (comparePriceEl) {
          comparePriceEl.textContent = compareFormatted;
          comparePriceEl.style.display = "inline";
        }
        if (savingsEl) {
          savingsEl.textContent = "Save " + savingsFormatted;
          savingsEl.style.display = "inline-block";
        }
      } else {
        if (comparePriceEl) comparePriceEl.style.display = "none";
        if (savingsEl) savingsEl.style.display = "none";
      }
      
      // Update image
      if (matchedVariant.featured_image && matchedVariant.featured_image.src && imgDisplay) {
        let imgUrl = matchedVariant.featured_image.src;
        // Adjust protocols if needed
        if (imgUrl.startsWith("//")) {
          imgUrl = "https:" + imgUrl;
        }
        imgDisplay.src = imgUrl;
      }
      
      // Update button state
      if (matchedVariant.available) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Add to Cart";
      } else {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sold Out";
      }
    }
  }

  if (swatches.length > 0) {
    swatches.forEach(swatch => {
      swatch.addEventListener("click", () => {
        const row = swatch.closest(".sticky-cart-option-row");
        if (!row) return;
        
        // Remove active class from sibling swatches
        row.querySelectorAll(".sticky-cart-swatch").forEach(s => {
          s.classList.remove("active");
        });
        
        // Add active class to selected swatch
        swatch.classList.add("active");
        
        // Match variant options
        updateSelectedVariant();
      });
    });
  }

  // Get sections to request based on cart elements on page
  function getSectionsToRequest() {
    const sections = [];
    const cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer && typeof cartDrawer.getSectionsToRender === "function") {
      try {
        cartDrawer.getSectionsToRender().forEach(s => {
          if (s.section) sections.push(s.section);
        });
      } catch (e) {
        console.warn("Error getting sections from cart-drawer:", e);
      }
    }
    if (sections.length === 0) {
      const cartNotification = document.querySelector("cart-notification");
      if (cartNotification && typeof cartNotification.getSectionsToRender === "function") {
        try {
          cartNotification.getSectionsToRender().forEach(s => {
            if (s.section) sections.push(s.section);
          });
        } catch (e) {
          console.warn("Error getting sections from cart-notification:", e);
        }
      }
    }
    if (sections.length === 0) {
      const drawerEl = document.getElementById("cart-drawer") || document.querySelector("cart-drawer");
      const bubbleEl = document.getElementById("cart-icon-bubble");
      const drawerSectionId = drawerEl?.dataset?.id || drawerEl?.getAttribute("data-id");
      const bubbleSectionId = bubbleEl?.dataset?.id || bubbleEl?.getAttribute("data-id");
      if (drawerSectionId) sections.push(drawerSectionId);
      if (bubbleSectionId) sections.push(bubbleSectionId);
    }
    if (sections.length === 0) {
      return "cart-drawer,cart-icon-bubble";
    }
    return sections.join(",");
  }

  // Robust Cart Drawer Opener
  function openCartDrawer() {
    const cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      cartDrawer.classList.remove('is-empty');
      if (typeof cartDrawer.open === "function") {
        try {
          cartDrawer.open();
          return;
        } catch (e) {
          console.warn("cartDrawer.open() failed:", e);
        }
      }
      const details = cartDrawer.querySelector("details");
      if (details) {
        details.setAttribute("open", "true");
      }
    }

    const activeDrawer = document.querySelector('.drawer, .cart-drawer, #CartDrawer');
    if (activeDrawer) {
      activeDrawer.classList.add('active', 'open');
      activeDrawer.classList.remove('is-empty');
      const details = activeDrawer.querySelector("details");
      if (details) {
        details.setAttribute("open", "true");
      }
    }
    
    const cartDrawerElement = document.querySelector("cart-drawer");
    if (cartDrawerElement) {
      cartDrawerElement.classList.add('active', 'open');
      cartDrawerElement.classList.remove('is-empty');
    }
  }

  // Unified DOM Section Updater
  function updateDOMSections(sections) {
    if (!sections) return;

    // Update cart bubble/count
    const bubbleSelectors = [
      '#cart-icon-bubble',
      '.cart-count-bubble',
      '.cart-link__count',
      '#CartCount',
      '.header__cart-count',
    ];
    
    for (const selector of bubbleSelectors) {
      const bubbleEl = document.querySelector(selector);
      if (bubbleEl) {
        let html = sections['cart-icon-bubble'] || sections['header'];
        if (!html) {
          const bubbleKey = Object.keys(sections).find(key => key.includes('cart-icon-bubble') || key.includes('header') || key.includes('cart-notification'));
          if (bubbleKey) html = sections[bubbleKey];
        }
        if (html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newBubble = doc.querySelector(selector) || doc.body.firstChild;
          if (newBubble) {
            bubbleEl.innerHTML = newBubble.innerHTML;
          }
        }
      }
    }

    // Update cart drawer HTML
    const drawerSelectors = ['#CartDrawer', '.cart-drawer', '#cart-drawer'];
    for (const selector of drawerSelectors) {
      const drawerEl = document.querySelector(selector);
      if (drawerEl) {
        let html = sections['cart-drawer'];
        if (!html) {
          const drawerKey = Object.keys(sections).find(key => key.includes('cart-drawer'));
          if (drawerKey) html = sections[drawerKey];
        }
        if (html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newDrawer = doc.querySelector(selector) || doc.body.firstChild;
          if (newDrawer) {
            drawerEl.innerHTML = newDrawer.innerHTML;
          }
        }
      }
    }

    // Dispatch events so theme scripts know cart updated
    document.dispatchEvent(new CustomEvent("cart:refresh") || new Event("cart:updated"));
    
    // Open the drawer
    openCartDrawer();
  }

  // Unified Cart Refresher Helper
  function refreshCart(response) {
    // Ensure is-empty class is removed from the cart-drawer element and wrapper since we just added items!
    const cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      cartDrawer.classList.remove('is-empty');
    }
    const drawerWrapper = document.querySelector('.drawer, .cart-drawer, #CartDrawer');
    if (drawerWrapper) {
      drawerWrapper.classList.remove('is-empty');
    }

    // 1. Try Dawn's native custom element rendering
    let rendered = false;
    try {
      if (cartDrawer && typeof cartDrawer.renderContents === "function") {
        cartDrawer.renderContents(response);
        rendered = true;
      }
    } catch (e) {
      console.warn("Dawn renderContents failed, falling back to manual DOM updates:", e);
    }

    if (rendered) {
      openCartDrawer();
      return;
    }

    // 2. Fallback manual update using returned sections
    const sections = response.sections;
    if (sections) {
      updateDOMSections(sections);
    } else {
      // If sections were not returned, fetch them
      fetch('/cart?sections=' + getSectionsToRequest())
        .then((res) => res.json())
        .then((sec) => updateDOMSections(sec))
        .catch((err) => console.error("Manual cart fetch error:", err));
    }
  }

  // Smooth AJAX Add to Cart
  submitBtn.addEventListener("click", () => {
    const variantId = variantIdInput.value;
    if (!variantId) return;

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Adding...";

    fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        items: [
          {
            id: parseInt(variantId),
            quantity: 1,
          },
        ],
        sections: getSectionsToRequest(),
        sections_url: window.location.pathname
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not add variant to cart");
        return res.json();
      })
      .then((response) => {
        submitBtn.textContent = "Added! ✓";
        submitBtn.style.backgroundColor = "#10b981"; // change button to success green

        refreshCart(response);

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.backgroundColor = ""; // reset color
        }, 2000);
      })
      .catch((err) => {
        console.error(err);
        submitBtn.textContent = "Error";
        submitBtn.style.backgroundColor = "#ef4444";
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.backgroundColor = "";
        }, 2000);
      });
  });
});
