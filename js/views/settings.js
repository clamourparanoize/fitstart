// Einstellungen, Datensicherung und Ersteinrichtung.
import { EQUIPMENT } from '../exercises.js';
import { getState, update, resetAll, exportJson, importJson, NEWS_VERSION } from '../store.js';
import { h, icon, stepper, toggleRow, segmented, confirmDialog, toast, fmtDate } from '../ui.js';
import { say, unlockAudio, signal, speechAvailable } from '../feedback.js';
import { awardBadges } from '../gamification.js';
import { dayKey } from '../stats.js';
import { navigate, rerender } from '../nav.js';
import { topbar } from './common.js';

export function applyTheme() {
  const t = getState().settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

const set = (fn) => update((s) => fn(s.settings));

const FITNESS = [
  ['einsteiger', 'Einsteiger', 'Wenig oder lange keine Trainingserfahrung. Die App startet behutsam.'],
  ['erfahren', 'Etwas Erfahrung', 'Du trainierst ab und zu. Startziele etwas höher, Ausdauer ab Stufe 2.'],
  ['fortgeschritten', 'Fortgeschritten', 'Regelmäßiges Training gewohnt. Schwerere Varianten, längere Intervalle, Ausdauer ab Stufe 3.'],
];

function fitnessCard() {
  const desc = h('p', { class: 'small muted', style: { marginTop: '8px' } });
  const paint = (v) => { desc.textContent = FITNESS.find(([k]) => k === v)[2]; };
  paint(getState().settings.fitness);
  return h('div', { class: 'card' },
    segmented(FITNESS.map(([k, label]) => [k, label]), getState().settings.fitness, (v) => { set((x) => { x.fitness = v; }); paint(v); }),
    desc,
  );
}

function row(title, desc, control) {
  return h('div', { class: 'toggle-row' },
    h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, title), desc ? h('div', { class: 'desc' }, desc) : null),
    control,
  );
}

function equipmentCard() {
  const st = getState().settings;
  const kgRow = row('Gewicht pro Hantel', 'Wird bei Hantelübungen automatisch eingetragen.',
    stepper({ value: st.dumbbellKg, min: 0.5, max: 50, step: 0.5, label: 'Hantelgewicht', format: (v) => `${String(v).replace('.', ',')} kg`, onchange: (v) => set((x) => { x.dumbbellKg = v; }) }));
  if (!st.equipment.hanteln) kgRow.classList.add('hidden');
  return h('div', { class: 'card', style: { padding: '4px 16px' } },
    Object.entries(EQUIPMENT).map(([key, label]) => toggleRow(label, null, !!st.equipment[key], (v) => {
      set((x) => { x.equipment[key] = v; });
      if (key === 'hanteln') kgRow.classList.toggle('hidden', !v);
    })),
    kgRow,
  );
}

function careCard() {
  const st = getState().settings;
  return h('div', { class: 'card', style: { padding: '4px 16px' } },
    toggleRow('Handgelenke schonen', 'Keine Übungen mit Stütz auf flacher Hand. Liegestütze auf den Fäusten, Stütz auf den Unterarmen.', st.wristSafe, (v) => set((x) => { x.wristSafe = v; })),
    toggleRow('Keine Sprünge', 'Leise und wohnungsfreundlich: Sprungübungen werden ersetzt.', st.noJumps, (v) => set((x) => { x.noJumps = v; })),
  );
}

function goalRow() {
  return row('Wochenziel', 'Trainings pro Woche',
    stepper({ value: getState().settings.weeklyGoal, min: 1, max: 7, label: 'Wochenziel', onchange: (v) => set((x) => { x.weeklyGoal = v; }) }));
}

function warmupDeviceRow() {
  const st = getState().settings;
  const opts = [['boden', 'Boden']];
  if (st.equipment.laufband) opts.push(['laufband', 'Laufband']);
  if (st.equipment.ergometer) opts.push(['ergometer', 'Ergometer']);
  if (opts.length === 1) return null;
  return h('div', { style: { padding: '12px 0' } },
    h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Aufwärmen auf'),
    segmented(opts, opts.some(([k]) => k === st.warmupDevice) ? st.warmupDevice : 'boden', (v) => set((x) => { x.warmupDevice = v; })),
    h('div', { class: 'desc small muted', style: { marginTop: '6px' } }, 'Am Gerät: 4 Minuten locker, danach Arme und Hüfte kreisen.'),
  );
}

// ---------- Datensicherung ----------
async function exportData() {
  const name = `fitstart-sicherung-${dayKey(Date.now())}.json`;
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  let done = false;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'FitStart-Sicherung' });
      done = true;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  if (!done) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  let fresh = [];
  update((s) => { s.lastBackup = Date.now(); fresh = awardBadges(s); });
  toast(fresh.length ? `Gesichert! Neues Abzeichen: ${fresh[0].emoji} ${fresh[0].name}` : 'Sicherung erstellt');
  rerender();
}

function importData() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.remove();
    if (!f) return;
    const text = await f.text();
    const ok = await confirmDialog({
      title: 'Sicherung einspielen?',
      text: 'Alle aktuellen Daten auf diesem Handy werden durch die Sicherung ersetzt.',
      ok: 'Einspielen', danger: true,
    });
    if (!ok) return;
    try {
      importJson(text);
      toast('Sicherung eingespielt');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast(err.message, 4000);
    }
  });
  document.body.append(input);
  input.click();
}

const DISCLAIMER = 'Hör auf deinen Körper: Bei Schmerzen die Übung abbrechen. Bei Beschwerden oder Vorerkrankungen vorher ärztlich abklären, welche Belastung für dich passt.';

export function renderSettings() {
  const state = getState();
  const st = state.settings;
  return h('div', { class: 'stack' },
    topbar('Einstellungen', { back: '#/heute' }),

    h('div', { class: 'section-title' }, 'Profil'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      h('label', { class: 'field', style: { padding: '12px 0' } }, h('span', null, 'Dein Vorname (für die Begrüßung)'),
        h('input', { class: 'input', value: state.profile.name, maxlength: 30, placeholder: 'optional', oninput: (e) => update((s) => { s.profile.name = e.target.value; }) })),
      goalRow(),
    ),

    h('div', { class: 'section-title' }, 'Fitness-Stufe'),
    fitnessCard(),

    h('div', { class: 'section-title' }, 'Meine Ausrüstung'),
    equipmentCard(),
    h('div', { class: 'section-title' }, 'Rücksicht'),
    careCard(),

    h('div', { class: 'section-title' }, 'Freihändig trainieren'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      toggleRow('Automatik für Kraftübungen', 'Jeder Satz läuft im Takt, danach startet die Pause von selbst. Am Ende kannst du die Zahlen korrigieren.', st.autoMode, (v) => set((x) => { x.autoMode = v; })),
      row('Takt pro Wiederholung', 'Langsamer Takt = saubere Technik',
        stepper({ value: st.secPerRep, min: 2, max: 6, step: 1, label: 'Takt', format: (v) => `${v} s`, onchange: (v) => set((x) => { x.secPerRep = v; }) })),
      toggleRow('Wiederholungen mitzählen', 'Die Sprachansage zählt laut mit', st.countReps, (v) => set((x) => { x.countReps = v; })),
      toggleRow('Bildschirm-Tipp als „Weiter“', 'Ein Tipp irgendwo auf den Bildschirm heißt „Bereit“ bzw. „Satz fertig“', st.tapAnywhere, (v) => set((x) => { x.tapAnywhere = v; })),
      toggleRow('Immer ausführlich erklären', 'Sonst werden die Erklärungen kürzer, sobald du eine Übung kennst', st.alwaysFull, (v) => set((x) => { x.alwaysFull = v; })),
    ),

    h('div', { class: 'section-title' }, 'Training'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      row('Pause zwischen Sätzen', 'Standard für Krafttraining',
        stepper({ value: st.restSec, min: 15, max: 240, step: 15, label: 'Pause', format: (v) => `${v} s`, onchange: (v) => set((x) => { x.restSec = v; }) })),
      toggleRow('Aufwärmen vorweg', 'ca. 3–5 Minuten lockere Bewegung vor dem Training', st.warmup, (v) => set((x) => { x.warmup = v; })),
      warmupDeviceRow(),
      toggleRow('Dehnen am Ende', 'ca. 3 Minuten zum Runterkommen', st.cooldown, (v) => set((x) => { x.cooldown = v; })),
    ),

    h('div', { class: 'section-title' }, 'Signale'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      toggleRow('Töne', 'Piepen bei 3-2-1 und beim Phasenwechsel', st.sound, (v) => set((x) => { x.sound = v; })),
      toggleRow('Vibration', 'Kurzes Vibrieren bei Wechseln', st.vibration, (v) => set((x) => { x.vibration = v; })),
      toggleRow('Sprachansage', speechAvailable() ? 'Sagt Übungen, Pausen und Wiederholungen an. Läuft auch über laufende Musik.' : 'Auf diesem Gerät nicht verfügbar', st.voice, (v) => set((x) => { x.voice = v; })),
      toggleRow('Bildschirm anlassen', 'Verhindert, dass das Handy während des Trainings sperrt', st.wakeLock, (v) => set((x) => { x.wakeLock = v; })),
      h('div', { style: { padding: '8px 0 14px' } },
        h('button', {
          class: 'btn small',
          onclick: () => { unlockAudio(); signal('go'); say('Hallo! So klingt deine Sprachansage. Nächste Übung: Kniebeugen, 40 Sekunden.', { force: true }); },
        }, icon('speaker'), 'Signale testen'),
      ),
    ),

    h('div', { class: 'section-title' }, 'Darstellung'),
    segmented([['system', 'Wie System'], ['light', 'Hell'], ['dark', 'Dunkel']], st.theme, (v) => { set((x) => { x.theme = v; }); applyTheme(); }),

    h('div', { class: 'section-title', id: 'sicherung' }, 'Datensicherung'),
    h('div', { class: 'card stack-sm' },
      h('p', { class: 'small muted' }, 'Alle Daten bleiben nur auf diesem Handy, ohne Konto und ohne Cloud. Sichere sie ab und zu als Datei, z. B. in Google Drive, damit nach einem Handywechsel nichts verloren geht.'),
      h('p', { class: 'small' }, state.lastBackup ? `Letzte Sicherung: ${fmtDate(state.lastBackup)}` : 'Noch keine Sicherung erstellt.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: exportData }, icon('copy'), 'Sicherung erstellen'),
        h('button', { class: 'btn', onclick: importData }, icon('up'), 'Sicherung einspielen'),
      ),
    ),

    h('div', { class: 'section-title' }, 'Daten löschen'),
    h('div', { class: 'card stack-sm' },
      h('button', {
        class: 'btn danger block',
        onclick: async () => {
          if (await confirmDialog({ title: 'Alle Daten löschen?', text: 'Verlauf, Pläne, Punkte und Abzeichen werden unwiderruflich gelöscht.', ok: 'Alles löschen', danger: true })) {
            resetAll();
            toast('Alle Daten gelöscht');
            navigate('#/willkommen', { replace: true });
          }
        },
      }, icon('trash'), 'Alle Daten löschen'),
    ),
    h('p', { class: 'small muted', style: { padding: '8px 4px' } }, DISCLAIMER),
    h('p', { class: 'tiny muted center' }, 'FitStart · Version 2.0'),
  );
}

export function renderOnboarding() {
  if (getState().onboarded) {
    navigate('#/heute', { replace: true });
    return null;
  }
  return h('div', { class: 'stack', style: { paddingBottom: '20px' } },
    h('div', { class: 'center', style: { paddingTop: '10px' } },
      h('div', { style: { fontSize: '56px' } }, '👋'),
      h('h1', null, 'Willkommen bei FitStart!'),
      h('p', { class: 'muted', style: { marginTop: '6px' } }, 'Dein Trainingsbegleiter für zu Hause. Kurz einrichten, dann geht’s los.'),
    ),
    h('label', { class: 'field' }, h('span', null, 'Wie heißt du? (optional)'),
      h('input', { class: 'input', maxlength: 30, placeholder: 'Vorname', value: getState().profile.name, oninput: (e) => update((s) => { s.profile.name = e.target.value; }) })),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Wie fit bist du gerade?'), fitnessCard()),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Was hast du zu Hause?'), equipmentCard()),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Worauf soll ich achten?'), careCard()),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Dein Ziel'), h('div', { class: 'card', style: { padding: '4px 16px' } }, goalRow())),
    h('p', { class: 'small muted' }, DISCLAIMER),
    h('button', {
      class: 'btn primary big block',
      onclick: () => {
        unlockAudio();
        update((s) => { s.onboarded = true; s.newsSeen = NEWS_VERSION; s.profile.createdAt = Date.now(); });
        navigate('#/heute', { replace: true });
      },
    }, 'Los geht’s', icon('right')),
    h('p', { class: 'tiny muted center' }, 'Alles lässt sich später in den Einstellungen ändern.'),
  );
}
