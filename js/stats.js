// Auswertungen über den Trainingsverlauf.
import { EX } from './exercises.js';

const DAY = 86400000;

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Montag 00:00 der Woche, in der ts liegt.
export function weekStart(ts) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function entryReps(entry) {
  let reps = 0, kg = 0;
  for (const ex of entry.exercises) {
    for (const s of ex.sets) {
      if (s.reps) {
        reps += s.reps;
        if (s.kg) kg += s.reps * s.kg;
      }
    }
  }
  return { reps, kg };
}

// Trainings in der Woche, in der „now“ liegt.
export function thisWeekCount(history, now = Date.now()) {
  const ws = weekStart(now);
  const we = addDays(ws, 7);
  return history.filter((h) => h.start >= ws && h.start < we).length;
}

// Kennzahlen pro Woche für die letzten n Wochen (älteste zuerst).
export function weeklySeries(history, weeks = 12, now = Date.now()) {
  const current = weekStart(now);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    out.push({ start, count: 0, minutes: 0, reps: 0, kg: 0, km: 0, kcal: 0, cardioMin: 0 });
  }
  const first = out[0].start;
  for (const h of history) {
    if (h.start < first) continue;
    const ws = weekStart(h.start);
    const row = out.find((r) => r.start === ws);
    if (!row) continue;
    const { reps, kg } = entryReps(h);
    row.count += 1;
    row.minutes += h.durationSec / 60;
    row.reps += reps;
    row.kg += kg;
    row.km += h.km || 0;
    row.kcal += h.kcal || 0;
    if (h.kind === 'ausdauer') row.cardioMin += h.durationSec / 60;
  }
  return out;
}

// Wochen-Serie: wie viele Wochen in Folge das Wochenziel erreicht wurde.
export function streakInfo(history, goal) {
  const counts = new Map();
  for (const h of history) {
    const ws = weekStart(h.start);
    counts.set(ws, (counts.get(ws) || 0) + 1);
  }
  const nowWeek = weekStart(Date.now());
  let current = (counts.get(nowWeek) || 0) >= goal ? 1 : 0;
  let w = addDays(nowWeek, -7);
  while ((counts.get(w) || 0) >= goal) {
    current += 1;
    w = addDays(w, -7);
  }
  let best = 0, run = 0;
  if (history.length) {
    for (let wk = weekStart(history[0].start); wk <= nowWeek; wk = addDays(wk, 7)) {
      if ((counts.get(wk) || 0) >= goal) {
        run += 1;
        best = Math.max(best, run);
      } else if (wk !== nowWeek) {
        run = 0;
      }
    }
  }
  return { current, best: Math.max(best, current) };
}

export function totals(history) {
  let minutes = 0, reps = 0, kg = 0, km = 0, kcal = 0, cardio = 0;
  for (const h of history) {
    minutes += h.durationSec / 60;
    const r = entryReps(h);
    reps += r.reps;
    kg += r.kg;
    km += h.km || 0;
    kcal += h.kcal || 0;
    if (h.kind === 'ausdauer') cardio += 1;
  }
  return { workouts: history.length, minutes, reps, kg, km, kcal, cardio };
}

// Bestwert einer Übung in einem Training (nur Krafttrainings, dort wird selbst gezählt).
export function sessionScore(exId, sets) {
  const ex = EX[exId];
  if (!ex || !sets.length) return null;
  if (ex.mode === 'time') return Math.max(...sets.map((s) => s.sec || 0));
  if (ex.weighted) return Math.max(...sets.map((s) => (s.kg || 0) * (1 + (s.reps || 0) / 30)));
  return Math.max(...sets.map((s) => s.reps || 0));
}

export function bestScore(history, exId) {
  let best = null;
  for (const h of history) {
    if (h.kind !== 'kraft') continue;
    const e = h.exercises.find((x) => x.exId === exId);
    if (!e) continue;
    const sc = sessionScore(exId, e.sets);
    if (sc != null && (best == null || sc > best)) best = sc;
  }
  return best;
}

export function lastSetsFor(history, exId) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.kind !== 'kraft') continue;
    const e = h.exercises.find((x) => x.exId === exId);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

// Verlauf einer Übung über alle Krafttrainings.
export function exerciseSeries(history, exId) {
  const ex = EX[exId];
  const out = [];
  for (const h of history) {
    if (h.kind !== 'kraft') continue;
    const e = h.exercises.find((x) => x.exId === exId);
    if (!e || !e.sets.length) continue;
    if (ex.mode === 'time') {
      const secs = e.sets.map((s) => s.sec || 0);
      out.push({ ts: h.start, best: Math.max(...secs), total: secs.reduce((a, b) => a + b, 0) });
    } else {
      const reps = e.sets.map((s) => s.reps || 0);
      const est = ex.weighted ? Math.max(...e.sets.map((s) => (s.kg || 0) * (1 + (s.reps || 0) / 30))) : null;
      out.push({ ts: h.start, best: Math.max(...reps), total: reps.reduce((a, b) => a + b, 0), est });
    }
  }
  return out;
}

export function trainedExerciseIds(history) {
  const ids = new Set();
  for (const h of history) if (h.kind === 'kraft') for (const e of h.exercises) if (e.sets.length) ids.add(e.exId);
  return [...ids];
}

export function distinctExercises(history) {
  const ids = new Set();
  for (const h of history) for (const e of h.exercises) ids.add(e.exId);
  return ids.size;
}

// Trainingstage der letzten n Wochen als Raster (Spalten = Wochen, Zeilen = Mo–So).
export function calendarGrid(history, weeks = 12, now = Date.now()) {
  const perDay = new Map();
  for (const h of history) {
    const k = startOfDay(h.start);
    perDay.set(k, (perDay.get(k) || 0) + 1);
  }
  const today = startOfDay(now);
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(first, i);
    cells.push({ day, count: perDay.get(day) || 0, future: day > today });
  }
  return cells;
}

export { DAY };
