// Startseite „Heute“.
import { EX } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, toast, confirmDialog, openSheet, fmtDateLong, segmented, plural } from '../ui.js';
import { planById, nextProgramPlanId, PROGRAM, generateSurprise, resolvedItems, planMeta } from '../plans.js';
import { thisWeekCount, streakInfo, startOfDay } from '../stats.js';
import { totalXp, levelInfo, todaysChallenge, quoteOfTheDay, awardBadges, CHALLENGE_XP } from '../gamification.js';
import { discardSession } from '../session.js';
import { beginPlan, exBadge, targetText } from './common.js';
import { openExerciseSheet } from './library.js';

let surpriseOpts = { minutes: 20, style: 'egal' };

export function renderHome() {
  const state = getState();
  const name = state.profile.name?.trim();
  const el = h('div', { class: 'stack' });

  el.append(h('div', { class: 'topbar', style: { marginBottom: '4px' } },
    h('div', { style: { flex: 1 } },
      h('h1', null, name ? `Hallo, ${name}!` : 'Hallo!'),
      h('div', { class: 'sub' }, fmtDateLong(Date.now())),
    ),
    h('a', { class: 'icon-btn', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('settings')),
  ));

  if (state.active) el.append(resumeCard(state.active));
  el.append(nextCard(state));
  el.append(h('div', { class: 'stat-grid' }, weekCard(state), levelCard(state)));
  el.append(surpriseCard());
  el.append(challengeCard(state));
  if (window.__installPrompt) el.append(installCard());
  el.append(h('p', { class: 'quote' }, `„${quoteOfTheDay()}“`));
  return el;
}

function resumeCard(active) {
  return h('div', { class: 'card resume-card stack-sm' },
    h('div', { class: 'row' },
      h('span', { style: { fontSize: '26px' } }, active.emoji),
      h('div', { class: 'grow' }, h('h3', null, 'Training läuft noch'), h('div', { class: 'muted small' }, active.name)),
    ),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      h('a', { class: 'btn primary', href: '#/training', style: { flex: 1 } }, icon('play'), 'Fortsetzen'),
      h('button', {
        class: 'btn danger',
        onclick: async () => {
          if (await confirmDialog({ title: 'Training verwerfen?', text: 'Der bisherige Fortschritt dieses Trainings wird nicht gespeichert.', ok: 'Verwerfen', danger: true })) {
            discardSession();
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }
        },
      }, 'Verwerfen'),
    ),
  );
}

function nextCard(state) {
  const plan = planById(nextProgramPlanId(state.history));
  const dayIdx = PROGRAM.indexOf(plan.id);
  const today = startOfDay(Date.now());
  const trainedToday = state.history.some((x) => x.start >= today);
  const eyebrow = trainedToday ? 'Heute schon trainiert 💪 · als Nächstes' : `Dein nächstes Training · Tag ${'ABCD'[dayIdx]}`;
  return h('div', { class: 'hero-card' },
    h('div', { class: 'eyebrow' }, eyebrow),
    h('h2', null, `${plan.emoji} ${plan.name}`),
    h('p', { style: { marginBottom: '8px' } }, plan.desc),
    h('div', { class: 'meta' }, planMeta(plan)),
    h('div', { class: 'row', style: { marginTop: '16px' } },
      h('button', { class: 'btn big', style: { flex: 1 }, onclick: () => beginPlan(plan) }, icon('play'), 'Training starten'),
      h('a', { class: 'btn ghost', href: `#/plan/${plan.id}` }, 'Details'),
    ),
    trainedToday ? h('p', { class: 'small', style: { marginTop: '10px', opacity: 0.85 } }, 'Erholung gehört dazu. Morgen geht es frisch weiter, oder du legst noch eine Runde drauf.') : null,
  );
}

function weekCard(state) {
  const goal = state.settings.weeklyGoal;
  const done = thisWeekCount(state.history);
  const st = streakInfo(state.history, goal);
  return h('a', { class: 'stat', href: '#/erfolge', style: { textDecoration: 'none', color: 'inherit' } },
    h('div', { class: 'label' }, 'Wochenziel'),
    h('div', { class: 'value num' }, `${Math.min(done, 99)}`, h('small', null, `/ ${goal}`)),
    h('div', { class: 'week-dots' }, Array.from({ length: goal }, (_, i) => h('i', { class: i < done ? 'on' : '' }))),
    h('div', { class: 'small muted', style: { marginTop: '8px' } }, st.current ? `🔥 ${plural(st.current, 'Woche', 'Wochen')} Serie` : 'Starte deine Serie!'),
  );
}

function levelCard(state) {
  const lv = levelInfo(totalXp(state));
  return h('a', { class: 'stat', href: '#/erfolge', style: { textDecoration: 'none', color: 'inherit' } },
    h('div', { class: 'label' }, 'Level'),
    h('div', { class: 'value num' }, `${lv.level}`, h('small', null, lv.title)),
    h('div', { class: 'progress', style: { marginTop: '10px' } }, h('div', { style: { width: `${lv.pct}%` } })),
    h('div', { class: 'small muted', style: { marginTop: '8px' } }, `noch ${lv.need - lv.into} XP`),
  );
}

function surpriseCard() {
  return h('div', { class: 'card stack-sm' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('h2', null, 'Überrasch mich 🎲'),
        h('div', { class: 'muted small' }, 'Ein zufälliges Training, passend zu deinen Geräten.'),
      ),
    ),
    h('div', { style: { marginTop: '12px' } },
      segmented([[10, '10 Min.'], [20, '20 Min.'], [30, '30 Min.']], surpriseOpts.minutes, (v) => { surpriseOpts.minutes = v; }),
    ),
    segmented([['kraft', 'Kraft'], ['zeit', 'Kondition'], ['egal', 'Egal']], surpriseOpts.style, (v) => { surpriseOpts.style = v; }),
    h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => openSurprise() }, icon('dice'), 'Würfeln'),
  );
}

function openSurprise(seed = Date.now()) {
  const plan = generateSurprise({ ...surpriseOpts, seed });
  const items = resolvedItems(plan);
  const cfg = plan.kind === 'zeit' ? `${plan.work} Sek. Übung · ${plan.rest} Sek. Pause · ${plural(plan.rounds, 'Runde', 'Runden')}` : null;
  const { close } = openSheet(h('div', { class: 'stack' },
    h('div', null,
      h('div', { class: 'tag accent' }, '🎲 Überraschung'),
      h('h2', { style: { marginTop: '8px' } }, plan.name),
      h('div', { class: 'muted small' }, planMeta(plan)),
      cfg ? h('div', { class: 'muted small' }, cfg) : null,
    ),
    h('div', { class: 'list' }, items.map((it) => {
      const ex = EX[it.exId];
      return h('button', { class: 'list-item', onclick: () => openExerciseSheet(it.exId) },
        exBadge(it.exId),
        h('div', { class: 'grow' },
          h('div', { class: 'title' }, ex.name),
          h('div', { class: 'meta' }, plan.kind === 'kraft' ? targetText(ex, it.range, it.sets) : ex.muscles),
        ),
        icon('info', 'chev'),
      );
    })),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { close(); openSurprise(Date.now()); } }, icon('dice'), 'Neu würfeln'),
      h('button', { class: 'btn primary', style: { flex: 1 }, onclick: () => { close(); beginPlan(plan); } }, icon('play'), 'Los geht’s'),
    ),
  ));
}

function challengeCard(state) {
  const ch = todaysChallenge(state);
  const ex = ch.ex ? EX[ch.ex] : null;
  return h('div', { class: 'card stack-sm' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('div', { class: 'section-title', style: { margin: 0 } }, 'Tages-Challenge')),
      h('span', { class: 'tag accent' }, `+${CHALLENGE_XP} XP`),
    ),
    h('p', { style: { fontSize: '17px', fontWeight: 600, marginTop: '8px' } }, ch.text),
    ex ? h('button', { class: 'btn ghost small', style: { padding: 0 }, onclick: () => openExerciseSheet(ex.id) }, icon('info'), `So geht „${ex.name}“`) : null,
    ch.done
      ? h('div', { class: 'tag rest', style: { marginTop: '10px', padding: '6px 12px' } }, icon('check'), 'Heute erledigt, stark!')
      : h('button', {
        class: 'btn block', style: { marginTop: '10px' },
        onclick: () => {
          let fresh = [];
          update((s) => { s.challenges[ch.key] = ch.id; fresh = awardBadges(s); });
          toast(fresh.length ? `Challenge geschafft! Neues Abzeichen: ${fresh[0].emoji} ${fresh[0].name}` : `Challenge geschafft! +${CHALLENGE_XP} XP`);
          location.hash = '#/heute';
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        },
      }, icon('check'), 'Geschafft!'),
  );
}

function installCard() {
  return h('div', { class: 'card row' },
    h('div', { class: 'grow' },
      h('h3', null, 'Als App installieren'),
      h('div', { class: 'muted small' }, 'Dann startest du FitStart direkt vom Startbildschirm, auch offline.'),
    ),
    h('button', {
      class: 'btn primary small',
      onclick: async () => {
        const p = window.__installPrompt;
        if (!p) return;
        p.prompt();
        await p.userChoice;
        window.__installPrompt = null;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      },
    }, 'Installieren'),
  );
}
