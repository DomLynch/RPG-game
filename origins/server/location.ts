// Launch gate X2 Stage 2, the writer half (docs/specs/origins/x2-presence-saved-location.md, PR #1575): the saved location of an account's ACTIVE character,
// written only from presence's own observation and served back to presence at join. Two INTERNAL routes, neither under /origins/ (so the public nginx route to
// the writer does not reach them), each needing the shared key AND a loopback caller, the same pattern as presence's GET /internal/where (origins/presence/server.ts):
//   POST /internal/location            {account, x, z, at?}  presence's observation (on leave and every 60 s); the writer stores it for the active character
//   GET  /internal/location?account=…                        what presence should start that account at: {saved:false} or {saved:true, zone, x, z, source}
// No client op writes a location: the client ops are POST /origins/<op> with a Supabase token, and none of them touches these tables.
// Rules on serve (Strategy, via Lead, #1575 §4 e/f): a server-held state (jail, bounty, feud, duel) overrides the saved spot and never expires; a saved spot in
// the exchange zone (the whole zone is the trade area, Lead 05:4x) is served just outside the Exchange's outer gate, Pit side, 50 cm in.
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LEGACY_SHIFT_CM, inTradeArea as inTradeAreaCm, REJOIN_EDGE as REJOIN_EDGE_CM, zoneAt as zoneAtCm } from '../presence/zones.ts';
import type { Db } from './db.ts';
import type { LocationFlusher } from './location-flush.ts';
import * as store from './store.ts';
const wornIdsOf = async (db: Db, account: string, character: string) => (await import('./worn-gear.ts')).wornIdsOf(db, account, character);   // lazy: presence imports this file for its client half and must not load the fight code

export const ZONE_CM = 30000;   // the saved x/z columns' bound, check (between 0 and 30000) in migration 202610070009 (old town frame): a storage contract, pinned by tests/location-bounds.test.ts

// The rejoin edge and the trade area are presence's own (origins/presence/zones.ts, #1577): one definition for both servers. The saved columns stay in the OLD frame (town square, centre 15000)
// until the location migration widens them (docs/specs/origins/frontier-presence.md §2), so presence's v2-frame answers are shifted back here.
const shift = (x: number, z: number): [number, number] => [x + LEGACY_SHIFT_CM, z + LEGACY_SHIFT_CM];
export const zoneAt = (x: number, z: number): string | null => zoneAtCm(...shift(x, z));
export const inTradeArea = (x: number, z: number): boolean => inTradeAreaCm(...shift(x, z));
export const REJOIN_EDGE = { x: REJOIN_EDGE_CM.x - LEGACY_SHIFT_CM, z: REJOIN_EDGE_CM.z - LEGACY_SHIFT_CM };

// Strategy's rule (a), no logout escape: a server-owned state that decides where the character stands (Feuds jail, an active bounty or feud, a duel in
// progress) overrides the saved spot and never expires. The writer holds NO such state today (origins/feuds is a pure engine with no table; duels are not in
// the writer), so the default answers null for everyone. When jail (or the others) gets a table, its lookup is passed in here; serve already lets it win.
export type HeldPlace = { zone: string | null; x: number; z: number; reason: 'jail' | 'bounty' | 'feud' | 'duel' };
export type HeldFn = (db: Db, account: string, character: string) => Promise<HeldPlace | null>;
export const noServerHeldState: HeldFn = async () => null;

export type Worn = Readonly<Record<string, string>>;   // {slot: lootId} of the pieces a character wears, what other players see
export type Served = { saved: false; name?: string | null; worn?: Worn } | { saved: true; zone: string | null; x: number; z: number; source: 'saved' | 'trade-edge' | HeldPlace['reason']; name?: string | null; worn?: Worn };
// What presence should start this account at. Pure given the saved row and the held state.
export function serve(saved: store.SavedRow | null, held: HeldPlace | null): Served {
  if (held) return { saved: true, zone: held.zone, x: held.x, z: held.z, source: held.reason };
  if (!saved) return { saved: false };
  if (saved.zone === 'exchange' || inTradeArea(saved.x, saved.z)) return { saved: true, zone: zoneAt(REJOIN_EDGE.x, REJOIN_EDGE.z), x: REJOIN_EDGE.x, z: REJOIN_EDGE.z, source: 'trade-edge' };
  return { saved: true, zone: saved.zone, x: saved.x, z: saved.z, source: 'saved' };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY = 1024;
const loopback = (a: string | undefined): boolean => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
const cm = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= ZONE_CM;

// `flusher`: when set, presence's posts go into the dirty map (answer {queued:true}) and are written in one statement per interval; unset, each post is written through as before.
export type InternalOptions = { key: string; held?: HeldFn; now?: () => number; flusher?: LocationFlusher; liveOps?: { snapshot(): unknown }; worldRecords?: { snapshot(): unknown } };

// The writer's internal routes (server.ts sends every /internal/ path here when a key is configured; without one those paths are a plain 404).
export function internalRoute(db: Db, opts: InternalOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { key, held = noServerHeldState, now = Date.now, flusher, liveOps, worldRecords } = opts;
  if (!key) throw new Error('writer: the internal key is empty');
  return async (req, res) => {
    const reply = (code: number, body: unknown): void => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    const url = new URL(req.url ?? '/', 'http://writer');
    const isLive = url.pathname === '/internal/live-ops' && req.method === 'GET' && liveOps !== undefined;   // the live-ops rows as the writer holds them (events, which are active, switches)
    const isRecords = url.pathname === '/internal/world-records' && req.method === 'GET' && worldRecords !== undefined;   // the soak counters: kills by verdict reason
    if (!isLive && !isRecords && (url.pathname !== '/internal/location' || (req.method !== 'GET' && req.method !== 'POST'))) return reply(404, { error: 'not found' });
    const sent = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
    const a = Buffer.from(sent ?? ''), b = Buffer.from(key);
    if (!loopback(req.socket.remoteAddress) || a.length !== b.length || !timingSafeEqual(a, b)) { req.resume(); return reply(401, { error: 'unauthorised' }); }
    try {
      if (isLive) return reply(200, liveOps!.snapshot());
      if (isRecords) return reply(200, worldRecords!.snapshot());
      if (req.method === 'GET') {
        const account = url.searchParams.get('account')?.toLowerCase();
        if (!account || !UUID.test(account)) return reply(400, { error: 'account: a uuid' });
        if (url.searchParams.get('worn') === '1') { const c = await store.active(db, account); return reply(200, { worn: c ? await wornIdsOf(db, account, c) : {} }); }   // presence's refresh: only what others see worn, nothing else
        if (flusher?.has(account)) await flusher.flush();   // read your own write: presence rejoining right after a leave sees the spot it just posted
        const saved = await store.savedLocation(db, account);
        const character = saved?.character ?? await store.active(db, account);
        const name = await store.activeName(db, account);   // presence's name tag for this account's active character; null when none, or before the migration
        return reply(200, { ...serve(saved, character ? await held(db, account, character) : null), name, worn: character ? await wornIdsOf(db, account, character) : {} });   // worn: the visible gear {slot: lootId}, read from the ledger, never from the client
      }
      const text = await new Promise<string>((resolve, reject) => {
        let size = 0; const parts: Buffer[] = [];
        req.on('data', (c: Buffer) => { size += c.length; if (size <= MAX_BODY) parts.push(c); });
        req.on('end', () => (size > MAX_BODY ? reject(new Error('too large')) : resolve(Buffer.concat(parts).toString('utf8'))));
        req.on('error', reject);
      }).catch(() => null);
      let body: Record<string, unknown> | null = null;
      try { body = text === null ? null : JSON.parse(text); } catch { body = null; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'body: {account, x, z, at?}' });
      const account = typeof body.account === 'string' ? body.account.toLowerCase() : '';
      if (!UUID.test(account)) return reply(400, { error: 'account: a uuid' });
      if (!cm(body.x) || !cm(body.z)) return reply(400, { error: `x, z: whole centimetres 0..${ZONE_CM}` });
      if (body.at !== undefined && !(Number.isInteger(body.at) && (body.at as number) > 0)) return reply(400, { error: 'at: epoch milliseconds' });
      // The zone is the writer's own computation from x, z in the one Concord frame (the same zoneAt presence uses), never a field of the post.
      const seen = { x: body.x, z: body.z, zone: zoneAt(body.x, body.z), atMs: (body.at as number | undefined) ?? now() };
      if (flusher) { flusher.mark(account, seen); return reply(200, { queued: true }); }
      return reply(200, await store.saveLocation(db, account, seen));
    } catch (e) {
      console.error('origins-writer internal:', e instanceof Error ? e.message : e);
      return reply(500, { error: 'server error' });
    }
  };
}

// ---- presence's side of the channel (Backend wires these into the join and the leave/checkpoint; both fail closed) ------------------------------------------
export function parseServed(v: unknown): Served {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new Error('writer: malformed answer');
  // `name` is additive: an older writer sends none (undefined = no name tag); a malformed one is dropped, never trusted
  const name = typeof o.name === 'string' && o.name !== '' ? o.name : null;   // the database holds the length (origins_characters.name check)
  const worn = parseWorn(o.worn);
  if (o.saved === false) return { saved: false, name, worn };
  if (o.saved !== true || !cm(o.x) || !cm(o.z) || (o.zone !== null && typeof o.zone !== 'string') || typeof o.source !== 'string') throw new Error('writer: malformed answer');
  return { saved: true, zone: o.zone, x: o.x as number, z: o.z as number, source: o.source as Extract<Served, { saved: true }>['source'], name, worn };
}
// `worn` is additive like `name`: an older writer sends none (nothing worn shown); entries that are not {slot: id} strings are dropped, never trusted (the keys are sorted so equal sets compare equal).
const SLOT = /^[a-z][a-z0-9_-]{0,23}$/, LOOT_ID = /^[A-Za-z0-9._:-]{1,64}$/;
export function parseWorn(v: unknown): Worn {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([s, id]) => SLOT.test(s) && typeof id === 'string' && LOOT_ID.test(id)).sort(([a], [b]) => (a < b ? -1 : 1)));
}
// presence's refresh: only the worn set (GET /internal/location?worn=1). Any error is thrown; the caller keeps the last set.
export function writerWorn(baseUrl: string, key: string, timeoutMs = 1500, fetchImpl: typeof fetch = fetch): (account: string) => Promise<Worn> {
  return async account => {
    const res = await fetchImpl(`${baseUrl}/internal/location?account=${encodeURIComponent(account)}&worn=1`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`writer: HTTP ${res.status}`);
    return parseWorn(((await res.json()) as { worn?: unknown }).worn);
  };
}
// The join's ask. Any error (no answer in time, a refusal, a malformed body) is thrown: presence turns it into the default spawn, never a client pose.
export function writerSavedLocation(baseUrl: string, key: string, timeoutMs = 500, fetchImpl: typeof fetch = fetch): (account: string) => Promise<Served> {
  return async account => {
    const res = await fetchImpl(`${baseUrl}/internal/location?account=${encodeURIComponent(account)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`writer: HTTP ${res.status}`);
    return parseServed(await res.json());
  };
}
// The leave / checkpoint post: presence's own observation of the account.
export function writerSaveLocation(baseUrl: string, key: string, timeoutMs = 1500, fetchImpl: typeof fetch = fetch): (account: string, at: { x: number; z: number; atMs: number }) => Promise<{ character: string | null; stored: boolean }> {
  return async (account, at) => {
    const res = await fetchImpl(`${baseUrl}/internal/location`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ account, x: Math.round(at.x), z: Math.round(at.z), at: Math.round(at.atMs) }), signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`writer: HTTP ${res.status}`);
    const r = (await res.json()) as { character?: unknown; stored?: unknown };
    if ((r.character !== null && typeof r.character !== 'string') || typeof r.stored !== 'boolean') throw new Error('writer: malformed answer');
    return { character: r.character, stored: r.stored };
  };
}
