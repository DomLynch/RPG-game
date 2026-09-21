import { createClient } from '@supabase/supabase-js';
import { loadProfile, saveProfile, type Profile } from './profile.ts';
import { fighterDetails, readAdmin, readFighter, writeFighter, type CloudProfile } from './cloud-profile.ts';
import { marksOf } from './career.ts';
import { mergeLoot } from './loot.ts';
import { session } from './session.ts';

export async function mountAccount(url: string, key: string) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = get('account-status'), identity = get('account-identity');
  const login = get<HTMLButtonElement>('account-login'), logout = get<HTMLButtonElement>('account-logout');
  const retry = get<HTMLButtonElement>('account-retry');
  const db = createClient(url, key, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, storageKey: 'frankendom.auth.v1' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(10000)]) }) },
  });
  session.db = db;   // Share (main.ts) stores a signed-in fighter's record through this client
  const tools = get('test-tools');
  let userId: string | null = null, saved: CloudProfile | null = null, generation = 0, busy = true;
  // Test tools follow the admins roster; ?debug (main.ts) keeps them open for the release checks whatever the account says.
  const showTools = (admin: boolean) => { tools.dataset.admin = String(admin); tools.hidden = !admin && tools.dataset.debug !== 'true'; };
  function render() {
    login.hidden = !!userId; logout.hidden = !userId;
    for (const button of [login, logout, retry]) button.disabled = busy;
  }
  const local = () => loadProfile(localStorage, () => crypto.randomUUID()).profile;
  // What the device would write, against what the cloud holds: a change of name or opponent, more marks, or a piece the cloud lacks.
  const differs = (profile: Profile, cloud: CloudProfile) => { const mine = fighterDetails(profile); return mine.display_name !== cloud.display_name || mine.encounter !== cloud.encounter || mine.victory_marks > cloud.victory_marks || mine.loot.owned.some(id => !cloud.loot.owned.includes(id)); };
  // The cloud save is automatic (owner 2026-09-21: no Save / Load buttons): the device writes whenever it has something the cloud lacks.
  async function sync(profile: Profile, turn: number): Promise<boolean> {
    if (!userId) return false;
    try {
      const result = await writeFighter(db, userId, profile, saved?.revision ?? null);
      if (turn !== generation) return false;
      saved = result; status.textContent = `Saved to your account as ${saved.display_name}.`; return true;
    } catch {
      if (turn === generation) { status.textContent = 'Save failed or changed on another device. Retry to read the latest save first.'; retry.hidden = false; }
      return false;
    }
  }
  // A fresh sign-in on this device (merge = true): the cloud comes down — its name and opponent, the higher mark count, every piece of loot
  // from either side — and the page restarts once on the merged fighter. Every later refresh only sends up what the device has gained.
  async function refresh(merge = false) {
    const turn = ++generation;
    busy = true; saved = null; retry.hidden = true; render();
    status.textContent = 'Checking your account…';
    try {
      const { data, error } = await db.auth.getSession();
      if (turn !== generation) return;
      if (error) throw error;
      userId = data.session?.user.id ?? null; session.userId = userId;
      identity.textContent = userId ? data.session!.user.email ?? 'Signed in' : 'Guest';
      const result = userId ? await readFighter(db, userId) : null;
      if (turn !== generation) return;
      saved = result;
      // A failed roster read means no tools this visit, never a failed account: the fighter save is unaffected.
      const admin = userId ? await readAdmin(db, userId).catch(() => false) : false;
      if (turn !== generation) return;
      showTools(admin);
      if (!userId) status.textContent = 'Sign in to keep your fighter name, opponent and career marks across devices.';
      else if (!saved) await sync(local(), turn);   // the account's first fighter: this device's
      else if (merge) {
        const profile = local();
        profile.name = saved.display_name; profile.encounter = saved.encounter ?? undefined;
        const victoryMarks = Math.max(marksOf(profile), saved.victory_marks);
        if (victoryMarks) profile.career = { victoryMarks };
        const loot = mergeLoot(profile.loot, saved.loot); if (loot.owned.length) profile.loot = loot;   // loot: the union of both, nothing lost
        if (!saveProfile(localStorage, profile)) throw Error('Device storage unavailable');
        if (differs(profile, saved) && !(await sync(profile, turn))) return;
        const target = new URL(location.href); target.searchParams.delete('opponent');
        location.replace(target.href); return;
      } else if (differs(local(), saved)) await sync(local(), turn);
      else status.textContent = `Saved to your account as ${saved.display_name}.`;
    } catch {
      if (turn !== generation) return;
      status.textContent = 'Could not read your account. Retry before saving; your local fighter is safe.';
      retry.hidden = false;
    } finally { if (turn === generation) { busy = false; render(); } }
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
  // Every recorded result persists the device's fighter (main.ts persist()); a signed-in account sends the gain up on the same beat.
  window.addEventListener('frankendom:profile', () => { if (userId && saved && !busy && retry.hidden && differs(local(), saved)) void sync(local(), generation); });
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
        await refresh(!error);
        if (error) status.textContent = 'Sign-in expired or failed. Please continue with Google again.';
      } catch { await refresh(); status.textContent = 'Sign-in expired or failed. Please continue with Google again.'; }
    } else { await refresh(); if (denied) status.textContent = 'Sign-in cancelled. You can keep playing as a guest.'; }
  } else await refresh();
  // Do not await Supabase calls inside its auth lock. Ignore token refreshes: they must not interrupt a save.
  db.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { ++generation; setTimeout(() => { void refresh(); }, 0); }
  });
}
