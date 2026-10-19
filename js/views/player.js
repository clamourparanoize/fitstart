// Trainings-Player: Krafttraining (Sätze + Pausen), Zeittraining (Intervalle) und Ausdauer an Geräten.
// Grundsätze: Neue Übungen werden zuerst erklärt, erst dann laufen Countdowns.
// Freihändig: Sätze laufen auf Wunsch automatisch im Takt, ein Tipp irgendwo auf den Bildschirm = „Bereit“/„Fertig“.
import { EX, spokenName } from '../exercises.js';
import { getState, save } from '../store.js';
import { h, s, icon, openSheet, confirmDialog, toast, fmtClock, stepper, levelDots, toggleRow } from '../ui.js';
import { signal, say, keepAwake, unlockAudio, stopSpeech, speechAvailable } from '../feedback.js';
import {
  finishSession, discardSession, prepareItem, upgradeExercise, introMode, isIntroduced, markIntroduced,
} from '../session.js';
import { alternativesFor, EFFORT } from '../plans.js';
import { navigate, setGuard, clearGuard, leaveTo, curIdx } from '../nav.js';
import { CAT_EMOJI, exBadge, targetText } from './common.js';
import { setResult } from './summary.js';

const C = 2 * Math.PI * 45;
const REST_TIPS = [
  'Atme ruhig und tief durch.',
  'Trink einen Schluck Wasser.',
  'Schüttel Arme und Beine locker aus.',
  'Denk an die Technik: sauber vor schnell.',
  'Stark! Gleich geht es weiter.',
];

let baseIdx = 0;     // Verlaufsposition des Trainings, um es sauber zu verlassen
let onBack = null;   // was die Zurück-Taste des Handys im Training tut

export function renderPlayer() {
  const a = getState().active;
  if (!a) {
    navigate('#/heute', { replace: true });
    return null;
  }
  baseIdx = history.state?.guard ? curIdx() - 1 : curIdx();
  setGuard(() => onBack?.());
  const view = a.kind === 'kraft' ? strengthPlayer(a) : timedPlayer(a);
  return {
    el: view.el,
    destroy() {
      clearGuard();
      onBack = null;
      view.destroy();
    },
  };
}

// ---------- Hilfen ----------
function complete(extra) {
  stopSpeech();
  const res = finishSession(extra);
  setResult(res);
  leaveTo('#/geschafft', baseIdx);
}

function leave() {
  stopSpeech();
  leaveTo('#/heute', baseIdx);
}

function ring() {
  const bar = s('circle', { class: 'bar', cx: 50, cy: 50, r: 45, fill: 'none', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': 0 });
  const svg = s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    s('circle', { class: 'track', cx: 50, cy: 50, r: 45, fill: 'none', 'stroke-width': 7 }), bar);
  const time = h('div', { class: 'ring-time', role: 'timer' }, '0:00');
  const label = h('div', { class: 'ring-label' });
  const el = h('div', { class: 'ring-wrap' }, svg, h('div', { class: 'ring-center' }, time, label));
  return {
    el,
    set(remMs, totalMs, text) {
      time.textContent = fmtClock(remMs / 1000);
      const frac = totalMs > 0 ? Math.max(0, Math.min(1, remMs / totalMs)) : 0;
      bar.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
      if (text != null) label.textContent = text;
    },
  };
}

function howto(ex, { open = false } = {}) {
  return h('details', { class: 'howto', open },
    h('summary', null, icon('info'), `So geht’s: ${ex.name}`, icon('right', 'chev')),
    h('ol', null, ex.steps.map((t) => h('li', null, t))),
    h('ul', { class: 'muted small' }, ex.tips.map((t) => h('li', null, t))),
    speechAvailable() ? h('button', { class: 'btn small', style: { marginBottom: '14px' }, onclick: () => say(`${ex.name}. ${ex.steps.join(' ')}`, { force: true }) }, icon('speaker'), 'Vorlesen') : null,
  );
}

// Erklärung einer Übung vor dem Start. mode 'full' wartet auf „Bereit“, 'short' startet nach der Ansage.
function introPanel(ex, { mode, info, label, onReady }) {
  const full = mode === 'full';
  let done = false;
  let timer = null;
  let autoStarted = false;
  const fill = h('div');
  const bar = h('div', { class: 'auto-bar hidden' }, fill);
  const ready = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    stopSpeech();
    onReady();
  };
  const startAuto = (ms) => {
    if (done || autoStarted) return;
    autoStarted = true;
    bar.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = `width ${ms}ms linear`;
      fill.style.width = '100%';
    }));
    timer = setTimeout(ready, ms);
  };
  const name = label || ex.name;
  const text = full
    ? `${spokenName(ex)}. So geht’s: ${ex.steps.join(' ')} Tipp: ${ex.tips[0]} Tippe auf Bereit, wenn du so weit bist.`
    : `Als Nächstes: ${label || spokenName(ex)}. ${ex.tips[0]}`;
  const speak = () => say(text, { onEnd: () => { if (!full) startAuto(3500); } });
  const el = h('div', { class: 'intro' },
    h('div', { class: 'phase-label' }, full ? 'Neue Übung · erst in Ruhe ansehen' : 'Gleich geht’s los'),
    h('div', { class: 'ex-title' }, name),
    h('div', { class: 'ex-sub' }, `${CAT_EMOJI[ex.cat]} ${ex.muscles}`),
    info ? h('div', { class: 'intro-info' }, info) : null,
    ex.wrist === 'fist' ? h('div', { class: 'hint-box' }, icon('info'), 'Auf den Fäusten, Handgelenk gerade halten.') : null,
    h('ol', { class: 'intro-steps' }, ex.steps.map((t) => h('li', null, t))),
    full
      ? h('ul', { class: 'intro-tips' }, ex.tips.map((t) => h('li', null, t)))
      : h('p', { class: 'intro-tips' }, `💡 ${ex.tips[0]}`),
    bar,
  );
  setTimeout(() => { if (!done) speak(); }, 250);
  return { el, ready, speak, cancel() { done = true; clearTimeout(timer); } };
}

function introFoot({ onReady, onRepeat, extra }) {
  const tap = getState().settings.tapAnywhere;
  return [
    h('button', { class: 'btn primary big block', onclick: onReady }, icon('play'), 'Bereit, los geht’s'),
    h('div', { class: 'row' },
      speechAvailable() ? h('button', { class: 'btn small', style: { flex: 1 }, onclick: onRepeat }, icon('speaker'), 'Nochmal vorlesen') : null,
      extra,
    ),
    tap ? h('p', { class: 'tap-hint' }, 'oder irgendwo auf den Bildschirm tippen') : null,
  ];
}

// Tipp irgendwo auf den Bildschirm löst die Hauptaktion aus (nicht auf Knöpfen und Feldern).
function tapZone(root, getAction, getLastPaint) {
  root.addEventListener('click', (e) => {
    if (!getState().settings.tapAnywhere) return;
    if (e.target.closest('button, a, input, select, textarea, label, details, .stepper, .no-tap')) return;
    if (performance.now() - getLastPaint() < 700) return;
    const fn = getAction();
    if (fn) fn();
  });
}

// Zählt nur Zeit, in der wirklich trainiert wird (keine langen Unterbrechungen).
function activityTracker(a, isActive) {
  let last = Date.now();
  let n = 0;
  const id = setInterval(() => {
    const now = Date.now();
    const d = now - last;
    last = now;
    if (isActive() && d < 120000) a.activeMs = (a.activeMs || 0) + d;
    if (++n % 5 === 0) save();
  }, 1000);
  return () => clearInterval(id);
}

function exitSheet(a, { canFinish, onFinish, onResume }) {
  const { close } = openSheet(h('div', { class: 'stack' },
    h('h2', null, 'Training unterbrechen?'),
    h('p', { class: 'muted' }, 'Du kannst später genau hier weitermachen.'),
    h('button', { class: 'btn primary block', onclick: async () => { await close(); leave(); } }, icon('pause'), 'Später weitermachen'),
    canFinish ? h('button', { class: 'btn block', onclick: async () => { await close(); onFinish(); } }, icon('flag'), 'Jetzt beenden & speichern') : null,
    h('button', {
      class: 'btn danger block',
      onclick: async () => {
        await close();
        if (await confirmDialog({ title: 'Training verwerfen?', text: 'Dieses Training wird nicht gespeichert.', ok: 'Verwerfen', danger: true })) {
          discardSession();
          leave();
        }
      },
    }, icon('trash'), 'Verwerfen'),
    h('button', { class: 'btn ghost block', onclick: async () => { await close(); onResume?.(); } }, 'Weiter trainieren'),
  ));
}

// =====================================================================
// Zeitgesteuerter Ablauf (Zirkel, Aufwärmen, Dehnen, Ausdauer an Geräten)
// =====================================================================
const MOVE_TYPES = ['prep', 'warmup', 'work', 'easy', 'cooldown'];
const PHASE_LABEL = {
  prep: () => 'Mach dich bereit',
  warmup: (sg) => (EX[sg.exId]?.machine ? 'Einlaufen' : 'Aufwärmen'),
  work: (sg) => {
    if (sg.effort) return sg.rounds > 1 ? `Belastung ${sg.round}/${sg.rounds}` : 'Belastung';
    return sg.rounds > 1 ? `Übung · Runde ${sg.round}/${sg.rounds}` : 'Übung';
  },
  easy: () => 'Locker weiter',
  rest: () => 'Pause',
  roundrest: (sg) => `Runde ${sg.round} geschafft · Pause`,
  cooldown: (sg) => (EX[sg.exId]?.machine ? 'Ausklingen' : 'Dehnen & Entspannen'),
};
const segName = (sg) => sg.label || EX[sg.exId]?.name || '';
const minText = (sec) => (sec >= 60 ? `${String(Math.round(sec / 6) / 10).replace('.', ',')} Min.` : `${sec} Sek.`);

function timedView(a, r, { title, onDone, skipLabel, onSkip, onExit }) {
  const root = h('div', { class: 'player' });
  const subEl = h('span');
  const progFill = h('div', { style: { width: '0%' } });
  const body = h('div', { class: 'player-body' });
  const foot = h('div', { class: 'player-foot' });
  const totalMs = r.segments.reduce((sum, sg) => sum + sg.dur * 1000, 0);
  let refs = {};
  let intro = null;
  let action = null;
  let lastPaint = 0;
  let iv = null;

  const remaining = () => (r.paused ? r.remaining : Math.max(0, r.endsAt - Date.now()));
  const seg = () => r.segments[r.seg];
  const nextMove = (i) => r.segments.slice(i + 1).find((sg) => sg.exId && sg.type !== 'prep');
  const firstInRound = (i) => {
    const sg = r.segments[i];
    return sg.type === 'work' && !r.segments.slice(0, i).some((x) => x.type === 'work' && x.round === sg.round);
  };

  function logCurrent() {
    const sg = seg();
    if (!sg || r.intro) return;
    const loggable = sg.type === 'work' || sg.type === 'easy' || (EX[sg.exId]?.machine && sg.type !== 'prep');
    if (!loggable) return;
    const done = Math.round((sg.dur * 1000 - remaining()) / 1000);
    if (done >= 5) r.log.push({ exId: sg.exId, sec: done });
  }

  function introFor(i) {
    const sg = r.segments[i];
    if (!sg?.exId || !MOVE_TYPES.includes(sg.type)) return null;
    if (isIntroduced(a, sg.exId)) return null;
    const mode = introMode(sg.exId);
    if (mode === 'none') {
      markIntroduced(a, sg.exId);
      return null;
    }
    return { exId: sg.exId, mode };
  }

  function announce(i, { afterIntro = false } = {}) {
    const sg = r.segments[i];
    const ex = sg.exId ? EX[sg.exId] : null;
    const nx = nextMove(i);
    const effort = sg.effort ? ` Anstrengung ${sg.effort} von 10.` : '';
    if (afterIntro && sg.type !== 'rest') {
      signal('go');
      say(`Los geht’s!${effort}`);
      return;
    }
    switch (sg.type) {
      case 'prep': signal('tick'); say(`Mach dich bereit. Als Erstes: ${spokenName(ex)}.`); break;
      case 'warmup': signal('go'); say(`${sg.label || spokenName(ex)}, ${minText(sg.dur).replace('Sek.', 'Sekunden').replace('Min.', 'Minuten')}.${effort}`); break;
      case 'work': signal('go'); say(`${firstInRound(i) && sg.round > 1 && !sg.effort ? `Runde ${sg.round}. ` : ''}${sg.label || spokenName(ex)}.${effort || ' Los!'}`); break;
      case 'easy': signal('rest'); say(`Locker weiter: ${sg.label || spokenName(ex)}.${effort}`); break;
      case 'rest': {
        signal('rest');
        const nex = nx ? EX[nx.exId] : null;
        // kurze Erklärung der nächsten Übung gleich in der Pause erledigen
        if (nex && !isIntroduced(a, nex.id) && introMode(nex.id) === 'short' && sg.dur >= 10) {
          markIntroduced(a, nex.id);
          say(`Pause. Als Nächstes: ${spokenName(nex)}. ${nex.tips[0]}`);
        } else {
          say(nex ? `Pause. Als Nächstes: ${spokenName(nex)}.` : 'Pause.');
        }
        break;
      }
      case 'roundrest': signal('rest'); say(`Runde ${sg.round} geschafft! ${sg.dur} Sekunden Pause.${nx ? ` Danach: ${spokenName(EX[nx.exId])}.` : ''}`); break;
      case 'cooldown': signal('rest'); say(`${sg.label || spokenName(ex)}. ${ex?.machine ? 'Ganz locker ausklingen lassen.' : 'Ganz entspannt atmen.'}`); break;
      default: break;
    }
  }

  function go(i) {
    if (i > r.seg) logCurrent();
    if (i >= r.segments.length) {
      r.seg = r.segments.length;
      r.paused = true;
      r.intro = null;
      save();
      stopTimer();
      onDone();
      return;
    }
    r.seg = Math.max(0, i);
    r.remaining = seg().dur * 1000;
    r.half = false;
    r.lastBeep = null;
    r.cueMin = null;
    const it = introFor(r.seg);
    if (it) {
      r.intro = it;
      r.paused = true;
      save();
      paint();
      return;
    }
    r.intro = null;
    if (!r.paused) r.endsAt = Date.now() + r.remaining;
    save();
    paint();
    if (!r.paused) announce(r.seg);
  }

  function introReady() {
    const it = r.intro;
    if (!it) return;
    unlockAudio();
    markIntroduced(a, it.exId);
    r.intro = null;
    r.started = true;
    r.paused = false;
    if (seg().type === 'prep') {
      go(r.seg + 1);
      return;
    }
    r.endsAt = Date.now() + r.remaining;
    save();
    paint();
    announce(r.seg, { afterIntro: true });
  }

  function play() {
    unlockAudio();
    if (r.intro) {
      intro?.ready();
      return;
    }
    if (!r.paused) return;
    r.paused = false;
    r.endsAt = Date.now() + r.remaining;
    if (!r.started) {
      r.started = true;
      announce(r.seg);
    }
    save();
    paintPlay();
  }

  function pause() {
    if (r.paused) return;
    r.remaining = remaining();
    r.paused = true;
    save();
    stopSpeech();
    paintPlay();
  }

  function paintPlay() {
    if (!refs.playBtn) return;
    refs.playBtn.innerHTML = '';
    refs.playBtn.append(icon(r.paused ? 'play' : 'pause'));
  }

  function paint() {
    lastPaint = performance.now();
    intro?.cancel();
    intro = null;
    action = null;
    refs = {};
    body.innerHTML = '';
    foot.innerHTML = '';
    const sg = seg();
    if (!sg) return;
    if (r.intro) {
      const ex = EX[r.intro.exId];
      const target = sg.type === 'prep' ? nextMove(r.seg) : sg;
      const info = target?.effort
        ? `${minText(target.dur)} · Anstrengung ${target.effort}/10: ${EFFORT[target.effort] || ''}`
        : target ? `${minText(target.dur)}${ex.perSide ? ' · Seitenwechsel zur Halbzeit' : ''}` : null;
      root.className = 'player phase-intro';
      intro = introPanel(ex, { mode: r.intro.mode, info, label: target?.label, onReady: introReady });
      body.append(intro.el);
      foot.append(...introFoot({
        onReady: () => intro.ready(),
        onRepeat: () => intro.speak(),
        extra: h('button', {
          class: 'btn small', style: { flex: 1 },
          onclick: () => { markIntroduced(a, r.intro.exId); r.intro = null; r.paused = false; r.started = true; go(r.seg + 1); },
        }, icon('next'), 'Übung auslassen'),
      }));
      action = () => intro?.ready();
      return;
    }

    root.className = `player phase-${sg.type}`;
    const isRest = sg.type === 'rest' || sg.type === 'roundrest';
    const focus = isRest ? nextMove(r.seg) : sg.type === 'prep' ? nextMove(r.seg) || sg : sg;
    const fex = focus?.exId ? EX[focus.exId] : null;
    refs.ring = ring();
    const nameEl = h('div', { class: 'ex-title center' }, isRest ? 'Durchatmen' : focus ? segName(focus) : '');
    const subText = isRest
      ? (fex ? `Gleich: ${segName(focus)}` : 'Gleich geschafft!')
      : fex ? [
        `${CAT_EMOJI[fex.cat]} ${fex.muscles}`,
        fex.perSide ? 'Seitenwechsel zur Halbzeit' : null,
        fex.wrist === 'fist' ? 'auf Fäusten' : null,
      ].filter(Boolean).join(' · ') : '';
    const nx = isRest || sg.type === 'prep' ? null : nextMove(r.seg);
    body.append(
      h('div', { class: 'stack-sm' },
        h('div', { class: 'phase-label center' }, PHASE_LABEL[sg.type](sg)),
        nameEl,
        h('div', { class: 'ex-sub center' }, subText),
        sg.effort ? h('div', { class: 'effort center' }, `Anstrengung ${sg.effort}/10 · ${EFFORT[sg.effort] || ''}`) : null,
      ),
      refs.ring.el,
      nx ? h('div', { class: 'next-up' }, exBadge(nx.exId),
        h('div', null, h('div', { class: 'label' }, 'Als Nächstes'), h('div', { style: { fontWeight: 650 } }, `${segName(nx)}${nx.effort ? ` · ${minText(nx.dur)}` : ''}`))) : null,
      fex ? howto(fex, { open: isRest && !isIntroduced(a, fex.id) }) : null,
    );
    refs.playBtn = h('button', { class: 'icon-btn main', 'aria-label': 'Start oder Pause', onclick: () => (r.paused ? play() : pause()) });
    foot.append(h('div', { class: 'controls' },
      h('button', {
        class: 'icon-btn', 'aria-label': 'Zurück',
        onclick: () => {
          const elapsed = seg() ? seg().dur * 1000 - remaining() : 0;
          go(elapsed > 3000 ? r.seg : r.seg - 1);
        },
      }, icon('prev')),
      refs.playBtn,
      h('button', { class: 'icon-btn', 'aria-label': 'Überspringen', onclick: () => go(r.seg + 1) }, icon('next')),
    ));
    paintPlay();
    tick();
  }

  function tick() {
    const sg = seg();
    if (!sg) return;
    const rem = remaining();
    const after = r.segments.slice(r.seg + 1).reduce((sum, x) => sum + x.dur * 1000, 0);
    const left = (r.intro ? sg.dur * 1000 : rem) + after;
    subEl.textContent = `noch ${fmtClock(left / 1000)} Min.`;
    progFill.style.width = `${Math.round((1 - left / totalMs) * 100)}%`;
    if (r.intro || !refs.ring) return;
    const secLeft = Math.ceil(rem / 1000);
    if (!r.paused && secLeft <= 3 && secLeft >= 1 && r.lastBeep !== secLeft) {
      r.lastBeep = secLeft;
      signal('tick');
    }
    const ex = sg.exId ? EX[sg.exId] : null;
    if (!r.paused && !r.half && ex?.perSide && sg.type !== 'prep' && rem <= sg.dur * 500) {
      r.half = true;
      signal('go');
      say('Seite wechseln!');
      toast('Seite wechseln', 1800);
    }
    // bei langen Abschnitten (Geräte) die Restzeit ansagen
    if (!r.paused && sg.dur >= 180 && rem > 5000 && rem < sg.dur * 1000 - 30000) {
      const minLeft = Math.ceil(rem / 60000);
      if (minLeft !== r.cueMin && (minLeft % 5 === 0 || minLeft === 1)) {
        r.cueMin = minLeft;
        say(minLeft === 1 ? 'Noch eine Minute.' : `Noch ${minLeft} Minuten.`);
      }
    }
    refs.ring.set(rem, sg.dur * 1000, r.paused ? 'pausiert' : ex?.perSide && sg.type !== 'prep' ? (r.half ? '2. Seite' : '1. Seite') : '');
    if (!r.paused && rem <= 0) go(r.seg + 1);
  }

  const stopTimer = () => { clearInterval(iv); iv = null; };

  root.append(
    h('div', { class: 'phase-bg' }),
    h('div', { class: 'player-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Training unterbrechen', onclick: () => { pause(); intro?.cancel(); onExit(); } }, icon('close')),
      h('div', { class: 'title' }, h('b', null, title), subEl),
      skipLabel ? h('button', { class: 'btn small', onclick: () => { logCurrent(); stopTimer(); intro?.cancel(); stopSpeech(); onSkip(); } }, skipLabel) : null,
    ),
    h('div', { class: 'player-progress' }, progFill),
    body,
    foot,
  );
  root.addEventListener('pointerdown', unlockAudio, { once: true });
  tapZone(root, () => action, () => lastPaint);

  // Nach einer Unterbrechung (App geschlossen) pausiert weitermachen statt weiterzulaufen
  if (r.started && !r.paused) {
    r.remaining = Math.max(1000, r.endsAt - Date.now());
    r.paused = true;
    save();
  }
  if (!r.intro && !r.started) {
    const it = introFor(r.seg);
    if (it) r.intro = it;
  }
  paint();
  iv = setInterval(tick, 200);
  if (!r.started && !r.intro) setTimeout(() => play(), 300);

  return {
    el: root,
    destroy() { stopTimer(); intro?.cancel(); },
    pause,
    resume: () => { if (!r.intro) play(); },
  };
}

// Werte vom Display nach einer Ausdauer-Einheit
function valuesView(a, { onSave }) {
  const km = h('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: 'z. B. 3,2', 'aria-label': 'Kilometer' });
  const kcal = h('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: 'z. B. 250', 'aria-label': 'Kalorien' });
  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };
  const el = h('div', { class: 'player' },
    h('div', { class: 'player-top' }, h('div', { class: 'title' }, h('b', null, `${a.emoji} ${a.name}`), h('span', null, 'Geschafft!'))),
    h('div', { class: 'player-body' },
      h('div', { class: 'center stack-sm' },
        h('div', { style: { fontSize: '56px' } }, '🏁'),
        h('div', { class: 'ex-title' }, 'Was zeigt das Display?'),
        h('p', { class: 'muted' }, 'Trag ein, was dein Gerät anzeigt. Beides ist freiwillig.'),
      ),
      h('label', { class: 'field' }, h('span', null, 'Strecke in km'), km),
      h('label', { class: 'field' }, h('span', null, 'Kalorien (kcal)'), kcal),
    ),
    h('div', { class: 'player-foot' },
      h('button', { class: 'btn primary big block', onclick: () => onSave({ km: num(km.value), kcal: num(kcal.value) }) }, icon('check'), 'Speichern'),
      h('button', { class: 'btn ghost block', onclick: () => onSave({}) }, 'Ohne Werte speichern'),
    ),
  );
  return { el, destroy() {} };
}

function timedPlayer(a) {
  keepAwake(true);
  const container = h('div');
  let view = null;
  const stopAct = activityTracker(a, () => a.phase !== 'values' && !a.timed.paused && !a.timed.intro);

  const showValues = () => {
    view?.destroy();
    container.innerHTML = '';
    a.phase = 'values';
    save();
    view = valuesView(a, { onSave: (extra) => complete(extra) });
    container.append(view.el);
  };
  const finish = () => (a.kind === 'ausdauer' ? showValues() : complete());
  const openExit = () => {
    if (a.phase === 'values') return;
    view?.pause?.();
    exitSheet(a, { canFinish: a.timed.log.length > 0, onFinish: finish });
  };
  onBack = openExit;

  if (a.phase === 'values') {
    showValues();
  } else {
    view = timedView(a, a.timed, {
      title: `${a.emoji} ${a.name}`,
      onExit: openExit,
      onDone: () => { signal('success'); say('Geschafft! Super gemacht.'); finish(); },
    });
    container.append(view.el);
  }
  return {
    el: container,
    destroy() { view?.pause?.(); view?.destroy(); stopAct(); keepAwake(false); },
  };
}

// =====================================================================
// Krafttraining
// =====================================================================
function strengthPlayer(a) {
  keepAwake(true);
  const container = h('div');
  let sub = null;
  const stopAct = activityTracker(a, () => {
    if (a.phase === 'warmup') return !a.warm.paused && !a.warm.intro;
    if (a.phase === 'cooldown') return !a.cool.paused && !a.cool.intro;
    return a.phase !== 'review';
  });
  const hasLogs = () => a.items.some((it) => it.logs.length);

  const toReview = () => {
    a.phase = 'review';
    a.restEndsAt = null;
    save();
    show();
  };
  const finish = () => (a.auto && hasLogs() ? toReview() : complete());
  const afterCool = () => (a.auto ? toReview() : complete());
  const finishMain = () => {
    a.restEndsAt = null;
    if (a.cool) {
      a.phase = 'cooldown';
      save();
      signal('success');
      say('Krafttraining geschafft! Zum Schluss noch etwas Dehnen.');
      show();
    } else {
      signal('success');
      say('Geschafft! Super gemacht.');
      finish();
    }
  };
  const openExit = () => {
    if (a.phase === 'review') return;
    sub?.pause?.();
    exitSheet(a, { canFinish: hasLogs(), onFinish: finish, onResume: () => sub?.resume?.() });
  };
  onBack = openExit;

  function show() {
    sub?.destroy();
    container.innerHTML = '';
    if (a.phase === 'warmup' && a.warm) {
      const toMain = () => {
        a.phase = 'main';
        save();
        say('Aufwärmen geschafft. Jetzt geht es ans Krafttraining.');
        show();
      };
      sub = timedView(a, a.warm, { title: 'Aufwärmen', onDone: toMain, skipLabel: 'Überspringen', onSkip: toMain, onExit: openExit });
    } else if (a.phase === 'cooldown' && a.cool) {
      const done = () => { signal('success'); say('Geschafft! Super gemacht.'); afterCool(); };
      sub = timedView(a, a.cool, { title: 'Dehnen zum Abschluss', onDone: done, skipLabel: 'Überspringen', onSkip: afterCool, onExit: openExit });
    } else if (a.phase === 'review') {
      sub = reviewView(a, { onSave: () => complete() });
    } else {
      sub = mainView(a, { onExit: openExit, finishMain });
    }
    container.append(sub.el);
  }
  show();

  return {
    el: container,
    destroy() { sub?.pause?.(); sub?.destroy(); stopAct(); keepAwake(false); },
  };
}

function nextIncomplete(a, from) {
  for (let k = 1; k <= a.items.length; k++) {
    const j = (from + k) % a.items.length;
    const it = a.items[j];
    if (!it.skipped && it.logs.length < it.sets) return j;
  }
  return null;
}

function mainView(a, { onExit, finishMain }) {
  const root = h('div', { class: 'player' });
  const st = () => getState().settings;
  let refs = {};
  let hold = null;      // Halte-Timer im manuellen Modus
  let run = null;       // automatischer Satz: { phase: 'lead'|'run', endsAt, total, ... }
  let intro = null;
  let action = null;
  let lastPaint = 0;
  let iv = null;

  const doneSets = () => a.items.reduce((n, it) => n + it.logs.length, 0);
  const totalSets = () => a.items.reduce((n, it) => n + (it.skipped ? it.logs.length : Math.max(it.sets, it.logs.length)), 0);
  const unitOf = (ex) => (ex.mode === 'time' ? 'Sek.' : 'Wdh.');
  const unitWord = (ex) => (ex.mode === 'time' ? 'Sekunden' : 'Wiederholungen');

  function topBar() {
    refs.sub = h('span');
    return [
      h('div', { class: 'player-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Training unterbrechen', onclick: () => { pauseRun(); onExit(); } }, icon('close')),
        h('div', { class: 'title' }, h('b', null, `${a.emoji} ${a.name}`), refs.sub),
        h('button', { class: 'icon-btn', 'aria-label': 'Übersicht', onclick: overview }, icon('menu')),
      ),
      h('div', { class: 'player-progress' }, h('div', { style: { width: `${Math.round((doneSets() / Math.max(1, totalSets())) * 100)}%` } })),
    ];
  }

  function render() {
    lastPaint = performance.now();
    intro?.cancel();
    intro = null;
    hold = null;
    run = null;
    action = null;
    root.innerHTML = '';
    refs = {};
    if (a.idx == null || !a.items[a.idx]) {
      const nx = nextIncomplete(a, -1);
      if (nx == null) { finishMain(); return; }
      a.idx = nx;
    }
    const it = a.items[a.idx];
    if (a.restEndsAt) {
      renderRest();
    } else if (!isIntroduced(a, it.exId) && introMode(it.exId) !== 'none') {
      renderIntro(it);
      return;
    } else {
      if (!isIntroduced(a, it.exId)) markIntroduced(a, it.exId);
      if (a.auto) renderAuto(it); else renderSet(it);
    }
    tick();
  }

  // ----- Erklärung vor der ersten Runde einer Übung -----
  function renderIntro(it) {
    const ex = EX[it.exId];
    root.className = 'player phase-intro';
    intro = introPanel(ex, {
      mode: introMode(it.exId),
      info: `${it.sets} Sätze · Ziel: ${it.target} ${unitOf(ex)}${ex.perSide ? ' je Seite' : ''}${ex.weighted ? ` · ${String(it.kg ?? a.kg).replace('.', ',')} kg` : ''}`,
      onReady: () => {
        unlockAudio();
        markIntroduced(a, it.exId);
        render();
      },
    });
    root.append(
      ...topBar(),
      h('div', { class: 'player-body' }, intro.el),
      h('div', { class: 'player-foot' }, ...introFoot({
        onReady: () => intro.ready(),
        onRepeat: () => intro.speak(),
        extra: it.logs.length ? null : h('button', { class: 'btn small', style: { flex: 1 }, onclick: swapExercise }, icon('swap'), 'Tauschen'),
      })),
    );
    action = () => intro?.ready();
    tick();
  }

  function setPills(it) {
    const ex = EX[it.exId];
    const setNo = it.logs.length + 1;
    return h('div', { class: 'set-pills', 'aria-label': 'Sätze' },
      Array.from({ length: Math.max(it.sets, setNo) }, (_, i) => {
        const log = it.logs[i];
        if (log) return h('span', { class: 'done' }, `✓ ${ex.mode === 'time' ? `${log.sec}s` : log.reps}`);
        return h('span', { class: i === setNo - 1 ? 'now' : '' }, `Satz ${i + 1}`);
      }));
  }

  function progressHint(it) {
    if (!it.lastVals || it.logs.length) return null;
    if (it.allTop && it.harder) {
      const harder = EX[it.harder];
      return h('div', { class: 'hint-box' }, icon('bolt'),
        h('div', null,
          h('div', null, h('b', null, 'Letztes Mal alles geschafft! '), `Bereit für die schwerere Variante „${harder.name}“?`),
          h('button', {
            class: 'btn small primary', style: { marginTop: '8px' },
            onclick: () => {
              const fresh = upgradeExercise(it.exId, harder.id);
              a.items[a.idx] = prepareItem({ exId: harder.id, sets: it.sets, rest: it.rest, range: harder.range });
              save();
              toast(fresh.length ? `Neues Abzeichen: ${fresh[0].emoji} ${fresh[0].name}` : `Gewechselt zu ${harder.name}`);
              render();
            },
          }, icon('up'), 'Wechseln'),
        ));
    }
    if (it.allTop) return h('div', { class: 'hint-box' }, icon('bolt'), h('div', null, h('b', null, 'Ziel erreicht! '), 'Mach es heute schwerer: 3 Sekunden langsam absenken und unten kurz halten.'));
    return null;
  }

  function kgButton(it) {
    const ex = EX[it.exId];
    if (!ex.weighted) return null;
    const kg = it.kg ?? a.kg;
    return h('button', {
      class: 'tag', style: { border: 0, cursor: 'pointer', padding: '6px 12px', fontSize: '14px' },
      onclick: () => {
        pauseRun();
        const stp = stepper({ value: kg, min: 0, max: 100, step: 0.5, label: 'Gewicht', format: (v) => `${String(v).replace('.', ',')} kg` });
        const { close } = openSheet(h('div', { class: 'stack' },
          h('h2', null, 'Gewicht pro Hantel'),
          h('p', { class: 'muted small' }, 'Gilt für diese Übung in diesem Training. Dein Standard steht in den Einstellungen.'),
          h('div', { class: 'center' }, stp),
          h('button', { class: 'btn primary block', onclick: async () => { it.kg = stp.getValue(); save(); await close(); render(); } }, 'Übernehmen'),
        ), { onClose: () => resumeRun() });
      },
    }, `🏋️ ${String(kg).replace('.', ',')} kg`);
  }

  // ----- Satz manuell (selbst zählen, dann „Satz geschafft“) -----
  function renderSet(it) {
    const ex = EX[it.exId];
    const isTime = ex.mode === 'time';
    const setNo = it.logs.length + 1;
    const prev = it.logs.at(-1);
    const startValue = prev ? (isTime ? prev.sec : prev.reps) : it.target;
    root.className = 'player';

    const valueStepper = stepper({
      value: startValue, min: 0, max: isTime ? 600 : 200, step: isTime ? 5 : 1, big: true,
      label: isTime ? 'Sekunden' : 'Wiederholungen',
      format: (v) => (isTime ? `${v}s` : v),
    });
    refs.valueStepper = valueStepper;
    refs.holdArea = h('div', { class: 'center' });
    if (isTime) refs.holdArea.append(h('button', { class: 'btn block', onclick: () => startHold(valueStepper.getValue()) }, icon('clock'), 'Halte-Timer starten'));
    const lastText = it.lastVals ? `Letztes Mal: ${it.lastVals.join(' · ')} ${unitOf(ex)}` : 'Noch kein Vergleichswert';

    root.append(
      ...topBar(),
      h('div', { class: 'player-body' },
        h('div', { class: 'stack-sm' },
          h('div', { class: 'ex-sub' }, `${CAT_EMOJI[ex.cat]} ${ex.muscles}`, ' ', levelDots(ex.level)),
          h('div', { class: 'ex-title' }, ex.name),
          setPills(it),
        ),
        progressHint(it),
        h('div', { class: 'target-box stack-sm' },
          h('div', { class: 'row' },
            h('div', { class: 'grow' },
              h('div', { class: 'small muted', style: { fontWeight: 650 } }, `Satz ${setNo} von ${it.sets} · Ziel heute`),
              h('div', { style: { fontSize: '22px', fontWeight: 800 } }, `${it.target} ${unitOf(ex)}${ex.perSide ? ' je Seite' : ''}`),
              h('div', { class: 'small muted' }, lastText),
            ),
            kgButton(it),
          ),
          h('div', { class: 'center', style: { marginTop: '8px' } },
            h('div', { class: 'small muted', style: { marginBottom: '4px' } }, isTime ? 'Geschafft (Sekunden)' : 'Geschafft (Wiederholungen)'),
            valueStepper,
          ),
          refs.holdArea,
        ),
        howto(ex),
      ),
      h('div', { class: 'player-foot' },
        h('button', { class: 'btn primary big block', onclick: () => logSet(valueStepper.getValue()) }, icon('check'), 'Satz geschafft'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', style: { flex: 1 }, onclick: skipExercise }, icon('skip'), 'Übung überspringen'),
          it.logs.length ? null : h('button', { class: 'btn small', style: { flex: 1 }, onclick: swapExercise }, icon('swap'), 'Tauschen'),
        ),
        st().tapAnywhere ? h('p', { class: 'tap-hint' }, 'Fertig? Irgendwo auf den Bildschirm tippen') : null,
      ),
    );
    action = () => { if (!hold) logSet(valueStepper.getValue()); };
  }

  function startHold(target) {
    unlockAudio();
    hold = { lead: Date.now() + 5000, endsAt: null, total: target * 1000, lastBeep: null };
    refs.holdRing = ring();
    refs.holdArea.innerHTML = '';
    refs.holdArea.append(
      h('div', { style: { width: '200px', margin: '8px auto 0' } }, refs.holdRing.el),
      h('button', {
        class: 'btn block', style: { marginTop: '10px' },
        onclick: () => {
          if (!hold) return;
          const done = hold.endsAt ? Math.round((Date.now() - (hold.endsAt - hold.total)) / 1000) : 0;
          hold = null;
          refs.valueStepper.setValue(done);
          refs.holdArea.innerHTML = '';
          refs.holdArea.append(h('div', { class: 'small muted' }, `Gestoppt bei ${done} Sek. Tipp auf „Satz geschafft“ zum Speichern.`));
        },
      }, 'Stopp'),
    );
    refs.holdRing.el.querySelector('.ring-time').style.fontSize = '44px';
    say('Bereit machen. Es geht gleich los.');
  }

  // ----- Satz automatisch (freihändig im Takt) -----
  function runDuration(it) {
    const ex = EX[it.exId];
    const sides = ex.perSide ? 2 : 1;
    const unit = ex.mode === 'time' ? it.target * 1000 : it.target * st().secPerRep * 1000;
    return unit * sides;
  }

  function renderAuto(it) {
    const ex = EX[it.exId];
    const setNo = it.logs.length + 1;
    root.className = 'player phase-work';
    refs.ring = ring();
    refs.status = h('div', { class: 'auto-status center' });
    refs.mainBtn = h('button', { class: 'btn primary big block', onclick: () => action?.() });
    refs.pauseBtn = h('button', { class: 'btn small', style: { flex: 1 }, onclick: () => (run?.pausedRem != null ? resumeRun() : pauseRun()) });
    const tempo = ex.mode === 'time' ? `${it.target} Sek. halten` : `${it.target} Wdh. im ${st().secPerRep}-Sekunden-Takt`;
    root.append(
      h('div', { class: 'phase-bg' }),
      ...topBar(),
      h('div', { class: 'player-body' },
        h('div', { class: 'stack-sm center' },
          h('div', { class: 'phase-label' }, `Satz ${setNo} von ${it.sets}`),
          h('div', { class: 'ex-title' }, ex.name),
          h('div', { class: 'ex-sub' }, `${tempo}${ex.perSide ? ' · je Seite' : ''}`),
          h('div', { class: 'row', style: { justifyContent: 'center' } }, setPills(it), kgButton(it)),
        ),
        progressHint(it),
        refs.ring.el,
        refs.status,
        howto(ex),
      ),
      h('div', { class: 'player-foot' },
        refs.mainBtn,
        h('div', { class: 'row' },
          refs.pauseBtn,
          h('button', { class: 'btn small', style: { flex: 1 }, onclick: skipExercise }, icon('skip'), 'Überspringen'),
          it.logs.length ? null : h('button', { class: 'btn small', style: { flex: 1 }, onclick: swapExercise }, icon('swap'), 'Tauschen'),
        ),
        st().tapAnywhere ? h('p', { class: 'tap-hint' }, 'Irgendwo tippen = Satz fertig') : null,
      ),
    );
    startLead(it);
  }

  function setMain(label, ic, fn) {
    if (!refs.mainBtn) return;
    refs.mainBtn.innerHTML = '';
    refs.mainBtn.append(icon(ic), label);
    action = fn;
  }

  function paintPauseBtn() {
    if (!refs.pauseBtn) return;
    refs.pauseBtn.innerHTML = '';
    const paused = run?.pausedRem != null;
    refs.pauseBtn.append(icon(paused ? 'play' : 'pause'), paused ? 'Weiter' : 'Pause');
  }

  function startLead(it) {
    const ex = EX[it.exId];
    const setNo = it.logs.length + 1;
    run = { phase: 'lead', endsAt: Date.now() + 5000, total: 5000, lastBeep: null };
    setMain('Jetzt starten', 'play', () => startRun(it));
    paintPauseBtn();
    say(setNo === 1
      ? `Position einnehmen. ${it.sets} Sätze, Ziel: ${it.target} ${unitWord(ex)}${ex.perSide ? ' pro Seite' : ''}.`
      : `Satz ${setNo}. Position einnehmen.`);
  }

  function startRun(it) {
    const ex = EX[it.exId];
    const total = runDuration(it);
    run = { phase: 'run', startAt: Date.now(), endsAt: Date.now() + total, total, lastRep: 0, half: false, lastBeep: null };
    signal('go');
    say('Los!');
    setMain('Satz fertig', 'check', () => finishRunNow(it));
    paintPauseBtn();
    if (ex.mode === 'time') refs.status.textContent = 'Halten';
  }

  function finishRunNow(it) {
    if (!run) return;
    const ex = EX[it.exId];
    if (ex.mode === 'time' && run.phase === 'run') {
      const elapsed = (Date.now() - run.startAt) / 1000 / (ex.perSide ? 2 : 1);
      logSet(Math.max(0, Math.min(it.target, Math.round(elapsed))));
    } else {
      logSet(it.target);
    }
  }

  function pauseRun() {
    if (!run || run.pausedRem != null) return;
    run.pausedRem = Math.max(0, run.endsAt - Date.now());
    stopSpeech();
    paintPauseBtn();
  }

  function resumeRun() {
    if (!run || run.pausedRem == null) return;
    const shift = run.pausedRem - (run.endsAt - Date.now());
    run.endsAt = Date.now() + run.pausedRem;
    if (run.startAt) run.startAt += shift;
    run.pausedRem = null;
    paintPauseBtn();
  }

  function tickRun() {
    const it = a.items[a.idx];
    const ex = EX[it.exId];
    const now = Date.now();
    const rem = run.pausedRem != null ? run.pausedRem : run.endsAt - now;
    if (run.phase === 'lead') {
      refs.ring.set(Math.max(0, rem), run.total, run.pausedRem != null ? 'pausiert' : 'Bereit');
      refs.status.textContent = 'Position einnehmen …';
      const sec = Math.ceil(rem / 1000);
      if (run.pausedRem == null && sec <= 3 && sec >= 1 && run.lastBeep !== sec) { run.lastBeep = sec; signal('tick'); }
      if (run.pausedRem == null && rem <= 0) startRun(it);
      return;
    }
    const sides = ex.perSide ? 2 : 1;
    const elapsed = run.total - rem;
    const sideMs = run.total / sides;
    const side = Math.min(sides, Math.floor(elapsed / sideMs) + 1);
    if (sides === 2 && side === 2 && !run.half) {
      run.half = true;
      run.lastRep = 0;
      signal('go');
      say('Seite wechseln!');
    }
    const sideLabel = sides === 2 ? `${side}. Seite · ` : '';
    if (ex.mode === 'time') {
      refs.ring.set(Math.max(0, rem), run.total, run.pausedRem != null ? 'pausiert' : `${sideLabel}Halten`);
      const sec = Math.ceil(rem / 1000);
      if (run.pausedRem == null && sec <= 3 && sec >= 1 && run.lastBeep !== sec) { run.lastBeep = sec; signal('tick'); }
      refs.status.textContent = run.pausedRem != null ? 'Pausiert' : `${sideLabel}halten`;
    } else {
      const perRep = st().secPerRep * 1000;
      const inSide = elapsed - (side - 1) * sideMs;
      const reps = Math.min(it.target, Math.floor(inSide / perRep));
      if (run.pausedRem == null && reps > run.lastRep) {
        run.lastRep = reps;
        if (st().countReps && reps < it.target) say(String(reps));
      }
      refs.ring.set(Math.max(0, rem), run.total, run.pausedRem != null ? 'pausiert' : `${sideLabel}Wdh. ${Math.min(it.target, reps + 1)}/${it.target}`);
      refs.status.textContent = run.pausedRem != null ? 'Pausiert' : `${sideLabel}Wiederholung ${Math.min(it.target, reps + 1)} von ${it.target}`;
    }
    if (run.pausedRem == null && rem <= 0) {
      signal('done');
      logSet(ex.mode === 'time' ? it.target : it.target);
    }
  }

  // ----- Satz speichern, Pause starten -----
  function logSet(value) {
    const it = a.items[a.idx];
    const ex = EX[it.exId];
    run = null;
    it.logs.push(ex.mode === 'time' ? { sec: value } : { reps: value, ...(ex.weighted ? { kg: it.kg ?? a.kg } : {}) });
    signal('tick');
    const itemDone = it.logs.length >= it.sets;
    if (itemDone) {
      const nx = nextIncomplete(a, a.idx);
      if (nx == null) {
        save();
        finishMain();
        return;
      }
      a.idx = nx;
    }
    a.restTotal = (it.rest || 60) * 1000;
    a.restEndsAt = Date.now() + a.restTotal;
    a.restLastBeep = null;
    save();
    const up = a.items[a.idx];
    say(itemDone ? `Übung geschafft! Pause. Als Nächstes: ${spokenName(EX[up.exId])}.` : `Satz ${it.logs.length} geschafft. Pause.`);
    render();
  }

  function skipExercise() {
    const it = a.items[a.idx];
    it.skipped = true;
    run = null;
    const nx = nextIncomplete(a, a.idx);
    if (nx == null) {
      save();
      if (doneSets() > 0) finishMain();
      else {
        confirmDialog({ title: 'Keine Sätze gemacht', text: 'Möchtest du das Training verwerfen?', ok: 'Verwerfen', danger: true })
          .then((ok) => {
            if (ok) { discardSession(); leave(); } else { it.skipped = false; save(); render(); }
          });
      }
      return;
    }
    a.idx = nx;
    save();
    render();
  }

  function swapExercise() {
    const it = a.items[a.idx];
    pauseRun();
    intro?.cancel();
    stopSpeech();
    const alts = alternativesFor(it.exId).filter((x) => !a.items.some((o) => o.exId === x.id));
    const { close } = openSheet(h('div', { class: 'stack' },
      h('h2', null, 'Übung tauschen'),
      h('p', { class: 'muted small' }, 'Nur für dieses Training. Dauerhafte Varianten wählst du in den Plandetails.'),
      h('div', { class: 'list' }, alts.map((alt) => h('button', {
        class: 'list-item',
        onclick: async () => {
          a.items[a.idx] = prepareItem({ exId: alt.id, sets: it.sets, rest: it.rest, range: alt.range });
          save();
          await close();
          render();
        },
      }, exBadge(alt.id), h('div', { class: 'grow' }, h('div', { class: 'title' }, alt.name), h('div', { class: 'meta' }, levelDots(alt.level), ' ', targetText(alt, alt.range)))))),
    ), { onClose: () => { if (run) resumeRun(); else if (intro) render(); } });
  }

  // ----- Pause -----
  function renderRest() {
    const up = a.items[a.idx];
    const ex = EX[up.exId];
    const setNo = up.logs.length + 1;
    root.className = 'player phase-rest';
    refs.ring = ring();
    const fresh = !isIntroduced(a, up.exId);
    root.append(
      h('div', { class: 'phase-bg' }),
      ...topBar(),
      h('div', { class: 'player-body' },
        h('div', { class: 'stack-sm center' },
          h('div', { class: 'phase-label' }, 'Pause'),
          h('div', { class: 'muted' }, REST_TIPS[doneSets() % REST_TIPS.length]),
        ),
        refs.ring.el,
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn small', onclick: () => { a.restEndsAt -= 15000; a.restTotal = Math.max(a.restTotal - 15000, 1000); save(); tick(); } }, '−15 s'),
          h('button', { class: 'btn small', onclick: () => { a.restEndsAt += 15000; a.restTotal += 15000; save(); tick(); } }, '+15 s'),
        ),
        h('div', { class: 'next-up' },
          exBadge(up.exId),
          h('div', { class: 'grow' },
            h('div', { class: 'label' }, setNo === 1 ? 'Nächste Übung' : `Gleich: Satz ${setNo} von ${up.sets}`),
            h('div', { style: { fontWeight: 650 } }, ex.name),
            h('div', { class: 'small muted' }, `Ziel: ${up.target} ${unitOf(ex)}${ex.perSide ? ' je Seite' : ''}`),
          ),
        ),
        setNo === 1 && !fresh ? howto(ex) : null,
        fresh ? h('p', { class: 'small muted center' }, 'Nach der Pause erkläre ich dir die neue Übung in Ruhe.') : null,
      ),
      h('div', { class: 'player-foot' },
        h('button', { class: 'btn primary big block', onclick: endRest }, icon('play'), 'Weiter'),
      ),
    );
  }

  function endRest() {
    const up = a.items[a.idx];
    const ex = EX[up.exId];
    const setNo = up.logs.length + 1;
    a.restEndsAt = null;
    save();
    signal('go');
    // im Automatik-Modus und bei neuen Übungen sagt der nächste Schritt selbst an
    if (!a.auto && isIntroduced(a, up.exId)) {
      say(setNo === 1 ? `Los geht’s: ${spokenName(ex)}. Ziel: ${up.target} ${unitWord(ex)}${ex.perSide ? ' pro Seite' : ''}.` : `Weiter geht’s: Satz ${setNo}.`);
    }
    render();
  }

  // ----- Übersicht -----
  function overview() {
    pauseRun();
    const { close } = openSheet(h('div', { class: 'stack' },
      h('h2', null, 'Übersicht'),
      h('div', { class: 'card', style: { padding: '0 16px' } },
        toggleRow('Automatik (freihändig)', 'Sätze laufen im Takt, die Pause startet von selbst', !!a.auto, (v) => { a.auto = v; save(); }),
      ),
      h('div', { class: 'list' }, a.items.map((it, i) => {
        const ex = EX[it.exId];
        const status = it.skipped ? 'übersprungen' : `${it.logs.length}/${it.sets} Sätze`;
        return h('button', {
          class: 'list-item',
          style: i === a.idx ? { background: 'var(--accent-soft)' } : null,
          onclick: async () => {
            if (it.skipped) it.skipped = false;
            if (it.logs.length >= it.sets) it.sets = it.logs.length + 1;
            a.idx = i;
            a.restEndsAt = null;
            save();
            await close();
            render();
          },
        },
        exBadge(it.exId),
        h('div', { class: 'grow' }, h('div', { class: 'title' }, ex.name), h('div', { class: 'meta' }, status)),
        it.logs.length >= it.sets ? icon('check', 'chev') : icon('right', 'chev'));
      })),
      h('p', { class: 'muted small' }, 'Tipp auf eine Übung, um dorthin zu springen. Bei fertigen Übungen kommt ein Extra-Satz dazu.'),
      h('button', {
        class: 'btn block',
        onclick: async () => {
          const it = a.items[a.idx];
          it.sets += 1;
          save();
          await close();
          render();
          toast(`Extra-Satz für ${EX[it.exId].name}`);
        },
      }, icon('plus'), 'Satz zur aktuellen Übung hinzufügen'),
      doneSets() > 0 ? h('button', { class: 'btn block', onclick: async () => { await close(); finishMain(); } }, icon('flag'), 'Krafttraining abschließen') : null,
    ), { onClose: () => { if (getState().active === a && a.phase === 'main') render(); } });
  }

  // ----- Takt -----
  function tick() {
    const now = Date.now();
    if (refs.sub) refs.sub.textContent = `Übung ${Math.min(a.idx + 1, a.items.length)} von ${a.items.length} · ${fmtClock((a.activeMs || 0) / 1000)}`;
    if (!a.items[a.idx]) return;
    if (a.restEndsAt && refs.ring) {
      const rem = a.restEndsAt - now;
      refs.ring.set(Math.max(0, rem), a.restTotal, '');
      const sec = Math.ceil(rem / 1000);
      if (sec <= 3 && sec >= 1 && a.restLastBeep !== sec) {
        a.restLastBeep = sec;
        signal('tick');
      }
      if (rem <= 0) endRest();
      return;
    }
    if (run && refs.ring) tickRun();
    if (hold && refs.holdRing) {
      if (!hold.endsAt) {
        const lead = hold.lead - now;
        const sec = Math.ceil(lead / 1000);
        refs.holdRing.set(Math.max(0, lead), 5000, 'Bereit …');
        if (sec <= 3 && sec >= 1 && hold.lastBeep !== `l${sec}`) { hold.lastBeep = `l${sec}`; signal('tick'); }
        if (lead <= 0) {
          hold.endsAt = now + hold.total;
          signal('go');
          say('Los!');
        }
      } else {
        const rem = hold.endsAt - now;
        refs.holdRing.set(Math.max(0, rem), hold.total, 'Halten');
        const sec = Math.ceil(rem / 1000);
        if (sec <= 3 && sec >= 1 && hold.lastBeep !== sec) { hold.lastBeep = sec; signal('tick'); }
        if (rem <= 0) {
          const total = Math.round(hold.total / 1000);
          hold = null;
          signal('done');
          logSet(total);
        }
      }
    }
  }

  root.addEventListener('pointerdown', unlockAudio, { once: true });
  tapZone(root, () => action, () => lastPaint);
  render();
  iv = setInterval(tick, 200);
  return {
    el: root,
    destroy: () => { clearInterval(iv); intro?.cancel(); },
    pause: pauseRun,
    resume: resumeRun,
  };
}

// ----- Kontrolle am Ende (Automatik): Wiederholungen kurz anpassen -----
function reviewView(a, { onSave }) {
  const list = h('div', { class: 'list' });
  for (const it of a.items.filter((x) => x.logs.length)) {
    const ex = EX[it.exId];
    const isTime = ex.mode === 'time';
    list.append(h('div', { class: 'edit-item' },
      h('div', { class: 'head' }, exBadge(it.exId), h('div', { class: 'grow' }, ex.name, h('div', { class: 'tiny muted' }, `Ziel: ${it.target} ${isTime ? 'Sek.' : 'Wdh.'}${ex.perSide ? ' je Seite' : ''}`))),
      h('div', { class: 'review-sets' }, it.logs.map((log, i) => h('div', { class: 'review-set' },
        h('div', { class: 'tiny muted' }, `Satz ${i + 1}`),
        stepper({
          value: isTime ? log.sec : log.reps, min: 0, max: isTime ? 600 : 200, step: isTime ? 5 : 1,
          label: `Satz ${i + 1}`, format: (v) => (isTime ? `${v}s` : v),
          onchange: (v) => { if (isTime) log.sec = v; else log.reps = v; save(); },
        }),
      ))),
    ));
  }
  return {
    el: h('div', { class: 'player' },
      h('div', { class: 'player-top' }, h('div', { class: 'title' }, h('b', null, `${a.emoji} ${a.name}`), h('span', null, 'Fast geschafft'))),
      h('div', { class: 'player-body', style: { justifyContent: 'flex-start' } },
        h('div', { class: 'stack-sm' },
          h('div', { class: 'ex-title' }, 'Passt das so?'),
          h('p', { class: 'muted' }, 'Die App hat bei jedem Satz dein Ziel eingetragen. Hast du mehr oder weniger geschafft, korrigier es hier mit + und −.'),
        ),
        list,
      ),
      h('div', { class: 'player-foot' },
        h('button', { class: 'btn primary big block', onclick: onSave }, icon('check'), 'Speichern'),
      ),
    ),
    destroy() {},
  };
}
