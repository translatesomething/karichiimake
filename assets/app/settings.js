import { load, save } from './storage.js';
import { COUNTRIES } from './countries.js';

const MODES = ['infinite', 'real'];
const CURRENCY_CODES = new Set(['JPY', ...COUNTRIES.map((c) => c.currency)]);
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export function getSettings() {
  const s = load('settings', null);
  const o = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  return {
    mode: MODES.includes(o.mode) ? o.mode : 'infinite',
    currency: CURRENCY_CODES.has(o.currency) ? o.currency : 'JPY',
    country: COUNTRY_CODES.has(o.country) ? o.country : 'JP',
    resetAt: typeof o.resetAt === 'string' ? o.resetAt : null,
  };
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  save('settings', next);
  window.dispatchEvent(new CustomEvent('cmm:settings', { detail: next }));
  return next;
}
