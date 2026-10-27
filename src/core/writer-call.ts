// The writer's address, the stored sign-in and the one POST helper, browser-safe (no server code): the Pit's gear screen (src/) imports this, and save.ts / encounter-net.ts re-export it unchanged.
// The one place the writer's address lives: same origin, `/origins/<op>` behind nginx (origins/server/server.ts). Tests may point a page at
// a loopback writer with ?writer=http://127.0.0.1:<port>/origins; nothing else is accepted, so a link can never send the token elsewhere.
export const WRITER_PATH = '/origins';
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}\/[a-z/]*$/;
export function writerBase(search: string): string {
  const asked = new URLSearchParams(search).get('writer');
  return asked && LOOPBACK.test(asked) ? asked.replace(/\/$/, '') : WRITER_PATH;
}

// The live game's stored Supabase session (src/core/account.ts storageKey; src/core/loot-claims.ts AUTH_KEY reads it the same way). The preview is
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

// Whose stored session it is (the persisted session's user id), expired or not: what a page keys per-account state by (the kill outbox, origins/preview/outbox-store.ts). It authorises nothing; a
// request still needs storedToken. null when no session is stored or it has no well-formed id.
export function storedAccount(storage: { getItem(key: string): string | null } | null): string | null {
  try {
    const id = (JSON.parse(storage?.getItem(AUTH_KEY) ?? 'null') as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id.toLowerCase() : null;
  } catch { return null; }
}

// A kill_report 409's `kind` (launch gate V5, origins/server/server.ts): what became of a token that is no longer open, and for 'paid' the STORED receipt (never recomputed). A body without a well-formed `kind` is the plain old 409.
export type KillReceipt = { instance: string; killedAt: string; cp: number; bronze: number; loot: number };
export type RefusalKind = 'paid' | 'expired' | 'unknown';
export type Offline = { offline: string; code?: string; kind?: RefusalKind; receipt?: KillReceipt };   // 'no-session' | 'http-<status>' | 'timeout' | 'network' | 'bad-reply'; `code` is the writer's own refusal code when its answer carried one (a 409 / 422 body { ok: false, error, code }, origins/server/server.ts)
export type Opts = { base?: string; fetch?: typeof fetch; timeoutMs?: number };
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const receiptOf = (r: unknown): KillReceipt | null => {
  const x = r as Partial<Record<keyof KillReceipt, unknown>> | null;
  return x && typeof x === 'object' && typeof x.instance === 'string' && typeof x.killedAt === 'string' && count(x.cp) && count(x.bronze) && count(x.loot) ? { instance: x.instance, killedAt: x.killedAt, cp: x.cp, bronze: x.bronze, loot: x.loot } : null;
};
// The writer's refusal code, if its error body carries one: a short kebab id, never free text. A body that is not that shape is no code. A 409's `kind` rides along when it is one of the three known words ('paid' only with a well-formed receipt).
async function refusalCode(res: Response): Promise<{ code?: string; kind?: RefusalKind; receipt?: KillReceipt }> {
  try {
    const body = (await res.json()) as { code?: unknown; kind?: unknown; receipt?: unknown } | null;
    const code = typeof body?.code === 'string' && /^[a-z0-9-]{1,40}$/.test(body.code) ? { code: body.code } : {};
    const receipt = receiptOf(body?.receipt);
    return body?.kind === 'paid' ? (receipt ? { ...code, kind: 'paid', receipt } : code) : body?.kind === 'expired' || body?.kind === 'unknown' ? { ...code, kind: body.kind } : code;
  } catch { return {}; }
}
// One op. Never rejects: whatever goes wrong comes back as { offline: reason } within `timeoutMs`, even if the fetch ignores its signal.
export async function call<T>(op: string, body: object, token: string | null, read: (result: unknown) => T | null, opts: Opts): Promise<T | Offline> {
  if (!token) return { offline: 'no-session' };
  const { base = WRITER_PATH, fetch: doFetch = globalThis.fetch, timeoutMs = 4000 } = opts;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Offline>((resolve) => { timer = setTimeout(() => { abort.abort(); resolve({ offline: 'timeout' }); }, timeoutMs); });
  const ask = (async (): Promise<T | Offline> => {
    try {
      const res = await doFetch(`${base}/${op}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal, credentials: 'omit' });
      if (res.status !== 200) return { offline: `http-${res.status}`, ...(await refusalCode(res)) };
      const json = (await res.json()) as { ok?: unknown; result?: unknown };
      return (json?.ok === true && read(json.result)) || { offline: 'bad-reply' };
    } catch (e) {
      return { offline: e instanceof SyntaxError ? 'bad-reply' : 'network' };   // after an abort, `late` has already answered 'timeout'
    }
  })();
  try { return await Promise.race([ask, late]); } finally { clearTimeout(timer); }
}
