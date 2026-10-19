// Gemeinsame Bausteine der Ansichten.
import { EX, CATEGORIES } from '../exercises.js';
import { getState } from '../store.js';
import { h, icon, confirmDialog } from '../ui.js';
import { startSession } from '../session.js';
import { unlockAudio } from '../feedback.js';
import { planMeta } from '../plans.js';
import { navBack } from '../nav.js';

export const CAT_EMOJI = { beine: '🦵', push: '💪', pull: '🚣', rumpf: '🎯', cardio: '⚡', mobil: '🧘' };

export function exBadge(exId) {
  const ex = EX[exId];
  return h('div', { class: 'ex-badge', title: CATEGORIES[ex.cat] }, CAT_EMOJI[ex.cat]);
}

export function exTags(ex) {
  return [
    ex.weighted ? h('span', { class: 'tag' }, 'Hanteln') : null,
    ex.wrist === 'fist' ? h('span', { class: 'tag accent' }, 'auf Fäusten') : null,
    ex.wrist === 'flat' ? h('span', { class: 'tag' }, 'flache Hand') : null,
    ex.perSide ? h('span', { class: 'tag' }, 'je Seite') : null,
    ex.jump ? h('span', { class: 'tag' }, 'mit Sprüngen') : null,
  ];
}

export function targetText(ex, range, sets) {
  const unit = ex.mode === 'time' ? 'Sek.' : 'Wdh.';
  const r = range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;
  return `${sets ? `${sets} × ` : ''}${r} ${unit}${ex.perSide ? ' je Seite' : ''}`;
}

export async function beginPlan(plan) {
  const state = getState();
  if (state.active) {
    const ok = await confirmDialog({
      title: 'Laufendes Training verwerfen?',
      text: `„${state.active.name}“ ist noch nicht abgeschlossen. Wenn du ein neues Training startest, geht es verloren.`,
      ok: 'Neu starten', danger: true,
    });
    if (!ok) return;
  }
  unlockAudio();
  startSession(plan);
  location.hash = '#/training';
}

export function planCard(plan, { badge } = {}) {
  return h('a', { class: 'list-item', href: `#/plan/${plan.id}` },
    h('div', { class: 'ex-badge' }, plan.emoji || '⭐'),
    h('div', { class: 'grow' },
      h('div', { class: 'title' }, plan.name, badge ? h('span', { class: 'tag accent', style: { marginLeft: '8px' } }, badge) : null),
      h('div', { class: 'meta' }, planMeta(plan)),
    ),
    icon('right', 'chev'),
  );
}

export function topbar(title, { back, sub, actions } = {}) {
  return h('div', { class: 'topbar' },
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Zurück', onclick: () => navBack(back) }, icon('left')) : null,
    h('div', { style: { flex: 1, minWidth: 0 } }, h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null),
    actions || null,
  );
}
