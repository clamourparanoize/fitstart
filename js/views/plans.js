// Planübersicht und Plandetails.
import { EX } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, confirmDialog, toast, plural, uid, fmtSec } from '../ui.js';
import {
  BUILTIN_PLANS, PROGRAM, planById, nextProgramPlanId, resolvedItems, planMeta, timedConfig, cardioPrograms, cardioStage, EFFORT,
} from '../plans.js';
import { navigate, backOrReplace, rerender } from '../nav.js';
import { beginPlan, planCard, exBadge, targetText, topbar } from './common.js';
import { openExerciseSheet } from './library.js';
import { openLogSheet } from './log.js';

export function renderPlans() {
  const state = getState();
  const next = nextProgramPlanId(state.history);
  const program = PROGRAM.map((id) => planById(id));
  const extras = BUILTIN_PLANS.filter((p) => !PROGRAM.includes(p.id));
  const cardio = cardioPrograms(state);

  return h('div', null,
    topbar('Pläne', { sub: 'Wähle ein Training oder bau dir dein eigenes.' }),
    h('div', { class: 'section-title' }, 'Dein Einsteigerprogramm'),
    h('p', { class: 'muted small', style: { margin: '-4px 4px 10px' } },
      '3× pro Woche im Wechsel Kraft und Kondition. Die App merkt sich, welcher Tag dran ist.'),
    h('div', { class: 'list' }, program.map((p, i) => planCard(p, { badge: p.id === next ? 'als Nächstes' : `Tag ${'ABCD'[i]}` }))),
    cardio.length ? [
      h('div', { class: 'section-title' }, 'Ausdauer an Geräten'),
      h('p', { class: 'muted small', style: { margin: '-4px 4px 10px' } },
        'Geführt mit Ansagen. Nach zwei geschafften Einheiten geht es automatisch eine Stufe weiter.'),
      h('div', { class: 'list' }, cardio.map((p) => planCard(p))),
    ] : null,
    h('div', { class: 'section-title' }, 'Extra-Trainings'),
    h('div', { class: 'list' }, extras.map((p) => planCard(p))),
    h('div', { class: 'section-title' }, 'Eigene Pläne'),
    state.plans.length
      ? h('div', { class: 'list' }, state.plans.map((p) => planCard(p)))
      : h('div', { class: 'card empty' }, h('span', { class: 'emo' }, '📝'), 'Noch keine eigenen Pläne. Stell dir dein Lieblingstraining zusammen!'),
    h('a', { class: 'btn primary block', href: '#/plan-neu', style: { marginTop: '14px' } }, icon('plus'), 'Neuen Plan erstellen'),
    h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: () => openLogSheet() }, icon('plus'), 'Freie Einheit eintragen'),
  );
}

export function renderPlanDetail(id) {
  const plan = planById(id);
  if (!plan) {
    navigate('#/plaene', { replace: true });
    return null;
  }
  return plan.kind === 'ausdauer' ? cardioDetail(plan) : planDetail(plan);
}

function planDetail(plan) {
  const state = getState();
  const id = plan.id;
  const custom = state.plans.some((p) => p.id === id);
  const items = resolvedItems(plan);
  const cfg = plan.kind === 'zeit' ? timedConfig(plan) : null;

  const settingsTags = cfg
    ? [`${cfg.work} Sek. Übung`, `${cfg.rest} Sek. Pause`, plural(cfg.rounds, 'Runde', 'Runden'), cfg.roundRest ? `${fmtSec(cfg.roundRest)} Rundenpause` : null]
    : [`Pause ${fmtSec(items[0]?.rest || state.settings.restSec)} zwischen Sätzen`, state.settings.autoMode ? 'Automatik an' : null];
  const warm = state.settings.warmup && (plan.warmup ?? true);
  const cool = state.settings.cooldown && (plan.cooldown ?? true);

  return h('div', { class: 'stack' },
    topbar(`${plan.emoji || '⭐'} ${plan.name}`, { back: '#/plaene', sub: planMeta(plan) }),
    plan.desc ? h('p', { class: 'muted' }, plan.desc) : null,
    h('div', { class: 'row wrap', style: { gap: '6px' } },
      settingsTags.filter(Boolean).map((t) => h('span', { class: 'tag' }, t)),
      warm ? h('span', { class: 'tag rest' }, '✓ Aufwärmen') : null,
      cool ? h('span', { class: 'tag rest' }, '✓ Dehnen am Ende') : null,
    ),
    h('button', { class: 'btn primary big block', onclick: () => beginPlan(plan) }, icon('play'), 'Training starten'),
    h('div', { class: 'section-title' }, 'Übungen'),
    h('div', { class: 'list' }, items.map((it) => {
      const ex = EX[it.exId];
      const swapped = Object.values(state.swaps).includes(it.exId);
      return h('button', { class: 'list-item', onclick: () => openExerciseSheet(it.exId, { variants: !custom, onChange: rerender }) },
        exBadge(it.exId),
        h('div', { class: 'grow' },
          h('div', { class: 'title' }, ex.name, swapped ? h('span', { class: 'tag accent', style: { marginLeft: '6px' } }, 'Variante') : null),
          h('div', { class: 'meta' }, plan.kind === 'kraft' ? targetText(ex, it.range, it.sets) : `${ex.muscles}${ex.perSide ? ' · Seitenwechsel zur Halbzeit' : ''}`),
        ),
        icon('info', 'chev'),
      );
    })),
    !custom ? h('p', { class: 'muted small' }, 'Tipp: Tipp auf eine Übung, um sie zu erklären oder gegen eine andere Variante zu tauschen.') : null,
    h('div', { class: 'row wrap', style: { marginTop: '6px' } },
      custom
        ? [
          h('a', { class: 'btn', href: `#/plan/${id}/bearbeiten` }, icon('edit'), 'Bearbeiten'),
          h('button', {
            class: 'btn danger',
            onclick: async () => {
              if (await confirmDialog({ title: 'Plan löschen?', text: `„${plan.name}“ wird entfernt. Dein Trainingsverlauf bleibt erhalten.`, ok: 'Löschen', danger: true })) {
                update((s) => { s.plans = s.plans.filter((p) => p.id !== id); });
                toast('Plan gelöscht');
                backOrReplace('#/plaene');
              }
            },
          }, icon('trash'), 'Löschen'),
        ]
        : h('button', { class: 'btn', onclick: () => copyPlan(plan, items) }, icon('copy'), 'Kopieren & anpassen'),
    ),
  );
}

const mins = (sec) => {
  const m = sec / 60;
  return `${Number.isInteger(m) ? m : String(Math.round(m * 10) / 10).replace('.', ',')} Min.`;
};

function cardioDetail(plan) {
  const state = getState();
  const current = cardioStage(plan, state);
  const progress = state.cardio?.[plan.id];
  const stage = plan.stages[current];
  const blocks = stage.blocks;
  const warm = blocks[0];
  const cool = blocks.at(-1);
  const middle = blocks.slice(1, -1);
  const efforts = [...new Set(blocks.map((b) => b[2]))].sort();

  return h('div', { class: 'stack' },
    topbar(`${plan.emoji} ${plan.name}`, { back: '#/plaene', sub: planMeta(plan) }),
    h('p', { class: 'muted' }, plan.desc),
    h('div', { class: 'field' }, h('span', null, 'Stufe'),
      h('div', { class: 'chips' }, plan.stages.map((_, i) => h('button', {
        class: `chip${i === current ? ' on' : ''}`,
        onclick: () => {
          update((s) => { s.cardio = s.cardio || {}; s.cardio[plan.id] = { stage: i, done: 0 }; });
          rerender();
        },
      }, `Stufe ${i + 1}`)))),
    h('div', { class: 'card stack-sm' },
      h('h3', null, `Stufe ${current + 1}: ${stage.text}`),
      h('div', { class: 'list', style: { marginTop: '10px', boxShadow: 'none' } },
        h('div', { class: 'list-item' }, exBadge(warm[0]), h('div', { class: 'grow' }, h('div', { class: 'title' }, `${mins(warm[1])} ${warm[4] || EX[warm[0]].name}`), h('div', { class: 'meta' }, 'zum Aufwärmen'))),
        h('div', { class: 'list-item' }, exBadge(middle[0][0]), h('div', { class: 'grow' }, h('div', { class: 'title' }, stage.text), h('div', { class: 'meta' }, `Hauptteil, zusammen ${mins(middle.reduce((n, b) => n + b[1], 0))}`))),
        h('div', { class: 'list-item' }, exBadge(cool[0]), h('div', { class: 'grow' }, h('div', { class: 'title' }, `${mins(cool[1])} ${cool[4] || EX[cool[0]].name}`), h('div', { class: 'meta' }, 'zum Ausklingen'))),
      ),
      progress && progress.stage === current && progress.done
        ? h('p', { class: 'small muted' }, `Auf dieser Stufe schon ${plural(progress.done, 'Mal', 'Mal')} geschafft. ${current < plan.stages.length - 1 ? 'Noch einmal, dann geht es eine Stufe weiter.' : ''}`)
        : null,
    ),
    h('div', { class: 'card stack-sm' },
      h('h3', null, 'Wie anstrengend?'),
      h('p', { class: 'small muted' }, 'Jedes Gerät ist anders, deshalb sagt die App die Anstrengung auf einer Skala von 1 bis 10 an. Stell Tempo, Steigung oder Widerstand so ein, dass es passt:'),
      efforts.map((e) => h('div', { class: 'row small', style: { alignItems: 'flex-start' } }, h('b', { style: { minWidth: '44px' } }, `${e}/10`), h('span', null, EFFORT[e]))),
    ),
    h('button', { class: 'btn primary big block', onclick: () => beginPlan(plan) }, icon('play'), 'Training starten'),
    h('div', { class: 'section-title' }, 'Übungen'),
    h('div', { class: 'list' }, resolvedItems(plan).map((it) => h('button', { class: 'list-item', onclick: () => openExerciseSheet(it.exId) },
      exBadge(it.exId), h('div', { class: 'grow' }, h('div', { class: 'title' }, EX[it.exId].name), h('div', { class: 'meta' }, EX[it.exId].muscles)), icon('info', 'chev')))),
  );
}

function copyPlan(plan, items) {
  const copy = {
    id: uid(), custom: true, kind: plan.kind, emoji: plan.emoji, name: `${plan.name} (eigene)`, desc: plan.desc,
    work: plan.work, rest: plan.rest, rounds: plan.rounds, roundRest: plan.roundRest, warmup: plan.warmup ?? true, cooldown: plan.cooldown ?? true,
    items: items.map((it) => (plan.kind === 'kraft' ? { ex: it.exId, sets: it.sets, range: [...it.range], rest: it.rest } : { ex: it.exId })),
  };
  update((s) => { s.plans.push(copy); });
  navigate(`#/plan/${copy.id}/bearbeiten`);
}
