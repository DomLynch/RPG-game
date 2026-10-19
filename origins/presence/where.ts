// Asking the presence service where an account stands (docs/specs/origins/one-shard.md; Lead's launch gate: the writer derives a player's place from presence, never from a request
// body). The server side is GET /internal/where in server.ts. Everything here fails closed: a presence service that cannot be reached, or answers anything but a well-formed 200, is an
// error the caller must turn into a refusal, never into "not at the Exchange" quietly passing or "at the Exchange" assumed.
import { presenceRule } from './presence-rules.ts';

export type Where =
  | { online: false }
  | { online: true; layer: number; placed: false }   // in the world, but no first pose yet: its position is unknown
  | { online: true; layer: number; placed: true; x: number; z: number; zone: string | null; ageMs: number };   // centimetres in the town square; zone: 'pit-yard', 'exchange' or null (neither), computed by presence from x, z; ageMs: since its last pose was handled
export type WhereFn = (account: string) => Promise<Where>;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function parseWhere(v: unknown): Where {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new Error('presence: malformed answer');
  if (o.online === false) return { online: false };
  if (o.online !== true || !num(o.layer)) throw new Error('presence: malformed answer');
  if (o.placed === false) return { online: true, layer: o.layer, placed: false };
  if (o.placed !== true || !num(o.x) || !num(o.z) || !num(o.ageMs) || (o.zone !== null && typeof o.zone !== 'string')) throw new Error('presence: malformed answer');
  return { online: true, layer: o.layer, placed: true, x: o.x, z: o.z, zone: o.zone, ageMs: o.ageMs };
}

// The writer's client. `baseUrl` is the presence service on loopback (e.g. http://127.0.0.1:8793); `key` is the shared PRESENCE internal key.
export function presenceWhere(baseUrl: string, key: string, timeoutMs = presenceRule('whereTimeoutMs'), fetchImpl: typeof fetch = fetch): WhereFn {
  return async account => {
    const res = await fetchImpl(`${baseUrl}/internal/where?account=${encodeURIComponent(account)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`presence: HTTP ${res.status}`);
    return parseWhere(await res.json());
  };
}

// The ids of the layers presence holds right now (GET /internal/layers), for the writer's spawn janitor. Anything but a well-formed 200 is an error: the janitor deletes nothing then.
const HTTP_OK = 200;
export type LayersFn = () => Promise<number[]>;
export function presenceLayers(baseUrl: string, key: string, timeoutMs = presenceRule('whereTimeoutMs'), fetchImpl: typeof fetch = fetch): LayersFn {
  return async () => {
    const res = await fetchImpl(`${baseUrl}/internal/layers`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== HTTP_OK) throw new Error(`presence: HTTP ${res.status}`);
    const o = await res.json() as { layers?: unknown };
    if (!Array.isArray(o?.layers) || !o.layers.every((n) => Number.isInteger(n) && n >= 1)) throw new Error('presence: malformed answer');
    return o.layers as number[];
  };
}

// The writer tells presence "this account's worn set may have changed" after a gear op succeeded (POST /internal/worn, the server's wornRoute). Fire and forget: the caller ignores any failure, because
// presence also re-reads every account's worn set on its own timer, so a lost poke only delays what other players see.
export type WornPokeFn = (account: string) => Promise<void>;
export function presenceWornPoke(baseUrl: string, key: string, timeoutMs = presenceRule('wornPokeTimeoutMs'), fetchImpl: typeof fetch = fetch): WornPokeFn {
  return async account => {
    const res = await fetchImpl(`${baseUrl}/internal/worn`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ account }), signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`presence: HTTP ${res.status}`);
  };
}

// X1's test in one place: true only for a placed player whose last pose is at most `maxAgeMs` old and whose zone presence computed as `zone` (x and z alone are never enough).
export const inZone = (w: Where, zone: string, maxAgeMs: number): boolean => w.online && w.placed && w.zone === zone && w.ageMs <= maxAgeMs;

// The writer's reach read for a rewarding op (kill_report, ground_take): the placed pose when `inZone` holds, else null with WHY it does not, the first failing condition in inZone's order
// (Auditor 2026-10-18: every live kill and take was 'unchecked' with no way to tell which; the why goes in the op's log line). A presence that cannot be asked is an answer here, never a throw.
export type Reach = { pose: Extract<Where, { placed: true }> | null; why: string };
export async function reachOf(where: WhereFn | undefined, account: string, zone: string, maxAgeMs: number): Promise<Reach> {
  if (!where) return { pose: null, why: 'no-presence' };
  let w: Where | null;
  try { w = await where(account); } catch (e) { return { pose: null, why: `presence-error: ${e instanceof Error ? e.message : String(e)}` }; }
  if (!w) return { pose: null, why: 'presence-error: no answer' };
  if (!w.online) return { pose: null, why: 'offline' };
  if (!w.placed) return { pose: null, why: 'unplaced' };
  if (w.zone !== zone) return { pose: null, why: `other-zone: ${w.zone ?? 'none'} not ${zone}` };
  if (w.ageMs > maxAgeMs) return { pose: null, why: `stale: ${Math.round(w.ageMs)} ms` };
  return { pose: w, why: 'checked' };
}

// True only for a placed player whose last pose is at most `maxAgeMs` old and who stands within `radiusCm` of (x, z). Offline, unplaced or stale is false: the caller refuses. This is the radius test only; a rule that also needs a zone uses `inZone` too.
export function standsWithin(w: Where, area: { x: number; z: number; radiusCm: number }, maxAgeMs: number): boolean {
  return w.online && w.placed && w.ageMs <= maxAgeMs && Math.hypot(w.x - area.x, w.z - area.z) <= area.radiusCm;
}
