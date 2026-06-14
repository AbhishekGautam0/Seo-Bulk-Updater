document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("shopify-block-product-bundles");
  if (!container) return;

  const productHandle = container.getAttribute("data-product-handle");
  const devServerUrl = container.getAttribute("data-app-server-url");
  const loader = document.getElementById("product-bundles-loader");
  const content = document.getElementById("product-bundles-content");

  if (!productHandle) return;

  // Resolve request URL (Proxy vs. Direct dev URL)
  let requestUrl = `/apps/seo-bulk-updater-proxy/api/storefront-bundles?handle=${productHandle}`;
  if (devServerUrl && devServerUrl.trim() !== "") {
    const cleanDevUrl = devServerUrl.endsWith("/") ? devServerUrl.slice(0, -1) : devServerUrl;
    requestUrl = `${cleanDevUrl}/api/storefront-bundles?handle=${productHandle}`;
  }

  // Show skeleton loader
  loader.style.display = "block";

  fetch(requestUrl)
    .then((res) => {
      if (!res.ok) throw new Error("Bundle request failed");
      return res.json();
    })
    .then((data) => {
      loader.style.display = "none";
      if (data.bundle) {
        renderBundle(data.bundle);
      }
    })
    .catch((err) => {
      loader.style.display = "none";
      console.error("Bundling error:", err);
    });

  // Price formatting helper
  function formatMoney(cents) {
    if (typeof cents === "string") cents = parseFloat(cents);
    // Convert to dollar format
    const amount = (cents / 100).toFixed(2);
    const format = window.bundleMoneyFormat || "${{amount}}";
    return format.replace("{{amount}}", amount);
  }

  function renderBundle(bundle) {
    const mainProduct = window.bundleMainProduct;
    if (!mainProduct) return;

    // List of all items (main product is always the first item in the bundle list)
    const items = [
      {
        id: mainProduct.id,
        productId: mainProduct.id,
        productHandle: mainProduct.handle,
        title: mainProduct.title,
        price: mainProduct.price / 100, // Convert main price to standard dollars
        image: mainProduct.image,
        variantId: mainProduct.variantId,
        isMain: true,
      },
      ...bundle.items.map((item) => ({
        ...item,
        isMain: false,
        variantId: item.productId.replace("gid://shopify/Product/", ""), // fallback ID representation
      })),
    ];

    // Build HTML Structure
    let itemsListMarkup = "";

    items.forEach((item, index) => {
      const displayPrice = formatMoney(item.price * 100);
      const isChecked = true; // By default all complementary bundle items are selected
      const imgUrl = item.image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

      itemsListMarkup += `
        <div class="bundle-row-item">
          <div class="bundle-row-image">
            <img src="${imgUrl}" alt="${item.title}" width="50" height="50" loading="lazy">
          </div>
          <div class="bundle-row-details">
            <span class="bundle-row-title">${item.isMain ? "<strong>This Item:</strong> " + item.title : item.title}</span>
            <span class="bundle-row-price">${displayPrice}</span>
          </div>
          <div class="bundle-row-select">
            <input type="checkbox" class="bundle-item-checkbox" data-index="${index}" data-price="${item.price}" data-variant-id="${item.variantId}" ${isChecked ? "checked" : ""} ${item.isMain ? "disabled" : ""}>
          </div>
        </div>
      `;
    });

    // 3. Render Card Wrapper
    content.innerHTML = `
      <div class="bundle-card-wrapper">
        <h3 class="bundle-card-title">${bundle.title}</h3>
        
        <div class="bundle-rows-container">
          ${itemsListMarkup}
        </div>

        <div class="bundle-purchase-footer">
          <div class="bundle-pricing-summary">
            <span class="bundle-total-label">Total Price:</span>
            <div class="bundle-price-box">
              <span id="bundle-compare-price" class="bundle-compare-price"></span>
              <span id="bundle-total-price" class="bundle-total-price"></span>
            </div>
            <span id="bundle-savings-badge" class="bundle-savings-badge"></span>
          </div>

          <button id="bundle-add-to-cart-btn" class="bundle-add-btn">
            Add Bundle to Cart
          </button>
        </div>
      </div>
    `;

    // Hook up interactive logic using querySelector instead of getElementById on DOM elements
    const checkboxes = content.querySelectorAll(".bundle-item-checkbox");
    const totalPriceElement = content.querySelector("#bundle-total-price");
    const comparePriceElement = content.querySelector("#bundle-compare-price");
    const savingsElement = content.querySelector("#bundle-savings-badge");
    const addToCartBtn = content.querySelector("#bundle-add-to-cart-btn");

    function updateBundlePricing() {
      let subtotal = 0;
      let checkedCount = 0;

      checkboxes.forEach((cb) => {
        if (cb.checked) {
          subtotal += parseFloat(cb.getAttribute("data-price"));
          checkedCount++;
        }
      });

      // Display pricing (always use correct amount sum of selected items)
      totalPriceElement.textContent = formatMoney(subtotal * 100);
      comparePriceElement.style.display = "none";
      savingsElement.style.display = "none";

      // Disable button if nothing checked
      if (addToCartBtn) {
        addToCartBtn.disabled = checkedCount === 0;
      }
    }

    checkboxes.forEach((cb) => {
      cb.addEventListener("change", updateBundlePricing);
    });

    // Run initial pricing calculation
    updateBundlePricing();

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

      // 1. Dawn/custom element renderContents support (covers Dawn, Craft, Sense, Refresh, etc.)
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

      // 2. Fallback manual update for non-Dawn themes
      const sections = response.sections;
      if (sections) {
        updateDOMSections(sections);
      } else {
        fetch('/cart?sections=' + getSectionsToRequest())
          .then((res) => res.json())
          .then((sec) => updateDOMSections(sec))
          .catch((err) => console.error("Manual cart refresh error:", err));
      }
    }

    // Fetch correct variant IDs for secondary products dynamically from their handles
    async function resolveBundledVariants() {
      const resolvedItems = [];

      for (const cb of checkboxes) {
        if (cb.checked) {
          const index = parseInt(cb.getAttribute("data-index"));
          const item = items[index];

          if (item.isMain) {
            resolvedItems.push({ id: parseInt(item.variantId), quantity: 1 });
          } else {
            // Fetch first available variant for complementary products from standard Shopify product JSON endpoint
            try {
              const res = await fetch(`/products/${item.productHandle}.js`);
              const pData = await res.json();
              const firstVariant = pData.variants.find((v) => v.available) || pData.variants[0];
              if (firstVariant) {
                resolvedItems.push({ id: parseInt(firstVariant.id), quantity: 1 });
              }
            } catch (err) {
              console.error(`Failed to resolve variant for ${item.productHandle}:`, err);
            }
          }
        }
      }

      return resolvedItems;
    }

    // Intercept main "Add to Cart" button of the theme if found
    const mainForm = document.querySelector('form[action="/cart/add"]');
    const mainBtn = mainForm ? mainForm.querySelector('[name="add"]') : document.querySelector('[name="add"]');

    if (mainBtn && addToCartBtn) {
      // Hide the bundle's separate add button to prevent UI duplication
      addToCartBtn.style.display = "none";

      mainBtn.addEventListener("click", async (e) => {
        // Check if any other products in the bundle are selected
        const otherChecked = Array.from(checkboxes).some(cb => !cb.disabled && cb.checked);
        
        if (otherChecked) {
          e.preventDefault();
          e.stopPropagation();

          mainBtn.disabled = true;
          const originalText = mainBtn.textContent || mainBtn.value || "Add to cart";
          mainBtn.textContent = "Adding Bundle...";

          try {
            const cartItems = await resolveBundledVariants();
            if (cartItems.length === 0) throw new Error("No variants selected");

            const response = await fetch("/cart/add.js", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
              },
              body: JSON.stringify({ 
                items: cartItems,
                sections: getSectionsToRequest(),
                sections_url: window.location.pathname
              }),
            });

            if (!response.ok) throw new Error("Batch add failed");
            const responseData = await response.json();

            mainBtn.textContent = "Bundle Added! ✓";
            if (mainBtn.style) {
              mainBtn.style.backgroundColor = "#10b981";
              mainBtn.style.color = "#ffffff";
            }

            refreshCart(responseData);

            setTimeout(() => {
              mainBtn.disabled = false;
              mainBtn.textContent = originalText;
              if (mainBtn.style) {
                mainBtn.style.backgroundColor = "";
                mainBtn.style.color = "";
              }
            }, 2000);
          } catch (err) {
            console.error("Failed to add bundle via main button:", err);
            // Fallback: Submit form normally if AJAX request fails
            if (mainForm) {
              mainForm.submit();
            }
          }
        }
      });
    }

    // Smooth Batch AJAX Add to Cart (Fallback if main button not found)
    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", async () => {
        addToCartBtn.disabled = true;
        const originalText = addToCartBtn.textContent;
        addToCartBtn.textContent = "Adding Bundle...";

        try {
          const cartItems = await resolveBundledVariants();

          if (cartItems.length === 0) {
            throw new Error("No variants selected");
          }

          const response = await fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ 
              items: cartItems,
              sections: getSectionsToRequest(),
              sections_url: window.location.pathname
            }),
          });

          if (!response.ok) throw new Error("Could not add items to cart");
          const responseData = await response.json();

          addToCartBtn.textContent = "Bundle Added! ✓";
          addToCartBtn.style.backgroundColor = "#10b981";

          refreshCart(responseData);

          setTimeout(() => {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = originalText;
            addToCartBtn.style.backgroundColor = "";
          }, 2000);
        } catch (err) {
          console.error("Cart error:", err);
          addToCartBtn.textContent = "Failed to Add";
          addToCartBtn.style.backgroundColor = "#ef4444";
          setTimeout(() => {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = originalText;
            addToCartBtn.style.backgroundColor = "";
          }, 2000);
        }
      });
    }
  }
});
