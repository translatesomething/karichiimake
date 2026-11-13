// Thank-you page (order summary) and the 無駄遣い modal.
import { getSettings } from '../settings.js';
import { getOrder, listOrders, wastedTotalJpy } from '../orders.js';
import { money, setPrice, baseOf, formatAddress, fillLines } from './format.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderWasted(el, { order, orders, settings, rates, strings, base }) {
  const b = base ?? baseOf(el.ownerDocument);
  const amount = money(order.subtotalJpy, settings.currency, rates);
  const total = money(wastedTotalJpy(orders, settings.resetAt), settings.currency, rates);
  el.innerHTML = '<div class="cmm-wasted__dialog" role="dialog" aria-modal="true">'
    + `<p class="cmm-wasted__headline">${esc(strings['wasted.headline'].replace('{amount}', amount))}</p>`
    + `<p class="cmm-wasted__total">${esc(strings['wasted.total'].replace('{total}', total))}</p>`
    + '<div class="cmm-wasted__actions">'
    + `<a class="button button--primary" href="${esc(b + 'account/order/?id=' + encodeURIComponent(order.id))}">${esc(strings['wasted.viewOrder'])}</a>`
    + `<a class="button button--secondary" href="${esc(b)}">${esc(strings['wasted.continue'])}</a>`
    + '</div></div>';
  el.hidden = false;
}

export function mountThanks(root, { strings, rates, base } = {}) {
  const page = root.querySelector('[data-cmm-thanks]');
  if (!page) return;
  const win = root.defaultView ?? globalThis;
  const b = base ?? baseOf(root);
  const id = new URLSearchParams(win.location.search).get('order');
  const order = id ? getOrder(id) : null;
  if (!order) return;
  const set = (sel, text) => { for (const e of page.querySelectorAll(sel)) e.textContent = text; };
  const a = order.shippingAddress;
  set('[data-cmm-order-name]', order.name);
  set('[data-cmm-customer-name]', a ? [a.lastName, a.firstName].filter(Boolean).join(' ') : '');
  set('[data-cmm-order-email]', a?.email ?? '');
  set('[data-cmm-order-payment]', order.paymentMethod ?? '');
  const addr = page.querySelector('[data-cmm-order-address]');
  if (addr) { addr.textContent = formatAddress(a); addr.style.whiteSpace = 'pre-line'; }
  const tpl = page.querySelector('template[data-cmm-checkout-line]');
  const list = page.querySelector('[data-cmm-checkout-lines]');
  if (tpl && list) fillLines(list, tpl, order.lines, rates, b);
  setPrice(page.querySelector('[data-cmm-checkout-subtotal]'), order.subtotalJpy, rates);
  const ship = page.querySelector('[data-cmm-checkout-shipping]');
  if (order.shippingJpy === 0) { ship.removeAttribute('data-cmm-price-jpy'); ship.textContent = strings['checkout.free']; } else setPrice(ship, order.shippingJpy, rates);
  setPrice(page.querySelector('[data-cmm-checkout-total]'), order.totalJpy, rates);

  const modal = root.querySelector('[data-cmm-wasted]');
  if (!modal) return;
  const draw = () => {
    const wasHidden = modal.hidden && modal.dataset.closed === '1';
    renderWasted(modal, { order, orders: listOrders(), settings: getSettings(), rates, strings, base: b });
    if (wasHidden) modal.hidden = true;
  };
  const close = () => { modal.hidden = true; modal.dataset.closed = '1'; };
  draw();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  win.addEventListener('cmm:settings', draw);
  modal.querySelector('a')?.focus();
}
