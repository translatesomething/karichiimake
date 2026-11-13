// Shared boot for every page: mode attribute, currency prices, cart count, settings panel,
// currency picker, page modules by mount point. Re-renders on cmm:settings / cmm:cart.
import { getSettings } from '../settings.js';
import { formatMoney, getRates } from '../currency.js';
import { toggleWishlist, syncWishlistButtons, mountListings } from './listing.js';
import { mountProduct } from './product.js';
import { mountGallery } from './gallery.js';
import { mountCart } from './cart-page.js';
import { mountCheckout } from './checkout.js';
import { mountThanks } from './thanks.js';
import { mountAccount, mountOrder } from './account.js';
import { mountSettingsPanel } from './settings-panel.js';
import { mountCurrencyPicker, renderCartCount, openCartDrawer, closeCartDrawer, mountFaq } from './chrome.js';

const state = { strings: {}, rates: null, base: '/', listings: null, lastMode: null, wired: false };

// One failing step must not stop the rest of the page from mounting.
function safe(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[boot] ${label} failed`, err);
    return undefined;
  }
}

export function renderPrices(root = document) {
  const { currency } = getSettings();
  for (const el of root.querySelectorAll('[data-cmm-price-jpy]')) {
    const v = el.getAttribute('data-cmm-price-jpy');
    const n = Number(v);
    if (v === '' || !Number.isFinite(n)) { el.textContent = ''; continue; }
    if (currency !== 'JPY' && !state.rates) continue;
    el.textContent = formatMoney(n, currency, state.rates);
  }
}

function apply() {
  const { mode } = getSettings();
  document.documentElement.dataset.cmmMode = mode;
  safe('renderPrices', () => renderPrices(document));
  safe('renderCartCount', () => renderCartCount(document, state.strings));
  if (state.lastMode !== null && state.lastMode !== mode) safe('listings.rerender', () => state.listings?.rerender());
  state.lastMode = mode;
}

function wire() {
  if (state.wired) return;
  state.wired = true;
  window.addEventListener('cmm:settings', apply);
  window.addEventListener('cmm:cart', () => renderCartCount(document, state.strings));
  window.addEventListener('cmm:render', () => renderPrices(document));
  window.addEventListener('cmm:added', (e) => openCartDrawer(document, e.detail, state.base));
  window.addEventListener('cmm:wishlist', () => {
    syncWishlistButtons(document);
    state.listings?.rerender('wishlist');
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('[data-cmm-wishlist-toggle]');
    if (t) {
      e.preventDefault();
      toggleWishlist(t.getAttribute('data-cmm-wishlist-toggle'));
      window.dispatchEvent(new CustomEvent('cmm:wishlist'));
      return;
    }
    if (e.target.closest?.('[data-cmm-cart-drawer-close]')) closeCartDrawer(document);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCartDrawer(document); });
}

const LISTING_MOUNTS = '[data-cmm-grid],[data-cmm-collection],[data-cmm-search],[data-cmm-recent],[data-cmm-wishlist]';

export async function initBoot({ base, strings, rates, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  state.base = base ?? document.querySelector('meta[name="cmm-base"]')?.content ?? '/';
  if (!state.base.endsWith('/')) state.base += '/';
  state.strings = strings ?? await (await fetchImpl(state.base + 'assets/app/strings/ja.json')).json();
  state.lastMode = null;
  state.listings = null;
  wire();
  // The settings panel (backup restore) mounts first so a bad stored value can never lock the user out of it.
  safe('mountSettingsPanel', () => mountSettingsPanel(document.querySelector('[data-cmm-settings]'), { strings: state.strings }));
  apply();
  safe('mountFaq', () => mountFaq(document));
  safe('mountProduct', () => mountProduct(document, { strings: state.strings }));
  safe('mountGallery', () => mountGallery(document));
  safe('syncWishlistButtons', () => syncWishlistButtons(document));

  const ratesP = rates
    ? Promise.resolve(rates)
    : getRates({ fallbackUrl: state.base + 'data/rates.json' }).catch(() => null);
  const liteP = document.querySelector(LISTING_MOUNTS)
    ? fetchImpl(state.base + 'data/catalog-lite.json').then((r) => r.json()).catch((err) => { console.error(err); return null; })
    : null;

  state.rates = await ratesP;
  safe('renderPrices', () => renderPrices(document));
  // The picker lists only currencies that have a rate, so it mounts once rates are known.
  safe('mountCurrencyPicker', () => mountCurrencyPicker(document.querySelector('[data-cmm-currency]'), { strings: state.strings, rates: state.rates }));
  const ctx = { strings: state.strings, rates: state.rates, base: state.base };
  safe('mountCart', () => mountCart(document, ctx));
  safe('mountCheckout', () => mountCheckout(document, ctx));
  safe('mountThanks', () => mountThanks(document, ctx));
  safe('mountAccount', () => mountAccount(document, ctx));
  safe('mountOrder', () => mountOrder(document, ctx));
  safe('renderPrices', () => renderPrices(document));
  if (liteP) {
    const lite = await liteP;
    if (lite) {
      state.listings = safe('mountListings', () => mountListings({ lite, base: state.base, strings: state.strings })) ?? null;
      safe('renderPrices', () => renderPrices(document));
    }
  }
}

if (typeof document !== 'undefined' && document.querySelector('meta[name="cmm-base"]')) {
  initBoot().catch((err) => console.error(err));
}
