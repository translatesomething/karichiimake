const PREFIX = 'cmm:';
export const KNOWN_KEYS = ['cart', 'orders', 'settings', 'recent', 'wishlist', 'shipping'];

function ls() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function load(key, fallback) {
  try {
    const raw = ls()?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    ls()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full */
  }
}

export function exportAll() {
  const data = {};
  for (const k of KNOWN_KEYS) {
    const v = load(k, undefined);
    if (v !== undefined) data[k] = v;
  }
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

// Element shapes the readers rely on; anything else is dropped when reading and rejected on import.
export const isCartLine = (l) => isObj(l) && typeof l.variantId === 'string' && fin(l.quantity) && fin(l.priceJpy);
export const isOrder = (o) => isObj(o) && typeof o.id === 'string' && typeof o.createdAt === 'string' && fin(o.subtotalJpy);
const isHandle = (h) => typeof h === 'string';

const VALIDATORS = {
  cart: (v) => Array.isArray(v) && v.every(isCartLine),
  orders: (v) => Array.isArray(v) && v.every(isOrder),
  wishlist: (v) => Array.isArray(v) && v.every(isHandle),
  recent: (v) => Array.isArray(v) && v.every(isHandle),
  settings: isObj,
  shipping: isObj,
};

// Array stored under key, with malformed elements dropped (non-array -> []).
export function loadList(key, isValid) {
  const v = load(key, []);
  return Array.isArray(v) ? v.filter(isValid) : [];
}

export function importAll(obj) {
  const ok =
    obj && typeof obj === 'object' && obj.version === 1 &&
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data);
  if (!ok) throw new Error('invalid backup');
  // Validate everything before writing anything, so a bad file leaves existing data untouched.
  for (const k of KNOWN_KEYS) {
    if (k in obj.data && !VALIDATORS[k](obj.data[k])) throw new Error('invalid backup');
  }
  for (const k of KNOWN_KEYS) {
    if (k in obj.data) save(k, obj.data[k]);
  }
}
