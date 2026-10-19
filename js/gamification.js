// Punkte, Level, Abzeichen, Tages-Challenge und Sprüche.
import { EX } from './exercises.js';
import { isAllowed, PROGRAM } from './plans.js';
import { dayKey, streakInfo, totals, distinctExercises, thisWeekCount } from './stats.js';

export const CHALLENGE_XP = 15;

// ---------- Level ----------
const TITLES = [
  [1, 'Neueinsteiger'], [3, 'Durchstarter'], [5, 'Dranbleiber'], [8, 'Fitness-Fan'],
  [11, 'Kraftpaket'], [15, 'Athlet'], [20, 'Legende'],
];

export const xpNeeded = (level) => 100 + (level - 1) * 50;

export function totalXp(state) {
  const fromWorkouts = state.history.reduce((sum, h) => sum + (h.xp || 0), 0);
  return fromWorkouts + Object.keys(state.challenges).length * CHALLENGE_XP;
}

export function levelInfo(xp) {
  let level = 1, rest = xp;
  while (rest >= xpNeeded(level)) {
    rest -= xpNeeded(level);
    level += 1;
  }
  const title = [...TITLES].reverse().find(([l]) => level >= l)[1];
  const need = xpNeeded(level);
  return { level, title, into: rest, need, pct: Math.round((rest / need) * 100) };
}

export function xpParts({ durationSec, prs, completesGoal }) {
  const parts = [['Training abgeschlossen', 50], ['Trainingszeit', Math.min(60, Math.round(durationSec / 60)) * 2]];
  if (prs) parts.push([prs === 1 ? 'Neuer Rekord' : `${prs} neue Rekorde`, prs * 15]);
  if (completesGoal) parts.push(['Wochenziel erreicht', 30]);
  return parts;
}

// ---------- Abzeichen ----------
const count = (c, n) => c.history.length >= n;
export const BADGES = [
  { id: 'erstes', emoji: '🌱', name: 'Erster Schritt', desc: 'Dein erstes Training', test: (c) => count(c, 1) },
  { id: 'fuenf', emoji: '✋', name: 'High Five', desc: '5 Trainings', test: (c) => count(c, 5) },
  { id: 'zehn', emoji: '🔟', name: 'Zehnerpack', desc: '10 Trainings', test: (c) => count(c, 10) },
  { id: 'fuenfundzwanzig', emoji: '🥈', name: 'Viertelhundert', desc: '25 Trainings', test: (c) => count(c, 25) },
  { id: 'fuenfzig', emoji: '🥇', name: 'Halbes Hundert', desc: '50 Trainings', test: (c) => count(c, 50) },
  { id: 'hundert', emoji: '💯', name: 'Hundert!', desc: '100 Trainings', test: (c) => count(c, 100) },
  { id: 'wochenziel', emoji: '🎯', name: 'Ziel erreicht', desc: 'Einmal das Wochenziel geschafft', test: (c) => c.streak.best >= 1 },
  { id: 'serie2', emoji: '🔥', name: 'Feuer gefangen', desc: '2 Wochen in Folge das Wochenziel', test: (c) => c.streak.best >= 2 },
  { id: 'serie4', emoji: '📅', name: 'Ein Monat dran', desc: '4 Wochen in Folge das Wochenziel', test: (c) => c.streak.best >= 4 },
  { id: 'serie8', emoji: '🏅', name: 'Zwei Monate dran', desc: '8 Wochen in Folge das Wochenziel', test: (c) => c.streak.best >= 8 },
  { id: 'serie12', emoji: '👑', name: 'Unaufhaltsam', desc: '12 Wochen in Folge das Wochenziel', test: (c) => c.streak.best >= 12 },
  { id: 'rekord', emoji: '📈', name: 'Neuer Rekord', desc: 'Eine Bestleistung verbessert', test: (c) => c.prs >= 1 },
  { id: 'rekord10', emoji: '🚀', name: 'Rekordjäger', desc: '10 Bestleistungen verbessert', test: (c) => c.prs >= 10 },
  { id: 'aufgestiegen', emoji: '🆙', name: 'Aufgestiegen', desc: 'Zur schwereren Variante einer Übung gewechselt', test: (c) => c.upgrades >= 1 },
  { id: 'frueh', emoji: '🌅', name: 'Frühaufsteher', desc: 'Training vor 8 Uhr begonnen', test: (c) => c.history.some((h) => new Date(h.start).getHours() < 8) },
  { id: 'abend', emoji: '🌙', name: 'Nachteule', desc: 'Training ab 21 Uhr begonnen', test: (c) => c.history.some((h) => new Date(h.start).getHours() >= 21) },
  { id: 'wochenende', emoji: '🏖️', name: 'Wochenend-Held', desc: 'Samstag und Sonntag derselben Woche trainiert', test: (c) => weekendDouble(c.history) },
  { id: 'programm', emoji: '🗺️', name: 'Runde gedreht', desc: 'Alle vier Programmtage A bis D absolviert', test: (c) => PROGRAM.every((id) => c.history.some((h) => h.planId === id)) },
  { id: 'kraft10', emoji: '🏋️', name: 'Kraftpaket', desc: '10 Krafttrainings', test: (c) => c.history.filter((h) => h.kind === 'kraft').length >= 10 },
  { id: 'zeit10', emoji: '⚡', name: 'Ausdauer-Ass', desc: '10 Zeittrainings', test: (c) => c.history.filter((h) => h.kind === 'zeit').length >= 10 },
  { id: 'entdecker', emoji: '🧭', name: 'Entdecker', desc: '20 verschiedene Übungen gemacht', test: (c) => distinctExercises(c.history) >= 20 },
  { id: 'stunde', emoji: '⏳', name: 'Erste Stunde', desc: '60 Minuten Training insgesamt', test: (c) => c.totals.minutes >= 60 },
  { id: 'zehnstunden', emoji: '🕰️', name: 'Zehn Stunden', desc: '10 Stunden Training insgesamt', test: (c) => c.totals.minutes >= 600 },
  { id: 'wdh1000', emoji: '🔁', name: 'Tausender', desc: '1.000 Wiederholungen insgesamt', test: (c) => c.totals.reps >= 1000 },
  { id: 'stahlrumpf', emoji: '🧱', name: 'Stahlrumpf', desc: '60 Sek. Unterarmstütz am Stück (Krafttraining)', test: (c) => plank60(c.history) },
  { id: 'mutig', emoji: '🎲', name: 'Mutig', desc: 'Ein „Überrasch mich“-Training geschafft', test: (c) => c.history.some((h) => h.surprise) },
  { id: 'challenge10', emoji: '✅', name: 'Challenge-Jäger', desc: '10 Tages-Challenges erledigt', test: (c) => Object.keys(c.state.challenges).length >= 10 },
  { id: 'ausdauer1', emoji: '🚴', name: 'Ausdauer-Start', desc: 'Erste Ausdauer-Einheit (Gerät oder draußen)', test: (c) => c.totals.cardio >= 1 },
  { id: 'ausdauer10', emoji: '❤️', name: 'Herz-Kreislauf-Held', desc: '10 Ausdauer-Einheiten', test: (c) => c.totals.cardio >= 10 },
  { id: 'km10', emoji: '🛣️', name: '10 Kilometer', desc: '10 km insgesamt eingetragen', test: (c) => c.totals.km >= 10 },
  { id: 'km50', emoji: '🌍', name: '50 Kilometer', desc: '50 km insgesamt eingetragen', test: (c) => c.totals.km >= 50 },
  { id: 'stufe', emoji: '📶', name: 'Stufe hoch', desc: 'In einem Ausdauer-Programm eine Stufe aufgestiegen', test: (c) => (c.state.stageUps || 0) >= 1 },
  { id: 'gesichert', emoji: '💾', name: 'Gut gesichert', desc: 'Die erste Datensicherung gemacht', test: (c) => !!c.state.lastBackup },
  { id: 'level5', emoji: '⭐', name: 'Level 5', desc: 'Level 5 erreicht', test: (c) => c.level >= 5 },
  { id: 'level10', emoji: '🌟', name: 'Level 10', desc: 'Level 10 erreicht', test: (c) => c.level >= 10 },
];

function weekendDouble(history) {
  const sat = new Set();
  for (const h of history) {
    const d = new Date(h.start);
    if (d.getDay() === 6) sat.add(dayKey(h.start));
  }
  return history.some((h) => {
    const d = new Date(h.start);
    if (d.getDay() !== 0) return false;
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return sat.has(dayKey(prev.getTime()));
  });
}

function plank60(history) {
  return history.some((h) => h.kind === 'kraft' && h.exercises.some((e) => e.exId === 'unterarmstuetz' && e.sets.some((s) => s.sec >= 60)));
}

// Prüft alle Abzeichen und trägt neue ein. Gibt die neu verdienten zurück.
export function awardBadges(state) {
  const ctx = {
    state,
    history: state.history,
    totals: totals(state.history),
    streak: streakInfo(state.history, state.settings.weeklyGoal),
    prs: state.history.reduce((n, h) => n + (h.prs?.length || 0), 0),
    upgrades: state.upgrades || 0,
    level: levelInfo(totalXp(state)).level,
  };
  const fresh = [];
  for (const b of BADGES) {
    if (!state.badges[b.id] && b.test(ctx)) {
      state.badges[b.id] = Date.now();
      fresh.push(b);
    }
  }
  return fresh;
}

export function completesWeeklyGoal(state, now = Date.now()) {
  return thisWeekCount(state.history, now) + 1 === state.settings.weeklyGoal;
}

// ---------- Tages-Challenge ----------
const CHALLENGES = [
  { id: 'c-kniebeuge', ex: 'kniebeuge', text: 'Mach 20 Kniebeugen am Stück, ganz sauber.' },
  { id: 'c-plank-knie', ex: 'unterarmstuetz-knie', text: 'Halte 30 Sek. den Unterarmstütz auf Knien.' },
  { id: 'c-plank', ex: 'unterarmstuetz', text: 'Schaffst du 45 Sek. Unterarmstütz?' },
  { id: 'c-wandsitz', ex: 'wandsitzen', text: 'Halte 40 Sek. Wandsitzen, zum Beispiel während der Kaffee durchläuft.' },
  { id: 'c-marsch', ex: 'marschieren', text: '2 Minuten Marschieren mit hohen Knien, gern mit Musik.' },
  { id: 'c-beckenheben', ex: 'beckenheben', text: '15 Beckenheben, oben jeweils 2 Sek. halten.' },
  { id: 'c-ausfall', ex: 'ausfallschritt', text: '10 Ausfallschritte rückwärts pro Bein.' },
  { id: 'c-dehnen', ex: 'beinrueckseite-dehnung', text: 'Dehne 1 Minute pro Bein die Beinrückseite.' },
  { id: 'c-boxen', ex: 'schattenboxen', text: '1 Minute Schattenboxen, so schnell du kannst.' },
  { id: 'c-waden', ex: 'wadenheben', text: '25 Wadenheben, zum Beispiel beim Zähneputzen.' },
  { id: 'c-curls', ex: 'hammercurl', text: '15 Hammercurls mit langsamem Absenken (3 Sek.).' },
  { id: 'c-koffer', ex: 'koffertragen', text: 'Trag eine Hantel 45 Sek. pro Seite durch die Wohnung.' },
  { id: 'c-treppe', ex: null, text: 'Nimm heute überall die Treppe statt Aufzug oder Rolltreppe.' },
  { id: 'c-spazieren', ex: null, text: 'Geh heute 20 Minuten zügig spazieren.' },
  { id: 'c-wasser', ex: null, text: 'Trink heute über den Tag verteilt 2 Liter Wasser.' },
  { id: 'c-brust', ex: 'brust-dehnung', text: 'Dehne heute zweimal die Brust am Türrahmen, je 30 Sek. pro Seite.' },
  { id: 'c-deadbug', ex: 'dead-bug', text: '12 langsame Käfer (Dead Bugs), ganz kontrolliert.' },
  { id: 'c-superman', ex: 'superman', text: '15 Superman, oben jeweils kurz halten.' },
  { id: 'c-wandliegestuetz', ex: 'liegestuetz-wand', text: '15 Liegestütze an der Wand auf den Fäusten.' },
  { id: 'c-kindhaltung', ex: 'kindhaltung', text: 'Gönn dir vorm Schlafen 1 Minute Kindhaltung.' },
];

function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619);
  return x >>> 0;
}

export function todaysChallenge(state, now = Date.now()) {
  const key = dayKey(now);
  const pool = CHALLENGES.filter((c) => !c.ex || isAllowed(EX[c.ex], state.settings));
  const ch = pool[hash(key) % pool.length];
  return { ...ch, key, done: !!state.challenges[key] };
}

// ---------- Sprüche ----------
const QUOTES = [
  'Jedes Training zählt, auch das kurze.',
  'Du musst nicht perfekt sein, nur dranbleiben.',
  'Stark wird man nicht an einem Tag, sondern an vielen.',
  'Der schwerste Teil ist der Anfang, und den hast du schon geschafft.',
  'Heute ein bisschen besser als gestern.',
  'Kleine Schritte bringen dich auch ans Ziel.',
  'Dein zukünftiges Ich klatscht schon Beifall.',
  'Muskeln wachsen in der Pause. Das Training ist der Startschuss.',
  'Motivation bringt dich in Gang, Gewohnheit hält dich in Bewegung.',
  'Sauber vor schwer: Technik ist dein bester Trainingspartner.',
  '30 Minuten sind gerade mal 2 % deines Tages.',
  'Fortschritt statt Perfektion.',
  'Wer sich bewegt, bewegt etwas.',
  'Mach es für dich. Nur für dich.',
  'Ausreden verbrennen keine Kalorien.',
  'Ein schlechtes Training gibt es nicht, nur ein ausgelassenes.',
];

export function quoteOfTheDay(now = Date.now()) {
  return QUOTES[hash(`q${dayKey(now)}`) % QUOTES.length];
}
