// Einstellungen und Ersteinrichtung.
import { EQUIPMENT } from '../exercises.js';
import { getState, update, resetAll } from '../store.js';
import { h, icon, stepper, toggleRow, segmented, confirmDialog, toast } from '../ui.js';
import { say, unlockAudio, signal, speechAvailable } from '../feedback.js';
import { topbar } from './common.js';

export function applyTheme() {
  const t = getState().settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

const set = (fn) => update((s) => fn(s.settings));

function equipmentCard() {
  const st = getState().settings;
  const kgRow = h('div', { class: 'toggle-row' },
    h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, 'Gewicht pro Hantel'), h('div', { class: 'desc' }, 'Wird bei Hantelübungen automatisch eingetragen.')),
    stepper({ value: st.dumbbellKg, min: 0.5, max: 50, step: 0.5, label: 'Hantelgewicht', format: (v) => `${String(v).replace('.', ',')} kg`, onchange: (v) => set((x) => { x.dumbbellKg = v; }) }),
  );
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
  return h('div', { class: 'toggle-row' },
    h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, 'Wochenziel'), h('div', { class: 'desc' }, 'Trainings pro Woche')),
    stepper({ value: getState().settings.weeklyGoal, min: 1, max: 7, label: 'Wochenziel', onchange: (v) => set((x) => { x.weeklyGoal = v; }) }),
  );
}

const DISCLAIMER = 'Hör auf deinen Körper: Bei Schmerzen die Übung abbrechen. Bei Beschwerden oder Vorerkrankungen vorher ärztlich abklären, welche Belastung für dich passt.';

export function renderSettings() {
  const st = getState().settings;
  const name = getState().profile.name;
  return h('div', { class: 'stack' },
    topbar('Einstellungen', { back: '#/heute' }),

    h('div', { class: 'section-title' }, 'Profil'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      h('label', { class: 'field', style: { padding: '12px 0' } }, h('span', null, 'Dein Vorname (für die Begrüßung)'),
        h('input', { class: 'input', value: name, maxlength: 30, placeholder: 'optional', oninput: (e) => update((s) => { s.profile.name = e.target.value; }) })),
      goalRow(),
    ),

    h('div', { class: 'section-title' }, 'Meine Ausrüstung'),
    equipmentCard(),
    h('div', { class: 'section-title' }, 'Rücksicht'),
    careCard(),

    h('div', { class: 'section-title' }, 'Training'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      h('div', { class: 'toggle-row' },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, 'Pause zwischen Sätzen'), h('div', { class: 'desc' }, 'Standard für Krafttraining')),
        stepper({ value: st.restSec, min: 15, max: 240, step: 15, label: 'Pause', format: (v) => `${v} s`, onchange: (v) => set((x) => { x.restSec = v; }) }),
      ),
      toggleRow('Aufwärmen vorweg', 'ca. 3 Minuten lockere Bewegung vor dem Training', st.warmup, (v) => set((x) => { x.warmup = v; })),
      toggleRow('Dehnen am Ende', 'ca. 3 Minuten zum Runterkommen', st.cooldown, (v) => set((x) => { x.cooldown = v; })),
    ),

    h('div', { class: 'section-title' }, 'Signale'),
    h('div', { class: 'card', style: { padding: '4px 16px' } },
      toggleRow('Töne', 'Piepen bei 3-2-1 und beim Phasenwechsel', st.sound, (v) => set((x) => { x.sound = v; })),
      toggleRow('Vibration', 'Kurzes Vibrieren bei Wechseln', st.vibration, (v) => set((x) => { x.vibration = v; })),
      toggleRow('Sprachansage', speechAvailable() ? 'Sagt Übungen und Pausen an' : 'Auf diesem Gerät nicht verfügbar', st.voice, (v) => set((x) => { x.voice = v; })),
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

    h('div', { class: 'section-title' }, 'Daten'),
    h('div', { class: 'card stack-sm' },
      h('p', { class: 'small muted' }, 'Alle Daten bleiben nur auf diesem Handy gespeichert, ohne Konto und ohne Cloud.'),
      h('button', {
        class: 'btn danger block',
        onclick: async () => {
          if (await confirmDialog({ title: 'Alle Daten löschen?', text: 'Verlauf, Pläne, Punkte und Abzeichen werden unwiderruflich gelöscht.', ok: 'Alles löschen', danger: true })) {
            resetAll();
            toast('Alle Daten gelöscht');
            location.hash = '#/willkommen';
          }
        },
      }, icon('trash'), 'Alle Daten löschen'),
    ),
    h('p', { class: 'small muted', style: { padding: '8px 4px' } }, DISCLAIMER),
    h('p', { class: 'tiny muted center' }, 'FitStart · Version 1.0'),
  );
}

export function renderOnboarding() {
  if (getState().onboarded) {
    location.replace('#/heute');
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
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Was hast du zu Hause?'), equipmentCard()),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Worauf soll ich achten?'), careCard()),
    h('div', null, h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Dein Ziel'), h('div', { class: 'card', style: { padding: '4px 16px' } }, goalRow())),
    h('p', { class: 'small muted' }, DISCLAIMER),
    h('button', {
      class: 'btn primary big block',
      onclick: () => {
        unlockAudio();
        update((s) => { s.onboarded = true; s.profile.createdAt = Date.now(); });
        location.hash = '#/heute';
      },
    }, 'Los geht’s', icon('right')),
    h('p', { class: 'tiny muted center' }, 'Alles lässt sich später in den Einstellungen ändern.'),
  );
}
