// Trainingspläne: Einsteigerprogramm, Extra-Trainings, eigene Pläne, Zufallsgenerator.
import { EX, EXERCISES } from './exercises.js';
import { getState } from './store.js';

// ---------- Filter nach Ausrüstung und Rücksichten ----------
export function isAllowed(ex, settings = getState().settings) {
  if (!ex) return false;
  if (ex.needs.some((n) => !settings.equipment[n])) return false;
  if (settings.wristSafe && ex.wrist === 'flat') return false;
  if (settings.noJumps && ex.jump) return false;
  return true;
}

function followSwaps(id, swaps) {
  let cur = id;
  const seen = new Set();
  while (swaps?.[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = swaps[cur];
  }
  return cur;
}

// Erste erlaubte Übung aus einer Kandidatenliste (gewählte Varianten haben Vorrang).
export function resolveEx(candidates, state = getState()) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  for (const id of list) {
    const swapped = followSwaps(id, state.swaps);
    if (isAllowed(EX[swapped], state.settings)) return swapped;
    if (isAllowed(EX[id], state.settings)) return id;
  }
  const first = EX[list[0]];
  if (!first) return null;
  const alt = EXERCISES.find((e) => e.cat === first.cat && !e.machine && e.mode === first.mode && isAllowed(e, state.settings))
    || EXERCISES.find((e) => e.cat === first.cat && !e.machine && isAllowed(e, state.settings));
  return alt?.id || null;
}

// ---------- Auf- und Abwärmen ----------
const WARMUP = [['armkreisen', 30], ['marschieren', 40], ['rumpfdrehung', 30], ['kniebeuge', 40], ['hueftkreisen', 30], ['hampelmann-leise', 30]];
const WARMUP_DEVICE = {
  laufband: [['laufband-gehen', 240], ['armkreisen', 30], ['hueftkreisen', 30]],
  ergometer: [['ergo-locker', 240], ['armkreisen', 30], ['rumpfdrehung', 30]],
};
const COOLDOWN = [['beinrueckseite-dehnung', 40], ['hueftbeuger-dehnung', 40], ['brust-dehnung', 40], ['figur-vier', 40], ['kindhaltung', 40]];

function blockSegments(list, type) {
  const out = [];
  const used = new Set();
  for (const [id, dur] of list) {
    const r = EX[id]?.machine ? (isAllowed(EX[id]) ? id : null) : resolveEx(id);
    if (r && !used.has(r)) {
      used.add(r);
      out.push({ type, exId: r, dur });
    }
  }
  return out;
}
export function warmupSegments(state = getState()) {
  const dev = state.settings.warmupDevice;
  if (WARMUP_DEVICE[dev] && state.settings.equipment[dev]) return blockSegments(WARMUP_DEVICE[dev], 'warmup');
  return blockSegments(WARMUP, 'warmup');
}
export const cooldownSegments = () => blockSegments(COOLDOWN, 'cooldown');

const fitness = (state = getState()) => state.settings.fitness || 'einsteiger';

// ---------- Eingebaute Pläne ----------
export const PROGRAM = ['kraft-a', 'zirkel-b', 'kraft-c', 'zirkel-d'];

export const BUILTIN_PLANS = [
  {
    id: 'kraft-a', kind: 'kraft', emoji: '💪', name: 'Ganzkörper Kraft A',
    desc: 'Die Basis: Beine, Brust, Rücken und Rumpf mit deinen Hanteln.',
    items: [
      { ex: ['goblet-squat', 'kniebeuge'], sets: 3 },
      { ex: ['bodendruecken', 'liegestuetz-knie', 'liegestuetz-wand'], sets: 3 },
      { ex: ['rudern-vorgebeugt', 'rudern-einarmig', 'band-rudern', 'superman'], sets: 3 },
      { ex: ['beckenheben', 'kreuzheben-rumaenisch'], sets: 2 },
      { ex: ['schulterdruecken', 'liegestuetz-wand'], sets: 2 },
      { ex: ['unterarmstuetz-knie', 'dead-bug'], sets: 2 },
    ],
  },
  {
    id: 'zirkel-b', kind: 'zeit', emoji: '⚡', name: 'Kondition Zirkel B',
    desc: 'Puls hoch: 40 Sek. Übung, 20 Sek. Pause. Die App führt dich durch.',
    work: 40, rest: 20, rounds: 3, roundRest: 60,
    items: [
      { ex: ['hampelmann', 'hampelmann-leise'] },
      { ex: ['kniebeuge'] },
      { ex: ['schattenboxen'] },
      { ex: ['ausfallschritt'] },
      { ex: ['knie-ellbogen'] },
      { ex: ['unterarmstuetz-knie', 'dead-bug'] },
    ],
  },
  {
    id: 'kraft-c', kind: 'kraft', emoji: '🏋️', name: 'Ganzkörper Kraft C',
    desc: 'Neue Reize: einbeinig, einarmig und dazu Arme.',
    items: [
      { ex: ['ausfallschritt-hanteln', 'ausfallschritt'], sets: 2 },
      { ex: ['liegestuetz-knie', 'liegestuetz-wand'], sets: 3 },
      { ex: ['rudern-einarmig', 'rudern-vorgebeugt', 'band-rudern', 'superman'], sets: 2 },
      { ex: ['kreuzheben-rumaenisch', 'beckenheben'], sets: 3 },
      { ex: ['hammercurl', 'superman'], sets: 2 },
      { ex: ['trizeps-kickback', 'liegestuetz-wand'], sets: 2 },
    ],
  },
  {
    id: 'zirkel-d', kind: 'zeit', emoji: '🔥', name: 'Power-Zirkel D',
    desc: 'Ganzkörper mit Hanteln im Zeittakt: kurz, knackig, abwechslungsreich.',
    work: 40, rest: 20, rounds: 3, roundRest: 60,
    items: [
      { ex: ['thruster', 'kniebeuge'] },
      { ex: ['marschieren'] },
      { ex: ['russian-twist', 'crunch'] },
      { ex: ['sumo-kniebeuge', 'wandsitzen'] },
      { ex: ['schattenboxen'] },
      { ex: ['seitstuetz', 'unterarmstuetz-knie'] },
    ],
  },
  {
    id: 'arme-schultern', kind: 'kraft', emoji: '💥', name: 'Arme & Schultern',
    desc: 'Extra-Einheit für Oberkörper: Drücken, Heben, Curlen.',
    items: [
      { ex: ['schulterdruecken'], sets: 3 },
      { ex: ['bizepscurl'], sets: 3 },
      { ex: ['trizeps-ueberkopf', 'trizeps-kickback'], sets: 3 },
      { ex: ['seitheben'], sets: 2 },
      { ex: ['reverse-fly', 'band-auseinander', 'ytw'], sets: 2 },
      { ex: ['hammercurl'], sets: 2 },
    ],
  },
  {
    id: 'bauch-10', kind: 'zeit', emoji: '🎯', name: 'Bauch & Rumpf kompakt',
    desc: '10 Minuten für einen starken Rumpf. Gut als Zusatz nach dem Krafttraining.',
    work: 40, rest: 20, rounds: 2, roundRest: 30, warmup: false, cooldown: false,
    items: [{ ex: ['dead-bug'] }, { ex: ['crunch'] }, { ex: ['seitstuetz'] }, { ex: ['fahrrad-crunch'] }, { ex: ['unterarmstuetz-knie'] }],
  },
  {
    id: 'mobil-10', kind: 'zeit', emoji: '🧘', name: 'Beweglich & entspannt',
    desc: 'Ruhiges Dehnen und Mobilisieren, ideal an trainingsfreien Tagen oder abends.',
    work: 45, rest: 10, rounds: 1, roundRest: 0, warmup: false, cooldown: false,
    items: ['armkreisen', 'rumpfdrehung', 'hueftkreisen', 'hueftbeuger-dehnung', 'beinrueckseite-dehnung', 'oberschenkel-dehnung',
      'brust-dehnung', 'figur-vier', 'liegende-drehung', 'kindhaltung', 'nacken-dehnung'].map((id) => ({ ex: [id] })),
  },
  {
    id: 'wachmacher', kind: 'zeit', emoji: '☀️', name: 'Morgen-Wachmacher',
    desc: '7 Minuten zum Wachwerden, ganz ohne Geräte.',
    work: 30, rest: 10, rounds: 1, roundRest: 0, warmup: false, cooldown: false,
    items: ['armkreisen', 'marschieren', 'kniebeuge', 'rumpfdrehung', 'hampelmann-leise', 'ausfallschritt', 'schattenboxen', 'hueftkreisen', 'wadenheben', 'unterarmstuetz-knie']
      .map((id) => ({ ex: [id] })),
  },
  {
    id: 'kurz-knackig', kind: 'zeit', emoji: '⏱️', name: 'Kurz & knackig',
    desc: '4 Minuten Vollgas: 20 Sek. alles geben, 10 Sek. Pause, nach kurzem Aufwärmen.',
    work: 20, rest: 10, rounds: 4, roundRest: 10, cooldown: false,
    items: [{ ex: ['kniebeuge'] }, { ex: ['schattenboxen'] }],
  },
].map((p) => ({ ...p, builtin: true }));

// ---------- Ausdauer an Geräten (Laufband, Ergometer) ----------
export const EFFORT = {
  3: 'sehr locker: du kannst dich ganz normal unterhalten',
  4: 'locker: Unterhalten geht problemlos',
  5: 'zügig: du atmest schneller, Sprechen geht noch gut',
  6: 'etwas anstrengend: Sprechen geht noch in ganzen Sätzen',
  7: 'anstrengend: Sprechen geht nur noch in kurzen Sätzen',
};
// Block: [Übung, Sekunden, Anstrengung (1–10), Abschnitt, optionaler Anzeigetext]
const times = (n, blocks) => Array.from({ length: n }, () => blocks).flat();
const LB_WARM = ['laufband-gehen', 300, 4, 'warmup'];
const ERGO_WARM = ['ergo-locker', 300, 3, 'warmup'];
const lbCool = (s) => ['laufband-gehen', s, 3, 'cooldown', 'Ausgehen'];
const ergoCool = (s) => ['ergo-locker', s, 3, 'cooldown', 'Ausrollen'];

export const CARDIO_PROGRAMS = [
  {
    id: 'lb-intervall', device: 'laufband', emoji: '🏃', name: 'Laufband: Gehen & Joggen',
    desc: 'Vom Gehen zum Laufen: Joggen und Gehen im Wechsel. Von Stufe zu Stufe joggst du länger am Stück.',
    stages: [
      { text: '6 × (1 Min. Joggen + 2 Min. Gehen)', blocks: [LB_WARM, ...times(6, [['laufband-joggen', 60, 6, 'work'], ['laufband-gehen', 120, 4, 'easy']]), lbCool(240)] },
      { text: '5 × (2 Min. Joggen + 2 Min. Gehen)', blocks: [LB_WARM, ...times(5, [['laufband-joggen', 120, 6, 'work'], ['laufband-gehen', 120, 4, 'easy']]), lbCool(240)] },
      { text: '4 × (4 Min. Joggen + 1,5 Min. Gehen)', blocks: [LB_WARM, ...times(4, [['laufband-joggen', 240, 6, 'work'], ['laufband-gehen', 90, 4, 'easy']]), lbCool(180)] },
      { text: '2 × (9 Min. Joggen + 2 Min. Gehen)', blocks: [LB_WARM, ...times(2, [['laufband-joggen', 540, 6, 'work'], ['laufband-gehen', 120, 4, 'easy']]), lbCool(180)] },
    ],
  },
  {
    id: 'lb-steigung', device: 'laufband', emoji: '⛰️', name: 'Laufband: Bergauf gehen',
    desc: 'Gehen mit Steigung: gelenkschonend, stärkt Po und Beine und bringt den Kreislauf in Schwung.',
    stages: [
      { text: '15 Min. bergauf am Stück', blocks: [LB_WARM, ['laufband-steigung', 900, 5, 'work'], lbCool(300)] },
      { text: '3 × (5 Min. bergauf + 2 Min. flach)', blocks: [LB_WARM, ...times(3, [['laufband-steigung', 300, 6, 'work'], ['laufband-gehen', 120, 4, 'easy', 'Flach gehen']]), lbCool(180)] },
      { text: '20 Min. bergauf am Stück', blocks: [LB_WARM, ['laufband-steigung', 1200, 6, 'work'], lbCool(300)] },
      { text: '4 × (4 Min. steil bergauf + 2 Min. flach)', blocks: [LB_WARM, ...times(4, [['laufband-steigung', 240, 7, 'work', 'Steil bergauf'], ['laufband-gehen', 120, 4, 'easy', 'Flach gehen']]), lbCool(180)] },
    ],
  },
  {
    id: 'ergo-intervall', device: 'ergometer', emoji: '🚴', name: 'Ergometer: Intervalle',
    desc: 'Kräftige und lockere Abschnitte im Wechsel. Kurz und wirksam für die Kondition.',
    stages: [
      { text: '5 × (1 Min. kräftig + 2 Min. locker)', blocks: [ERGO_WARM, ...times(5, [['ergo-kraeftig', 60, 7, 'work'], ['ergo-locker', 120, 4, 'easy']]), ergoCool(300)] },
      { text: '6 × (1,5 Min. kräftig + 2 Min. locker)', blocks: [ERGO_WARM, ...times(6, [['ergo-kraeftig', 90, 7, 'work'], ['ergo-locker', 120, 4, 'easy']]), ergoCool(240)] },
      { text: '5 × (2 Min. kräftig + 2 Min. locker)', blocks: [ERGO_WARM, ...times(5, [['ergo-kraeftig', 120, 7, 'work'], ['ergo-locker', 120, 4, 'easy']]), ergoCool(300)] },
      { text: '4 × (4 Min. kräftig + 2 Min. locker)', blocks: [ERGO_WARM, ...times(4, [['ergo-kraeftig', 240, 7, 'work'], ['ergo-locker', 120, 4, 'easy']]), ergoCool(180)] },
    ],
  },
  {
    id: 'ergo-ausdauer', device: 'ergometer', emoji: '🚲', name: 'Ergometer: Gleichmäßig',
    desc: 'Ruhiges, gleichmäßiges Treten, ideal für die Grundausdauer und zum Abschalten, gern mit Musik oder Podcast.',
    stages: [15, 20, 25, 30].map((m) => ({
      text: `${m} Min. gleichmäßig zügig`,
      blocks: [ERGO_WARM, ['ergo-locker', m * 60, 5, 'work', 'Gleichmäßig zügig treten'], ergoCool(300)],
    })),
  },
].map((p) => ({ ...p, kind: 'ausdauer', builtin: true, cooldown: true }));

export function cardioStage(plan, state = getState()) {
  const saved = state.cardio?.[plan.id]?.stage;
  const start = { einsteiger: 0, erfahren: 1, fortgeschritten: 2 }[fitness(state)] ?? 0;
  return Math.min(plan.stages.length - 1, saved ?? start);
}

function cardioSegments(plan, state) {
  const stage = plan.stages[cardioStage(plan, state)];
  const works = stage.blocks.filter((b) => b[3] === 'work').length;
  let k = 0;
  const segs = [{ type: 'prep', dur: 10, exId: stage.blocks[0][0] }];
  for (const [exId, dur, effort, type, label] of stage.blocks) {
    segs.push({ type, exId, dur, effort, label, ...(type === 'work' ? { round: ++k, rounds: works } : {}) });
  }
  if (useCooldown(plan, state)) {
    const cool = cooldownSegments();
    if (cool.length) segs.push({ type: 'rest', dur: 15 }, ...cool);
  }
  return segs;
}

export function allPlans(state = getState()) {
  return [...BUILTIN_PLANS, ...CARDIO_PROGRAMS, ...state.plans];
}

export function planById(id, state = getState()) {
  return allPlans(state).find((p) => p.id === id) || null;
}

export function isProgram(id) {
  return PROGRAM.includes(id);
}

// Nächster Programmtag aus dem Verlauf (A → B → C → D → A …).
export function nextProgramPlanId(history = getState().history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const idx = PROGRAM.indexOf(history[i].planId);
    if (idx >= 0) return PROGRAM[(idx + 1) % PROGRAM.length];
  }
  return PROGRAM[0];
}

// ---------- Aufgelöste Übungen eines Plans ----------
export function resolvedItems(plan, state = getState()) {
  if (plan.kind === 'ausdauer') {
    const ids = [...new Set(plan.stages[cardioStage(plan, state)].blocks.map((b) => b[0]))];
    return ids.filter((id) => isAllowed(EX[id], state.settings)).map((exId) => ({ exId, sets: 1, rest: 0, range: EX[exId].range }));
  }
  const out = [];
  const seen = new Set();
  const userVariants = new Set([...Object.keys(state.swaps), ...Object.values(state.swaps)]);
  for (const it of plan.items) {
    let exId = resolveEx(it.ex, state);
    if (!exId) continue;
    // Fortgeschrittene starten bei eingebauten Plänen eine Variante schwerer
    const hx = EX[exId].harder;
    if (plan.builtin && fitness(state) === 'fortgeschritten' && hx && !userVariants.has(exId) && isAllowed(EX[hx], state.settings)) exId = hx;
    // doppelte Übungen (z. B. durch Ersatz) nur in Kraftplänen vermeiden
    if (plan.kind === 'kraft' && seen.has(exId)) continue;
    seen.add(exId);
    const ex = EX[exId];
    out.push({ exId, sets: it.sets || 3, rest: it.rest || state.settings.restSec, range: it.range || ex.range });
  }
  return out;
}

export function timedConfig(plan, state = getState()) {
  const harder = plan.builtin && fitness(state) === 'fortgeschritten' && (plan.work ?? 40) >= 30;
  const work = (plan.work ?? 40) + (harder ? 5 : 0);
  const rest = harder ? Math.max(10, (plan.rest ?? 20) - 5) : plan.rest ?? 20;
  return {
    work, rest, rounds: plan.rounds ?? 3, roundRest: plan.roundRest ?? 60,
    warmup: plan.warmup ?? true, cooldown: plan.cooldown ?? true,
  };
}

export function useWarmup(plan, state = getState()) {
  return state.settings.warmup && (plan.warmup ?? true);
}
export function useCooldown(plan, state = getState()) {
  return state.settings.cooldown && (plan.cooldown ?? true);
}

// Ablauf eines Zeittrainings als Liste von Abschnitten.
export function buildTimedSegments(plan, state = getState()) {
  if (plan.kind === 'ausdauer') return cardioSegments(plan, state);
  const cfg = timedConfig(plan, state);
  const items = resolvedItems(plan, state).map((i) => i.exId);
  const segs = [];
  const warm = useWarmup(plan, state) ? warmupSegments(state) : [];
  segs.push({ type: 'prep', dur: 10, exId: warm[0]?.exId || items[0] });
  segs.push(...warm);
  if (warm.length) segs.push({ type: 'rest', dur: 15 });
  for (let r = 1; r <= cfg.rounds; r++) {
    items.forEach((exId, i) => {
      segs.push({ type: 'work', exId, dur: cfg.work, round: r, rounds: cfg.rounds });
      const lastInRound = i === items.length - 1;
      if (lastInRound) {
        if (r < cfg.rounds && cfg.roundRest > 0) segs.push({ type: 'roundrest', dur: cfg.roundRest, round: r, rounds: cfg.rounds });
      } else if (cfg.rest > 0) {
        segs.push({ type: 'rest', dur: cfg.rest, round: r, rounds: cfg.rounds });
      }
    });
  }
  if (useCooldown(plan, state)) {
    const cool = cooldownSegments();
    if (cool.length) segs.push({ type: 'rest', dur: 10 }, ...cool);
  }
  return segs;
}

// Geschätzte Dauer in Sekunden (Kraft: ca. 3 Sek. pro Wiederholung plus Pausen).
function estimateSeconds(plan, state = getState()) {
  if (plan.kind !== 'kraft') return buildTimedSegments(plan, state).reduce((sum, s) => sum + s.dur, 0);
  const perRep = Math.max(3, state.settings.secPerRep || 3) + 0.2;
  let sec = 0;
  for (const it of resolvedItems(plan, state)) {
    const ex = EX[it.exId];
    const avg = (it.range[0] + it.range[1]) / 2;
    const work = ex.mode === 'time' ? avg : avg * perRep;
    sec += it.sets * (work * (ex.perSide ? 2 : 1) + it.rest) + 25;
  }
  if (useWarmup(plan, state)) sec += warmupSegments(state).reduce((a, s) => a + s.dur, 0);
  if (useCooldown(plan, state)) sec += cooldownSegments().reduce((a, s) => a + s.dur, 0);
  return sec;
}

export function estimateMinutes(plan, state = getState()) {
  return Math.max(1, Math.round(estimateSeconds(plan, state) / 60));
}

export function planMeta(plan, state = getState()) {
  if (plan.kind === 'ausdauer') {
    return `Ausdauer · ca. ${estimateMinutes(plan, state)} Min. · Stufe ${cardioStage(plan, state) + 1} von ${plan.stages.length}`;
  }
  const n = resolvedItems(plan, state).length;
  const kind = plan.kind === 'kraft' ? 'Kraft' : 'Zeittraining';
  return `${kind} · ca. ${estimateMinutes(plan, state)} Min. · ${n} Übungen`;
}

export function cardioPrograms(state = getState()) {
  return CARDIO_PROGRAMS.filter((p) => state.settings.equipment[p.device]);
}

// ---------- Zufallsgenerator „Überrasch mich“ ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seededRandom = rng;

const SURPRISE_NAMES = ['Wundertüte', 'Glücksgriff', 'Joker-Training', 'Zufallstreffer', 'Überraschungs-Mix', 'Wildcard', 'Lucky Workout'];

export function generateSurprise({ minutes = 20, style = 'egal', seed = Date.now() } = {}, state = getState()) {
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const kind = style === 'egal' ? (rand() < 0.5 ? 'kraft' : 'zeit') : style;
  const maxLevel = fitness(state) === 'einsteiger' && state.history.length < 10 ? 2 : 3;
  const used = new Set();

  const choose = (cat, modes) => {
    const pool = EXERCISES.filter((e) => e.cat === cat && !e.machine && isAllowed(e, state.settings) && e.level <= maxLevel
      && !used.has(e.id) && (!modes || modes.includes(e.mode)));
    if (!pool.length) return null;
    const ex = pick(pool);
    used.add(ex.id);
    return ex.id;
  };

  // Übungen hinzufügen, solange die geschätzte Dauer noch passt
  const fill = (plan, cats, sets) => {
    for (const cat of cats) {
      const id = choose(cat, null);
      if (!id) continue;
      const item = plan.kind === 'kraft' ? { ex: [id], sets: cat === 'rumpf' ? 2 : sets } : { ex: [id] };
      const trial = { ...plan, items: [...plan.items, item] };
      if (plan.items.length >= 3 && estimateSeconds(trial, state) > (minutes + 1) * 60) break;
      plan.items.push(item);
    }
    return plan;
  };

  let plan;
  if (kind === 'kraft') {
    plan = fill({ kind: 'kraft', items: [], warmup: minutes > 10, cooldown: minutes > 20 },
      ['beine', 'push', 'pull', 'rumpf', 'beine', 'push', 'pull'], minutes <= 20 ? 2 : 3);
  } else {
    plan = fill({
      kind: 'zeit', items: [], work: 40, rest: 20, rounds: minutes <= 20 ? 2 : 3, roundRest: 45,
      warmup: minutes > 10, cooldown: minutes > 10,
    }, ['cardio', 'beine', 'push', 'cardio', 'rumpf', 'pull', 'beine'], 0);
  }
  return { ...plan, id: 'surprise', surprise: true, emoji: '🎲', name: pick(SURPRISE_NAMES), desc: 'Zufällig für dich zusammengestellt.' };
}

// Ersatzübungen derselben Kategorie (für „Übung tauschen“).
export function alternativesFor(exId, state = getState()) {
  const ex = EX[exId];
  return EXERCISES.filter((e) => e.id !== exId && e.cat === ex.cat && e.machine === ex.machine && isAllowed(e, state.settings))
    .sort((a, b) => a.level - b.level);
}
