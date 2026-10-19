// Zustand der App, gespeichert im localStorage des Handys.

const KEY = 'fitstart.v1';
export const NEWS_VERSION = 2;

export function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: { name: '', createdAt: Date.now() },
    settings: {
      weeklyGoal: 3,
      fitness: 'einsteiger',   // einsteiger | erfahren | fortgeschritten
      equipment: { matte: true, hanteln: true, stuhl: true, band: false, stange: false, kettlebell: false, laufband: true, ergometer: true },
      dumbbellKg: 5,
      wristSafe: false,
      noJumps: false,
      restSec: 60,
      warmup: true,
      warmupDevice: 'boden',   // boden | laufband | ergometer
      cooldown: true,
      autoMode: true,          // Sätze laufen freihändig im Takt
      secPerRep: 3,
      countReps: true,
      tapAnywhere: true,
      alwaysFull: false,       // Erklärungen immer ausführlich
      sound: true,
      vibration: true,
      voice: true,
      wakeLock: true,
      theme: 'system',
    },
    plans: [],        // eigene Pläne
    swaps: {},        // Übung -> gewählte Variante (bei Programmplänen)
    history: [],      // abgeschlossene Trainings
    badges: {},       // Abzeichen-ID -> Zeitpunkt
    challenges: {},   // 'JJJJ-MM-TT' -> Challenge-ID (erledigt)
    seen: {},         // Übung -> wie oft schon gemacht (für kürzere Erklärungen)
    cardio: {},       // Ausdauer-Programm -> { stage, done }
    active: null,     // laufendes Training
    upgrades: 0,      // Wechsel zu schwereren Varianten
    lastBackup: null,
    newsSeen: 0,
  };
}

function merge(data) {
  const base = defaultState();
  return {
    ...base,
    ...data,
    profile: { ...base.profile, ...data.profile },
    settings: { ...base.settings, ...data.settings, equipment: { ...base.settings.equipment, ...data.settings?.equipment } },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return merge(JSON.parse(raw));
  } catch (err) {
    console.error('Speicher konnte nicht gelesen werden', err);
    return defaultState();
  }
}

let state = load();

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
  }
}

export function update(mutator) {
  mutator(state);
  save();
}

export function resetAll() {
  state = defaultState();
  save();
}

// ---------- Datensicherung ----------
export function exportJson() {
  const { active, ...rest } = state;
  return JSON.stringify({ app: 'FitStart', exportedAt: new Date().toISOString(), ...rest }, null, 1);
}

// Prüft und übernimmt eine Sicherung. Wirft einen Fehler mit verständlichem Text.
export function importJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige FitStart-Sicherung.');
  }
  if (data?.app !== 'FitStart' || !Array.isArray(data.history) || typeof data.settings !== 'object') {
    throw new Error('Die Datei ist keine FitStart-Sicherung.');
  }
  delete data.app;
  delete data.exportedAt;
  state = merge({ ...data, active: null, onboarded: true });
  save();
}

// Bittet den Browser, die Daten nicht automatisch zu löschen.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* nicht unterstützt */ }
}
