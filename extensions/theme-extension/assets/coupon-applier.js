document.addEventListener("DOMContentLoaded", () => {
  const configEl = document.getElementById("shopify-block-coupon-applier");
  if (!configEl) return;

  const permanentDomain = configEl.getAttribute("data-shop-domain");
  const appServerUrl = configEl.getAttribute("data-app-server-url");
  const moneyFormat = configEl.getAttribute("data-money-format") || "${{amount}}";

  let appliedCouponCode = sessionStorage.getItem('applied_coupon_code') || '';
  window.activeStorefrontCoupons = [];

  // Resolve request URL (Proxy vs. Direct dev URL)
  let requestUrl = `/apps/seo-bulk-updater-proxy/api/storefront-coupons?shop=${permanentDomain}`;
  if (appServerUrl && appServerUrl.trim() !== "") {
    const cleanDevUrl = appServerUrl.endsWith("/") ? appServerUrl.slice(0, -1) : appServerUrl;
    requestUrl = `${cleanDevUrl}/api/storefront-coupons?shop=${permanentDomain}`;
  }

  // Price formatting helper
  function formatMoney(cents, formatString) {
    if (typeof cents === "string") cents = parseFloat(cents);
    const amount = (cents / 100).toFixed(2);
    const format = formatString || moneyFormat || "${{amount}}";
    return format.replace("{{amount}}", amount);
  }

  // Fetch active storefront coupons
  function fetchActiveCoupons() {
    return fetch(requestUrl)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch coupons");
        return res.json();
      })
      .then(data => {
        window.activeStorefrontCoupons = data.coupons || [];
      })
      .catch(err => {
        console.error("Error fetching coupons:", err);
      });
  }

  function findCoupon(code) {
    if (!window.activeStorefrontCoupons) return null;
    return window.activeStorefrontCoupons.find(c => c.code === code.trim().toUpperCase());
  }

  // Check custom rules eligibility
  function checkEligibility(coupon, cart) {
    const subtotalCents = cart.items_subtotal_price || cart.total_price;
    const subtotalDollars = subtotalCents / 100;

    // 1. Min Subtotal check
    if (coupon.minSubtotal > 0 && subtotalDollars < coupon.minSubtotal) {
      const diff = coupon.minSubtotal - subtotalDollars;
      return { eligible: false, reason: `Spend $${diff.toFixed(2)} more to apply this coupon.` };
    }

    // 2. Required Product check
    if (coupon.requiredProductHandle) {
      const hasProduct = cart.items.some(item => item.handle === coupon.requiredProductHandle);
      if (!hasProduct) {
        return { eligible: false, reason: `This coupon is only applicable to ${coupon.requiredProductTitle || coupon.requiredProductHandle}.` };
      }
    }

    return { eligible: true };
  }

  function calculateDiscount(coupon, cart) {
    const subtotalCents = cart.items_subtotal_price || cart.total_price;
    if (coupon.discountType === 'percentage') {
      return Math.round(subtotalCents * (coupon.discountValue / 100));
    } else if (coupon.discountType === 'fixed_amount') {
      return Math.round(coupon.discountValue * 100);
    }
    return 0;
  }

  // Class toggler helper for cart components
  function toggleActiveCouponClass(isActive) {
    const elements = [
      document.body,
      document.querySelector('cart-drawer'),
      document.querySelector('.cart-drawer'),
      document.querySelector('#CartDrawer'),
      document.querySelector('cart-items'),
      document.querySelector('.cart__footer'),
      document.querySelector('#main-cart-items'),
      document.querySelector('#main-cart-footer')
    ];

    elements.forEach(el => {
      if (el) {
        // Always add class indicating coupon field block is active/loaded from customizer
        el.classList.add('coupon-field-active');

        if (isActive) {
          el.classList.add('coupon-code-active');
        } else {
          el.classList.remove('coupon-code-active');
        }
      }
    });
  }

  // Find theme-specific section IDs
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

  function refreshCart(response) {
    const cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      cartDrawer.classList.remove('is-empty');
    }
    const drawerWrapper = document.querySelector('.drawer, .cart-drawer, #CartDrawer');
    if (drawerWrapper) {
      drawerWrapper.classList.remove('is-empty');
    }

    let rendered = false;
    try {
      if (cartDrawer && typeof cartDrawer.renderContents === "function") {
        cartDrawer.renderContents(response);
        rendered = true;
      }
    } catch (e) {
      console.warn("Dawn renderContents failed:", e);
    }

    if (rendered) return;

    const sections = response.sections;
    if (sections) {
      updateDOMSections(sections);
    }
  }

  function updateDOMSections(sections) {
    if (!sections) return;
    const bubbleSelectors = ['#cart-icon-bubble', '.cart-count-bubble', '#CartCount'];
    for (const selector of bubbleSelectors) {
      const bubbleEl = document.querySelector(selector);
      if (bubbleEl) {
        let html = sections['cart-icon-bubble'] || sections['header'];
        if (!html) {
          const bubbleKey = Object.keys(sections).find(key => key.includes('cart-icon-bubble') || key.includes('header'));
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
  }

  // Update hidden discount inputs inside cart forms to pass to checkout page
  function updateDiscountInForms(code) {
    const checkoutButtons = document.querySelectorAll('[name="checkout"]');
    checkoutButtons.forEach(btn => {
      const form = btn.closest('form');
      if (form) {
        let discountInput = form.querySelector('input[name="discount"]');
        if (code) {
          if (!discountInput) {
            discountInput = document.createElement('input');
            discountInput.type = 'hidden';
            discountInput.name = 'discount';
            form.appendChild(discountInput);
          }
          discountInput.value = code;
        } else if (discountInput) {
          discountInput.remove();
        }
      }
    });
  }

  // Recalculate totals in the DOM and display the discount row
  function recalculateCartTotals(cart, coupon) {
    // Toggle class on cart containers based on coupon status
    toggleActiveCouponClass(!!coupon);

    const totalsContainers = document.querySelectorAll('.totals');
    if (totalsContainers.length === 0) return;

    totalsContainers.forEach(container => {
      // Remove any existing coupon elements to prevent duplication
      container.querySelectorAll('.totals__coupon-discount, .totals__coupon-final').forEach(el => el.remove());

      const subtotalValEl = container.querySelector('.totals__subtotal-value')
        || container.querySelector('p')
        || container.lastElementChild;
      if (!subtotalValEl) return;

      if (!coupon) {
        // Reset subtotal styling
        subtotalValEl.style.textDecoration = 'none';
        subtotalValEl.style.opacity = '1';
        return;
      }

      // Calculate discount amount
      const discount = calculateDiscount(coupon, cart);
      if (discount <= 0) {
        subtotalValEl.style.textDecoration = 'none';
        subtotalValEl.style.opacity = '1';
        return;
      }

      const subtotalCents = cart.items_subtotal_price || cart.total_price;
      const finalCents = Math.max(0, subtotalCents - discount);

      const discountFormatted = formatMoney(discount, moneyFormat);
      const finalFormatted = formatMoney(finalCents, moneyFormat);

      // Strike out the original subtotal
      subtotalValEl.style.textDecoration = 'line-through';
      subtotalValEl.style.opacity = '0.6';

      // Inject discount row
      const discountRow = document.createElement('div');
      discountRow.className = 'totals__coupon-discount';
      discountRow.style.cssText = 'display: flex; justify-content: space-between; width: 100%; margin-top: 6px; font-size: 13px; color: #10b981; font-weight: 600;';
      discountRow.innerHTML = `<span>Discount (${coupon.code})</span><span>-${discountFormatted}</span>`;

      // Inject final totals row
      const finalRow = document.createElement('div');
      finalRow.className = 'totals__coupon-final';
      finalRow.style.cssText = 'display: flex; justify-content: space-between; width: 100%; margin-top: 10px; font-size: 16px; font-weight: 700; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 8px;';
      finalRow.innerHTML = `<span>Final Total</span><span>${finalFormatted}</span>`;

      container.appendChild(discountRow);
      container.appendChild(finalRow);
    });
  }

  // Remove applied coupon
  async function removeAppliedCoupon() {
    try {
      const updateRes = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          discount: '',
          sections: getSectionsToRequest(),
          sections_url: window.location.pathname
        })
      });

      sessionStorage.removeItem('applied_coupon_code');
      appliedCouponCode = '';
      updateDiscountInForms('');

      // Reset DOM inputs and success banners
      document.querySelectorAll('.coupon-success-banner').forEach(suc => {
        suc.style.display = 'none';
        suc.innerHTML = '';
      });
      document.querySelectorAll('.coupon-error-banner').forEach(err => {
        err.style.display = 'none';
      });
      document.querySelectorAll('.coupon-code-input').forEach(inp => {
        inp.value = '';
      });
      document.querySelectorAll('.coupon-code-select').forEach(sel => {
        sel.value = '';
      });

      const responseData = await updateRes.json();
      refreshCart(responseData);
      recalculateCartTotals(responseData, null);

    } catch (err) {
      console.error("Error removing coupon:", err);
    }
  }

  // Apply Coupon
  async function applyCouponCode(code, errorEl, successEl) {
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';

    if (!code.trim()) {
      if (errorEl) {
        errorEl.textContent = 'Please enter a coupon code.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const coupon = findCoupon(code);
    if (!coupon) {
      if (errorEl) {
        errorEl.textContent = 'Invalid coupon code.';
        errorEl.style.display = 'block';
      }
      return;
    }

    try {
      // Fetch cart to check rules
      const cartRes = await fetch('/cart.js');
      const cart = await cartRes.json();

      // Check subtotal and product eligibility rules
      const eligibility = checkEligibility(coupon, cart);
      if (!eligibility.eligible) {
        if (errorEl) {
          errorEl.textContent = eligibility.reason;
          errorEl.style.display = 'block';
        }
        return;
      }

      // Apply coupon code via Shopify update endpoint
      const updateRes = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          discount: coupon.code,
          sections: getSectionsToRequest(),
          sections_url: window.location.pathname
        })
      });

      if (!updateRes.ok) {
        throw new Error('Failed to apply discount.');
      }

      const responseData = await updateRes.json();

      sessionStorage.setItem('applied_coupon_code', coupon.code);
      appliedCouponCode = coupon.code;
      updateDiscountInForms(coupon.code);

      // Update success message across all matching DOM elements
      document.querySelectorAll('.coupon-code-input').forEach(inp => {
        inp.value = coupon.code;
      });
      document.querySelectorAll('.coupon-code-select').forEach(sel => {
        sel.value = coupon.code;
      });
      document.querySelectorAll('.coupon-error-banner').forEach(err => {
        err.style.display = 'none';
      });
      document.querySelectorAll('.coupon-success-banner').forEach(suc => {
        suc.innerHTML = `Applied! <button type="button" class="coupon-remove-link" style="margin-left: 10px; background: none; border: none; color: #ef4444; cursor: pointer; text-decoration: underline; padding: 0; font-size: 11px;">Remove</button>`;
        suc.style.display = 'block';

        // Rebind click listener to remove button
        const removeBtn = suc.querySelector('.coupon-remove-link');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            removeAppliedCoupon();
          });
        }
      });

      refreshCart(responseData);
      recalculateCartTotals(cart, coupon);

    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.textContent = 'Error applying coupon code.';
        errorEl.style.display = 'block';
      }
    }
  }

  // Create coupon input widget
  function createWidgetElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'coupon-applier-widget';

    let optionsMarkup = '<option value="">-- View Available Coupons --</option>';
    if (window.activeStorefrontCoupons && window.activeStorefrontCoupons.length > 0) {
      window.activeStorefrontCoupons.forEach(coupon => {
        const desc = coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `$${coupon.discountValue.toFixed(2)}`;
        optionsMarkup += `<option value="${coupon.code}">${coupon.code} (${desc} Off)</option>`;
      });
    }

    wrapper.innerHTML = `
      <div class="coupon-widget-wrapper" style="margin: 14px 0;">
        <div class="coupon-widget-input-row">
          <input type="text" class="coupon-code-input" placeholder="Coupon Code" value="${appliedCouponCode}">
          <button type="button" class="coupon-apply-btn">Apply</button>
        </div>
        ${window.activeStorefrontCoupons && window.activeStorefrontCoupons.length > 0 ? `
        <div class="coupon-widget-select-row" style="margin-top: 8px;">
          <select class="coupon-code-select">
            ${optionsMarkup}
          </select>
        </div>
        ` : ''}
        <div class="coupon-error-banner" style="display: none;"></div>
        <div class="coupon-success-banner" style="display: none;"></div>
      </div>
    `;

    const input = wrapper.querySelector('.coupon-code-input');
    const select = wrapper.querySelector('.coupon-code-select');
    const applyBtn = wrapper.querySelector('.coupon-apply-btn');
    const errorEl = wrapper.querySelector('.coupon-error-banner');
    const successEl = wrapper.querySelector('.coupon-success-banner');

    if (select) {
      // Pre-select if coupon is active
      if (appliedCouponCode) select.value = appliedCouponCode;

      select.addEventListener('change', () => {
        input.value = select.value;
        if (select.value) {
          applyCouponCode(select.value, errorEl, successEl);
        }
      });
    }

    applyBtn.addEventListener('click', () => {
      applyCouponCode(input.value, errorEl, successEl);
    });

    if (appliedCouponCode) {
      const coupon = findCoupon(appliedCouponCode);
      if (coupon) {
        successEl.innerHTML = `Applied! <button type="button" class="coupon-remove-link" style="margin-left: 10px; background: none; border: none; color: #ef4444; cursor: pointer; text-decoration: underline; padding: 0; font-size: 11px;">Remove</button>`;
        successEl.style.display = 'block';

        const removeBtn = successEl.querySelector('.coupon-remove-link');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            removeAppliedCoupon();
          });
        }
      }
    }

    return wrapper;
  }

  // Inject widget in drawer and page summaries
  function injectCouponApplier() {
    // Locate the checkout buttons on screen (matches both cart page and cart drawer)
    const checkoutButtons = document.querySelectorAll('[name="checkout"]');
    checkoutButtons.forEach(btn => {
      // Ignore hidden buttons (like secondary hidden checkout triggers in some drawers)
      if (btn.offsetWidth === 0 && btn.offsetHeight === 0) return;

      const parent = btn.parentElement;
      // Verify that we haven't already injected the widget in this parent container
      if (parent && !parent.querySelector('.coupon-applier-widget')) {
        const widget = createWidgetElement();
        parent.insertBefore(widget, btn);
      }
    });
    // Ensure all cart checkout forms have the discount parameter applied
    updateDiscountInForms(appliedCouponCode);
  }

  async function init() {
    // Fetch coupons first
    await fetchActiveCoupons();

    if (appliedCouponCode) {
      const coupon = findCoupon(appliedCouponCode);
      if (coupon) {
        try {
          const cartRes = await fetch('/cart.js');
          const cart = await cartRes.json();
          const eligibility = checkEligibility(coupon, cart);
          if (eligibility.eligible) {
            // Re-apply to cart session to keep Shopify active
            await fetch('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ discount: coupon.code })
            });
            recalculateCartTotals(cart, coupon);
            updateDiscountInForms(coupon.code);
          } else {
            // Cart changed and no longer matches coupon criteria, drop it
            sessionStorage.removeItem('applied_coupon_code');
            appliedCouponCode = '';
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Run first injection
    injectCouponApplier();
    toggleActiveCouponClass(!!appliedCouponCode);

    // Hook into browser fetch to detect cart updates natively
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const [url] = args;
      const cartEndpoints = ['/cart/add.js', '/cart/change.js', '/cart/update.js', '/cart/clear.js', '/cart/add', '/cart/change', '/cart/update', '/cart/clear'];

      return originalFetch.apply(this, args).then(async (response) => {
        if (typeof url === 'string' && cartEndpoints.some(endpoint => url.includes(endpoint))) {
          // Cart was modified, wait for the DOM to update, then recalculate
          setTimeout(async () => {
            try {
              const cartRes = await originalFetch('/cart.js');
              const cart = await cartRes.json();
              if (appliedCouponCode) {
                const coupon = findCoupon(appliedCouponCode);
                if (coupon) {
                  const eligibility = checkEligibility(coupon, cart);
                  if (eligibility.eligible) {
                    recalculateCartTotals(cart, coupon);
                    updateDiscountInForms(coupon.code);
                  } else {
                    await removeAppliedCoupon();
                  }
                }
              }
            } catch (e) {
              console.error("Error updating cart after fetch:", e);
            }
          }, 100);
        }
        return response;
      });
    };

    // Setup DOM MutationObserver to dynamically re-inject when theme updates
    const observer = new MutationObserver((mutations) => {
      let needsInject = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          needsInject = true;
          break;
        }
      }
      if (needsInject) {
        injectCouponApplier();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Watch custom theme events
    document.addEventListener("cart:refresh", async () => {
      try {
        const cartRes = await fetch('/cart.js');
        const cart = await cartRes.json();
        if (appliedCouponCode) {
          const coupon = findCoupon(appliedCouponCode);
          if (coupon) {
            const eligibility = checkEligibility(coupon, cart);
            if (eligibility.eligible) {
              recalculateCartTotals(cart, coupon);
              updateDiscountInForms(coupon.code);
            } else {
              // Cart was updated and no longer eligible (e.g. items removed)
              await removeAppliedCoupon();
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Run initialization
  init();
});
