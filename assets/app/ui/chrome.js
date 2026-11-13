// Shared chrome behaviour: currency picker, cart count, add-to-cart drawer, FAQ accordion.
import { getSettings, setSettings } from '../settings.js';
import { COUNTRIES } from '../countries.js';
import { hasRate } from '../currency.js';
import { getCart, cartCount } from '../cart.js';

const CHECK = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" class="icon icon-checkmark" viewBox="0 0 12 9"><path fill="currentColor" fill-rule="evenodd" d="M11.35.643a.5.5 0 0 1 .006.707l-6.77 6.886a.5.5 0 0 1-.719-.006L.638 4.845a.5.5 0 1 1 .724-.69l2.872 3.011 6.41-6.517a.5.5 0 0 1 .707-.006z" clip-rule="evenodd"></path></svg>';
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const labelOf = (c) => `${c.name} | ${c.currency} ${c.symbol}`.trim();

// Footer 国/地域 picker, mirroring the real widget: every country whose currency has a rate (plus JPY).
export function mountCurrencyPicker(host, { strings, rates } = {}) {
  if (!host) return;
  const heading = host.querySelector('h2')?.outerHTML ?? '';
  const caret = host.querySelector('button svg')?.outerHTML ?? '';
  const countries = COUNTRIES.filter((c) => hasRate(c.currency, rates));
  const opts = countries.map((c) => `<li class="disclosure__item" tabindex="-1"><a class="link link--text disclosure__link caption-large focus-inset" href="#" data-value="${esc(c.code)}" data-search="${esc((c.name + ' ' + c.currency + ' ' + c.code).toLowerCase())}">`
    + `<span class="visibility-hidden">${CHECK}</span> <span class="country">${esc(c.name)}</span> <span class="localization-form__currency motion-reduce">${esc(c.currency)} ${esc(c.symbol)}</span></a></li>`).join('');
  const search = strings?.['currency.search'] ?? '';
  host.innerHTML = `<form class="localization-form" onsubmit="return false"><div>${heading}<div class="disclosure">`
    + `<button type="button" class="disclosure__button localization-form__select localization-selector link link--text caption-large" aria-expanded="false" data-cmm-currency-button><span></span>${caret}</button>`
    + `<div class="disclosure__list-wrapper country-selector" hidden><div class="country-filter"><div class="field"><input class="country-filter__input field__input" type="search" placeholder="${esc(search)}" aria-label="${esc(search)}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>`
    + `<button class="country-selector__close-button button--small link" type="button" aria-label="${esc(strings?.['currency.close'] ?? '')}">×</button></div>`
    + `<div class="disclosure__list country-selector__list"><ul class="list-unstyled countries">${opts}</ul></div></div><div class="country-selector__overlay"></div>`
    + `</div></div></form>`;
  const button = host.querySelector('[data-cmm-currency-button]');
  const list = host.querySelector('.disclosure__list-wrapper');
  const input = host.querySelector('input[type=search]');
  const links = [...host.querySelectorAll('.disclosure__link')];
  const close = () => { list.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    for (const a of links) a.closest('li').hidden = q !== '' && !a.dataset.search.includes(q);
  };
  for (const a of links) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const c = COUNTRIES.find((x) => x.code === a.dataset.value);
      setSettings({ currency: c.currency, country: c.code });
      close();
    });
  }
  input.addEventListener('input', filter);
  host.querySelector('.country-selector__close-button').addEventListener('click', close);
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); button.focus(); } });
  button.addEventListener('click', () => {
    list.hidden = !list.hidden;
    button.setAttribute('aria-expanded', String(!list.hidden));
    if (!list.hidden) input.focus();
  });
  host.ownerDocument.addEventListener('click', (e) => { if (!host.contains(e.target)) close(); });
  const sync = () => {
    const s = getSettings();
    // A stored currency without a rate is priced in yen, so the label shows the Japan / JPY state.
    const usable = hasRate(s.currency, rates);
    const cur = (usable && (COUNTRIES.find((c) => c.code === s.country && c.currency === s.currency)
      ?? COUNTRIES.find((c) => c.currency === s.currency)))
      || COUNTRIES.find((c) => c.code === 'JP');
    button.querySelector('span').textContent = labelOf(cur);
    for (const a of links) {
      const on = a.dataset.value === cur.code;
      a.setAttribute('aria-current', String(on));
      a.firstElementChild.classList.toggle('visibility-hidden', !on);
    }
  };
  host.ownerDocument.defaultView.addEventListener('cmm:settings', sync);
  sync();
}

export function renderCartCount(root, strings) {
  const n = cartCount(getCart());
  for (const el of root.querySelectorAll('[data-cmm-cart-count]')) {
    el.hidden = n === 0;
    const num = el.querySelector('span[aria-hidden]');
    if (num) num.textContent = String(n);
    const label = el.querySelector('[data-cmm-cart-count-label]');
    if (label) label.textContent = strings['cart.countLabel'].replace('{count}', String(n));
  }
  for (const el of root.querySelectorAll('[data-cmm-cart-count-text]')) el.textContent = String(n);
}

export function openCartDrawer(root, line, base) {
  const drawer = root.querySelector('[data-cmm-cart-drawer]');
  if (!drawer || !line) return;
  const box = drawer.querySelector('[data-cmm-cart-drawer-product]');
  const tpl = drawer.querySelector('template[data-cmm-cart-drawer-item]');
  if (box && tpl) {
    box.textContent = '';
    box.appendChild(tpl.content.cloneNode(true));
    const img = box.querySelector('[data-cmm-item-image]');
    if (img) {
      img.src = line.imageSrc || base + 'assets/app/noimage.svg';
      img.alt = line.productTitle;
    }
    const title = box.querySelector('[data-cmm-item-title]');
    if (title) title.textContent = line.productTitle;
    const opts = box.querySelector('[data-cmm-item-options]');
    if (opts && line.variantTitle) {
      const d = root.createElement('div');
      d.className = 'product-option';
      const dd = root.createElement('dd');
      dd.textContent = line.variantTitle;
      d.appendChild(dd);
      opts.appendChild(d);
    }
  }
  const note = drawer.querySelector('#cart-notification');
  note?.classList.add('animate', 'active');
  note?.focus({ preventScroll: true });
}

export function closeCartDrawer(root) {
  root.querySelector('#cart-notification')?.classList.remove('animate', 'active');
}

// FAQ: <dt class="toggle"> opens/closes the following <dd class="target"> (hidden by max-height + inert).
export function mountFaq(root) {
  const toggle = (dt) => {
    const dd = dt.nextElementSibling;
    if (!dd) return;
    const open = !dt.classList.contains('active');
    dt.classList.toggle('active', open);
    if (open) dd.removeAttribute("inert");
    else dd.setAttribute("inert", "");
    dd.style.maxHeight = open ? dd.scrollHeight + 'px' : '0px';
  };
  for (const dt of root.querySelectorAll('.faq_list > dt.toggle')) {
    dt.setAttribute('role', 'button');
    dt.setAttribute('aria-expanded', 'false');
    dt.addEventListener('click', () => { toggle(dt); dt.setAttribute('aria-expanded', String(dt.classList.contains('active'))); });
    dt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dt.click(); }
    });
  }
}
