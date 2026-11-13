// Listings: pure sorting/search/paging helpers, wishlist storage, and the DOM mounts
// (home grids, collection, search, recently viewed, wishlist) driven by catalog-lite.json.
import { loadList, save } from '../storage.js';
import { getSettings } from '../settings.js';
import { productCardHtml } from './card.js';

export const SORTS = ['manual', 'best-selling', 'title-ascending', 'title-descending', 'price-ascending', 'price-descending', 'created-ascending', 'created-descending'];

const time = (c) => Date.parse(c.publishedAt) || 0;
const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), 'ja');

export function sortCards(cards, sort) {
  const list = cards.slice();
  switch (sort) {
    case 'title-ascending': return list.sort(byTitle);
    case 'title-descending': return list.sort((a, b) => byTitle(b, a));
    case 'price-ascending': return list.sort((a, b) => (a.priceJpy ?? 0) - (b.priceJpy ?? 0));
    case 'price-descending': return list.sort((a, b) => (b.priceJpy ?? 0) - (a.priceJpy ?? 0));
    case 'created-ascending': return list.sort((a, b) => time(a) - time(b));
    case 'created-descending': return list.sort((a, b) => time(b) - time(a));
    default: return list; // manual and best-selling (no sales data offline) keep the collection order
  }
}

export function paginate(cards, page = 1, perPage) {
  if (!perPage) return { cards, totalPages: 1 };
  const totalPages = Math.max(1, Math.ceil(cards.length / perPage));
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  return { cards: cards.slice((p - 1) * perPage, p * perPage), totalPages };
}

export function collectionCards(lite, handle, { sort = 'manual', page = 1, perPage } = {}) {
  const col = lite.collections?.[handle];
  const cards = (col?.handles ?? []).map((h) => lite.products[h]).filter(Boolean);
  return paginate(sortCards(cards, sort), page, perPage);
}

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase();

export function searchCards(lite, query) {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const hits = [];
  for (const c of Object.values(lite.products)) {
    const title = norm(c.title);
    const hay = title + '\n' + (c.tags ?? []).map(norm).join('\n');
    if (!tokens.every((t) => hay.includes(t))) continue;
    hits.push({ c, inTitle: tokens.every((t) => title.includes(t)) });
  }
  hits.sort((a, b) => (b.inTitle - a.inTitle) || (time(b.c) - time(a.c)));
  return hits.map((h) => h.c);
}

export function getWishlist() {
  return loadList('wishlist', (h) => typeof h === 'string');
}

export function toggleWishlist(handle) {
  const list = getWishlist();
  const i = list.indexOf(handle);
  if (i >= 0) list.splice(i, 1); else list.unshift(handle);
  save('wishlist', list);
  return i < 0;
}

export function syncWishlistButtons(root = document) {
  const set = new Set(getWishlist());
  for (const b of root.querySelectorAll('[data-cmm-wishlist-toggle]')) {
    b.setAttribute('data-in-wishlist', String(set.has(b.getAttribute('data-cmm-wishlist-toggle'))));
  }
}

// ---- DOM ----

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function paginationHtml(page, totalPages, hrefFor, strings) {
  if (totalPages <= 1) return '';
  const nums = new Set([1, 2, 3, totalPages, page - 1, page, page + 1]);
  const shown = [...nums].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const caret = '<span class="svg-wrapper"><svg class="icon icon-caret" viewBox="0 0 10 6"><path fill="currentColor" fill-rule="evenodd" d="M9.354.646a.5.5 0 0 0-.708 0L5 4.293 1.354.646a.5.5 0 0 0-.708.708l4 4a.5.5 0 0 0 .708 0l4-4a.5.5 0 0 0 0-.708" clip-rule="evenodd"></path></svg></span>';
  const label = (n) => esc(strings['pagination.page'].replace('{n}', n));
  let items = '';
  let last = 0;
  for (const n of shown) {
    if (n - last > 1) items += '<li><span class="pagination__item">…</span></li>';
    items += n === page
      ? `<li><a role="link" aria-disabled="true" class="pagination__item pagination__item--current light" aria-current="page" aria-label="${label(n)}">${n}</a></li>`
      : `<li><a href="${esc(hrefFor(n))}" class="pagination__item link" aria-label="${label(n)}" data-page="${n}">${n}</a></li>`;
    last = n;
  }
  const arrow = (n, cls, key) => `<li><a href="${esc(hrefFor(n))}" class="pagination__item ${cls} pagination__item-arrow link motion-reduce" aria-label="${esc(strings[key])}" data-page="${n}">${caret}</a></li>`;
  const prev = page > 1 ? arrow(page - 1, 'pagination__item--next', 'pagination.prev') : '';
  const next = page < totalPages ? arrow(page + 1, 'pagination__item--prev', 'pagination.next') : '';
  return `<nav class="pagination" aria-label="ページネーション"><ul class="pagination__list list-unstyled">${prev}${items}${next}</ul></nav>`;
}

export function mountListings({ lite, base, strings, root = document }) {
  const cardOpts = () => ({ base, mode: getSettings().mode, strings });
  const cardsHtml = (cards) => cards.map((c) => productCardHtml(c, cardOpts())).join('');
  const finish = (el) => {
    syncWishlistButtons(el);
    window.dispatchEvent(new CustomEvent('cmm:render'));
  };
  const query = () => new URLSearchParams(location.search);
  const urlFor = (params) => {
    const s = params.toString();
    return location.pathname + (s ? '?' + s : '');
  };
  const counts = (n) => root.querySelectorAll('[data-cmm-product-count]').forEach((e) => { e.textContent = String(n); });

  const renderers = [];

  // Paged mounts (collection and search): URL <-> state, sort selects, pagination links.
  const paged = (ul, compute, validSort, defaultSort) => {
    const pagEl = root.querySelector('[data-cmm-pagination]');
    const perPage = Number(ul.getAttribute('data-per-page')) || undefined;
    const draw = () => {
      const q = query();
      const sort = validSort.includes(q.get('sort_by')) ? q.get('sort_by') : defaultSort;
      const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
      const { cards, total, totalPages } = compute(sort, page, perPage);
      ul.innerHTML = cardsHtml(cards);
      counts(total);
      root.querySelectorAll('[data-cmm-sort]').forEach((s) => { s.value = sort; });
      if (pagEl) {
        pagEl.innerHTML = paginationHtml(page, totalPages, (n) => {
          const p = query();
          if (n > 1) p.set('page', n); else p.delete('page');
          return urlFor(p);
        }, strings);
      }
      finish(ul);
    };
    const go = (params, scroll) => {
      history.pushState(null, '', urlFor(params));
      draw();
      if (scroll) ul.scrollIntoView({ block: 'start' });
    };
    root.querySelectorAll('[data-cmm-sort]').forEach((s) => s.addEventListener('change', () => {
      const p = query();
      p.set('sort_by', s.value);
      p.delete('page');
      go(p, false);
    }));
    pagEl?.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-page]');
      if (!a) return;
      e.preventDefault();
      const p = query();
      const n = Number(a.dataset.page);
      if (n > 1) p.set('page', n); else p.delete('page');
      go(p, true);
    });
    window.addEventListener('popstate', draw);
    renderers.push({ kind: 'paged', draw });
    draw();
  };

  const col = root.querySelector('[data-cmm-collection]');
  if (col) {
    const handle = col.getAttribute('data-cmm-collection');
    paged(col, (sort, page, perPage) => {
      const all = collectionCards(lite, handle, { sort });
      const r = collectionCards(lite, handle, { sort, page, perPage });
      return { cards: r.cards, totalPages: r.totalPages, total: all.cards.length };
    }, SORTS, 'manual');
  }

  const search = root.querySelector('[data-cmm-search]');
  if (search) {
    const q = query().get('q') ?? '';
    root.querySelectorAll('input[name="q"]').forEach((i) => { i.value = q; });
    paged(search, (sort, page, perPage) => {
      const found = sortCards(searchCards(lite, query().get('q') ?? ''), sort);
      const r = paginate(found, page, perPage);
      return { ...r, total: found.length };
    }, ['relevance', 'price-ascending', 'price-descending'], 'relevance');
  }

  for (const el of root.querySelectorAll('[data-cmm-grid]')) {
    const [kind, handle] = el.getAttribute('data-cmm-grid').split(':');
    const limit = Number(el.getAttribute('data-limit')) || 12;
    const draw = () => {
      if (kind !== 'collection') return;
      el.innerHTML = cardsHtml(collectionCards(lite, handle, { page: 1, perPage: limit }).cards);
      finish(el);
    };
    renderers.push({ kind: 'grid', draw });
    draw();
  }

  const recent = root.querySelector('[data-cmm-recent]');
  if (recent) {
    const limit = Number(recent.getAttribute('data-limit')) || 4;
    const self = recent.getAttribute('data-product-handle');
    const empty = recent.innerHTML;
    const draw = () => {
      const cards = loadList('recent', (h) => typeof h === 'string').filter((h) => h !== self).map((h) => lite.products[h]).filter(Boolean).slice(0, limit);
      recent.innerHTML = cards.length
        ? `<ul class="grid product-grid contains-card contains-card--product contains-card--standard grid--4-col-desktop grid--2-col-tablet-down">${cardsHtml(cards)}</ul>`
        : empty;
      finish(recent);
    };
    renderers.push({ kind: 'recent', draw });
    draw();
  }

  const wish = root.querySelector('[data-cmm-wishlist]');
  if (wish) {
    const emptyEl = root.querySelector('[data-cmm-wishlist-empty]');
    const draw = () => {
      const cards = getWishlist().map((h) => lite.products[h]).filter(Boolean);
      wish.innerHTML = cardsHtml(cards);
      if (emptyEl) emptyEl.hidden = cards.length > 0;
      finish(wish);
    };
    renderers.push({ kind: 'wishlist', draw });
    draw();
  }

  return {
    rerender(kind) { for (const r of renderers) if (!kind || r.kind === kind) r.draw(); },
  };
}
