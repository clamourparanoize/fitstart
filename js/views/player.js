// Trainings-Player: Krafttraining (Sätze + Pausentimer) und Zeittraining (Intervalle).
import { EX, spokenName } from '../exercises.js';
import { getState, save } from '../store.js';
import { h, s, icon, openSheet, confirmDialog, toast, fmtClock, stepper, levelDots } from '../ui.js';
import { signal, say, keepAwake, unlockAudio, stopSpeech, speechAvailable } from '../feedback.js';
import { finishSession, discardSession, prepareItem, upgradeExercise } from '../session.js';
import { alternativesFor } from '../plans.js';
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

export function renderPlayer() {
  const a = getState().active;
  if (!a) {
    location.replace('#/heute');
    return null;
  }
  return a.kind === 'zeit' ? timedPlayer(a) : strengthPlayer(a);
}

// ---------- Hilfen ----------
function complete() {
  stopSpeech();
  const res = finishSession();
  setResult(res);
  location.hash = '#/geschafft';
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

function exitSheet(a, { onLater, canFinish }) {
  const { close } = openSheet(h('div', { class: 'stack' },
    h('h2', null, 'Training unterbrechen?'),
    h('p', { class: 'muted' }, 'Du kannst später genau hier weitermachen.'),
    h('button', { class: 'btn primary block', onclick: () => { close(); onLater?.(); location.hash = '#/heute'; } }, icon('pause'), 'Später weitermachen'),
    canFinish ? h('button', { class: 'btn block', onclick: () => { close(); complete(); } }, icon('flag'), 'Jetzt beenden & speichern') : null,
    h('button', {
      class: 'btn danger block',
      onclick: async () => {
        close();
        if (await confirmDialog({ title: 'Training verwerfen?', text: 'Dieses Training wird nicht gespeichert.', ok: 'Verwerfen', danger: true })) {
          stopSpeech();
          discardSession();
          location.hash = '#/heute';
        }
      },
    }, icon('trash'), 'Verwerfen'),
    h('button', { class: 'btn ghost block', onclick: () => close() }, 'Weiter trainieren'),
  ));
}

// =====================================================================
// Zeitgesteuerter Ablauf (Zirkel, Aufwärmen, Dehnen)
// =====================================================================
const PHASE_LABEL = {
  prep: () => 'Mach dich bereit',
  warmup: () => 'Aufwärmen',
  work: (seg) => (seg.rounds > 1 ? `Übung · Runde ${seg.round}/${seg.rounds}` : 'Übung'),
  rest: () => 'Pause',
  roundrest: (seg) => `Runde ${seg.round} geschafft · Pause`,
  cooldown: () => 'Dehnen & Entspannen',
};

function timedView(a, r, { title, onDone, skipLabel, onSkip }) {
  const root = h('div', { class: 'player' });
  const phaseBg = h('div', { class: 'phase-bg' });
  const subEl = h('span');
  const progFill = h('div', { style: { width: '0%' } });
  const phaseLabel = h('div', { class: 'phase-label center' });
  const exName = h('div', { class: 'ex-title center' });
  const exSub = h('div', { class: 'ex-sub center' });
  const rg = ring();
  const howtoWrap = h('div');
  const nextWrap = h('div');
  const playBtn = h('button', { class: 'icon-btn main', 'aria-label': 'Start/Pause' });
  const totalMs = r.segments.reduce((sum, sg) => sum + sg.dur * 1000, 0);

  const remaining = () => (r.paused ? r.remaining : Math.max(0, r.endsAt - Date.now()));
  const seg = () => r.segments[r.seg];
  const nextWork = (i) => r.segments.slice(i + 1).find((sg) => sg.exId && sg.type !== 'prep');
  const firstInRound = (i) => {
    const sg = r.segments[i];
    return sg.type === 'work' && !r.segments.slice(0, i).some((x) => x.type === 'work' && x.round === sg.round);
  };

  function logCurrent() {
    const sg = seg();
    if (!sg || sg.type !== 'work') return;
    const done = Math.round((sg.dur * 1000 - remaining()) / 1000);
    if (done >= 5) r.log.push({ exId: sg.exId, sec: done });
  }

  function announce(i) {
    const sg = r.segments[i];
    const ex = sg.exId ? EX[sg.exId] : null;
    const nx = nextWork(i);
    switch (sg.type) {
      case 'prep': signal('tick'); say(`Mach dich bereit. Als Erstes: ${spokenName(ex)}.`); break;
      case 'warmup': signal('go'); say(`${spokenName(ex)}, ${sg.dur} Sekunden.`); break;
      case 'work': signal('go'); say(`${firstInRound(i) && sg.round > 1 ? `Runde ${sg.round}. ` : ''}${spokenName(ex)}. Los!`); break;
      case 'rest': signal('rest'); say(nx ? `Pause. Als Nächstes: ${spokenName(EX[nx.exId])}.` : 'Pause.'); break;
      case 'roundrest': signal('rest'); say(`Runde ${sg.round} geschafft! ${sg.dur} Sekunden Pause.${nx ? ` Danach: ${spokenName(EX[nx.exId])}.` : ''}`); break;
      case 'cooldown': signal('rest'); say(`${spokenName(ex)}. Ganz entspannt atmen.`); break;
      default: break;
    }
  }

  function go(i, { speak = true } = {}) {
    if (i > r.seg) logCurrent();
    if (i >= r.segments.length) {
      r.seg = r.segments.length;
      r.paused = true;
      save();
      stopTimer();
      onDone();
      return;
    }
    r.seg = Math.max(0, i);
    r.remaining = seg().dur * 1000;
    r.half = false;
    r.lastBeep = null;
    if (!r.paused) r.endsAt = Date.now() + r.remaining;
    save();
    paintSegment();
    if (speak && !r.paused) announce(r.seg);
  }

  function play() {
    unlockAudio();
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
    playBtn.innerHTML = '';
    playBtn.append(icon(r.paused ? 'play' : 'pause'));
  }

  function paintSegment() {
    const sg = seg();
    if (!sg) return;
    root.className = `player phase-${sg.type}`;
    phaseLabel.textContent = PHASE_LABEL[sg.type](sg);
    const isRest = sg.type === 'rest' || sg.type === 'roundrest';
    const focus = isRest ? nextWork(r.seg) : sg;
    const fex = focus?.exId ? EX[focus.exId] : null;
    if (isRest) {
      exName.textContent = 'Durchatmen';
      exSub.textContent = fex ? `Gleich: ${fex.name}` : 'Gleich geschafft!';
    } else {
      exName.textContent = fex ? fex.name : '';
      exSub.textContent = fex ? `${CAT_EMOJI[fex.cat]} ${fex.muscles}${fex.perSide ? ' · Seitenwechsel zur Halbzeit' : ''}${fex.wrist === 'fist' ? ' · auf Fäusten' : ''}` : '';
    }
    howtoWrap.innerHTML = '';
    if (fex) howtoWrap.append(howto(fex, { open: isRest }));
    nextWrap.innerHTML = '';
    const nx = isRest ? null : nextWork(r.seg);
    nextWrap.append(h('div', { class: 'next-up' },
      nx ? exBadge(nx.exId) : h('div', { class: 'ex-badge' }, '🏁'),
      h('div', null, h('div', { class: 'label' }, 'Als Nächstes'), h('div', { style: { fontWeight: 650 } }, nx ? EX[nx.exId].name : isRest && fex ? fex.name : 'Ziel erreicht!')),
    ));
    if (isRest || sg.type === 'prep') nextWrap.firstChild.classList.add('hidden');
  }

  function tick() {
    const sg = seg();
    if (!sg) return;
    const rem = remaining();
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
    rg.set(rem, sg.dur * 1000, r.paused ? 'pausiert' : ex?.perSide && sg.type !== 'prep' ? (r.half ? '2. Seite' : '1. Seite') : '');
    const after = r.segments.slice(r.seg + 1).reduce((sum, x) => sum + x.dur * 1000, 0);
    const left = rem + after;
    subEl.textContent = `noch ${fmtClock(left / 1000)} Min.`;
    progFill.style.width = `${Math.round((1 - left / totalMs) * 100)}%`;
    if (!r.paused && rem <= 0) go(r.seg + 1);
  }

  let iv = null;
  const stopTimer = () => { clearInterval(iv); iv = null; };

  root.append(
    phaseBg,
    h('div', { class: 'player-top' },
      h('button', {
        class: 'icon-btn', 'aria-label': 'Training unterbrechen',
        onclick: () => {
          pause();
          exitSheet(a, { canFinish: a.kind === 'zeit' ? r.log.length > 0 : a.items.some((it) => it.logs.length) });
        },
      }, icon('close')),
      h('div', { class: 'title' }, h('b', null, title), subEl),
      skipLabel ? h('button', { class: 'btn small', onclick: () => { logCurrent(); stopTimer(); onSkip(); } }, skipLabel) : null,
    ),
    h('div', { class: 'player-progress' }, progFill),
    h('div', { class: 'player-body' },
      h('div', { class: 'stack-sm' }, phaseLabel, exName, exSub),
      rg.el,
      nextWrap,
      howtoWrap,
    ),
    h('div', { class: 'player-foot' },
      h('div', { class: 'controls' },
        h('button', {
          class: 'icon-btn', 'aria-label': 'Zurück',
          onclick: () => {
            const elapsed = seg() ? seg().dur * 1000 - remaining() : 0;
            go(elapsed > 3000 ? r.seg : r.seg - 1);
          },
        }, icon('prev')),
        playBtn,
        h('button', { class: 'icon-btn', 'aria-label': 'Überspringen', onclick: () => go(r.seg + 1) }, icon('next')),
      ),
    ),
  );
  playBtn.addEventListener('click', () => (r.paused ? play() : pause()));
  root.addEventListener('pointerdown', unlockAudio, { once: true });

  // Nach einer Unterbrechung (App geschlossen) pausiert weitermachen statt weiterzulaufen
  if (r.started && !r.paused) {
    r.remaining = Math.max(1000, r.endsAt - Date.now());
    r.paused = true;
    save();
  }

  paintSegment();
  paintPlay();
  tick();
  iv = setInterval(tick, 200);
  // Direkt loslegen, wenn das Training gerade erst gestartet wurde
  if (!r.started) setTimeout(() => play(), 300);

  return { el: root, destroy: () => { stopTimer(); }, pause, isPaused: () => r.paused };
}

function timedPlayer(a) {
  keepAwake(true);
  const view = timedView(a, a.timed, { title: `${a.emoji} ${a.name}`, onDone: () => { signal('success'); say('Geschafft! Super gemacht.'); complete(); } });
  const stopAct = activityTracker(a, () => !a.timed.paused);
  return {
    el: view.el,
    destroy() { view.pause(); view.destroy(); stopAct(); keepAwake(false); },
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
    if (a.phase === 'warmup') return !a.warm.paused;
    if (a.phase === 'cooldown') return !a.cool.paused;
    return true;
  });

  const show = () => {
    sub?.destroy();
    container.innerHTML = '';
    if (a.phase === 'warmup' && a.warm) {
      const toMain = () => {
        a.phase = 'main';
        save();
        say('Aufwärmen geschafft. Jetzt geht es ans Krafttraining.');
        show();
      };
      sub = timedView(a, a.warm, { title: 'Aufwärmen', onDone: toMain, skipLabel: 'Überspringen', onSkip: toMain });
    } else if (a.phase === 'cooldown' && a.cool) {
      const done = () => { signal('success'); say('Geschafft! Super gemacht.'); complete(); };
      sub = timedView(a, a.cool, { title: 'Dehnen zum Abschluss', onDone: done, skipLabel: 'Überspringen', onSkip: complete });
    } else {
      sub = mainView(a, show);
    }
    container.append(sub.el);
  };
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

function mainView(a, onPhase) {
  const root = h('div', { class: 'player' });
  let hold = null;     // Halte-Timer für Zeitübungen (nicht gespeichert)
  let refs = {};
  let iv = null;

  const doneSets = () => a.items.reduce((n, it) => n + it.logs.length, 0);
  const totalSets = () => a.items.reduce((n, it) => n + (it.skipped ? it.logs.length : Math.max(it.sets, it.logs.length)), 0);

  function finishMain() {
    if (a.cool) {
      a.phase = 'cooldown';
      a.restEndsAt = null;
      save();
      signal('success');
      say('Krafttraining geschafft! Zum Schluss noch etwas Dehnen.');
      onPhase();
    } else {
      signal('success');
      say('Geschafft! Super gemacht.');
      complete();
    }
  }

  function topBar() {
    refs.sub = h('span');
    return [
      h('div', { class: 'player-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Training unterbrechen', onclick: () => exitSheet(a, { canFinish: doneSets() > 0 }) }, icon('close')),
        h('div', { class: 'title' }, h('b', null, `${a.emoji} ${a.name}`), refs.sub),
        h('button', { class: 'icon-btn', 'aria-label': 'Übersicht', onclick: overview }, icon('menu')),
      ),
      h('div', { class: 'player-progress' }, h('div', { style: { width: `${Math.round((doneSets() / Math.max(1, totalSets())) * 100)}%` } })),
    ];
  }

  function render() {
    root.innerHTML = '';
    hold = null;
    refs = {};
    if (a.idx == null || !a.items[a.idx]) {
      const nx = nextIncomplete(a, -1);
      if (nx == null) { finishMain(); return; }
      a.idx = nx;
    }
    if (a.restEndsAt) renderRest(); else renderSet();
    tick();
  }

  // ----- Satz -----
  function renderSet() {
    const it = a.items[a.idx];
    const ex = EX[it.exId];
    const isTime = ex.mode === 'time';
    const unit = isTime ? 'Sek.' : 'Wdh.';
    const setNo = it.logs.length + 1;
    const prev = it.logs.at(-1);
    const startValue = prev ? (isTime ? prev.sec : prev.reps) : it.target;
    const kg = it.kg ?? a.kg;
    root.className = 'player';

    const pills = h('div', { class: 'set-pills', 'aria-label': 'Sätze' },
      Array.from({ length: Math.max(it.sets, setNo) }, (_, i) => {
        const log = it.logs[i];
        if (log) return h('span', { class: 'done' }, `✓ ${isTime ? `${log.sec}s` : log.reps}`);
        return h('span', { class: i === setNo - 1 ? 'now' : '' }, `Satz ${i + 1}`);
      }));

    let hint = null;
    if (!it.lastVals) {
      hint = h('div', { class: 'hint-box' }, icon('info'), h('div', null, 'Zum ersten Mal: Lerne die Bewegung in Ruhe kennen. Lieber sauber als viel.'));
    } else if (it.allTop && it.harder && !it.logs.length) {
      const harder = EX[it.harder];
      hint = h('div', { class: 'hint-box' }, icon('bolt'),
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
    } else if (it.allTop) {
      hint = h('div', { class: 'hint-box' }, icon('bolt'), h('div', null, h('b', null, 'Ziel erreicht! '), 'Mach es heute schwerer: 3 Sekunden langsam absenken und unten kurz halten.'));
    }

    const valueStepper = stepper({
      value: startValue, min: 0, max: isTime ? 600 : 200, step: isTime ? 5 : 1, big: true,
      label: isTime ? 'Sekunden' : 'Wiederholungen',
      format: (v) => (isTime ? `${v}s` : v),
    });

    const kgBtn = ex.weighted ? h('button', {
      class: 'tag', style: { border: 0, cursor: 'pointer', padding: '6px 12px', fontSize: '14px' },
      onclick: () => {
        const st = stepper({ value: kg, min: 0, max: 100, step: 0.5, label: 'Gewicht', format: (v) => `${String(v).replace('.', ',')} kg` });
        const { close } = openSheet(h('div', { class: 'stack' },
          h('h2', null, 'Gewicht pro Hantel'),
          h('p', { class: 'muted small' }, 'Gilt für diese Übung in diesem Training. Dein Standard steht in den Einstellungen.'),
          h('div', { class: 'center' }, st),
          h('button', { class: 'btn primary block', onclick: () => { it.kg = st.getValue(); save(); close(); render(); } }, 'Übernehmen'),
        ));
      },
    }, `🏋️ ${String(kg).replace('.', ',')} kg`) : null;

    refs.holdArea = h('div', { class: 'center' });
    if (isTime) {
      refs.holdArea.append(h('button', { class: 'btn block', onclick: () => startHold(valueStepper.getValue()) }, icon('clock'), 'Halte-Timer starten'));
    }

    const lastText = it.lastVals ? `Letztes Mal: ${it.lastVals.join(' · ')} ${unit}` : 'Noch kein Vergleichswert';

    root.append(
      ...topBar(),
      h('div', { class: 'player-body' },
        h('div', { class: 'stack-sm' },
          h('div', { class: 'ex-sub' }, `${CAT_EMOJI[ex.cat]} ${ex.muscles}`, ' ', levelDots(ex.level)),
          h('div', { class: 'ex-title' }, ex.name),
          pills,
        ),
        hint,
        h('div', { class: 'target-box stack-sm' },
          h('div', { class: 'row' },
            h('div', { class: 'grow' },
              h('div', { class: 'small muted', style: { fontWeight: 650 } }, `Satz ${setNo} von ${it.sets} · Ziel heute`),
              h('div', { style: { fontSize: '22px', fontWeight: 800 } }, `${it.target} ${unit}${ex.perSide ? ' je Seite' : ''}`),
              h('div', { class: 'small muted' }, lastText),
            ),
            kgBtn,
          ),
          h('div', { class: 'center', style: { marginTop: '8px' } },
            h('div', { class: 'small muted', style: { marginBottom: '4px' } }, isTime ? 'Geschafft (Sekunden)' : 'Geschafft (Wiederholungen)'),
            valueStepper,
          ),
          refs.holdArea,
        ),
        howto(ex, { open: !it.lastVals && setNo === 1 }),
      ),
      h('div', { class: 'player-foot' },
        h('button', { class: 'btn primary big block', onclick: () => logSet(valueStepper.getValue()) }, icon('check'), 'Satz geschafft'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', style: { flex: 1 }, onclick: skipExercise }, icon('skip'), 'Übung überspringen'),
          it.logs.length ? null : h('button', { class: 'btn small', style: { flex: 1 }, onclick: swapExercise }, icon('swap'), 'Tauschen'),
        ),
      ),
    );
    refs.valueStepper = valueStepper;
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

  function logSet(value) {
    const it = a.items[a.idx];
    const ex = EX[it.exId];
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
    const nx = nextIncomplete(a, a.idx);
    if (nx == null) {
      save();
      if (doneSets() > 0) finishMain();
      else confirmDialog({ title: 'Keine Sätze gemacht', text: 'Möchtest du das Training verwerfen?', ok: 'Verwerfen', danger: true })
        .then((ok) => { if (ok) { discardSession(); location.hash = '#/heute'; } else { it.skipped = false; save(); render(); } });
      return;
    }
    a.idx = nx;
    save();
    render();
  }

  function swapExercise() {
    const it = a.items[a.idx];
    const alts = alternativesFor(it.exId).filter((x) => !a.items.some((o) => o.exId === x.id));
    const { close } = openSheet(h('div', { class: 'stack' },
      h('h2', null, 'Übung tauschen'),
      h('p', { class: 'muted small' }, 'Nur für dieses Training. Dauerhafte Varianten wählst du in den Plandetails.'),
      h('div', { class: 'list' }, alts.map((alt) => h('button', {
        class: 'list-item',
        onclick: () => {
          a.items[a.idx] = prepareItem({ exId: alt.id, sets: it.sets, rest: it.rest, range: alt.range });
          save();
          close();
          render();
        },
      }, exBadge(alt.id), h('div', { class: 'grow' }, h('div', { class: 'title' }, alt.name), h('div', { class: 'meta' }, levelDots(alt.level), ' ', targetText(alt, alt.range)))))),
    ));
  }

  // ----- Pause -----
  function renderRest() {
    const up = a.items[a.idx];
    const ex = EX[up.exId];
    const setNo = up.logs.length + 1;
    root.className = 'player phase-rest';
    refs.ring = ring();
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
            h('div', { class: 'small muted' }, `Ziel: ${up.target} ${ex.mode === 'time' ? 'Sek.' : 'Wdh.'}${ex.perSide ? ' je Seite' : ''}`),
          ),
        ),
        setNo === 1 ? howto(ex) : null,
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
    const unitWord = ex.mode === 'time' ? 'Sekunden' : 'Wiederholungen';
    say(setNo === 1 ? `Los geht’s: ${spokenName(ex)}. Ziel: ${up.target} ${unitWord}${ex.perSide ? ' pro Seite' : ''}.` : `Weiter geht’s: Satz ${setNo}.`);
    render();
  }

  // ----- Übersicht -----
  function overview() {
    const { close } = openSheet(h('div', { class: 'stack' },
      h('h2', null, 'Übersicht'),
      h('div', { class: 'list' }, a.items.map((it, i) => {
        const ex = EX[it.exId];
        const status = it.skipped ? 'übersprungen' : `${it.logs.length}/${it.sets} Sätze`;
        return h('button', {
          class: 'list-item',
          style: i === a.idx ? { background: 'var(--accent-soft)' } : null,
          onclick: () => {
            if (it.skipped) it.skipped = false;
            if (it.logs.length >= it.sets) it.sets = it.logs.length + 1;
            a.idx = i;
            a.restEndsAt = null;
            save();
            close();
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
        onclick: () => {
          close();
          const it = a.items[a.idx];
          it.sets += 1;
          save();
          render();
          toast(`Extra-Satz für ${EX[it.exId].name}`);
        },
      }, icon('plus'), 'Satz zur aktuellen Übung hinzufügen'),
      doneSets() > 0 ? h('button', { class: 'btn block', onclick: () => { close(); finishMain(); } }, icon('flag'), 'Krafttraining abschließen') : null,
    ));
  }

  // ----- Takt -----
  function tick() {
    const now = Date.now();
    if (refs.sub) {
      const it = a.items[a.idx];
      refs.sub.textContent = `Übung ${Math.min(a.idx + 1, a.items.length)} von ${a.items.length} · ${fmtClock((a.activeMs || 0) / 1000)}`;
      if (!it) return;
    }
    if (a.restEndsAt && refs.ring) {
      const rem = a.restEndsAt - now;
      refs.ring.set(Math.max(0, rem), a.restTotal, '');
      const sec = Math.ceil(rem / 1000);
      if (sec <= 3 && sec >= 1 && a.restLastBeep !== sec) {
        a.restLastBeep = sec;
        signal('tick');
      }
      if (rem <= 0) endRest();
    }
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
  render();
  iv = setInterval(tick, 200);
  return { el: root, destroy: () => clearInterval(iv) };
}
