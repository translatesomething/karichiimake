export const MAX_LINE_QTY = 9999;

export function canAdd(item, { mode, qtyInCart, addQty }) {
  if (mode !== 'real') return { ok: true };
  if (!item.available || item.removed) return { ok: false, reason: 'soldout' };
  const limit = item.purchaseLimit;
  if (typeof limit === 'number' && qtyInCart + addQty > limit) {
    return { ok: false, reason: 'limit', limit };
  }
  return { ok: true };
}
