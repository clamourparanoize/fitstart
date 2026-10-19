// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten.
//   node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../icons/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Signed distance zu einem abgerundeten Rechteck (Mittelpunkt, halbe Breite/Höhe, Radius).
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// Hantel aus Stange + je zwei Scheiben, in Koordinaten 0..1 (Mitte 0.5).
const DUMBBELL = [
  [0.5, 0.5, 0.2, 0.035, 0.03],      // Stange
  [0.285, 0.5, 0.045, 0.19, 0.035],  // innere Scheibe links
  [0.715, 0.5, 0.045, 0.19, 0.035],  // innere Scheibe rechts
  [0.205, 0.5, 0.038, 0.125, 0.03],  // äußere Scheibe links
  [0.795, 0.5, 0.038, 0.125, 0.03],  // äußere Scheibe rechts
];

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  const angle = (-35 * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const scale = maskable ? 0.78 : 1;
  const top = [0xf5, 0x8a, 0x4c], bottom = [0xd9, 0x4f, 0x1c];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCov = 0, fgCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const inBg = maskable ? true : sdRoundRect(px, py, 0.5, 0.5, 0.5, 0.5, 0.22) <= 0;
          if (!inBg) continue;
          bgCov++;
          // in Hantel-Koordinaten drehen und skalieren
          const dx = (px - 0.5) / scale, dy = (py - 0.5) / scale;
          const rx = 0.5 + dx * cos - dy * sin;
          const ry = 0.5 + dx * sin + dy * cos;
          if (DUMBBELL.some(([cx, cy, hw, hh, r]) => sdRoundRect(rx, ry, cx, cy, hw, hh, r) <= 0)) fgCov++;
        }
      }
      const n = SS * SS;
      const t = y / (size - 1);
      const bg = top.map((c, i) => c + (bottom[i] - c) * t);
      const f = bgCov ? fgCov / bgCov : 0;
      const col = bg.map((c) => c + (255 - c) * f * 0.98);
      const i = (y * size + x) * 4;
      buf[i] = Math.round(col[0]);
      buf[i + 1] = Math.round(col[1]);
      buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = Math.round((bgCov / n) * 255);
    }
  }
  return png(size, buf);
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(OUT + name, render(size, { maskable }));
  console.log('geschrieben:', name);
}
