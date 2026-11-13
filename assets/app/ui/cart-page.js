// Cart page: rows from the captured row template, quantity/remove/clear, totals, free-shipping
// message, terms consent gate. Re-renders on cmm:cart and cmm:settings.
import { getSettings } from '../settings.js';
import { getCart, setQuantity, removeLine, clearCart, cartSubtotalJpy, validateCart } from '../cart.js';
import { FREE_SHIPPING_THRESHOLD_JPY } from '../shipping.js';
import { baseOf, setPrice, currentMoney } from './format.js';

export function mountCart(root, { strings, rates, base } = {}) {
  const page = root.querySelector('[data-cmm-cart]');
  if (!page) return;
  const win = root.defaultView ?? globalThis;
  const b = base ?? baseOf(root);
  const footer = root.querySelector('#main-cart-footer');
  const body = page.querySelector('[data-cmm-cart-lines]');
  const tpl = page.querySelector('template[data-cmm-cart-row]');
  const warnings = page.querySelector('.cart__warnings');
  const terms = root.querySelector('[data-cmm-terms]');
  const button = root.querySelector('[data-cmm-checkout-button]');
  const errorsBox = root.querySelector('[data-cmm-cart-errors]');
  const freeMsg = root.querySelector('[data-cmm-free-shipping]');

  function render() {
    const lines = getCart();
    const { mode } = getSettings();
    const issues = new Map(validateCart(lines, mode).map((i) => [i.variantId, i]));
    const empty = lines.length === 0;
    page.classList.toggle('is-empty', empty);
    footer?.classList.toggle('is-empty', empty);
    if (warnings) warnings.hidden = !empty;
    body.textContent = '';
    for (const line of lines) {
      const row = tpl.content.firstElementChild.cloneNode(true);
      const link = row.querySelector('[data-cmm-item-link]');
      link.href = `${b}products/${line.productHandle}/`;
      link.textContent = line.productTitle;
      const img = row.querySelector('[data-cmm-item-image]');
      img.src = line.imageSrc || b + 'assets/app/noimage.svg';
      img.alt = line.productTitle;
      setPrice(row.querySelector('[data-cmm-item-price]'), line.priceJpy, rates);
      for (const t of row.querySelectorAll('[data-cmm-item-total]')) setPrice(t, line.priceJpy * line.quantity, rates);
      const opts = row.querySelector('[data-cmm-item-options]');
      if (line.variantTitle) {
        const d = root.createElement('div');
        d.className = 'product-option';
        const dd = root.createElement('dd');
        dd.textContent = line.variantTitle;
        d.append(dd);
        opts.append(d);
      }
      const input = row.querySelector('[data-cmm-qty-input]');
      input.value = String(line.quantity);
      input.addEventListener('change', () => setQuantity(line.variantId, input.value));
      row.querySelector('[data-cmm-qty-minus]').addEventListener('click', () => setQuantity(line.variantId, line.quantity - 1));
      row.querySelector('[data-cmm-qty-plus]').addEventListener('click', () => setQuantity(line.variantId, line.quantity + 1));
      row.querySelector('[data-cmm-remove]').addEventListener('click', () => removeLine(line.variantId));
      const issue = issues.get(line.variantId);
      const err = row.querySelector('[data-cmm-item-error]');
      if (issue) err.textContent = issue.reason === 'limit' ? strings['cart.limit'].replace('{limit}', String(issue.limit)) : strings['cart.soldout'];
      body.append(row);
    }
    const subtotal = cartSubtotalJpy(lines);
    setPrice(root.querySelector('[data-cmm-cart-subtotal]'), subtotal, rates);
    if (freeMsg) {
      const rest = FREE_SHIPPING_THRESHOLD_JPY - subtotal;
      freeMsg.textContent = empty ? '' : rest > 0
        ? strings['cart.freeShippingRemaining'].replace('{amount}', currentMoney(rest, rates))
        : strings['cart.freeShippingReached'];
    }
    const blocked = issues.size > 0;
    if (errorsBox) errorsBox.textContent = blocked ? strings['checkout.blocked'] : '';
    if (button) button.disabled = empty || blocked || !terms?.checked;
  }

  terms?.addEventListener('change', render);
  root.querySelector('[data-cmm-cart-clear]')?.addEventListener('click', () => clearCart());
  // The captured form action is root-relative (/checkout); go through base instead.
  root.querySelector('form#cart')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!button?.disabled) win.location.assign(b + 'checkout/');
  });
  win.addEventListener('cmm:cart', render);
  win.addEventListener('cmm:settings', render);
  render();
}
