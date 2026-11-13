// Simulator settings: floating button (bottom-right) with mode switch, reset total, clear order history, export, import.
import { getSettings, setSettings } from '../settings.js';
import { exportAll, importAll } from '../storage.js';
import { resetWastedTotal, clearOrders } from '../orders.js';

export function backupFilename(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `chiikawa-sim-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}

export function mountSettingsPanel(host, { strings, reload } = {}) {
  if (!host) return;
  const doc = host.ownerDocument;
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  host.textContent = '';

  const toggle = el('button', 'cmm-settings__toggle', '⚙');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', strings['settings.open']);
  toggle.setAttribute('aria-expanded', 'false');

  const panel = el('div', 'cmm-settings__panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', strings['settings.title']);
  panel.appendChild(el('h2', null, strings['settings.title']));

  const row = el('div', 'cmm-settings__row');
  row.appendChild(el('span', null, strings['mode.label']));
  const group = el('div', 'cmm-settings__modes');
  group.setAttribute('role', 'radiogroup');
  const radios = {};
  for (const m of ['infinite', 'real']) {
    const lab = el('label', 'cmm-settings__mode');
    const r = el('input');
    r.type = 'radio';
    r.name = 'cmm-mode';
    r.value = m;
    r.addEventListener('change', () => { if (r.checked) setSettings({ mode: m }); });
    radios[m] = r;
    lab.append(r, doc.createTextNode(' ' + strings['mode.' + m]));
    group.appendChild(lab);
  }
  row.appendChild(group);
  panel.appendChild(row);

  const btn = (text, onClick) => {
    const b = el('button', 'button button--secondary', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    panel.appendChild(b);
    return b;
  };
  btn(strings['settings.reset'], () => {
    if (win().confirm(strings['settings.resetConfirm'])) resetWastedTotal();
  });
  btn(strings['settings.clearOrders'], () => {
    if (!win().confirm(strings['settings.clearOrdersConfirm'])) return;
    clearOrders();
    reloadPage();
  });
  btn(strings['settings.export'], () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = backupFilename();
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const msg = el('p', 'cmm-settings__msg');
  msg.setAttribute('role', 'status');
  msg.setAttribute('data-cmm-settings-msg', '');
  const file = el('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      importAll(JSON.parse(await f.text()));
      msg.textContent = '';
      reloadPage();
    } catch {
      msg.textContent = strings['settings.importError'];
    }
  });
  btn(strings['settings.import'], () => file.click());
  panel.append(file, msg);

  const win = () => doc.defaultView;
  // Injectable for tests (jsdom cannot navigate).
  const reloadPage = () => (reload ? reload() : win().location.reload());
  const sync = () => {
    const { mode } = getSettings();
    for (const [m, r] of Object.entries(radios)) r.checked = m === mode;
  };
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  win().addEventListener('cmm:settings', sync);
  sync();
  host.append(panel, toggle);
}
