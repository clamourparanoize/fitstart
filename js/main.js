// Einstieg: Router, Navigation, Design, Offline-Unterstützung.
import { getState, requestPersistence } from './store.js';
import { hydrateIcons } from './ui.js';
import { renderHome } from './views/home.js';
import { renderPlans, renderPlanDetail } from './views/plans.js';
import { renderPlanEditor } from './views/editor.js';
import { renderLibrary } from './views/library.js';
import { renderProgress } from './views/progress.js';
import { renderAchievements } from './views/achievements.js';
import { renderSettings, renderOnboarding, applyTheme } from './views/settings.js';
import { renderPlayer } from './views/player.js';
import { renderSummary } from './views/summary.js';

const ROUTES = [
  { re: /^#\/heute$/, view: renderHome, tab: 'heute' },
  { re: /^#\/plaene$/, view: renderPlans, tab: 'plaene' },
  { re: /^#\/plan-neu$/, view: () => renderPlanEditor(null), tab: 'plaene' },
  { re: /^#\/plan\/([\w-]+)\/bearbeiten$/, view: (m) => renderPlanEditor(m[1]), tab: 'plaene' },
  { re: /^#\/plan\/([\w-]+)$/, view: (m) => renderPlanDetail(m[1]), tab: 'plaene' },
  { re: /^#\/uebungen$/, view: renderLibrary, tab: 'uebungen' },
  { re: /^#\/fortschritt$/, view: renderProgress, tab: 'fortschritt' },
  { re: /^#\/erfolge$/, view: renderAchievements, tab: 'erfolge' },
  { re: /^#\/einstellungen$/, view: renderSettings, tab: 'heute' },
  { re: /^#\/willkommen$/, view: renderOnboarding, immersive: true },
  { re: /^#\/training$/, view: renderPlayer, immersive: true },
  { re: /^#\/geschafft$/, view: renderSummary, immersive: true },
];

let current = null;

function route() {
  const hash = location.hash || '#/heute';
  if (!getState().onboarded && hash !== '#/willkommen') {
    location.replace('#/willkommen');
    return;
  }
  const r = ROUTES.find((x) => x.re.test(hash));
  if (!r) {
    location.replace('#/heute');
    return;
  }
  current?.destroy?.();
  current = null;
  const app = document.getElementById('app');
  app.innerHTML = '';
  document.body.classList.toggle('immersive', !!r.immersive);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  const out = r.view(hash.match(r.re));
  if (!out) return;
  if (out instanceof Node) {
    app.append(out);
  } else {
    app.append(out.el);
    current = out;
  }
  if (!r.immersive) window.scrollTo(0, 0);
}

// Installations-Hinweis von Chrome merken, damit die Startseite einen Knopf zeigen kann.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  if ((location.hash || '#/heute') === '#/heute') route();
});
window.addEventListener('appinstalled', () => { window.__installPrompt = null; });

window.addEventListener('hashchange', route);
applyTheme();
hydrateIcons();
route();
requestPersistence();

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw=1'))) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
}
