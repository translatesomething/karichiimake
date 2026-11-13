// Order history (/account/) and order detail (/account/order/?id=).
import { listOrders, getOrder } from '../orders.js';
import { baseOf, setPrice, formatAddress } from './format.js';

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
};

export function mountAccount(root, { strings, rates, base } = {}) {
  const page = root.querySelector('[data-cmm-account]');
  if (!page) return;
  const b = base ?? baseOf(root);
  const orders = listOrders();
  const table = page.querySelector('[data-cmm-account-table]');
  const empty = page.querySelector('[data-cmm-account-empty]');
  const rows = page.querySelector('[data-cmm-account-rows]');
  empty.hidden = orders.length > 0;
  table.hidden = orders.length === 0;
  rows.textContent = '';
  for (const o of orders) {
    const tr = root.createElement('tr');
    tr.setAttribute('role', 'row');
    const cell = (label) => { const td = root.createElement('td'); td.setAttribute('role', 'cell'); td.dataset.label = label; tr.append(td); return td; };
    const a = root.createElement('a');
    a.href = `${b}account/order/?id=${encodeURIComponent(o.id)}`;
    a.textContent = o.name;
    cell(strings['account.colOrder']).append(a);
    cell(strings['account.colDate']).textContent = fmtDate(o.createdAt);
    cell(strings['account.colPayment']).textContent = strings['account.paid'];
    cell(strings['account.colFulfillment']).textContent = strings['account.unfulfilled'];
    setPrice(cell(strings['account.colTotal']), o.totalJpy, rates);
    rows.append(tr);
  }
}

export function mountOrder(root, { strings, rates, base } = {}) {
  const page = root.querySelector('[data-cmm-order]');
  if (!page) return;
  const win = root.defaultView ?? globalThis;
  const b = base ?? baseOf(root);
  const id = new URLSearchParams(win.location.search).get('id');
  const order = id ? getOrder(id) : null;
  const table = page.querySelector('table.order-details');
  const missing = page.querySelector('[data-cmm-order-missing]');
  if (!order) {
    missing.hidden = false;
    table.hidden = true;
    page.querySelector('.address')?.closest('section')?.setAttribute('hidden', '');
    return;
  }
  for (const e of root.querySelectorAll('[data-cmm-order-name]')) e.textContent = order.name;
  page.querySelector('[data-cmm-order-date]').textContent = fmtDate(order.createdAt);
  const body = page.querySelector('[data-cmm-order-lines]');
  body.textContent = '';
  for (const l of Array.isArray(order.lines) ? order.lines : []) {
    const tr = root.createElement('tr');
    tr.setAttribute('role', 'row');
    const cell = () => { const td = root.createElement('td'); td.setAttribute('role', 'cell'); tr.append(td); return td; };
    const a = root.createElement('a');
    a.href = `${b}products/${l.productHandle}/`;
    a.textContent = l.productTitle;
    const first = cell();
    first.append(a);
    if (l.variantTitle) { const s = root.createElement('div'); s.textContent = l.variantTitle; first.append(s); }
    setPrice(cell(), l.priceJpy, rates);
    cell().textContent = String(l.quantity);
    setPrice(cell(), l.priceJpy * l.quantity, rates);
    body.append(tr);
  }
  setPrice(page.querySelector('[data-cmm-order-subtotal]'), order.subtotalJpy, rates);
  const ship = page.querySelector('[data-cmm-order-shipping]');
  if (order.shippingJpy === 0) { ship.textContent = strings['checkout.free']; } else setPrice(ship, order.shippingJpy, rates);
  setPrice(page.querySelector('[data-cmm-order-total]'), order.totalJpy, rates);
  const addr = page.querySelector('[data-cmm-order-address]');
  addr.textContent = formatAddress(order.shippingAddress);
  addr.style.whiteSpace = 'pre-line';
}
