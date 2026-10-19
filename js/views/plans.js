// Planübersicht und Plandetails.
import { EX } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, confirmDialog, toast, plural, uid, fmtSec } from '../ui.js';
import { BUILTIN_PLANS, PROGRAM, planById, nextProgramPlanId, resolvedItems, planMeta, timedConfig } from '../plans.js';
import { beginPlan, planCard, exBadge, targetText, topbar } from './common.js';
import { openExerciseSheet } from './library.js';

const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function renderPlans() {
  const state = getState();
  const next = nextProgramPlanId(state.history);
  const program = PROGRAM.map((id) => planById(id));
  const extras = BUILTIN_PLANS.filter((p) => !PROGRAM.includes(p.id));

  return h('div', null,
    topbar('Pläne', { sub: 'Wähle ein Training oder bau dir dein eigenes.' }),
    h('div', { class: 'section-title' }, 'Dein Einsteigerprogramm'),
    h('p', { class: 'muted small', style: { margin: '-4px 4px 10px' } },
      '3× pro Woche im Wechsel Kraft und Kondition. Die App merkt sich, welcher Tag dran ist.'),
    h('div', { class: 'list' }, program.map((p, i) => planCard(p, { badge: p.id === next ? 'als Nächstes' : `Tag ${'ABCD'[i]}` }))),
    h('div', { class: 'section-title' }, 'Extra-Trainings'),
    h('div', { class: 'list' }, extras.map((p) => planCard(p))),
    h('div', { class: 'section-title' }, 'Eigene Pläne'),
    state.plans.length
      ? h('div', { class: 'list' }, state.plans.map((p) => planCard(p)))
      : h('div', { class: 'card empty' }, h('span', { class: 'emo' }, '📝'), 'Noch keine eigenen Pläne. Stell dir dein Lieblingstraining zusammen!'),
    h('a', { class: 'btn primary block', href: '#/plan-neu', style: { marginTop: '14px' } }, icon('plus'), 'Neuen Plan erstellen'),
  );
}

export function renderPlanDetail(id) {
  const state = getState();
  const plan = planById(id);
  if (!plan) {
    location.replace('#/plaene');
    return null;
  }
  const custom = state.plans.some((p) => p.id === id);
  const items = resolvedItems(plan);
  const cfg = plan.kind === 'zeit' ? timedConfig(plan) : null;

  const settingsTags = cfg
    ? [`${cfg.work} Sek. Übung`, `${cfg.rest} Sek. Pause`, plural(cfg.rounds, 'Runde', 'Runden'), cfg.roundRest ? `${fmtSec(cfg.roundRest)} Rundenpause` : null]
    : [`Pause ${fmtSec(items[0]?.rest || state.settings.restSec)} zwischen Sätzen`];
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
                location.hash = '#/plaene';
              }
            },
          }, icon('trash'), 'Löschen'),
        ]
        : h('button', { class: 'btn', onclick: () => copyPlan(plan, items) }, icon('copy'), 'Kopieren & anpassen'),
    ),
  );
}

function copyPlan(plan, items) {
  const copy = {
    id: uid(), custom: true, kind: plan.kind, emoji: plan.emoji, name: `${plan.name} (eigene)`, desc: plan.desc,
    work: plan.work, rest: plan.rest, rounds: plan.rounds, roundRest: plan.roundRest, warmup: plan.warmup ?? true, cooldown: plan.cooldown ?? true,
    items: items.map((it) => (plan.kind === 'kraft' ? { ex: it.exId, sets: it.sets, range: [...it.range], rest: it.rest } : { ex: it.exId })),
  };
  update((s) => { s.plans.push(copy); });
  location.hash = `#/plan/${copy.id}/bearbeiten`;
}
