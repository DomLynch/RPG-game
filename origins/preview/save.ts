// Origins greybox: the player's REAL saved career, read through the Origins writer's `open` op (origins/server). Read-only by construction:
// the only request this module can make is POST <writer>/open with an empty body and the signed-in player's Supabase access token. No duel
// result, account, reward or amount ever leaves the page; duel wins in the preview stay in its memory (main.ts) and are marked "(preview)".
// Any failure (no session, 401/403/404/503, a timeout, the network, a malformed reply) is an answer, never a throw: the page keeps today's
// in-memory preview career and says so in one line. Pure apart from the injected fetch and timer: no DOM, storage or clock read here.
import { careerState } from '../server/career.ts';
import type { CareerRow } from '../server/store.ts';
import type { CareerState } from '../progression/model.ts';
import { NEW_ALLEGIANCE, parseAllegianceState, type AllegianceState } from '../patrons/patrons.ts';

// The one place the writer's address lives: same origin, `/origins/<op>` behind nginx (origins/server/server.ts). Tests may point a page at
// a loopback writer with ?writer=http://127.0.0.1:<port>/origins; nothing else is accepted, so a link can never send the token elsewhere.
export const WRITER_PATH = '/origins';
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}\/[a-z/]*$/;
export function writerBase(search: string): string {
  const asked = new URLSearchParams(search).get('writer');
  return asked && LOOPBACK.test(asked) ? asked.replace(/\/$/, '') : WRITER_PATH;
}

// The live game's stored Supabase session (src/account.ts storageKey; src/loot-claims.ts AUTH_KEY reads it the same way). The preview is
// served from the same origin (/preview/origins/), so a player signed in on frankendom.com is signed in here. supabase-js is not loaded in
// the preview, so nothing refreshes the token: one that is expired (or within a minute of it) counts as no session and nothing is sent.
export const AUTH_KEY = 'frankendom.auth.v1';
export function storedToken(storage: { getItem(key: string): string | null } | null, nowMs: number): string | null {
  try {
    const stored = JSON.parse(storage?.getItem(AUTH_KEY) ?? 'null') as { access_token?: unknown; expires_at?: unknown } | null;
    const token = stored?.access_token;
    return typeof token === 'string' && /^\S{1,4096}$/.test(token) && typeof stored?.expires_at === 'number' && stored.expires_at * 1000 > nowMs + 60_000 ? token : null;
  } catch { return null; }
}

// Zone 1 renews a stale stored session through supabase-js itself (src/account.ts builds the same client on the same storageKey): getSession() exchanges
// the refresh_token inside the library's own navigator lock and writes the session back. The library is only imported (dynamic chunk) when a session is
// stored and its access token is expired or about to be; a fresh token, or none, costs nothing. Any failure leaves the storage as it was = signed out.
export const RENEW_TIMEOUT_MS = 3000;
export type AuthClient = { auth: { getSession(): Promise<unknown> } };
export async function ensureFreshSession(storage: { getItem(key: string): string | null } | null, nowMs: number, makeClient: () => Promise<AuthClient | null>,
  onSignedOut: (reason: 'no-client' | 'timeout' | 'refused') => void = () => {}): Promise<void> {
  try {
    if (!storage?.getItem(AUTH_KEY) || storedToken(storage, nowMs)) return;
    const done = (async () => { const client = await makeClient(); if (!client) return 'no-client' as const; await client.auth.getSession(); return 'asked' as const; })();
    const out = await Promise.race([done, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), RENEW_TIMEOUT_MS))]);   // a hung renewal must not hold presence, the saved career or the paid fight
    if (out === 'asked' ? !storedToken(storage, Date.now()) : true) onSignedOut(out === 'asked' ? 'refused' : out);   // a stored session that is still no session: counted once per page load
  } catch { onSignedOut('refused'); /* offline or refused: stays signed out */ }
}
export const authClient = async (env: { url?: string; key?: string }): Promise<AuthClient | null> => {
  if (!env.url || !env.key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env.url, env.key, { auth: { flowType: 'pkce', detectSessionInUrl: false, storageKey: AUTH_KEY, autoRefreshToken: false } });   // src/account.ts options; no timer: one renewal per page
};

export type Character = { id: string; name: string };
export type Opened = { career: CareerState; characters: Character[]; marks: number };
export type Offline = { offline: string };   // 'no-session' | 'http-<status>' | 'timeout' | 'network' | 'bad-reply'
export const isOffline = (r: Opened | Offline): r is Offline => 'offline' in r;

const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
// The writer's career row -> the progression model's state, through the server's own mapping (origins/server/career.ts careerState), so the
// preview's level and CP are the derived total credit exactly as the server pays against it. A row that is not that shape is no career.
export function careerOf(row: unknown): CareerState | null {
  const r = row as Partial<CareerRow> | null;
  if (!r || typeof r !== 'object' || ![r.total_credit, r.rested, r.rested_at].every(count) || !strings(r.beaten) || !strings(r.story)) return null;
  if (!r.heat || typeof r.heat !== 'object' || Array.isArray(r.heat)) return null;
  if (!Object.values(r.heat).every((h) => Number.isFinite((h as { units?: unknown })?.units) && Number.isFinite((h as { at?: unknown })?.at))) return null;   // the model's Heat
  return careerState(r as CareerRow);
}
export function openedOf(result: unknown): Opened | null {
  const r = result as { marks?: unknown; career?: unknown; characters?: unknown } | null;
  const career = careerOf(r?.career);
  if (!career || !Array.isArray(r?.characters)) return null;
  const characters = r.characters.filter((c): c is Character => typeof c?.id === 'string' && typeof c?.name === 'string').map((c) => ({ id: c.id, name: c.name }));
  return { career, characters, marks: count(r.marks) ? r.marks : 0 };
}

// One `open`. Never rejects: whatever goes wrong comes back as { offline: reason } within `timeoutMs`, even if the fetch ignores its signal.
export async function fetchOpen(token: string | null, opts: { base?: string; fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<Opened | Offline> {
  if (!token) return { offline: 'no-session' };
  const { base = WRITER_PATH, fetch: doFetch = globalThis.fetch, timeoutMs = 4000 } = opts;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Offline>((resolve) => { timer = setTimeout(() => { abort.abort(); resolve({ offline: 'timeout' }); }, timeoutMs); });
  const ask = (async (): Promise<Opened | Offline> => {
    try {
      const res = await doFetch(`${base}/open`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}', signal: abort.signal, credentials: 'omit' });
      if (res.status !== 200) return { offline: `http-${res.status}` };
      const json = (await res.json()) as { ok?: unknown; result?: unknown };
      return (json?.ok === true && openedOf(json.result)) || { offline: 'bad-reply' };
    } catch (e) {
      return { offline: e instanceof SyntaxError ? 'bad-reply' : 'network' };   // after an abort, `late` has already answered 'timeout'
    }
  })();
  try { return await Promise.race([ask, late]); } finally { clearTimeout(timer); }
}

// The HUD's one save line, and the CP the preview added on top of the saved career (memory only, never sent).
// Before the read answers (or times out) the line is neutral: the page starts as CHECKING and never claims offline until it knows.
export type Source = { saved: CareerState } | { offline: string };
export const CHECKING: Source = { offline: 'checking' };
export const saveLine = (source: Source): string =>
  'saved' in source ? 'Your saved career · duel wins here are preview only' : source.offline === CHECKING.offline ? 'Checking saved progress…' : 'Offline preview: progress is not saved';
export const previewCp = (source: Source, career: CareerState): number => ('saved' in source ? Math.max(0, career.credit - source.saved.credit) : 0);

// The preview's OWN save: the allegiance chosen at graduation (origins/patrons). It lives under a key of the preview's own, never one of the
// live game's `frankendom.*` keys, and nothing here sends it anywhere; the writer and the live game never read it. Storage is injected (the
// page passes localStorage, tests a map); a blocked, missing or malformed save reads as no choice yet, and a failed write is a `false`.
export const ALLEGIANCE_KEY = 'origins-preview.allegiance.v1';
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export function loadAllegiance(storage: Pick<Store, 'getItem'> | null): AllegianceState {
  try {
    const r = parseAllegianceState(JSON.parse(storage?.getItem(ALLEGIANCE_KEY) ?? 'null'));
    return r.ok ? r.value : NEW_ALLEGIANCE;
  } catch { return NEW_ALLEGIANCE; }
}
export function storeAllegiance(storage: Pick<Store, 'setItem'> | null, state: AllegianceState): boolean {
  try { if (!storage) return false; storage.setItem(ALLEGIANCE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
