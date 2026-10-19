// Erfolge: Level, Wochenziel & Serie, Abzeichen.
import { getState, update } from '../store.js';
import { h, stepper, fmtDate, fmtNum, plural } from '../ui.js';
import { totalXp, levelInfo, BADGES, CHALLENGE_XP } from '../gamification.js';
import { streakInfo, thisWeekCount } from '../stats.js';
import { topbar } from './common.js';

export function renderAchievements() {
  const state = getState();
  const xp = totalXp(state);
  const lv = levelInfo(xp);
  const goal = state.settings.weeklyGoal;
  const st = streakInfo(state.history, goal);
  const week = thisWeekCount(state.history);
  const earned = BADGES.filter((b) => state.badges[b.id]);
  const locked = BADGES.filter((b) => !state.badges[b.id]);

  return h('div', { class: 'stack' },
    topbar('Erfolge', { sub: `${earned.length} von ${BADGES.length} Abzeichen gesammelt` }),
    h('div', { class: 'card stack-sm' },
      h('div', { class: 'row' },
        h('div', { class: 'level-pill', style: { width: '60px', height: '60px', fontSize: '24px' } }, lv.level),
        h('div', { class: 'grow' },
          h('div', { class: 'small muted', style: { fontWeight: 650 } }, `Level ${lv.level}`),
          h('h2', null, lv.title),
          h('div', { class: 'small muted' }, `${fmtNum(xp)} XP gesamt`),
        ),
      ),
      h('div', { class: 'row small', style: { marginTop: '12px' } },
        h('span', { class: 'grow muted' }, `Bis Level ${lv.level + 1}`),
        h('b', { class: 'num' }, `${lv.into} / ${lv.need} XP`)),
      h('div', { class: 'progress' }, h('div', { style: { width: `${lv.pct}%` } })),
      h('p', { class: 'small muted', style: { marginTop: '10px' } },
        `So sammelst du Punkte: 50 pro Training, 2 pro Trainingsminute, 15 pro neuer Bestleistung, 30 fürs erreichte Wochenziel und ${CHALLENGE_XP} für jede Tages-Challenge.`),
    ),
    h('div', { class: 'card stack-sm' },
      h('h2', null, 'Wochenziel & Serie'),
      h('div', { class: 'stat-grid', style: { marginTop: '10px' } },
        h('div', null, h('div', { class: 'small muted' }, 'Diese Woche'), h('div', { style: { fontSize: '26px', fontWeight: 800 } }, `${week} / ${goal}`)),
        h('div', null, h('div', { class: 'small muted' }, 'Serie'), h('div', { style: { fontSize: '26px', fontWeight: 800 } }, `🔥 ${st.current}`), h('div', { class: 'tiny muted' }, `Rekord: ${plural(st.best, 'Woche', 'Wochen')}`)),
      ),
      h('div', { class: 'week-dots' }, Array.from({ length: goal }, (_, i) => h('i', { class: i < week ? 'on' : '' }))),
      h('div', { class: 'toggle-row', style: { marginTop: '6px' } },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, 'Trainings pro Woche'), h('div', { class: 'desc' }, 'Die Serie zählt die Wochen in Folge, in denen du dein Ziel erreichst.')),
        stepper({ value: goal, min: 1, max: 7, label: 'Wochenziel', onchange: (v) => { update((s) => { s.settings.weeklyGoal = v; }); } }),
      ),
    ),
    h('div', { class: 'section-title' }, 'Abzeichen'),
    h('div', { class: 'badge-grid' },
      earned.map((b) => h('div', { class: 'badge' }, h('div', { class: 'emo' }, b.emoji), h('div', { class: 'name' }, b.name), h('div', { class: 'when' }, fmtDate(state.badges[b.id])))),
      locked.map((b) => h('div', { class: 'badge locked' }, h('div', { class: 'emo' }, b.emoji), h('div', { class: 'name' }, b.name), h('div', { class: 'when' }, b.desc))),
    ),
  );
}
