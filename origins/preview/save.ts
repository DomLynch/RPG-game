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

// Zone 1 refreshes the stored session itself (a bookmark or reload lands here without the arena having run supabase-js). A session whose access token is
// expired or within a minute of it, with a refresh_token, is exchanged at Supabase's token endpoint and written back to the SAME key, under the Web Lock
// supabase-js takes, so a second tab cannot spend the rotating refresh token twice. Any failure leaves the storage untouched = signed out; nothing throws, nothing is logged.
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export async function refreshStoredSession(storage: Store | null, nowMs: number, env: { url?: string; key?: string }, doFetch: typeof fetch = globalThis.fetch,
  locks: { request<T>(name: string, cb: () => Promise<T>): Promise<T> } | null = typeof navigator !== 'undefined' ? navigator.locks ?? null : null): Promise<void> {
  const read = () => { try { return JSON.parse(storage?.getItem(AUTH_KEY) ?? 'null') as { refresh_token?: unknown; expires_at?: unknown } | null; } catch { return null; } };
  const stale = (s: ReturnType<typeof read>) => !!s && typeof s.refresh_token === 'string' && s.refresh_token.length > 0 && !(typeof s.expires_at === 'number' && s.expires_at * 1000 > nowMs + 60_000);
  if (!storage || !env.url || !env.key || !stale(read())) return;
  const run = async () => {
    const again = read();   // another tab may have refreshed while this one waited for the lock
    if (!stale(again)) return;
    try {
      const res = await doFetch(`${env.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: env.key!, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: again!.refresh_token }), credentials: 'omit', signal: AbortSignal.timeout(4000) });
      if (res.status !== 200) return;
      const next = (await res.json()) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; expires_at?: unknown };
      if (typeof next.access_token !== 'string' || typeof next.refresh_token !== 'string') return;
      const expires_at = typeof next.expires_at === 'number' ? next.expires_at : typeof next.expires_in === 'number' ? Math.floor(nowMs / 1000) + next.expires_in : null;
      if (expires_at === null) return;
      storage.setItem(AUTH_KEY, JSON.stringify({ ...(JSON.parse(storage.getItem(AUTH_KEY) ?? '{}') as object), ...next, expires_at }));
    } catch { /* offline or storage refused: stays signed out */ }
  };
  try { await (locks ? locks.request(AUTH_KEY.replace(/^/, 'lock:'), run) : run()); } catch { /* lock refused */ }
}

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
