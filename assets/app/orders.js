import { loadList, isOrder, save } from './storage.js';
import { setSettings } from './settings.js';
import { cartSubtotalJpy } from './cart.js';

function stored() {
  return loadList('orders', isOrder);
}

function nextName(orders) {
  let max = 1000;
  for (const o of orders) {
    const n = parseInt(String(o?.name ?? '').replace(/^#/, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return '#' + (max + 1);
}

export function placeOrder({ lines, shippingJpy, paymentMethod, shippingAddress, mode, now = new Date() }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('empty order');
  const orders = stored();
  const subtotalJpy = cartSubtotalJpy(lines);
  const ship = shippingJpy ?? 0;
  const order = {
    id: globalThis.crypto.randomUUID(),
    name: nextName(orders),
    createdAt: now.toISOString(),
    lines: lines.map((l) => ({ ...l })),
    subtotalJpy,
    shippingJpy: ship,
    totalJpy: subtotalJpy + ship,
    paymentMethod,
    shippingAddress: shippingAddress ?? null,
    mode,
  };
  save('orders', [...orders, order]);
  return order;
}

export function listOrders() {
  return stored().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .sort((a, b) => (a.createdAt === b.createdAt ? (parseInt(String(b.name ?? '').slice(1), 10) || 0) - (parseInt(String(a.name ?? '').slice(1), 10) || 0) : 0));
}

export function getOrder(id) {
  return stored().find((o) => o.id === id) ?? null;
}

export function wastedTotalJpy(orders, resetAt) {
  return orders
    .filter((o) => !resetAt || o.createdAt >= resetAt)
    .reduce((s, o) => s + o.subtotalJpy, 0);
}

export function clearOrders() {
  save('orders', []);
}

export function resetWastedTotal(now = new Date()) {
  return setSettings({ resetAt: now.toISOString() });
}
