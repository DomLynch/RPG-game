// Guest startup never waits for an account request or downloads the account SDK.
import { api } from './api.ts';
if (api) {
  const { url, key } = api;
  const panel = document.getElementById('account')!;
  const status = document.getElementById('account-status')!;
  const retry = document.getElementById('account-retry')!;
  panel.hidden = false;
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    try { const { mountAccount } = await import('./account.ts'); await mountAccount(url, key); }
    catch { started = false; status.textContent = 'Account unavailable. Your local fighter is safe.'; retry.hidden = false; }
  };
  document.getElementById('journal-button')!.addEventListener('click', () => { void start(); });
  retry.addEventListener('click', () => { if (!started) void start(); });
  if (new URL(location.href).searchParams.get('account') === 'return') {
    document.getElementById('journal-button')!.click();
  }
  // A device that has signed in before mounts the account once the page is idle, so its wins are claimed (loot-claims.ts) and the
  // rank shows the server's marks without a journal visit. A guest has no stored session and still never loads the SDK.
  else if ((() => { try { return !!localStorage.getItem('frankendom.auth.v1'); } catch { return false; } })()) {
    if ('requestIdleCallback' in window) requestIdleCallback(() => { void start(); }, { timeout: 5000 });
    else setTimeout(() => { void start(); }, 2000);
  }
}
