// Progressive enhancement shared by every page: theme, interface strings, copy buttons, favourites, recents, offline, palette shortcut.
// Everything reads local storage inside a guard; without storage the related features hide themselves (AC-37).
import { DICTS, currentLang } from '../i18n';
import { storage } from '../lib/client';

const root = document.documentElement;
const BASE = root.dataset.base ?? '';
const hasStorage = storage.ok();
const lang = currentLang;
const t = (k: string) => DICTS[lang()][k] ?? DICTS.en[k] ?? k;

// Theme: the inline script in Base.astro already set data-theme before paint; here we only handle the switch.
function setTheme(theme: 'dark' | 'light') { root.dataset.theme = theme; if (hasStorage) storage.set('theme', theme); }
document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'));

// Interface strings: swap [data-t] text and [data-t-attr] attributes from the locale file, then tell the islands.
function applyLang() {
  const l = lang();
  root.lang = l;
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t!); });
  document.querySelectorAll<HTMLElement>('[data-t-attr]').forEach((el) => { const [attr, key] = el.dataset.tAttr!.split(':'); el.setAttribute(attr, t(key)); });
  window.dispatchEvent(new CustomEvent('ddp:lang', { detail: l }));
}
applyLang();

// Storage-dependent features hide when storage is unavailable.
if (!hasStorage) document.querySelectorAll<HTMLElement>('[data-needs-storage]').forEach((el) => (el.hidden = true));
root.dataset.storage = String(hasStorage);

// Favourites: delegated so cards rendered later by islands work too.
export function favourites(): string[] { return hasStorage ? storage.get<string[]>('favourites', []) : []; }
export function paintFavs(scope: ParentNode = document) {
  const favs = new Set(favourites());
  scope.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach((b) => {
    const on = favs.has(b.dataset.fav!);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('svg')?.setAttribute('fill', on ? 'currentColor' : 'none');
    const label = b.querySelector('[data-fav-label]'); if (label) label.textContent = on ? t('favourited') : t('favourite');
  });
}
document.addEventListener('click', (e) => {
  const fav = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-fav]');
  if (fav && hasStorage) {
    const id = fav.dataset.fav!; const favs = favourites();
    storage.set('favourites', favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]);
    paintFavs(); window.dispatchEvent(new CustomEvent('ddp:favs'));
  }
  const copy = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (copy) copyText(copy.dataset.copy!, copy);
});
paintFavs();
new MutationObserver(() => paintFavs()).observe(document.body, { childList: true, subtree: true });

// Copy with a two-second confirmation; falls back to a selected text field when the clipboard API is unavailable (AC-20, edge case).
let copyTimer: number | undefined;
export function copyText(text: string, btn?: HTMLElement) {
  const done = () => {
    if (!btn) return;
    const original = btn.dataset.label ?? btn.textContent ?? '';
    btn.dataset.label = original; btn.textContent = t('copied');
    window.clearTimeout(copyTimer); copyTimer = window.setTimeout(() => { btn.textContent = original; }, 2000);
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackDialog(text));
  else fallbackDialog(text);
}
function fallbackDialog(text: string) {
  const dlg = document.createElement('div');
  dlg.className = 'dialog-backdrop'; dlg.style.placeItems = 'center';
  dlg.innerHTML = `<div class="dialog" role="dialog" style="padding:var(--space-4);gap:var(--space-3);width:min(440px,100%)"><div class="dialog-title">${t('copyFallback')}</div><input class="input" readonly style="font-family:var(--font-mono);font-size:13px"><div class="dialog-actions"><button class="btn btn-secondary">${t('close')}</button></div></div>`;
  const input = dlg.querySelector('input')!; input.value = text;
  dlg.querySelector('button')!.onclick = () => dlg.remove(); dlg.onclick = (e) => { if (e.target === dlg) dlg.remove(); };
  document.body.append(dlg); input.focus(); input.select();
}

// Recents: at most ten, recorded on artifact pages (AC-36).
const artifact = document.body.dataset.artifact;
if (artifact && hasStorage) storage.set('recents', [artifact, ...storage.get<string[]>('recents', []).filter((x) => x !== artifact)].slice(0, 10));

// Offline notice.
const banner = document.querySelector<HTMLElement>('[data-offline]');
const paintOnline = () => { if (banner) banner.hidden = navigator.onLine; };
window.addEventListener('online', paintOnline); window.addEventListener('offline', paintOnline); paintOnline();

// Command palette: Cmd/Ctrl+K anywhere, or the header button. The palette island listens for the event.
const openPalette = () => window.dispatchEvent(new CustomEvent('ddp:palette'));
window.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
document.querySelector('[data-palette-open]')?.addEventListener('click', openPalette);
const kbd = document.querySelector('[data-modkey]'); if (kbd) kbd.textContent = /Mac|iPhone/.test(navigator.platform) ? '\u2318' : 'Ctrl';

// Mobile filter drawer toggle on the search page.
document.querySelector('[data-facet-toggle]')?.addEventListener('click', (e) => { const aside = (e.currentTarget as HTMLElement).closest('aside')!; aside.dataset.open = aside.dataset.open === 'true' ? 'false' : 'true'; });

void BASE;
