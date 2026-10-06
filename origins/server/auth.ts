// The client's Supabase access token -> its account id, asked of Supabase Auth itself (which checks signature, expiry and revocation).
// No local JWT parsing: a token this service cannot get Auth to vouch for is nobody.
import { UUID } from './store.ts';

export type Verify = (token: string) => Promise<string | null>;

export function supabaseVerify(url: string, anonKey: string, doFetch: typeof fetch = fetch): Verify {
  return async token => {
    try {
      const res = await doFetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const id = ((await res.json()) as { id?: unknown }).id;
      return typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null;
    } catch { return null; }
  };
}
