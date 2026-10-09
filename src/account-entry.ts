// Guest startup never waits for an account request or downloads the account SDK.
import { api } from './api.ts';
import { autoReload } from './chunk-recover.ts';
import { rememberZone1 } from './zone1-hop.ts';
// main.ts hides the welcome card whenever a fight is on screen (paused() reads !welcome.hidden): only with the card up may a stale chunk reload the page by itself.
const fightOn = () => document.getElementById('welcome')?.hidden === true;
const safeStorage = () => { try { return sessionStorage; } catch { return null; } };
if (api) {
  const { url, key } = api;
  const panel = document.getElementById('account')!;
  const status = document.getElementById('account-status')!;
  const retry = document.getElementById('account-retry')!;
  panel.hidden = false;
  let started = false, stale = false;
  const start = async (tapped = false) => {   // tapped: a journal or retry tap, never mid-fight: only then may a stale chunk reload the page itself
    if (started) return;
    started = true;
    let mountAccount: typeof import('./account.ts').mountAccount;
    // A tab opened before a publish asks for the previous release's hashed account chunk, which now 404s: a retry would 404 again, a reload fetches the new index.
    try { ({ mountAccount } = await import('./account.ts')); }
    catch { started = false; stale = true; if (tapped && !fightOn() && autoReload(safeStorage(), Date.now(), () => location.reload())) return; status.textContent = 'A new version is ready. Tap to reload. Your local fighter is safe.'; retry.textContent = 'Reload'; retry.hidden = false; document.getElementById('account-login')!.hidden = true; return; }
    try { await mountAccount(url, key); }
    catch { started = false; status.textContent = 'Account unavailable. Your local fighter is safe.'; retry.hidden = false; }
  };
  document.getElementById('journal-button')!.addEventListener('click', () => { void start(true); });
  retry.addEventListener('click', () => { if (stale) location.reload(); else if (!started) void start(true); });
  if (new URL(location.href).searchParams.get('account') === 'signin') {   // Zone 1's "Sign in" link: open the journal where the Google button is
    rememberZone1(location.search, safeStorage());
    history.replaceState(null, '', '/');
    document.getElementById('journal-button')!.click();
  } else if (new URL(location.href).searchParams.get('account') === 'return') {
    document.getElementById('journal-button')!.click();
  }
  // A device that has signed in before mounts the account once the page is idle, so its wins are claimed (loot-claims.ts) and the
  // rank shows the server's marks without a journal visit. A guest has no stored session and still never loads the SDK.
  else if ((() => { try { return !!localStorage.getItem('frankendom.auth.v1'); } catch { return false; } })()) {
    if ('requestIdleCallback' in window) requestIdleCallback(() => { void start(); }, { timeout: 5000 });
    else setTimeout(() => { void start(); }, 2000);
  }
}
