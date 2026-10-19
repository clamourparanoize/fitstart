// Freie Ausdauer-Einheit eintragen (Laufband, Ergometer, Spaziergang …).
import { getState } from '../store.js';
import { h, icon, openSheet, toast, stepper } from '../ui.js';
import { ACTIVITIES, logFreeSession } from '../session.js';
import { dayKey } from '../stats.js';
import { rerender } from '../nav.js';

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export function openLogSheet() {
  const st = getState();
  const keys = Object.keys(ACTIVITIES).filter((k) => !(k in st.settings.equipment) || st.settings.equipment[k]);
  let activity = keys[0];
  let minutes = 30;

  const chips = h('div', { class: 'chips', style: { flexWrap: 'wrap' } });
  const paintChips = () => {
    chips.innerHTML = '';
    for (const k of keys) {
      chips.append(h('button', { class: `chip${k === activity ? ' on' : ''}`, onclick: () => { activity = k; paintChips(); } }, `${ACTIVITIES[k].emoji} ${ACTIVITIES[k].name}`));
    }
  };
  paintChips();

  const today = dayKey(Date.now());
  const date = h('input', { class: 'input', type: 'date', value: today, max: today, 'aria-label': 'Datum' });
  const km = h('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: 'optional, z. B. 3,5' });
  const kcal = h('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: 'optional, z. B. 250' });

  const { close } = openSheet(h('div', { class: 'stack' },
    h('h2', null, 'Einheit eintragen'),
    h('p', { class: 'muted small' }, 'Für alles, was du ohne Programm gemacht hast. Zählt fürs Wochenziel, für Punkte und die Statistik.'),
    h('div', { class: 'field' }, h('span', null, 'Was hast du gemacht?'), chips),
    h('label', { class: 'field' }, h('span', null, 'Wann?'), date),
    h('div', { class: 'field' }, h('span', null, 'Wie lange?'),
      h('div', { class: 'center' }, stepper({ value: minutes, min: 5, max: 300, step: 5, label: 'Dauer', format: (v) => `${v} Min.`, onchange: (v) => { minutes = v; } }))),
    h('div', { class: 'row' },
      h('label', { class: 'field', style: { flex: 1 } }, h('span', null, 'Strecke (km)'), km),
      h('label', { class: 'field', style: { flex: 1 } }, h('span', null, 'Kalorien'), kcal),
    ),
    h('button', {
      class: 'btn primary big block',
      onclick: async () => {
        const day = date.value || today;
        const start = day === today ? Date.now() - minutes * 60000 : new Date(`${day}T18:00`).getTime();
        const res = logFreeSession({ activity, start, minutes, km: num(km.value), kcal: num(kcal.value) });
        await close();
        toast(res.newBadges.length
          ? `Eingetragen! Neues Abzeichen: ${res.newBadges[0].emoji} ${res.newBadges[0].name}`
          : `Eingetragen! +${res.entry.xp} XP`);
        rerender();
      },
    }, icon('check'), 'Eintragen'),
  ));
}
