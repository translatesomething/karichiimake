import { loadList, isCartLine, save } from './storage.js';
import { MAX_LINE_QTY, canAdd } from './rules.js';

const clamp = (q) => {
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_LINE_QTY, Math.max(1, n));
};

export function getCart() {
  return loadList('cart', isCartLine);
}

function commit(lines) {
  save('cart', lines);
  window.dispatchEvent(new CustomEvent('cmm:cart', { detail: lines }));
  return lines;
}

export function addToCart(snapshot, qty) {
  const lines = getCart();
  const i = lines.findIndex((l) => l.variantId === snapshot.variantId);
  if (i >= 0) {
    lines[i] = { ...lines[i], ...snapshot, quantity: clamp(lines[i].quantity + clamp(qty)) };
  } else {
    lines.push({ ...snapshot, quantity: clamp(qty) });
  }
  return commit(lines);
}

export function setQuantity(variantId, qty) {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n <= 0) return removeLine(variantId);
  return commit(getCart().map((l) => (l.variantId === variantId ? { ...l, quantity: clamp(n) } : l)));
}

export function removeLine(variantId) {
  return commit(getCart().filter((l) => l.variantId !== variantId));
}

export function clearCart() {
  return commit([]);
}

export function cartCount(lines) {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export function cartSubtotalJpy(lines) {
  return lines.reduce((s, l) => s + l.priceJpy * l.quantity, 0);
}

export function validateCart(lines, mode) {
  const issues = [];
  for (const l of lines) {
    const r = canAdd(l, { mode, qtyInCart: 0, addQty: l.quantity });
    if (!r.ok) {
      const issue = { variantId: l.variantId, reason: r.reason };
      if (r.limit !== undefined) issue.limit = r.limit;
      issues.push(issue);
    }
  }
  return issues;
}
