// The writer's address, the stored sign-in and the one POST helper, browser-safe (no server code): the Pit's gear screen (src/) imports this, and save.ts / encounter-net.ts re-export it unchanged.
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

export type Offline = { offline: string };   // 'no-session' | 'http-<status>' | 'timeout' | 'network' | 'bad-reply'
type Opts = { base?: string; fetch?: typeof fetch; timeoutMs?: number };
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
      if (res.status !== 200) return { offline: `http-${res.status}` };
      const json = (await res.json()) as { ok?: unknown; result?: unknown };
      return (json?.ok === true && read(json.result)) || { offline: 'bad-reply' };
    } catch (e) {
      return { offline: e instanceof SyntaxError ? 'bad-reply' : 'network' };   // after an abort, `late` has already answered 'timeout'
    }
  })();
  try { return await Promise.race([ask, late]); } finally { clearTimeout(timer); }
}
