// Small helpers shared by the cart, checkout, thanks and account modules.
import { getSettings } from '../settings.js';
import { formatMoney } from '../currency.js';

export function money(jpy, currency, rates) {
  const c = currency !== 'JPY' && !rates ? 'JPY' : currency;
  return formatMoney(jpy, c, rates);
}

export function currentMoney(jpy, rates) {
  return money(jpy, getSettings().currency, rates);
}

// Sets text and the data attribute that boot's renderPrices re-renders on currency change.
export function setPrice(el, jpy, rates) {
  if (!el) return;
  el.setAttribute('data-cmm-price-jpy', String(jpy));
  el.textContent = currentMoney(jpy, rates);
}

export function baseOf(root) {
  let b = root.querySelector('meta[name="cmm-base"]')?.content ?? '/';
  if (!b.endsWith('/')) b += '/';
  return b;
}

export function formatAddress(a) {
  if (!a) return '';
  const lines = [
    a.postal ? '〒' + a.postal : '',
    [a.prefecture, a.city, a.address1, a.address2].filter(Boolean).join(' '),
    [a.lastName, a.firstName].filter(Boolean).join(' '),
    a.phone ?? '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function fillLines(listEl, tpl, lines, rates, base) {
  listEl.textContent = '';
  for (const l of lines) {
    const row = tpl.content.firstElementChild.cloneNode(true);
    const img = row.querySelector('[data-cmm-item-image]');
    if (img) { img.src = l.imageSrc || base + 'assets/app/noimage.svg'; img.alt = l.productTitle; }
    const set = (sel, text) => { const e = row.querySelector(sel); if (e) e.textContent = text; };
    set('[data-cmm-item-qty]', String(l.quantity));
    set('[data-cmm-item-title]', l.productTitle);
    set('[data-cmm-item-variant]', l.variantTitle ?? '');
    setPrice(row.querySelector('[data-cmm-item-total]'), l.priceJpy * l.quantity, rates);
    listEl.append(row);
  }
}
