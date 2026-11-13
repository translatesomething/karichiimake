// Product page: variant picker, price, add-to-cart (with the real-mode rules), recently viewed.
import { loadList, save } from '../storage.js';
import { getSettings } from '../settings.js';
import { addToCart, getCart } from '../cart.js';
import { MAX_LINE_QTY, canAdd } from '../rules.js';

const RECENT_MAX = 20;

export function variantFor(product, selectedOptions) {
  return (product.variants ?? []).find((v) => v.options.length === selectedOptions.length
    && v.options.every((o, i) => o === selectedOptions[i])) ?? null;
}

export function addRecent(handle) {
  const list = loadList('recent', (h) => typeof h === 'string');
  const next = [handle, ...list.filter((h) => h !== handle)].slice(0, RECENT_MAX);
  save('recent', next);
  return next;
}

export function mountProduct(root = document, { strings }) {
  const host = root.querySelector('[data-cmm-product]');
  const json = root.querySelector('#cmm-product-json');
  if (!host || !json) return null;
  const product = JSON.parse(json.textContent);
  addRecent(product.handle);

  const form = host.querySelector('[data-cmm-add-form]');
  const button = host.querySelector('[data-cmm-add]');
  const idInput = host.querySelector('.product-variant-id');
  const errorEl = host.querySelector('[data-cmm-product-error]');
  const errorWrap = host.querySelector('.product-form__error-message-wrapper');
  const select = host.querySelector('#product-form--quantity');
  const radios = [...host.querySelectorAll('[data-cmm-option]')];
  const label = button?.querySelector('span') ?? button;
  const addLabel = label?.textContent ?? '';

  // Quantity dropdown (both modes). real: 1..purchaseLimit (else 10); infinite: 1..max(10, purchaseLimit), never fewer than real.
  const qtyMax = () => {
    const limit = product.purchaseLimit ?? 0;
    return mode() === 'real' ? (limit || 10) : Math.max(10, limit);
  };
  const buildQtyOptions = () => {
    if (!select) return;
    const max = qtyMax();
    const prev = Math.floor(Number(select.value));
    select.replaceChildren(...Array.from({ length: max }, (_, i) => {
      const o = (host.ownerDocument || document).createElement('option');
      o.value = o.textContent = String(i + 1);
      return o;
    }));
    select.value = String(prev >= 1 && prev <= max ? prev : 1);
  };

  const selectedOptions = () => {
    if (radios.length) {
      const picks = [];
      for (const r of radios) if (r.checked) picks[Number(r.getAttribute('data-cmm-option'))] = r.value;
      return picks;
    }
    const v = product.variants.find((x) => String(x.id) === idInput?.value) ?? product.variants[0];
    return v ? v.options : [];
  };
  const current = () => variantFor(product, selectedOptions());
  const mode = () => getSettings().mode;
  const isSoldOut = (v) => mode() === 'real' && (!v || !v.available || !!product.removed);

  const setPrice = (el, jpy) => {
    el.setAttribute('data-cmm-price-jpy', jpy == null ? '' : String(jpy));
    if (jpy == null) el.textContent = '';
  };

  const update = () => {
    const v = current();
    if (idInput) idInput.value = v ? String(v.id) : '';
    if (v) {
      const onSale = v.compareAtJpy != null && v.compareAtJpy > v.priceJpy;
      for (const el of host.querySelectorAll('[data-cmm-price-jpy]')) {
        setPrice(el, el.hasAttribute('data-cmm-compare-at') ? (onSale ? v.compareAtJpy : null) : v.priceJpy);
      }
      host.querySelectorAll('.price').forEach((p) => p.classList.toggle('price--on-sale', onSale));
    }
    const soldOut = isSoldOut(v) || !v;
    host.querySelectorAll('.price').forEach((p) => p.classList.toggle('price--sold-out', !v || (mode() === 'real' && !v.available)));
    if (button) {
      button.disabled = soldOut;
      if (label) label.textContent = soldOut ? strings['cart.soldout'] : addLabel;
    }
    buildQtyOptions();
    window.dispatchEvent(new CustomEvent('cmm:render'));
  };

  const qty = () => {
    const n = Math.floor(Number(select?.value));
    return Number.isFinite(n) && n >= 1 ? Math.min(MAX_LINE_QTY, n) : 1;
  };
  const showError = (msg) => {
    if (errorEl) errorEl.textContent = msg;
    if (errorWrap) errorWrap.hidden = !msg;
  };

  radios.forEach((r) => r.addEventListener('change', update));
  window.addEventListener('cmm:settings', update);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = current();
    if (!v) return;
    const addQty = qty();
    const inCart = getCart().find((l) => l.variantId === String(v.id))?.quantity ?? 0;
    const item = { available: v.available, removed: !!product.removed, purchaseLimit: product.purchaseLimit ?? null };
    const r = canAdd(item, { mode: mode(), qtyInCart: inCart, addQty });
    if (!r.ok) {
      showError(r.reason === 'limit' ? strings['cart.limit'].replace('{limit}', r.limit) : strings['cart.soldout']);
      return;
    }
    showError('');
    const lines = addToCart({
      variantId: String(v.id),
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: v.title && v.title !== 'Default Title' ? v.title : null,
      imageSrc: v.imageSrc || product.images?.[0]?.src || null,
      priceJpy: v.priceJpy,
      available: !!v.available,
      removed: !!product.removed,
      purchaseLimit: product.purchaseLimit ?? null,
    }, addQty);
    window.dispatchEvent(new CustomEvent('cmm:added', { detail: lines.find((l) => l.variantId === String(v.id)) }));
  });

  update();
  return { update };
}
