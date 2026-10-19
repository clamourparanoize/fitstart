// Zustand der App, gespeichert im localStorage des Handys.

const KEY = 'fitstart.v1';

export function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: { name: '', createdAt: Date.now() },
    settings: {
      weeklyGoal: 3,
      equipment: { matte: true, hanteln: true, stuhl: true, band: false, stange: false, kettlebell: false },
      dumbbellKg: 5,
      wristSafe: true,
      noJumps: false,
      restSec: 60,
      warmup: true,
      cooldown: true,
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
    active: null,     // laufendes Training
    upgrades: 0,      // Wechsel zu schwereren Varianten
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...data,
      profile: { ...base.profile, ...data.profile },
      settings: { ...base.settings, ...data.settings, equipment: { ...base.settings.equipment, ...data.settings?.equipment } },
    };
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

// Bittet den Browser, die Daten nicht automatisch zu löschen.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* nicht unterstützt */ }
}
