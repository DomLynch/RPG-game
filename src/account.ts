import { createClient } from '@supabase/supabase-js';
import { loadProfile, saveProfile } from './profile.ts';
import { readFighter, writeFighter, type CloudProfile } from './cloud-profile.ts';

export async function mountAccount(url: string, key: string) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = get('account-status'), identity = get('account-identity');
  const login = get<HTMLButtonElement>('account-login'), logout = get<HTMLButtonElement>('account-logout');
  const save = get<HTMLButtonElement>('account-save'), restore = get<HTMLButtonElement>('account-load'), retry = get<HTMLButtonElement>('account-retry');
  const db = createClient(url, key, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, storageKey: 'frankendom.auth.v1' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(10000)]) }) },
  });
  let userId: string | null = null, saved: CloudProfile | null = null, generation = 0, busy = true;
  function render() {
    login.hidden = !!userId; logout.hidden = save.hidden = restore.hidden = !userId;
    for (const button of [login, logout, save, restore, retry]) button.disabled = busy;
    restore.disabled = busy || !saved;
    save.textContent = saved ? 'Replace cloud save' : 'Save fighter';
  }
  async function refresh() {
    const turn = ++generation;
    busy = true; saved = null; retry.hidden = true; render();
    status.textContent = 'Checking your account…';
    try {
      const { data, error } = await db.auth.getSession();
      if (turn !== generation) return;
      if (error) throw error;
      userId = data.session?.user.id ?? null;
      identity.textContent = userId ? data.session!.user.email ?? 'Signed in' : 'Guest';
      const result = userId ? await readFighter(db, userId) : null;
      if (turn !== generation) return;
      saved = result;
      status.textContent = saved ? `Cloud fighter: ${saved.display_name}. Load it here, or replace it with this device’s fighter.`
        : userId ? 'Save your fighter name and chosen opponent to this account.' : 'Sign in to keep your fighter name and chosen opponent across devices.';
    } catch {
      if (turn !== generation) return;
      status.textContent = 'Could not read your account. Retry before saving; your local fighter is safe.';
      retry.hidden = false;
    } finally { if (turn === generation) { busy = false; render(); save.disabled = !retry.hidden; } }
  }
  login.addEventListener('click', async () => {
    busy = true; render(); status.textContent = 'Opening Google…';
    try {
      const redirect = new URL('/', location.origin); redirect.searchParams.set('account', 'return');
      const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account', access_type: 'online' } } });
      if (error) throw error;
    } catch { status.textContent = 'Sign-in could not start. Please try again.'; busy = false; render(); }
  });
  logout.addEventListener('click', async () => {
    busy = true; render(); ++generation;
    try {
      const { error } = await db.auth.signOut({ scope: 'local' });
      if (error) throw error;
      await refresh();
    } catch { status.textContent = 'Sign-out failed. Please retry.'; busy = false; render(); }
  });
  retry.addEventListener('click', () => { void refresh(); });
  save.addEventListener('click', async () => {
    if (!userId || busy) return;
    const turn = generation, owner = userId;
    busy = true; render(); status.textContent = 'Saving fighter…';
    try {
      const local = loadProfile(localStorage, () => crypto.randomUUID());
      if (!local.returning) throw Error('No readable local fighter');
      const result = await writeFighter(db, owner, local.profile, saved?.revision ?? null);
      if (turn !== generation) return;
      saved = result; status.textContent = `Saved ${saved.display_name}. Save again here after changing your name or opponent.`;
    } catch {
      if (turn !== generation) return;
      status.textContent = 'Save failed or changed on another device. Retry to read the latest save first.'; retry.hidden = false;
    } finally { if (turn === generation) { busy = false; render(); save.disabled = !retry.hidden; } }
  });
  restore.addEventListener('click', async () => {
    if (!userId || busy || !saved) return;
    const turn = generation;
    busy = true; render();
    try {
      const latest = await readFighter(db, userId);
      if (turn !== generation) return;
      if (!latest) throw Error('Save no longer exists');
      const { profile } = loadProfile(localStorage, () => crypto.randomUUID());
      // Explicit load restarts practice. Keep the device ID; do not import or invent career marks.
      profile.name = latest.display_name; profile.encounter = latest.encounter ?? undefined;
      if (!saveProfile(localStorage, profile)) throw Error('Device storage unavailable');
      const target = new URL(location.href); target.searchParams.delete('opponent');
      location.replace(target.href);
    } catch { if (turn === generation) { status.textContent = 'Could not load your fighter. Your current practice is unchanged.'; busy = false; render(); } }
  });
  const callback = new URL(location.href), code = callback.searchParams.get('code');
  const flowId = callback.searchParams.get('sb_flow_id');
  const denied = callback.searchParams.has('error');
  const returning = callback.searchParams.get('account') === 'return';
  if (returning) {
    for (const param of ['account', 'code', 'error', 'error_code', 'error_description', 'sb_flow_id']) callback.searchParams.delete(param);
    history.replaceState(null, '', callback.href);
    if (code) {
      try {
        const { error } = await db.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
        await refresh();
        if (error) status.textContent = 'Sign-in expired or failed. Please continue with Google again.';
      } catch { await refresh(); status.textContent = 'Sign-in expired or failed. Please continue with Google again.'; }
    } else { await refresh(); if (denied) status.textContent = 'Sign-in cancelled. You can keep playing as a guest.'; }
  } else await refresh();
  // Do not await Supabase calls inside its auth lock. Ignore token refreshes: they must not interrupt a save.
  db.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { ++generation; setTimeout(() => { void refresh(); }, 0); }
  });
}
