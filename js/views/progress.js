// Fortschritt: Häufigkeit, Volumen, Kraft pro Übung, Verlauf.
import { EX } from '../exercises.js';
import { getState, update } from '../store.js';
import { h, icon, openSheet, confirmDialog, toast, segmented, fmtDate, fmtDateLong, fmtTime, fmtMinutes, fmtNum, plural } from '../ui.js';
import { weeklySeries, streakInfo, totals, exerciseSeries, trainedExerciseIds, calendarGrid } from '../stats.js';
import { barChart, lineChart, calendarHeat } from '../charts.js';
import { exBadge, topbar } from './common.js';

const view = { volume: 'minutes', exId: null, exMetric: 'best', historyLimit: 15 };
const shortDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });
const sd = (ts) => shortDate.format(new Date(ts));

export function renderProgress() {
  const state = getState();
  const hist = state.history;
  const el = h('div', { class: 'stack' }, topbar('Fortschritt', { sub: 'Jede Einheit bringt dich weiter.' }));

  if (!hist.length) {
    el.append(h('div', { class: 'card empty' },
      h('span', { class: 'emo' }, '📊'),
      h('p', null, 'Hier siehst du bald deine Kurven: Trainings pro Woche, Wiederholungen und deine Bestleistungen.'),
      h('a', { class: 'btn primary', href: '#/heute', style: { marginTop: '14px' } }, icon('play'), 'Erstes Training starten'),
    ));
    return el;
  }

  const tot = totals(hist);
  const st = streakInfo(hist, state.settings.weeklyGoal);
  const prs = hist.reduce((n, x) => n + (x.prs?.length || 0), 0);
  el.append(h('div', { class: 'stat-grid' },
    stat('Trainings', fmtNum(tot.workouts)),
    tot.minutes >= 120
      ? stat('Trainingszeit', String(Math.round(tot.minutes / 6) / 10).replace('.', ','), 'Stunden')
      : stat('Trainingszeit', Math.round(tot.minutes), 'Minuten'),
    stat('Wochen-Serie', st.current, st.best > st.current ? `Rekord ${st.best}` : 'Wochen'),
    stat('Bestleistungen', prs, 'verbessert'),
  ));

  // Häufigkeit
  const weeks = weeklySeries(hist, 12);
  el.append(card('Trainings pro Woche', 'Die gestrichelte Linie ist dein Wochenziel.',
    barChart({
      data: weeks.map((w) => ({ label: sd(w.start), tipTitle: `Woche ab ${sd(w.start)}`, value: w.count })),
      goal: state.settings.weeklyGoal, tableHeaders: ['Woche', 'Trainings'],
    })));
  el.append(card('Kalender', 'Deine Trainingstage der letzten 12 Wochen.', calendarHeat(calendarGrid(hist, 12), (ts) => fmtDate(ts))));

  // Volumen
  const volBox = h('div');
  const VOL = {
    minutes: { label: 'Minuten', get: (w) => Math.round(w.minutes), fmt: (v) => fmtNum(v), head: 'Minuten', info: 'Trainingsminuten pro Woche.' },
    reps: { label: 'Wdh.', get: (w) => w.reps, fmt: (v) => fmtNum(v), head: 'Wiederholungen', info: 'Alle Wiederholungen aus deinen Krafttrainings pro Woche.' },
    kg: { label: 'kg', get: (w) => Math.round(w.kg), fmt: (v) => (v >= 10000 ? `${fmtNum(v / 1000)} t` : fmtNum(v)), head: 'kg (Wdh. × Gewicht)', info: 'Bewegte Last: Wiederholungen × Hantelgewicht, pro Woche zusammengezählt.' },
  };
  const paintVol = () => {
    const m = VOL[view.volume];
    volBox.innerHTML = '';
    volBox.append(h('p', { class: 'small muted', style: { marginBottom: '8px' } }, m.info));
    volBox.append(barChart({
      data: weeks.map((w) => ({ label: sd(w.start), tipTitle: `Woche ab ${sd(w.start)}`, value: m.get(w) })),
      format: m.fmt, tableHeaders: ['Woche', m.head],
    }));
  };
  paintVol();
  el.append(card('Trainingsvolumen pro Woche', null,
    segmented(Object.entries(VOL).map(([k, v]) => [k, v.label]), view.volume, (k) => { view.volume = k; paintVol(); }),
    h('div', { style: { marginTop: '12px' } }, volBox),
  ));

  // Kraft pro Übung
  const ids = trainedExerciseIds(hist);
  if (ids.length) {
    if (!view.exId || !ids.includes(view.exId)) view.exId = lastTrained(hist, ids);
    const exBox = h('div');
    const metricBox = h('div');
    const paintEx = () => {
      const ex = EX[view.exId];
      const series = exerciseSeries(hist, view.exId);
      const unit = ex.mode === 'time' ? 'Sek.' : 'Wdh.';
      const metrics = [['best', 'Bester Satz'], ['total', 'Gesamt']];
      if (ex.weighted) metrics.push(['est', 'Maximalkraft']);
      if (!metrics.some(([k]) => k === view.exMetric)) view.exMetric = 'best';
      metricBox.innerHTML = '';
      metricBox.append(segmented(metrics, view.exMetric, (k) => { view.exMetric = k; paintEx(); }));
      const fmt = view.exMetric === 'est' ? (v) => `${String(Math.round(v * 10) / 10).replace('.', ',')} kg` : (v) => `${Math.round(v)} ${unit}`;
      const points = series.map((p) => ({ ts: p.ts, value: p[view.exMetric] ?? 0, title: fmtDate(p.ts) }));
      exBox.innerHTML = '';
      exBox.append(lineChart({ points, format: fmt, dateFmt: sd, tableHeaders: ['Datum', metrics.find(([k]) => k === view.exMetric)[1]] }));
      const explain = {
        best: `Die meisten ${ex.mode === 'time' ? 'Sekunden' : 'Wiederholungen'} in einem Satz.`,
        total: `Alle ${ex.mode === 'time' ? 'Sekunden' : 'Wiederholungen'} der Übung in einem Training zusammen.`,
        est: 'Geschätztes Maximalgewicht für eine Wiederholung, berechnet aus Gewicht und Wiederholungen. Steigt, wenn du mehr schaffst.',
      };
      exBox.append(h('p', { class: 'small muted', style: { marginTop: '8px' } }, explain[view.exMetric],
        series.length < 2 ? ' Ab dem zweiten Training mit dieser Übung siehst du hier eine Kurve.' : ''));
    };
    const select = h('select', { class: 'input', 'aria-label': 'Übung wählen', onchange: (e) => { view.exId = e.target.value; paintEx(); } },
      ids.map((id) => h('option', { value: id, selected: id === view.exId }, EX[id].name)));
    select.value = view.exId;
    paintEx();
    el.append(card('Kraft pro Übung', null, select, h('div', { style: { marginTop: '10px' } }, metricBox), h('div', { style: { marginTop: '12px' } }, exBox)));
  }

  // Verlauf
  el.append(h('div', { class: 'section-title' }, 'Verlauf'));
  const listEl = h('div', { class: 'list' });
  const newestFirst = [...hist].reverse();
  newestFirst.slice(0, view.historyLimit).forEach((entry) => {
    listEl.append(h('button', { class: 'list-item', onclick: () => openEntry(entry) },
      h('div', { class: 'ex-badge' }, entry.emoji || '💪'),
      h('div', { class: 'grow' },
        h('div', { class: 'title' }, entry.name),
        h('div', { class: 'meta' }, `${fmtDate(entry.start)} · ${fmtMinutes(entry.durationSec)} · +${entry.xp} XP${entry.prs?.length ? ' · 🏆' : ''}`),
      ),
      icon('right', 'chev'),
    ));
  });
  el.append(listEl);
  if (hist.length > view.historyLimit) {
    el.append(h('button', { class: 'btn block', onclick: () => { view.historyLimit += 30; window.dispatchEvent(new HashChangeEvent('hashchange')); } }, 'Mehr anzeigen'));
  }
  return el;
}

function lastTrained(hist, ids) {
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = hist[i].exercises.find((x) => ids.includes(x.exId));
    if (e) return e.exId;
  }
  return ids[0];
}

function stat(label, value, small) {
  return h('div', { class: 'stat' }, h('div', { class: 'label' }, label), h('div', { class: 'value num' }, value, small ? h('small', null, small) : null));
}

function card(title, sub, ...children) {
  return h('div', { class: 'card' },
    h('h2', null, title),
    sub ? h('p', { class: 'small muted', style: { margin: '2px 0 12px' } }, sub) : h('div', { style: { height: '10px' } }),
    ...children,
  );
}

function setsText(ex, sets) {
  if (ex.mode === 'time' || sets.every((x) => x.reps == null)) return sets.map((x) => `${x.sec}s`).join(' · ');
  const kg = sets.find((x) => x.kg)?.kg;
  return `${sets.map((x) => x.reps).join(' · ')} Wdh.${kg ? ` · ${String(kg).replace('.', ',')} kg` : ''}`;
}

function openEntry(entry) {
  const { close } = openSheet(h('div', { class: 'stack' },
    h('div', null,
      h('h2', null, `${entry.emoji || '💪'} ${entry.name}`),
      h('div', { class: 'muted small' }, `${fmtDateLong(entry.start)}, ${fmtTime(entry.start)} Uhr · ${fmtMinutes(entry.durationSec)} · +${entry.xp} XP`),
    ),
    entry.exercises.length
      ? h('div', { class: 'list' }, entry.exercises.map((e) => {
        const ex = EX[e.exId];
        return h('div', { class: 'list-item' }, exBadge(e.exId),
          h('div', { class: 'grow' },
            h('div', { class: 'title' }, ex.name, entry.prs?.includes(e.exId) ? ' 🏆' : ''),
            h('div', { class: 'meta' }, `${plural(e.sets.length, entry.kind === 'kraft' ? 'Satz' : 'Intervall', entry.kind === 'kraft' ? 'Sätze' : 'Intervalle')}: ${setsText(ex, e.sets)}`),
          ));
      }))
      : h('p', { class: 'muted' }, 'Keine Übungen protokolliert.'),
    h('button', {
      class: 'btn danger block',
      onclick: async () => {
        close();
        if (await confirmDialog({ title: 'Eintrag löschen?', text: 'Das Training wird aus dem Verlauf entfernt, die Punkte dafür ebenfalls. Abzeichen bleiben.', ok: 'Löschen', danger: true })) {
          update((s) => { s.history = s.history.filter((x) => x.id !== entry.id); });
          toast('Eintrag gelöscht');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      },
    }, icon('trash'), 'Eintrag löschen'),
  ));
}
