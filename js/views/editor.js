// Eigene Pläne anlegen und bearbeiten.
import { EX, EXERCISES, CATEGORIES } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, openSheet, toast, segmented, stepper, toggleRow, uid, levelDots } from '../ui.js';
import { isAllowed } from '../plans.js';
import { CAT_EMOJI, exBadge, topbar } from './common.js';

const EMOJIS = ['⭐', '💪', '🔥', '⚡', '🎯', '🧘', '🦵', '🏃', '🌞', '🚀'];
let draft = null;
let draftFor = undefined;

export function renderPlanEditor(id) {
  const state = getState();
  if (draftFor !== id || !draft) {
    const existing = id ? state.plans.find((p) => p.id === id) : null;
    if (id && !existing) {
      location.replace('#/plaene');
      return null;
    }
    draft = existing
      ? structuredClone(existing)
      : { id: uid(), custom: true, kind: 'kraft', emoji: '⭐', name: '', desc: '', items: [], work: 40, rest: 20, rounds: 3, roundRest: 60, warmup: true, cooldown: true };
    draftFor = id;
  }

  const itemsEl = h('div', { class: 'list' });
  const timedEl = h('div');

  const renderItems = () => {
    itemsEl.innerHTML = '';
    if (!draft.items.length) {
      itemsEl.append(h('div', { class: 'empty' }, h('span', { class: 'emo' }, '➕'), 'Füge deine ersten Übungen hinzu.'));
      return;
    }
    draft.items.forEach((it, i) => {
      const ex = EX[it.ex];
      if (!it.range) it.range = [...ex.range];
      if (!it.sets) it.sets = 3;
      if (!it.rest) it.rest = state.settings.restSec;
      const move = (d) => {
        const j = i + d;
        if (j < 0 || j >= draft.items.length) return;
        [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
        renderItems();
      };
      const num = (label, value, set) => h('label', null, label,
        h('input', { type: 'number', inputmode: 'numeric', min: 1, value, onchange: (e) => set(Math.max(1, parseInt(e.target.value, 10) || 1)) }));
      itemsEl.append(h('div', { class: 'edit-item' },
        h('div', { class: 'head' },
          exBadge(it.ex),
          h('div', { class: 'grow' }, ex.name, isAllowed(ex) ? null : h('div', { class: 'tiny', style: { color: 'var(--danger)' } }, 'passt nicht zu deinen Einstellungen, wird ersetzt')),
          h('button', { class: 'icon-btn plain', 'aria-label': 'Nach oben', onclick: () => move(-1) }, icon('up')),
          h('button', { class: 'icon-btn plain', 'aria-label': 'Nach unten', onclick: () => move(1) }, icon('down')),
          h('button', { class: 'icon-btn plain', 'aria-label': 'Entfernen', onclick: () => { draft.items.splice(i, 1); renderItems(); } }, icon('trash')),
        ),
        draft.kind === 'kraft' ? h('div', { class: 'mini-fields', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
          num('Sätze', it.sets, (v) => { it.sets = v; }),
          num(ex.mode === 'time' ? 'Sek. von' : 'Wdh. von', it.range[0], (v) => { it.range[0] = v; }),
          num('bis', it.range[1], (v) => { it.range[1] = v; }),
          num('Pause s', it.rest, (v) => { it.rest = v; }),
        ) : null,
      ));
    });
  };

  const renderTimed = () => {
    timedEl.innerHTML = '';
    if (draft.kind !== 'zeit') return;
    const row = (label, el) => h('div', { class: 'toggle-row' }, h('div', { class: 'grow', style: { fontWeight: 600 } }, label), el);
    timedEl.append(h('div', { class: 'card', style: { padding: '4px 16px' } },
      row('Übung', stepper({ value: draft.work, min: 10, max: 180, step: 5, format: (v) => `${v} s`, onchange: (v) => { draft.work = v; }, label: 'Übungszeit' })),
      row('Pause', stepper({ value: draft.rest, min: 0, max: 120, step: 5, format: (v) => `${v} s`, onchange: (v) => { draft.rest = v; }, label: 'Pause' })),
      row('Runden', stepper({ value: draft.rounds, min: 1, max: 10, onchange: (v) => { draft.rounds = v; }, label: 'Runden' })),
      row('Rundenpause', stepper({ value: draft.roundRest, min: 0, max: 300, step: 15, format: (v) => `${v} s`, onchange: (v) => { draft.roundRest = v; }, label: 'Rundenpause' })),
    ));
  };

  renderItems();
  renderTimed();

  const emojiRow = h('div', { class: 'chips' });
  const renderEmojis = () => {
    emojiRow.innerHTML = '';
    EMOJIS.forEach((e) => emojiRow.append(h('button', {
      class: `chip${draft.emoji === e ? ' on' : ''}`, style: { fontSize: '20px' }, 'aria-label': `Symbol ${e}`,
      onclick: () => { draft.emoji = e; renderEmojis(); },
    }, e)));
  };
  renderEmojis();

  const save = () => {
    draft.name = draft.name.trim();
    if (!draft.name) return toast('Bitte gib dem Plan einen Namen.');
    if (!draft.items.length) return toast('Füge mindestens eine Übung hinzu.');
    const plan = draft;
    update((s) => {
      const idx = s.plans.findIndex((p) => p.id === plan.id);
      if (idx >= 0) s.plans[idx] = plan; else s.plans.push(plan);
    });
    draft = null;
    draftFor = undefined;
    toast('Plan gespeichert');
    location.hash = `#/plan/${plan.id}`;
    return null;
  };

  return h('div', { class: 'stack' },
    topbar(id ? 'Plan bearbeiten' : 'Neuer Plan', {
      back: id ? `#/plan/${id}` : '#/plaene',
      actions: h('button', { class: 'btn primary small', onclick: save }, icon('check'), 'Speichern'),
    }),
    h('label', { class: 'field' }, h('span', null, 'Name'),
      h('input', { class: 'input', value: draft.name, placeholder: 'z. B. Mein Montagstraining', maxlength: 40, oninput: (e) => { draft.name = e.target.value; } })),
    h('div', { class: 'field' }, h('span', null, 'Symbol'), emojiRow),
    h('div', { class: 'field' }, h('span', null, 'Art des Trainings'),
      segmented([['kraft', 'Kraft (Wiederholungen)'], ['zeit', 'Zeit (Intervalle)']], draft.kind, (v) => { draft.kind = v; renderItems(); renderTimed(); })),
    timedEl,
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      toggleRow('Aufwärmen vorweg', 'ca. 3 Minuten lockere Bewegung', draft.warmup, (v) => { draft.warmup = v; }),
      toggleRow('Dehnen am Ende', 'ca. 3 Minuten zum Runterkommen', draft.cooldown, (v) => { draft.cooldown = v; }),
    ),
    h('div', { class: 'section-title' }, 'Übungen'),
    itemsEl,
    h('button', { class: 'btn block', onclick: () => openPicker(() => renderItems()) }, icon('plus'), 'Übung hinzufügen'),
    h('button', { class: 'btn primary big block', onclick: save }, icon('check'), 'Plan speichern'),
  );
}

function openPicker(onAdd) {
  const state = getState();
  let cat = 'alle', q = '';
  const listEl = h('div', { class: 'list' });
  const renderList = () => {
    listEl.innerHTML = '';
    const needle = q.trim().toLowerCase();
    EXERCISES.filter((e) => isAllowed(e, state.settings) && (cat === 'alle' || e.cat === cat) && (!needle || e.name.toLowerCase().includes(needle)))
      .forEach((ex) => listEl.append(h('button', {
        class: 'list-item',
        onclick: () => {
          draft.items.push({ ex: ex.id, sets: 3, range: [...ex.range], rest: state.settings.restSec });
          onAdd();
          toast(`${ex.name} hinzugefügt`);
        },
      }, exBadge(ex.id), h('div', { class: 'grow' }, h('div', { class: 'title' }, ex.name), h('div', { class: 'meta' }, levelDots(ex.level), ' ', ex.muscles)), icon('plus', 'chev'))));
  };
  const chips = h('div', { class: 'chips' });
  const renderChips = () => {
    chips.innerHTML = '';
    for (const [key, label] of [['alle', 'Alle'], ...Object.entries(CATEGORIES)]) {
      chips.append(h('button', { class: `chip${cat === key ? ' on' : ''}`, onclick: () => { cat = key; renderChips(); renderList(); } }, key === 'alle' ? label : `${CAT_EMOJI[key]} ${label}`));
    }
  };
  renderChips();
  renderList();
  const { close } = openSheet(h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Übung hinzufügen'), h('button', { class: 'btn small primary', onclick: () => close() }, 'Fertig')),
    h('input', { class: 'input', type: 'search', placeholder: 'Suchen …', oninput: (e) => { q = e.target.value; renderList(); } }),
    chips,
    listEl,
  ));
}
