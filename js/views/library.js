// Übungsbibliothek und Übungsdetails.
import { EX, EXERCISES, CATEGORIES, EQUIPMENT } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, openSheet, levelDots, toast, fmtDate } from '../ui.js';
import { isAllowed, alternativesFor } from '../plans.js';
import { bestScore, exerciseSeries } from '../stats.js';
import { say, stopSpeech, speechAvailable } from '../feedback.js';
import { CAT_EMOJI, exBadge, exTags, targetText, topbar } from './common.js';

const filter = { q: '', cat: 'alle', onlyMine: true };

export function renderLibrary() {
  const state = getState();
  const fitting = EXERCISES.filter((e) => isAllowed(e, state.settings)).length;
  const listEl = h('div', { class: 'list' });

  const renderList = () => {
    const q = filter.q.trim().toLowerCase();
    const items = EXERCISES.filter((e) => (filter.cat === 'alle' || e.cat === filter.cat)
      && (!filter.onlyMine || isAllowed(e, state.settings))
      && (!q || e.name.toLowerCase().includes(q) || e.muscles.toLowerCase().includes(q)));
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.append(h('div', { class: 'empty' }, h('span', { class: 'emo' }, '🔍'), 'Keine passende Übung gefunden.'));
      return;
    }
    for (const ex of items) {
      const ok = isAllowed(ex, state.settings);
      listEl.append(h('button', { class: 'list-item', onclick: () => openExerciseSheet(ex.id), style: ok ? null : { opacity: 0.55 } },
        exBadge(ex.id),
        h('div', { class: 'grow' },
          h('div', { class: 'title' }, ex.name),
          h('div', { class: 'meta' }, levelDots(ex.level), ' ', ex.muscles),
        ),
        icon('right', 'chev'),
      ));
    }
  };

  const chips = h('div', { class: 'chips' });
  const renderChips = () => {
    chips.innerHTML = '';
    for (const [key, label] of [['alle', 'Alle'], ...Object.entries(CATEGORIES)]) {
      chips.append(h('button', {
        class: `chip${filter.cat === key ? ' on' : ''}`,
        onclick: () => { filter.cat = key; renderChips(); renderList(); },
      }, key === 'alle' ? label : `${CAT_EMOJI[key]} ${label}`));
    }
  };
  renderChips();
  renderList();

  return h('div', { class: 'stack' },
    topbar('Übungen', { sub: `${fitting} von ${EXERCISES.length} passen zu deiner Ausrüstung` }),
    h('div', { class: 'row', style: { position: 'relative' } },
      h('input', {
        class: 'input', type: 'search', placeholder: 'Übung oder Muskel suchen …', value: filter.q, 'aria-label': 'Suchen',
        oninput: (e) => { filter.q = e.target.value; renderList(); },
      }),
    ),
    chips,
    h('label', { class: 'row small muted', style: { gap: '8px' } },
      h('input', { type: 'checkbox', checked: filter.onlyMine, onchange: (e) => { filter.onlyMine = e.target.checked; renderList(); } }),
      'Nur Übungen, die zu meiner Ausrüstung und meinen Einstellungen passen',
    ),
    listEl,
  );
}

function blockReason(ex, settings) {
  const missing = ex.needs.filter((n) => !settings.equipment[n]).map((n) => EQUIPMENT[n]);
  if (missing.length) return `Benötigt: ${missing.join(', ')}`;
  if (settings.wristSafe && ex.wrist === 'flat') return 'Ausgeblendet, weil „Handgelenke schonen“ aktiv ist (Stütz auf flacher Hand).';
  if (settings.noJumps && ex.jump) return 'Ausgeblendet, weil „Keine Sprünge“ aktiv ist.';
  return null;
}

/**
 * Detailansicht einer Übung als Bottom-Sheet.
 * opts.variants: zeigt „Andere Variante wählen“ (dauerhaft für alle Pläne).
 * opts.onChange: wird nach einer Änderung aufgerufen.
 */
export function openExerciseSheet(exId, opts = {}) {
  const state = getState();
  const ex = EX[exId];
  const reason = blockReason(ex, state.settings);
  const best = bestScore(state.history, exId);
  const series = exerciseSeries(state.history, exId);
  const unit = ex.mode === 'time' ? 'Sek.' : 'Wdh.';
  const swappedFrom = Object.keys(state.swaps).find((k) => state.swaps[k] === exId);

  let bestText = null;
  if (best != null && series.length) {
    const top = Math.max(...series.map((p) => p.best));
    bestText = `Deine Bestleistung: ${top} ${unit} in einem Satz · zuletzt am ${fmtDate(series.at(-1).ts)}`;
  }

  const content = h('div', { class: 'stack' },
    h('div', { class: 'row' },
      h('div', { class: 'ex-badge', style: { width: '52px', height: '52px', fontSize: '26px' } }, CAT_EMOJI[ex.cat]),
      h('div', { class: 'grow' },
        h('h2', null, ex.name),
        h('div', { class: 'muted small' }, ex.muscles),
      ),
    ),
    h('div', { class: 'row wrap', style: { gap: '6px' } },
      h('span', { class: 'tag' }, levelDots(ex.level), ['', ' leicht', ' mittel', ' schwer'][ex.level]),
      h('span', { class: 'tag' }, `Ziel: ${targetText(ex, ex.range)}`),
      exTags(ex),
      ex.needs.length ? h('span', { class: 'tag' }, ex.needs.map((n) => EQUIPMENT[n]).join(', ')) : h('span', { class: 'tag' }, 'ohne Geräte'),
    ),
    reason ? h('div', { class: 'hint-box' }, icon('info'), reason) : null,
    ex.wrist === 'fist' ? h('div', { class: 'hint-box' }, icon('info'), 'Handgelenkschonend: auf den Fäusten, Handgelenk gerade halten.') : null,
    h('div', null,
      h('h3', { style: { marginBottom: '6px' } }, 'So geht’s'),
      h('ol', { style: { margin: 0, paddingLeft: '22px' } }, ex.steps.map((t) => h('li', { style: { marginBottom: '6px' } }, t))),
    ),
    h('div', null,
      h('h3', { style: { marginBottom: '6px' } }, 'Tipps'),
      h('ul', { style: { margin: 0, paddingLeft: '22px' } }, ex.tips.map((t) => h('li', { style: { marginBottom: '6px' } }, t))),
    ),
    bestText ? h('div', { class: 'tag rest', style: { padding: '8px 12px', whiteSpace: 'normal' } }, '🏆 ', bestText) : null,
    h('div', { class: 'row wrap' },
      speechAvailable() ? h('button', { class: 'btn small', onclick: () => say(`${ex.name}. ${ex.steps.join(' ')} Tipp: ${ex.tips[0]}`, { force: true }) }, icon('speaker'), 'Vorlesen') : null,
      ex.easier ? h('button', { class: 'btn small', onclick: async () => { await close(); openExerciseSheet(ex.easier, opts); } }, icon('down'), 'Leichter') : null,
      ex.harder ? h('button', { class: 'btn small', onclick: async () => { await close(); openExerciseSheet(ex.harder, opts); } }, icon('up'), 'Schwerer') : null,
    ),
    opts.variants ? variantSection(exId, swappedFrom, async () => { await close(); opts.onChange?.(); }) : null,
  );
  const { close } = openSheet(content, { onClose: stopSpeech });
  return close;
}

function variantSection(exId, swappedFrom, done) {
  const alts = alternativesFor(exId);
  const box = h('div', { class: 'stack-sm' });
  const listWrap = h('div', { class: 'list hidden' }, alts.map((alt) => h('button', {
    class: 'list-item',
    onclick: () => {
      update((s) => {
        // Kette auflösen: ursprüngliche Übung zeigt direkt auf die neue Variante
        const root = swappedFrom || exId;
        if (alt.id === root) delete s.swaps[root];
        else s.swaps[root] = alt.id;
      });
      toast(`Gemerkt: ${alt.name} (gilt für alle Pläne)`);
      done();
    },
  }, exBadge(alt.id), h('div', { class: 'grow' }, h('div', { class: 'title' }, alt.name), h('div', { class: 'meta' }, levelDots(alt.level), ' ', alt.muscles)))));
  box.append(
    h('div', { class: 'divider' }),
    h('button', { class: 'btn block', onclick: () => listWrap.classList.toggle('hidden') }, icon('swap'), 'Andere Variante wählen'),
    listWrap,
    swappedFrom ? h('button', {
      class: 'btn ghost block',
      onclick: () => { update((s) => { delete s.swaps[swappedFrom]; }); toast(`Zurück zu: ${EX[swappedFrom].name}`); done(); },
    }, `Zurück zu „${EX[swappedFrom].name}“`) : null,
  );
  return box;
}
