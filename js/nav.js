// Navigation wie in einer App: Die Zurück-Taste des Handys schließt zuerst offene Fenster,
// geht dann eine Ebene zurück; Tabs springen zurück zu „Heute“; im Training wird gefragt.

const TABS = ['#/heute', '#/plaene', '#/uebungen', '#/fortschritt', '#/erfolge'];
const KEY = 'fitstart.nav';

let routeFn = () => {};
let stack = [];          // Hash je Verlaufsposition
let lastIdx = 0;
let pending = null;      // Ziel nach history.go()
let skipHash = false;
let guard = null;        // Zurück-Taste abfangen (laufendes Training)
const sheets = [];       // offene Fenster [{ id, closeInternal }]
let popWaiters = [];

export const curIdx = () => history.state?.idx ?? 0;
const hashNow = () => location.hash || '#/heute';

function record() {
  lastIdx = curIdx();
  stack[lastIdx] = hashNow();
  stack.length = lastIdx + 1;
  try { sessionStorage.setItem(KEY, JSON.stringify(stack)); } catch { /* egal */ }
}

export function initNav(route) {
  routeFn = route;
  try { stack = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { stack = []; }
  if (history.state?.idx == null) history.replaceState({ idx: 0 }, '');
  record();
  window.addEventListener('popstate', onPop);
  window.addEventListener('hashchange', onHash);
}

function onHash() {
  if (skipHash) {
    skipHash = false;
    return;
  }
  // Neuer Eintrag durch einen Link: Position im Verlauf vergeben
  if (history.state?.idx == null) history.replaceState({ idx: lastIdx + 1 }, '');
  record();
  routeFn();
}

function onPop(e) {
  const st = e.state || {};
  const hashChanged = hashNow() !== stack[lastIdx];
  try {
    if (pending) {
      const target = pending;
      pending = null;
      history.replaceState({ idx: curIdx() }, '', target);
      skipHash = hashChanged;
      record();
      routeFn();
      return;
    }
    let closed = false;
    while (sheets.length && sheets.at(-1).id !== st.sheet) {
      sheets.pop().closeInternal();
      closed = true;
    }
    // Eintrag eines bereits geschlossenen Fensters überspringen
    if (st.sheet && !sheets.some((x) => x.id === st.sheet)) {
      history.back();
      return;
    }
    if (guard && !st.guard && !hashChanged && !closed) {
      history.pushState({ idx: curIdx() + 1, guard: true }, '');
      record();
      guard();
      return;
    }
    if (!hashChanged) record();
  } finally {
    const w = popWaiters;
    popWaiters = [];
    w.forEach((fn) => fn());
  }
}

export function navigate(hash, { replace = false } = {}) {
  closeAllSheets();
  if (replace) history.replaceState({ idx: curIdx() }, '', hash);
  else history.pushState({ idx: curIdx() + 1 }, '', hash);
  record();
  routeFn();
}

// Zurück, wenn der Eintrag darunter das Ziel ist, sonst ersetzen.
export function backOrReplace(hash) {
  if (curIdx() > 0 && stack[curIdx() - 1] === hash) history.back();
  else navigate(hash, { replace: true });
}

// Zurück-Pfeil in der App: wie die Zurück-Taste, sonst zur übergeordneten Seite.
export function navBack(fallback = '#/heute') {
  if (curIdx() > 0 && stack[curIdx() - 1]) history.back();
  else navigate(fallback, { replace: true });
}

export function switchTab(hash) {
  const cur = hashNow();
  if (cur === hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (TABS.includes(cur) && cur !== '#/heute') {
    if (hash === '#/heute' && stack[curIdx() - 1] === '#/heute') history.back();
    else navigate(hash, { replace: true });
  } else {
    navigate(hash);
  }
}

export const rerender = () => routeFn();

// ---------- Fenster (Bottom-Sheets) ----------
export function pushSheet(id, closeInternal) {
  sheets.push({ id, closeInternal });
  history.pushState({ idx: curIdx() + 1, sheet: id }, '');
  record();
}

// Schließt ein Fenster. Das Promise ist erfüllt, sobald der Verlauf aufgeräumt ist.
export function closeSheet(id, closeInternal) {
  const i = sheets.findIndex((x) => x.id === id);
  if (i >= 0 && history.state?.sheet === id) {
    return new Promise((resolve) => {
      popWaiters.push(resolve);
      history.back();
    });
  }
  if (i >= 0) sheets.splice(i, 1);
  closeInternal();
  return Promise.resolve();
}

export function closeAllSheets() {
  while (sheets.length) sheets.pop().closeInternal();
}

// ---------- Training: Zurück-Taste abfangen ----------
export function setGuard(fn) {
  guard = fn;
  if (fn && !history.state?.guard) {
    history.pushState({ idx: curIdx() + 1, guard: true }, '');
    record();
  }
}

export function clearGuard() {
  guard = null;
}

// Verlässt das Training: springt zum Eintrag „baseIdx“ zurück und ersetzt ihn durch hash.
export function leaveTo(hash, baseIdx) {
  guard = null;
  closeAllSheets();
  let target = Math.max(0, Math.min(baseIdx, curIdx()));
  if (target > 0 && stack[target - 1] === hash) target -= 1;
  const d = curIdx() - target;
  if (d > 0) {
    pending = hash;
    history.go(-d);
  } else {
    navigate(hash, { replace: true });
  }
}
