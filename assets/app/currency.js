import { load, save } from './storage.js';
import { COUNTRIES } from './countries.js';

const TTL = 24 * 60 * 60 * 1000;
const LIVE_URL = 'https://open.er-api.com/v6/latest/JPY';
const LIVE_TIMEOUT_MS = 5000;
const HARD_FALLBACK = { USD: 0.0066, VND: 170 };

export function convert(jpy, currency, rates) {
  if (currency === 'JPY') return jpy;
  return jpy * rates[currency];
}

const SYMBOLS = new Map();
for (const c of COUNTRIES) if (!SYMBOLS.has(c.currency)) SYMBOLS.set(c.currency, c.symbol);

export const symbolOf = (code) => SYMBOLS.get(code) ?? '';

const decimalsOf = (code) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
};

export const hasRate = (currency, rates) => currency === 'JPY' || Number.isFinite(rates?.[currency]);

export function formatMoney(jpy, currency, rates) {
  // No usable rate (or unknown code): show yen rather than NaN/blank.
  if (!hasRate(currency, rates)) return '¥' + Math.round(jpy).toLocaleString('en-US');
  if (currency === 'USD') {
    return '$' + convert(jpy, 'USD', rates).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (currency === 'VND') {
    const v = Math.round(convert(jpy, 'VND', rates) / 1000) * 1000;
    return v.toLocaleString('vi-VN') + ' ₫';
  }
  if (currency === 'JPY') return '¥' + Math.round(jpy).toLocaleString('en-US');
  const d = decimalsOf(currency);
  const amount = convert(jpy, currency, rates).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${symbolOf(currency)}${amount} ${currency}`;
}

// A usable table needs at least USD and VND; every other code is optional.
const validTable = (t) => t && typeof t === 'object' && Number.isFinite(t.USD) && Number.isFinite(t.VND);
const numericOnly = (t) => Object.fromEntries(Object.entries(t).filter(([k, v]) => k !== 'fetchedAt' && k !== 'source' && Number.isFinite(v)));
// Cache is { rates, fetchedAt }; the old shape { USD, VND, fetchedAt } is a partial table.
const cachedTable = (c) => (c && typeof c === 'object' ? numericOnly(c.rates && typeof c.rates === 'object' ? c.rates : c) : null);

// A table with fewer codes than this is partial (e.g. the old {USD, VND} cache): not trusted as fresh.
const FULL_TABLE_MIN = 100;
const isFull = (t) => Object.keys(t).length >= FULL_TABLE_MIN;

export async function getRates({ fetchImpl = globalThis.fetch?.bind(globalThis), now = Date.now, fallbackUrl } = {}) {
  const cached = load('rates', null);
  const cachedRates = cachedTable(cached);
  const hasCache = validTable(cachedRates) && Number.isFinite(cached.fetchedAt);
  const t = now();

  let fallbackP = null;
  const fetchFallback = () => (fallbackP ??= (async () => {
    try {
      const res = await fetchImpl(fallbackUrl, { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
      if (!res.ok) throw new Error('bad status');
      const r = numericOnly(await res.json());
      return validTable(r) ? r : null;
    } catch { return null; }
  })());
  // Fill codes missing from the chosen table from the fallback table, when one is available.
  const withFallback = async (table, fetchedAt, source) => {
    if (fallbackUrl && !isFull(table)) {
      const fb = await fetchFallback();
      if (fb) return { ...fb, ...table, fetchedAt, source };
    }
    return { ...table, fetchedAt, source };
  };

  if (hasCache && isFull(cachedRates) && t - cached.fetchedAt < TTL) {
    return { ...cachedRates, fetchedAt: cached.fetchedAt, source: 'cache' };
  }
  try {
    const res = await fetchImpl(LIVE_URL, { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
    if (!res.ok) throw new Error('bad status');
    const json = await res.json();
    const r = json.rates && typeof json.rates === 'object' ? numericOnly(json.rates) : null;
    if (!validTable(r)) throw new Error('bad payload');
    save('rates', { rates: r, fetchedAt: t });
    return await withFallback(r, t, 'live');
  } catch {
    if (hasCache) return withFallback(cachedRates, cached.fetchedAt, 'cache');
  }
  const fb = await fetchFallback();
  return fb ? { ...fb, fetchedAt: t, source: 'fallback' } : { ...HARD_FALLBACK, fetchedAt: t, source: 'fallback' };
}
