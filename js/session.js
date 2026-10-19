// Laufendes Training anlegen, Ziele berechnen und Training abschließen.
import { EX } from './exercises.js';
import { getState, update } from './store.js';
import {
  buildTimedSegments, resolvedItems, warmupSegments, cooldownSegments, useWarmup, useCooldown, isAllowed,
  planById, cardioStage,
} from './plans.js';
import { lastSetsFor, bestScore, sessionScore } from './stats.js';
import { xpParts, completesWeeklyGoal, awardBadges, totalXp, levelInfo } from './gamification.js';
import { uid } from './ui.js';

export function newRunner(segments) {
  return { segments, seg: 0, endsAt: null, remaining: segments[0] ? segments[0].dur * 1000 : 0, paused: true, log: [] };
}

// Ziel für heute aus dem letzten Mal ableiten (Wiederholungen bzw. Sekunden).
export function computeTarget(item, history = getState().history) {
  const ex = EX[item.exId];
  const [lo, hi] = item.range;
  const last = lastSetsFor(history, item.exId);
  const harder = ex.harder && isAllowed(EX[ex.harder]) ? ex.harder : null;
  if (!last) {
    const start = getState().settings.fitness === 'einsteiger' ? lo : Math.round((lo + hi) / 2);
    return { target: start, lastVals: null, allTop: false, harder };
  }
  const vals = last.map((s) => (ex.mode === 'time' ? s.sec || 0 : s.reps || 0));
  const allTop = vals.length >= item.sets && vals.every((v) => v >= hi);
  const target = ex.mode === 'time'
    ? Math.min(hi, Math.max(lo, Math.max(...vals) + 5))
    : Math.min(hi, Math.max(lo, Math.min(...vals) + 1));
  return { target, lastVals: vals, allTop, harder };
}

export function prepareItem(it) {
  return { ...it, logs: [], ...computeTarget(it) };
}

// ---------- Erklärungen: erst ausführlich, mit der Zeit kürzer ----------
// 'full' = genau erklären und auf „Bereit“ warten, 'short' = kurz ansagen und automatisch starten,
// 'none' = nur der Name.
export function introMode(exId, state = getState()) {
  if (state.settings.alwaysFull) return 'full';
  const n = state.seen?.[exId] || 0;
  if (n < 2) return 'full';
  if (n < 5) return 'short';
  return 'none';
}

export function isIntroduced(a, exId) {
  return !!a.introduced?.includes(exId);
}

export function markIntroduced(a, exId) {
  if (isIntroduced(a, exId)) return;
  update((s) => {
    a.introduced = [...(a.introduced || []), exId];
    s.seen = s.seen || {};
    s.seen[exId] = (s.seen[exId] || 0) + 1;
  });
}

export function startSession(plan) {
  const state = getState();
  const base = {
    id: uid(), planId: plan.id, name: plan.name, emoji: plan.emoji || '💪', kind: plan.kind,
    surprise: !!plan.surprise, startedAt: Date.now(), activeMs: 0, introduced: [],
  };
  let session;
  if (plan.kind === 'zeit' || plan.kind === 'ausdauer') {
    session = {
      ...base,
      timed: newRunner(buildTimedSegments(plan, state)),
      ...(plan.kind === 'ausdauer' ? { device: plan.device, stage: cardioStage(plan, state) } : {}),
    };
  } else {
    const warm = useWarmup(plan, state) ? warmupSegments(state) : [];
    const cool = useCooldown(plan, state) ? cooldownSegments() : [];
    session = {
      ...base,
      phase: warm.length ? 'warmup' : 'main',
      warm: warm.length ? newRunner([{ type: 'prep', dur: 10, exId: warm[0].exId }, ...warm]) : null,
      cool: cool.length ? newRunner(cool) : null,
      items: resolvedItems(plan, state).map(prepareItem),
      idx: 0,
      restEndsAt: null,
      kg: state.settings.dumbbellKg,
      auto: state.settings.autoMode,
    };
  }
  update((s) => { s.active = session; });
  return session;
}

export function discardSession() {
  update((s) => { s.active = null; });
}

function insertEntry(s, entry) {
  s.history.push(entry);
  s.history.sort((x, y) => x.start - y.start);
}

// Training abschließen: Verlauf, Rekorde, Punkte, Abzeichen.
// extra: { km, kcal } bei Ausdauer an Geräten.
export function finishSession(extra = {}) {
  const state = getState();
  const a = state.active;
  if (!a) return null;
  const end = Date.now();
  const durationSec = Math.max(60, Math.round((a.activeMs || end - a.startedAt) / 1000));

  let exercises = [];
  if (a.kind === 'kraft') {
    exercises = a.items.filter((it) => it.logs.length).map((it) => ({ exId: it.exId, sets: it.logs, range: it.range }));
  } else {
    const byEx = new Map();
    for (const l of a.timed.log) {
      if (!byEx.has(l.exId)) byEx.set(l.exId, []);
      byEx.get(l.exId).push({ sec: l.sec });
    }
    exercises = [...byEx].map(([exId, sets]) => ({ exId, sets }));
  }

  const prs = [];
  if (a.kind === 'kraft') {
    for (const e of exercises) {
      const prev = bestScore(state.history, e.exId);
      const now = sessionScore(e.exId, e.sets);
      if (prev != null && now != null && now > prev + 1e-9) prs.push(e.exId);
    }
  }

  const goalDone = completesWeeklyGoal(state, a.startedAt);
  const parts = xpParts({ durationSec, prs: prs.length, completesGoal: goalDone });
  const xp = parts.reduce((sum, [, v]) => sum + v, 0);
  const levelBefore = levelInfo(totalXp(state));

  // Vorschläge für die nächste Steigerung
  const suggestions = [];
  if (a.kind === 'kraft') {
    for (const it of a.items) {
      const ex = EX[it.exId];
      if (!it.logs.length) continue;
      const vals = it.logs.map((l) => (ex.mode === 'time' ? l.sec : l.reps));
      if (vals.length >= it.sets && vals.every((v) => v >= it.range[1])) {
        const harder = ex.harder && isAllowed(EX[ex.harder]) ? ex.harder : null;
        suggestions.push({ exId: it.exId, harder });
      }
    }
  }

  const entry = {
    id: a.id, planId: a.planId, name: a.name, emoji: a.emoji, kind: a.kind, surprise: a.surprise,
    start: a.startedAt, end, durationSec, exercises, prs, xp, xpParts: parts, goalDone,
    ...(a.kind === 'ausdauer' ? { device: a.device, stage: a.stage } : {}),
    ...(extra.km ? { km: extra.km } : {}),
    ...(extra.kcal ? { kcal: extra.kcal } : {}),
  };

  // Ausdauer-Programm: nach zwei geschafften Einheiten eine Stufe weiter
  let stageUp = null;
  const plan = a.kind === 'ausdauer' ? planById(a.planId) : null;

  let fresh = [];
  update((s) => {
    insertEntry(s, entry);
    s.active = null;
    if (plan) {
      s.cardio = s.cardio || {};
      const c = s.cardio[plan.id] || { stage: a.stage, done: 0 };
      if (c.stage === a.stage) c.done += 1;
      if (c.done >= 2 && c.stage < plan.stages.length - 1) {
        c.stage += 1;
        c.done = 0;
        stageUp = { name: plan.name, stage: c.stage + 1, text: plan.stages[c.stage].text };
        s.stageUps = (s.stageUps || 0) + 1;
      }
      s.cardio[plan.id] = c;
    }
    fresh = awardBadges(s);
  });
  const levelAfter = levelInfo(totalXp(getState()));
  return { entry, newBadges: fresh, levelBefore, levelAfter, suggestions, stageUp };
}

// Freie Einheit eintragen (z. B. Laufband ohne Programm, Spaziergang).
export const ACTIVITIES = {
  laufband: { name: 'Laufband', emoji: '🏃', exId: 'laufband-gehen' },
  ergometer: { name: 'Ergometer', emoji: '🚴', exId: 'ergo-locker' },
  spaziergang: { name: 'Spaziergang', emoji: '🚶', exId: null },
  radfahren: { name: 'Radfahren draußen', emoji: '🚲', exId: null },
  laufen: { name: 'Laufen draußen', emoji: '👟', exId: null },
  schwimmen: { name: 'Schwimmen', emoji: '🏊', exId: null },
  sonstiges: { name: 'Sonstiges', emoji: '⭐', exId: null },
};

export function logFreeSession({ activity, start, minutes, km, kcal }) {
  const act = ACTIVITIES[activity] || ACTIVITIES.sonstiges;
  const state = getState();
  const durationSec = Math.round(minutes * 60);
  const goalDone = completesWeeklyGoal(state, start);
  const parts = xpParts({ durationSec, prs: 0, completesGoal: goalDone });
  const entry = {
    id: uid(), planId: 'frei', name: act.name, emoji: act.emoji, kind: 'ausdauer', free: true,
    device: activity, start, end: start + durationSec * 1000, durationSec,
    exercises: act.exId ? [{ exId: act.exId, sets: [{ sec: durationSec }] }] : [],
    prs: [], xp: parts.reduce((sum, [, v]) => sum + v, 0), xpParts: parts, goalDone,
    ...(km ? { km } : {}),
    ...(kcal ? { kcal } : {}),
  };
  let fresh = [];
  update((s) => {
    insertEntry(s, entry);
    fresh = awardBadges(s);
  });
  return { entry, newBadges: fresh };
}

// Schwerere Variante dauerhaft merken.
export function upgradeExercise(fromId, toId) {
  update((s) => {
    s.swaps[fromId] = toId;
    s.upgrades = (s.upgrades || 0) + 1;
  });
  return awardBadges(getState());
}
