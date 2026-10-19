// Signale während des Trainings: Töne, Vibration, Sprachansage, Bildschirm anlassen.
import { getState } from './store.js';

let ctx;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Muss einmal durch einen Tipp ausgelöst werden, damit Töne später erlaubt sind.
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume();
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

function tone(freq, start, dur, vol = 0.25, type = 'sine') {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = a.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const PATTERNS = {
  tick: () => tone(880, 0, 0.12, 0.2),
  go: () => { tone(988, 0, 0.16, 0.3); tone(1319, 0.16, 0.3, 0.3); },
  rest: () => { tone(784, 0, 0.18, 0.25); tone(523, 0.18, 0.3, 0.25); },
  done: () => { tone(784, 0, 0.14, 0.28); tone(988, 0.14, 0.14, 0.28); tone(1319, 0.28, 0.4, 0.28); },
  success: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, 0.25, 'triangle')); },
};

const VIBES = { tick: 60, go: [120, 60, 220], rest: [220], done: [200, 80, 200, 80, 400], success: [100, 50, 100, 50, 300] };

export function signal(kind) {
  const { sound, vibration } = getState().settings;
  if (sound) {
    try { audio()?.state === 'suspended' && audio().resume(); PATTERNS[kind]?.(); } catch { /* ohne Ton weiter */ }
  }
  if (vibration && navigator.vibrate) navigator.vibrate(VIBES[kind] || 100);
}

// ---------- Sprache ----------
let germanVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  if (germanVoice) return germanVoice;
  const voices = speechSynthesis.getVoices();
  germanVoice = voices.find((v) => v.lang === 'de-DE' && v.localService) || voices.find((v) => v.lang?.startsWith('de')) || null;
  return germanVoice;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { germanVoice = null; pickVoice(); });

export function say(text, { force = false } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (!force && !getState().settings.voice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch { /* Sprachausgabe nicht verfügbar */ }
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export const speechAvailable = () => 'speechSynthesis' in window;

// ---------- Bildschirm anlassen ----------
let lock = null;
let wantLock = false;
export async function keepAwake(on) {
  wantLock = on && getState().settings.wakeLock;
  try {
    if (wantLock && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!wantLock && lock) {
      await lock.release();
      lock = null;
    }
  } catch { /* z. B. Akku-Sparmodus */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock && !lock) keepAwake(true);
});
