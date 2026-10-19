// Schlanke SVG-Diagramme: Balken, Linie, Kalender. Mit Tipp-/Hover-Tooltip und Tabellenansicht.
import { h, s } from './ui.js';

const W = 340;

// Achse mit „runden“ Schritten (1, 2, 2,5, 5 × 10^k), höchstens ~4 Linien.
function axis(dataMax, integer = true) {
  const raw = Math.max(dataMax, integer ? 1 : 0.0001) / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  if (integer) step = Math.max(1, Math.round(step));
  const max = Math.max(step, Math.ceil(dataMax / step) * step);
  const ticks = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(t);
  return { max, ticks };
}

// Balken mit abgerundeter Oberkante, unten bündig zur Grundlinie.
function barPath(x, y, w, y0) {
  const hgt = y0 - y;
  const r = Math.min(4, hgt, w / 2);
  return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`;
}

function tableView(headers, rows) {
  return h('details', { class: 'table-view' },
    h('summary', null, 'Als Tabelle anzeigen'),
    h('table', null,
      h('thead', null, h('tr', null, headers.map((t) => h('th', null, t)))),
      h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c))))),
    ),
  );
}

function makeTip(wrap) {
  const tip = h('div', { class: 'chart-tip hidden' });
  wrap.append(tip);
  return {
    show(xPct, yPx, title, value) {
      tip.innerHTML = '';
      tip.append(h('div', { class: 't' }, title), h('div', null, value));
      tip.classList.remove('hidden');
      const svg = wrap.querySelector('svg');
      const scale = svg.getBoundingClientRect().width / W;
      const left = Math.min(Math.max(xPct * scale, 50), svg.getBoundingClientRect().width - 50);
      tip.style.left = `${left}px`;
      tip.style.top = `${yPx * scale - 8}px`;
    },
    hide() { tip.classList.add('hidden'); },
  };
}

/**
 * Balkendiagramm.
 * data: [{ label, value, tipTitle }], format(v) für Werte, goal optional (gestrichelte Linie).
 */
export function barChart({ data, format = (v) => String(v), goal = null, goalLabel = 'Ziel', height = 180, xLabelEvery = 3, tableHeaders = ['Zeitraum', 'Wert'] }) {
  const m = { l: 34, r: 8, t: 16, b: 24 };
  const iw = W - m.l - m.r, ih = height - m.t - m.b;
  const { max, ticks } = axis(Math.max(...data.map((d) => d.value), goal || 0));
  const y = (v) => m.t + ih - (v / max) * ih;
  const band = iw / data.length;
  const bw = Math.max(4, Math.min(22, band - 2 - band * 0.3));
  const y0 = m.t + ih;

  const svg = s('svg', { viewBox: `0 0 ${W} ${height}`, role: 'img' });
  const grid = s('g', { class: 'grid' });
  for (const t of ticks) {
    if (t > 0) grid.append(s('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { class: 'axis-label', x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, format(t)));
  }
  svg.append(grid);

  const bars = data.map((d, i) => {
    const x = m.l + band * i + (band - bw) / 2;
    const el = d.value > 0 ? s('path', { class: 'bar', d: barPath(x, y(d.value), bw, y0) }) : null;
    if (el) svg.append(el);
    return { x, el };
  });
  svg.append(s('line', { class: 'baseline', x1: m.l, x2: W - m.r, y1: y0, y2: y0 }));

  data.forEach((d, i) => {
    if (i % xLabelEvery === (data.length - 1) % xLabelEvery) {
      svg.append(s('text', { class: 'axis-label', x: bars[i].x + bw / 2, y: height - 6, 'text-anchor': 'middle' }, d.label));
    }
  });

  // Wert der letzten Säule direkt beschriften
  const last = data[data.length - 1];
  if (goal) {
    svg.append(s('line', { class: 'goal-line', x1: m.l, x2: W - m.r, y1: y(goal), y2: y(goal) }));
    // Ziel-Beschriftung nach links, wenn sie sonst mit dem Wert der letzten Säule kollidiert
    const clash = last && last.value > 0 && Math.abs(y(last.value) - y(goal)) < 16;
    svg.append(s('text', {
      class: 'goal-label', x: clash ? m.l + 4 : W - m.r, y: y(goal) - 5, 'text-anchor': clash ? 'start' : 'end',
    }, `${goalLabel} ${format(goal)}`));
  }
  if (last && last.value > 0) {
    svg.append(s('text', { class: 'direct-label', x: bars.at(-1).x + bw / 2, y: y(last.value) - 6, 'text-anchor': 'middle' }, format(last.value)));
  }

  const wrap = h('div', { class: 'chart' }, svg);
  const tip = makeTip(wrap);
  data.forEach((d, i) => {
    const hit = s('rect', { class: 'hit', x: m.l + band * i, y: m.t, width: band, height: ih + m.b });
    const show = () => {
      bars.forEach((b, j) => b.el?.classList.toggle('dim', j !== i));
      tip.show(bars[i].x + bw / 2, y(d.value), d.tipTitle || d.label, format(d.value));
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    svg.append(hit);
  });
  svg.addEventListener('pointerleave', () => { bars.forEach((b) => b.el?.classList.remove('dim')); tip.hide(); });

  wrap.append(tableView(tableHeaders, data.map((d) => [d.tipTitle || d.label, format(d.value)])));
  return wrap;
}

/**
 * Liniendiagramm über die Zeit.
 * points: [{ ts, value, title }]
 */
export function lineChart({ points, format = (v) => String(v), height = 190, dateFmt, tableHeaders = ['Datum', 'Wert'] }) {
  const m = { l: 34, r: 14, t: 18, b: 24 };
  const iw = W - m.l - m.r, ih = height - m.t - m.b;
  const { max, ticks } = axis(Math.max(...points.map((p) => p.value)) * 1.08);
  const t0 = points[0].ts, t1 = points[points.length - 1].ts;
  const x = (ts) => (t1 === t0 ? m.l + iw / 2 : m.l + ((ts - t0) / (t1 - t0)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;
  const y0 = m.t + ih;

  const svg = s('svg', { viewBox: `0 0 ${W} ${height}`, role: 'img' });
  const grid = s('g', { class: 'grid' });
  for (const t of ticks) {
    if (t > 0) grid.append(s('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { class: 'axis-label', x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, format(t)));
  }
  svg.append(grid);
  svg.append(s('line', { class: 'baseline', x1: m.l, x2: W - m.r, y1: y0, y2: y0 }));

  const pts = points.map((p) => [x(p.ts), y(p.value)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  if (pts.length > 1) {
    svg.append(s('path', { class: 'area', d: `${line}L${pts.at(-1)[0]},${y0}L${pts[0][0]},${y0}Z` }));
    svg.append(s('path', { class: 'line', d: line }));
  }
  const cross = s('line', { class: 'crosshair hidden', y1: m.t, y2: y0 });
  svg.append(cross);
  pts.forEach(([px, py]) => svg.append(s('circle', { class: 'dot', cx: px, cy: py, r: 4.5 })));

  // Datumsbeschriftung: erster, letzter Punkt
  const labels = points.length > 1 ? [0, points.length - 1] : [0];
  labels.forEach((i, k) => {
    svg.append(s('text', {
      class: 'axis-label', x: pts[i][0], y: height - 6,
      'text-anchor': points.length === 1 ? 'middle' : k === 0 ? 'start' : 'end',
    }, dateFmt(points[i].ts)));
  });
  const lastP = pts.at(-1);
  svg.append(s('text', { class: 'direct-label', x: lastP[0], y: lastP[1] - 10, 'text-anchor': points.length > 1 ? 'end' : 'middle' }, format(points.at(-1).value)));

  const wrap = h('div', { class: 'chart' }, svg);
  const tip = makeTip(wrap);
  const hit = s('rect', { class: 'hit', x: m.l - 10, y: 0, width: iw + 20, height });
  const near = (evt) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((evt.clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach(([px], i) => { if (Math.abs(px - vx) < Math.abs(pts[best][0] - vx)) best = i; });
    return best;
  };
  const show = (evt) => {
    const i = near(evt);
    cross.setAttribute('x1', pts[i][0]);
    cross.setAttribute('x2', pts[i][0]);
    cross.classList.remove('hidden');
    tip.show(pts[i][0], pts[i][1], points[i].title, format(points[i].value));
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', () => { cross.classList.add('hidden'); tip.hide(); });
  svg.append(hit);

  wrap.append(tableView(tableHeaders, points.map((p) => [p.title, format(p.value)])));
  return wrap;
}

/** Kalender-Raster: Spalten = Wochen, Zeilen = Mo–So. */
export function calendarHeat(cells, fmt) {
  const weeks = Math.ceil(cells.length / 7);
  const grid = h('div', { class: 'heat', role: 'img', 'aria-label': 'Trainingstage der letzten Wochen', style: { gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` } },
    cells.map((c) => h('i', {
      class: c.future ? 'future' : c.count >= 2 ? 'l2' : c.count === 1 ? 'l1' : '',
      title: `${fmt(c.day)}: ${c.count ? `${c.count} Training${c.count > 1 ? 's' : ''}` : 'kein Training'}`,
    })));
  const days = h('div', { class: 'heat-days' }, ['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((d) => h('span', null, d)));
  return h('div', null,
    h('div', { class: 'heat-wrap' }, days, grid),
    h('div', { class: 'row small muted', style: { marginTop: '10px', gap: '14px' } },
      h('span', { class: 'row', style: { gap: '6px' } }, h('i', { style: { width: '12px', height: '12px', borderRadius: '3px', background: 'var(--surface-2)', display: 'inline-block' } }), 'kein Training'),
      h('span', { class: 'row', style: { gap: '6px' } }, h('i', { style: { width: '12px', height: '12px', borderRadius: '3px', background: 'var(--series)', display: 'inline-block' } }), 'trainiert'),
      h('span', { class: 'row', style: { gap: '6px' } }, h('i', { style: { width: '12px', height: '12px', borderRadius: '3px', background: 'var(--series-strong)', display: 'inline-block' } }), '2+ Trainings'),
    ),
  );
}
