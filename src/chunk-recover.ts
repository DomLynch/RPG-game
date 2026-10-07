// A tab opened before a publish asks for the previous release's hashed chunks (account, pit, net, special-*, lobby, fight-results), which now 404.
// Retrying asks for the same dead URL, so the only recovery is a reload that fetches the new index (incident 2026-10-07 10:05, Dom's iPhone).
// Account (a tap on the journal, never mid-fight) reloads once; every other chunk may fail mid-fight, so it shows a "Tap to reload" bar instead.
const KEY = 'frankendom.chunkreload.v1', LOOP_GUARD_MS = 5 * 60 * 1000;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const isChunkError = (reason: unknown): boolean =>
  /dynamically imported module|importing a module script failed|unable to preload|error loading dynamically/i.test(String((reason as { message?: unknown } | null)?.message ?? reason));
// One automatic reload per LOOP_GUARD_MS: the stamp is written BEFORE reloading, so a page that still cannot load its chunk shows the bar, never a loop.
export function autoReload(store: Store | null, now: number, reload: () => void): boolean {
  try {
    const last = Number(store?.getItem(KEY) ?? 0);
    if (!store || (last && now - last < LOOP_GUARD_MS)) return false;
    store.setItem(KEY, String(now));
  } catch { return false; }   // storage blocked: we cannot prove it is the first, so never risk a loop
  reload();
  return true;
}
export function reloadBar(doc: Document, reload: () => void) {
  if (doc.getElementById('chunk-reload')) return;
  const bar = doc.createElement('button');
  bar.id = 'chunk-reload'; bar.type = 'button'; bar.textContent = 'A new version is ready. Tap to reload.';
  bar.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateX(-50%);z-index:99999;max-width:92vw;padding:10px 16px;border:1px solid #c9c4b8;border-radius:999px;background:#1b1713f2;color:#f4ead8;font:600 14px system-ui,sans-serif;';
  bar.addEventListener('click', reload);
  doc.body.appendChild(bar);
}
// The lazy chunks that nothing awaits (prefetches, fire-and-forget imports) fail as vite:preloadError or an unhandled rejection: say so, do not reload mid-fight.
export function installChunkRecovery(win: Pick<Window, 'addEventListener' | 'document' | 'location'>) {
  const reload = () => win.location.reload();
  win.addEventListener('vite:preloadError', () => reloadBar(win.document, reload));
  win.addEventListener('unhandledrejection', (event) => { if (isChunkError((event as PromiseRejectionEvent).reason)) reloadBar(win.document, reload); });
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof document !== 'undefined') installChunkRecovery(window);
