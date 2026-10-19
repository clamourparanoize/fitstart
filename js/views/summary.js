// „Geschafft!“-Bildschirm nach dem Training.
import { EX } from '../exercises.js';
import { getState } from '../store.js';
import { h, icon, toast, fmtMinutes, fmtNum, plural } from '../ui.js';
import { upgradeExercise } from '../session.js';
import { thisWeekCount, entryReps } from '../stats.js';
import { signal } from '../feedback.js';
import { exBadge } from './common.js';

let result = null;
export function setResult(r) {
  result = r;
}

export function renderSummary() {
  if (!result) {
    location.replace('#/heute');
    return null;
  }
  const { entry, newBadges, levelBefore, levelAfter, suggestions } = result;
  const state = getState();
  const goal = state.settings.weeklyGoal;
  const week = thisWeekCount(state.history);
  const levelUp = levelAfter.level > levelBefore.level;
  const { reps } = entryReps(entry);
  const sets = entry.exercises.reduce((n, e) => n + e.sets.length, 0);

  const bar = h('div', { style: { width: `${levelUp ? 0 : levelBefore.pct}%` } });
  setTimeout(() => { bar.style.width = `${levelAfter.pct}%`; }, 350);
  setTimeout(() => confetti(levelUp || newBadges.length ? 220 : 140), 100);
  if (levelUp) setTimeout(() => signal('success'), 900);

  const el = h('div', { class: 'stack celebrate' },
    h('div', { class: 'big-emoji' }, entry.prs.length ? '🏆' : levelUp ? '🚀' : '🎉'),
    h('h1', null, 'Training geschafft!'),
    h('p', { class: 'muted' }, `${entry.emoji} ${entry.name}`),

    h('div', { class: 'stat-grid', style: { textAlign: 'left' } },
      h('div', { class: 'stat' }, h('div', { class: 'label' }, 'Dauer'), h('div', { class: 'value' }, fmtMinutes(entry.durationSec))),
      entry.kind === 'kraft'
        ? h('div', { class: 'stat' }, h('div', { class: 'label' }, 'Wiederholungen'), h('div', { class: 'value num' }, fmtNum(reps), h('small', null, `in ${sets} Sätzen`)))
        : h('div', { class: 'stat' }, h('div', { class: 'label' }, 'Intervalle'), h('div', { class: 'value num' }, sets, h('small', null, plural(entry.exercises.length, 'Übung', 'Übungen')))),
    ),

    h('div', { class: 'card', style: { textAlign: 'left' } },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, 'Punkte'), h('span', { class: 'tag accent' }, `+${entry.xp} XP`)),
      h('div', { style: { margin: '10px 0' } }, entry.xpParts.map(([label, v]) => h('div', { class: 'xp-line' }, h('span', null, label), h('b', null, `+${v}`)))),
      h('div', { class: 'row small', style: { marginBottom: '6px' } },
        h('b', { class: 'grow' }, `Level ${levelAfter.level} · ${levelAfter.title}`),
        h('span', { class: 'muted num' }, `${levelAfter.into} / ${levelAfter.need} XP`)),
      h('div', { class: 'progress' }, bar),
      levelUp ? h('div', { class: 'hint-box', style: { marginTop: '12px' } }, '🚀', h('div', null, h('b', null, 'Level up! '), `Du bist jetzt Level ${levelAfter.level}: ${levelAfter.title}.`)) : null,
    ),

    h('div', { class: 'card', style: { textAlign: 'left' } },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, 'Wochenziel'), h('b', { class: 'num' }, `${week} / ${goal}`)),
      h('div', { class: 'week-dots' }, Array.from({ length: goal }, (_, i) => h('i', { class: i < week ? 'on' : '' }))),
      h('p', { class: 'small muted', style: { marginTop: '10px' } },
        entry.goalDone ? '🎯 Wochenziel geschafft! Jede weitere Einheit ist ein Bonus.'
          : week >= goal ? 'Wochenziel schon erreicht. Stark, dass du noch einen drauflegst!'
            : `Noch ${plural(goal - week, 'Training', 'Trainings')} bis zum Wochenziel.`),
    ),

    entry.prs.length ? h('div', { class: 'card', style: { textAlign: 'left' } },
      h('h3', null, '🏆 Neue Bestleistungen'),
      h('div', { class: 'stack-sm', style: { marginTop: '10px' } }, entry.prs.map((id) => {
        const e = entry.exercises.find((x) => x.exId === id);
        const ex = EX[id];
        const best = ex.mode === 'time' ? `${Math.max(...e.sets.map((x) => x.sec))} Sek.` : `${Math.max(...e.sets.map((x) => x.reps))} Wdh.`;
        return h('div', { class: 'row' }, exBadge(id), h('div', { class: 'grow' }, h('b', null, ex.name), h('div', { class: 'small muted' }, `Bester Satz: ${best}`)));
      })),
    ) : null,

    newBadges.length ? h('div', { class: 'card', style: { textAlign: 'left' } },
      h('h3', null, newBadges.length === 1 ? 'Neues Abzeichen' : 'Neue Abzeichen'),
      h('div', { class: 'badge-grid', style: { marginTop: '12px' } }, newBadges.map((b) => h('div', { class: 'badge' },
        h('div', { class: 'emo' }, b.emoji), h('div', { class: 'name' }, b.name), h('div', { class: 'when' }, b.desc)))),
    ) : null,

    suggestions.length ? h('div', { class: 'card stack-sm', style: { textAlign: 'left' } },
      h('h3', null, '💡 Bereit für mehr'),
      suggestions.map((sg) => suggestionRow(sg)),
    ) : null,

    h('a', { class: 'btn primary big block', href: '#/heute', onclick: () => { result = null; } }, icon('check'), 'Fertig'),
  );
  return el;
}

function suggestionRow({ exId, harder }) {
  const ex = EX[exId];
  if (!harder) {
    return h('p', { class: 'small' }, h('b', null, `${ex.name}: `), 'alle Ziele erreicht! Mach es nächstes Mal schwerer: 3 Sek. langsam absenken oder einen Satz mehr.');
  }
  const hx = EX[harder];
  const row = h('div', { class: 'stack-sm' },
    h('p', { class: 'small' }, h('b', null, `${ex.name}: `), `alle Ziele erreicht. Nächstes Mal die schwerere Variante „${hx.name}“?`),
  );
  const swapped = getState().swaps[exId] === harder;
  row.append(swapped
    ? h('span', { class: 'tag rest' }, '✓ gemerkt')
    : h('button', {
      class: 'btn small primary',
      onclick: (e) => {
        const fresh = upgradeExercise(exId, harder);
        e.currentTarget.replaceWith(h('span', { class: 'tag rest' }, '✓ gemerkt'));
        toast(fresh.length ? `Neues Abzeichen: ${fresh[0].emoji} ${fresh[0].name}` : `Ab jetzt: ${hx.name}`);
      },
    }, icon('up'), 'Ja, wechseln'));
  return row;
}

function confetti(count) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = h('canvas', { id: 'confetti' });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#eb6834', '#1baf7a', '#eda100', '#2a78d6', '#e87ba4', '#6250d6'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 12 - 4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (t) => {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.3;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 3200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < 3200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
