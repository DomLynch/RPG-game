import { createClient } from '@supabase/supabase-js';
import { loadProfile, saveProfile, type Profile } from './profile.ts';
import { absorbCloud, createSaveQueue, profileDiffers, readAdmin, readFighter, readStanding, writeFighter, type CloudProfile } from './cloud-profile.ts';
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
  const arenaRow = get('arena-row'), signatureRow = get('signature-row');   // the Options tab's Arena and Signature picks: test tools beside Opponent (Dom 2026-09-24)
  const showTools = (admin: boolean) => { tools.dataset.admin = String(admin); tools.hidden = !admin && tools.dataset.debug !== 'true'; arenaRow.hidden = signatureRow.hidden = tools.hidden; };
  function render() {
    login.hidden = !!userId; logout.hidden = !userId;
    for (const button of [login, logout, retry]) button.disabled = busy;
    // A visible Retry means the last read or write failed: nothing is saving, and the line must not say so (audit 2026-09-23).
    headline(userId ? (saved && !profileDiffers(device(), saved) ? 'saved' : retry.hidden ? 'saving' : 'unsynced') : 'guest');
  }
  const local = () => loadProfile(localStorage, () => crypto.randomUUID()).profile;
  const differs = profileDiffers;   // cloud-profile.ts: name, opponent, marks, owned, equipped, provenance
  // What this device writes and compares: its fighter with the account's higher mark count and loot absorbed (cloud-profile.ts absorbCloud),
  // so no refresh and no save can lower the account.
  const device = () => (saved ? absorbCloud(local(), saved) : local());
  // The fighter card's save line (HUD and journal) tells the truth in three states; main.ts persist() writes 'saving' on every change
  // for a signed-in fighter and this file settles it once the cloud answers.
  const headline = (state: 'guest' | 'saving' | 'saved' | 'unsynced') => {
    const text = { guest: 'Guest · saved on this device', saving: 'Signed in · saving…', saved: 'Signed in · saved to your account', unsynced: 'Signed in · not synced' }[state];
    for (const id of ['save-status', 'journal-save']) get(id).textContent = text;
  };
  // The cloud save is automatic (owner 2026-09-21: no Save / Load buttons): the device writes whenever it has something the cloud lacks.
  // Writes are queued (cloud-profile.ts createSaveQueue): one in flight, the latest device profile written once more after it lands, so
  // two quick changes never race the same revision. `turn` guards against a sign-in/out that happened while a write was in the air.
  const queue = createSaveQueue(async profile => { saved = await writeFighter(db, userId!, profile, saved?.revision ?? null); });
  async function sync(profile: Profile, turn: number): Promise<boolean> {
    if (!userId) return false;
    if (!saveProfile(localStorage, profile)) { status.textContent = 'Device storage unavailable.'; return false; }   // the queue writes local(): the device is the source
    status.textContent = 'Saving to your account…'; delete status.dataset.saved; headline('saving');
    const ok = await queue(device);
    if (turn !== generation) return false;
    if (ok && saved) { status.textContent = ''; status.dataset.saved = saved.display_name; headline('saved'); return true; }   // the fighter card's save line says it (owner: the sentence was repetitive); data-saved is check 14's signal
    status.textContent = 'Save failed or changed on another device. Retry to read the latest save first.'; delete status.dataset.saved; retry.hidden = false; headline('unsynced');
    return false;
  }
  // A fresh sign-in on this device (merge = true): the cloud comes down — its name and opponent, the higher mark count, every piece of loot
  // from either side — and the page restarts once on the merged fighter. Every later refresh only sends up what the device has gained.
  async function refresh(merge = false) {
    const turn = ++generation;
    busy = true; saved = null; retry.hidden = true; render();
    status.textContent = 'Checking your account…'; delete status.dataset.saved;
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
      // The rank shows the server's marks once it has a figure; null (guest, or no my_standing yet) keeps the save's count (main.ts).
      const marks = userId ? await readStanding(db) : null;
      if (turn !== generation) return;
      session.marks = marks; window.dispatchEvent(new Event('frankendom:standing'));
      if (!userId) status.textContent = 'Sign in to keep your fighter name, opponent and career marks across devices.';
      else if (!saved) await sync(local(), turn);   // the account's first fighter: this device's
      else if (merge) {
        const profile = local();
        profile.name = saved.display_name; profile.encounter = saved.encounter ?? undefined;
        const victoryMarks = Math.max(marksOf(profile), saved.victory_marks);
        if (victoryMarks) profile.career = { victoryMarks };
        const loot = mergeLoot(profile.loot, saved.loot); if (loot.owned.length || loot.declined) profile.loot = loot;   // loot: the union of both, nothing lost
        if (!saveProfile(localStorage, profile)) throw Error('Device storage unavailable');
        if (differs(profile, saved) && !(await sync(profile, turn))) return;
        const target = new URL(location.href); target.searchParams.delete('opponent');
        location.replace(target.href); return;
      } else if (differs(device(), saved)) await sync(device(), turn);
      else { status.textContent = ''; status.dataset.saved = saved.display_name; }
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
  window.addEventListener('frankendom:profile', () => { if (userId && saved && !busy && retry.hidden && differs(device(), saved)) void sync(device(), generation); });   // equip, provenance, marks, name: all of them
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
