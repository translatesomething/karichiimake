// Mock checkout. No personal info is collected: the address is always the fixed DUMMY_CHECKOUT sample
// (fields are disabled) and the payment method is only a label on the order.
import { getSettings } from '../settings.js';
import { getCart, clearCart, cartSubtotalJpy, validateCart } from '../cart.js';
import { shippingFeeJpy } from '../shipping.js';
import { placeOrder } from '../orders.js';
import { DUMMY_CHECKOUT } from '../dummy.js';
import { baseOf, setPrice, fillLines } from './format.js';

const ADDRESS_FIELDS = ['email', 'lastName', 'firstName', 'postal', 'prefecture', 'city', 'address1', 'address2', 'phone'];
const CREDIT_CARD = 'クレジットカード';

const paymentOf = (form) => form.querySelector('input[name="paymentMethod"]:checked')?.value ?? CREDIT_CARD;

const sampleAddress = () => Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, DUMMY_CHECKOUT[k] ?? '']));

export function submitCheckout(form, { now = new Date(), strings = {}, navigate, base } = {}) {
  const doc = form.ownerDocument;
  const msg = (k) => strings[k] ?? k;
  const paymentMethod = paymentOf(form);
  const address = sampleAddress();
  const { mode } = getSettings();
  const lines = getCart();
  if (lines.length === 0) return { ok: false, errors: [{ field: 'cart', message: msg('cart.empty') }] };
  if (validateCart(lines, mode).length > 0) {
    return { ok: false, errors: [{ field: 'cart', message: msg('checkout.blocked') }] };
  }
  const shippingJpy = shippingFeeJpy(cartSubtotalJpy(lines), address.prefecture) ?? 0;
  const order = placeOrder({ lines, shippingJpy, paymentMethod, shippingAddress: address, mode, now });
  clearCart();
  const b = base ?? baseOf(doc);
  const url = `${b}thanks/?order=${encodeURIComponent(order.id)}`;
  (navigate ?? ((u) => doc.defaultView.location.assign(u)))(url);
  return { ok: true, order };
}

function showErrors(form, errors) {
  const box = form.querySelector('[data-cmm-checkout-errors]');
  if (box) box.textContent = errors.map((e) => e.message).join(' ');
}

export function mountCheckout(root, { strings, rates, base, navigate } = {}) {
  const form = root.querySelector('form[data-cmm-checkout]');
  if (!form) return;
  const win = root.defaultView ?? globalThis;
  const b = base ?? baseOf(root);
  const go = navigate ?? ((u) => win.location.assign(u));

  const lines = getCart();
  if (lines.length === 0) { go(b + 'cart/'); return; }

  const tpl = form.querySelector('template[data-cmm-checkout-line]');
  const list = form.querySelector('[data-cmm-checkout-lines]');
  if (tpl && list) fillLines(list, tpl, lines, rates, b);
  const subtotal = cartSubtotalJpy(lines);

  const renderTotals = () => {
    const fee = shippingFeeJpy(subtotal, DUMMY_CHECKOUT.prefecture) ?? 0;
    setPrice(form.querySelector('[data-cmm-checkout-subtotal]'), subtotal, rates);
    const shipEl = form.querySelector('[data-cmm-checkout-shipping]');
    const totalEl = form.querySelector('[data-cmm-checkout-total]');
    const feeEl = form.querySelector('[data-cmm-shipping-fee]');
    if (fee === 0) {
      shipEl.removeAttribute('data-cmm-price-jpy');
      shipEl.textContent = strings['checkout.free'];
      if (feeEl) { feeEl.removeAttribute('data-cmm-price-jpy'); feeEl.textContent = strings['checkout.free']; }
    } else {
      setPrice(shipEl, fee, rates);
      setPrice(feeEl, fee, rates);
    }
    setPrice(totalEl, subtotal + fee, rates);
  };
  renderTotals();
  win.addEventListener('cmm:settings', renderTotals);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'paymentMethod') syncPayment();
  });

  function syncPayment() {
    for (const r of form.querySelectorAll('input[name="paymentMethod"]')) {
      r.closest('.cmm-co-option')?.classList.toggle('is-selected', r.checked);
    }
  }
  syncPayment();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = submitCheckout(form, { strings, base: b, navigate: go });
    showErrors(form, r.ok ? [] : r.errors);
  });
}
