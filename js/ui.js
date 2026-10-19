// Kleine DOM-Helfer, Icons, Dialoge und Formatierungen.
import { pushSheet, closeSheet } from './nav.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function setProps(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'open') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

// ---------- Icons (24×24, Strichgrafik) ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  prev: '<path d="M19 5 9 12l10 7z"/><path d="M5 5v14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  fire: '<path d="M12 3c.8 3 4.5 4.7 4.5 9a4.5 4.5 0 0 1-9 0c0-2.2 1.2-3.5 2.3-4.4.1 2 1 3 2.2 3.2-.4-3 .2-5.5 0-7.8z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  skip: '<path d="M5 12h12M13 7l5 5-5 5"/>',
};

export function icon(name, cls = '') {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('class', `i ${cls}`.trim());
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = ICONS[name] || '';
  return el;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstChild) el.append(icon(el.dataset.icon));
  });
}

// ---------- Overlays ----------
const overlayRoot = () => document.getElementById('overlay-root');

// Öffnet ein Fenster von unten. close() gibt ein Promise zurück, das erfüllt ist,
// sobald das Fenster zu ist (danach erst weiter navigieren).
export function openSheet(content, { center = false, onClose } = {}) {
  const id = `s${Math.random().toString(36).slice(2, 9)}`;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    center ? null : h('div', { class: 'sheet-head' },
      h('div', { class: 'grab' }),
      h('button', { class: 'icon-btn plain sheet-close', 'aria-label': 'Schließen', onclick: () => close() }, icon('close')),
    ),
    content);
  const backdrop = h('div', { class: `backdrop${center ? ' center' : ''}` }, sheet);
  let closed = false;
  const closeInternal = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    onClose?.();
  };
  const close = () => (closed ? Promise.resolve() : closeSheet(id, closeInternal));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  overlayRoot().append(backdrop);
  pushSheet(id, closeInternal);
  return { close, sheet };
}

export function confirmDialog({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const { close } = openSheet(
      h('div', { class: 'stack' },
        h('h2', null, title),
        text ? h('p', { class: 'muted' }, text) : null,
        h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '20px' } },
          h('button', { class: 'btn', onclick: () => close().then(() => resolve(false)) }, cancel),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { result = true; close().then(() => resolve(true)); } }, ok),
        ),
      ),
      { center: true, onClose: () => setTimeout(() => resolve(result), 0) },
    );
  });
}

let toastTimer;
export function toast(text, ms = 2600) {
  const root = document.getElementById('toast-root');
  root.innerHTML = '';
  const el = h('div', { class: 'toast', role: 'status' }, text);
  root.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

// ---------- Formularbausteine ----------
export function switchInput(checked, onchange, label) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onchange(e.target.checked) }),
    h('span'),
  );
}

export function toggleRow(title, desc, checked, onchange) {
  return h('div', { class: 'toggle-row' },
    h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, title), desc ? h('div', { class: 'desc' }, desc) : null),
    switchInput(checked, onchange, title),
  );
}

// Plus/Minus-Feld. format(v) bestimmt die Anzeige.
export function stepper({ value, min = 0, max = 999, step = 1, onchange, format = (v) => v, big = false, label = 'Wert' }) {
  let v = value;
  const out = h('span', { class: 'val', 'aria-live': 'polite' }, format(v));
  const set = (nv) => {
    v = Math.max(min, Math.min(max, nv));
    out.textContent = format(v);
    onchange?.(v);
  };
  const el = h('div', { class: `stepper${big ? ' big' : ''}` },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label} verringern`, onclick: () => set(v - step) }, icon('minus')),
    out,
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label} erhöhen`, onclick: () => set(v + step) }, icon('plus')),
  );
  el.setValue = (nv) => { v = nv; out.textContent = format(v); };
  el.getValue = () => v;
  return el;
}

export function segmented(options, value, onchange) {
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  const render = () => {
    wrap.innerHTML = '';
    for (const [key, label] of options) {
      wrap.append(h('button', {
        type: 'button', role: 'tab', class: key === value ? 'on' : '', 'aria-selected': String(key === value),
        onclick: () => { value = key; render(); onchange(key); },
      }, label));
    }
  };
  render();
  return wrap;
}

export function levelDots(level) {
  return h('span', { class: 'level-dots', title: ['', 'leicht', 'mittel', 'schwer'][level], 'aria-label': `Schwierigkeit ${level} von 3` },
    [1, 2, 3].map((n) => h('i', { class: n <= level ? 'on' : '' })));
}

// ---------- Formatierung ----------
export function fmtClock(totalSec) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

export function fmtMinutes(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} Min.`;
  const hh = Math.floor(m / 60);
  return `${hh} Std. ${m % 60} Min.`;
}

export function fmtSec(sec) {
  return sec >= 60 && sec % 60 === 0 ? `${sec / 60} Min.` : `${sec} Sek.`;
}

const DATE_FMT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const DATE_LONG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME_FMT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (ts) => DATE_FMT.format(new Date(ts));
export const fmtDateLong = (ts) => DATE_LONG.format(new Date(ts));
export const fmtTime = (ts) => TIME_FMT.format(new Date(ts));
export const fmtNum = (n) => new Intl.NumberFormat('de-DE').format(Math.round(n));

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
