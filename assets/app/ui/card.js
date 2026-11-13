// Product card markup, copied from the theme's collection grid card
// (theme/raw/collection.html, `#product-grid > li.grid__item`), trimmed of
// Shopify ids/scripts. Pure function: usable in the browser and in Node.
// Labels come from the strings table (src/strings/ja.json): cart.soldout, card.wishlistAdd.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const yen = (n) => '¥' + Math.round(Number(n) || 0).toLocaleString('en-US');

export function imageUrl(src, width) {
  if (!src) return src;
  return src + (src.includes('?') ? '&' : '?') + 'width=' + width;
}

const WIDTHS = [165, 360, 533, 720];
const SIZES = '(min-width: 1400px) 282px, (min-width: 1000px) calc((100vw - 10rem - 36px) / 4), '
  + '(min-width: 841px) calc((100vw - 10rem - 24px) / 3), (min-width: 768px) calc((100vw - 3rem - 24px) / 3), '
  + 'calc((100vw - 3rem - 12px) / 2)';

const HEART = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" class="gw-wl-icon" width="20" height="20" viewBox="0 0 24 24" role="presentation">'
  + '<path d="M11.4807 6.1862L12 6.68455L12.5193 6.1862C13.447 5.29596 14.7044 4.75 16.0909 4.75C18.9402 4.75 21.25 7.0598 21.25 9.90909C21.25 12.5032 19.8356 14.5608 18.0169 16.1398C16.1975 17.7194 14.0516 18.7475 12.7931 19.2652C12.2797 19.4764 11.7203 19.4764 11.2069 19.2652C9.9484 18.7475 7.80251 17.7194 5.98314 16.1398C4.16437 14.5609 2.75 12.5032 2.75 9.90909C2.75 7.0598 5.0598 4.75 7.90909 4.75C9.2956 4.75 10.553 5.29596 11.4807 6.1862Z" stroke="currentColor" stroke-width="1.5"></path></svg>';

// The real store tags not-yet-released products 販売開始前 and shows that tag as a badge on the card
// (theme/raw/collection.html: .badge--before-the-launch). The badge text is the captured theme copy.
const BEFORE_LAUNCH_TAG = '販売開始前';
const BADGE_SCHEME = 'color-scheme-c7fed183-40e4-4124-ba9a-f6fff47fa42a';

export function isSoldOutShown(card, mode) {
  return mode === 'real' && (!card.available || !!card.removed);
}

function priceHtml(card, soldOut) {
  const price = card.priceJpy;
  const onSale = card.compareAtJpy != null && price != null && card.compareAtJpy > price;
  const amount = (jpy) => (jpy == null ? '' : `<span data-cmm-price-jpy="${escapeHtml(jpy)}">${yen(jpy)}</span><span class="tax">(税込)</span>`);
  return `<div class="price${onSale ? ' price--on-sale' : ''}${soldOut ? ' price--sold-out' : ''}"><div class="price__container">`
    + `<div class="price__regular"><span class="visually-hidden visually-hidden--inline">通常価格</span>`
    + `<span class="price-item price-item--regular">${amount(price)}</span></div>`
    + `<div class="price__sale"><span class="visually-hidden visually-hidden--inline">通常価格</span>`
    + `<span><s class="price-item price-item--regular">${onSale ? amount(card.compareAtJpy) : ''}</s></span>`
    + `<span class="visually-hidden visually-hidden--inline">セール価格</span>`
    + `<span class="price-item price-item--sale price-item--last">${amount(price)}</span></div>`
    + `</div></div>`;
}

export function productCardHtml(card, { base = '/', mode = 'infinite', strings } = {}) {
  const b = base.endsWith('/') ? base : base + '/';
  const href = escapeHtml(`${b}products/${card.handle}`);
  const title = escapeHtml(card.title);
  const soldOut = isSoldOutShown(card, mode);
  const beforeLaunch = mode === 'real' && (card.tags ?? []).includes(BEFORE_LAUNCH_TAG);
  let badge = '';
  if (beforeLaunch) badge = `<span class="badge badge--bottom-left badge--before-the-launch ${BADGE_SCHEME}">${escapeHtml(BEFORE_LAUNCH_TAG)}</span>`;
  else if (soldOut) badge = `<span class="badge badge--bottom-left ${BADGE_SCHEME} cmm-soldout">${escapeHtml(strings['cart.soldout'])}</span>`;
  const img = card.image
    ? `<img src="${escapeHtml(imageUrl(card.image, 533))}" srcset="${escapeHtml(WIDTHS.map((w) => `${imageUrl(card.image, w)} ${w}w`).join(','))}" sizes="${SIZES}" alt="${title}" class="motion-reduce" loading="lazy" width="1200" height="1200">`
    : `<img src="${escapeHtml(b + 'assets/app/noimage.svg')}" alt="${title}" class="motion-reduce" loading="lazy" width="1200" height="1200">`;

  return `<li class="grid__item">`
    + `<div class="card-wrapper product-card-wrapper underline-links-hover" style="position: relative;">`
    + `<div class="card card--standard card--media" style="--ratio-percent: 100%;">`
    + `<div class="card__inner color-scheme-2 gradient ratio" style="--ratio-percent: 100%;">`
    + `<div class="card__media"><div class="media media--transparent media--hover-effect">${img}</div></div>`
    + `<div class="card__content"><div class="card__information"><h3 class="card__heading">`
    + `<a href="${href}" class="full-unstyled-link" tabindex="-1">${title}</a></h3></div>`
    + `<div class="card__badge top left">${badge}</div></div>`
    + `</div>`
    + `<div class="card__content"><div class="card__information">`
    + `<h3 class="card__heading h5"><a href="${href}" class="full-unstyled-link">${title}</a></h3>`
    + `<div class="card-information"><span class="caption-large light"></span>${priceHtml(card, soldOut)}</div>`
    + `</div><div class="card__badge top left">${badge}</div></div>`
    + `</div>`
    + `<div class="gw-add-to-wishlist-product-card-placeholder"><button type="button" class="gw-toggle-wishlist-product-card-button svelte-znbnxb" data-in-wishlist="false" aria-label="${escapeHtml(strings['card.wishlistAdd'])}" data-cmm-wishlist-toggle="${escapeHtml(card.handle)}">${HEART}</button></div>`
    + `</div></li>`;
}
