// Origins: the client half of a server-held world creature fight (origins/server/encounter.ts, migration 202610080002). Three calls, in the order a fight lives:
//   startFight   POST /encounter_start  {character, encounter}  -> the fight to play: token, the SERVER's seed, foe, level, bar, twist flags. The body names no foe, level, seed or reward.
//   touchFight   POST /encounter_touch  {token, tick}           -> inside the 120 s reconnect grace: the same token and seed continue.
//   settleFight  POST /encounter_settle {token, record}         -> the fight's FightRecord (encounter-duel's EncounterEnd.record) packed as the Pit packs it; the server re-plays it.
// Call site (Expansion, ?worldfight): `startFight` replaces `fightSeed`: pass `fight.seed` to startEncounterDuel (and the foe/level/bar/flags it returns to fightSetup's reader), then post
// `end.record` with `settleFight` when `done` fires. A fight that ends by a twist with both standing records as 'abandoned' (pit-duel), which is what the verifier expects.
// Same contract as save.ts: no DOM, storage or clock here; any failure (no session, 4xx/5xx, a timeout, the network, a malformed reply) is an answer ({ offline }), never a throw. The preview
// then plays on its local seed and nothing is settled, exactly as today.
import { encodeRecord, type FightRecord } from '../../src/record.ts';
import { WRITER_PATH, type Offline } from './save.ts';

export type Fight = { token: string; seed: number; enemy: string; level: number; bar: number | null; flags: unknown[]; layer: string | null; startTick: number; lastTick: number; graceS: number; expiresAt: string };
// result 'draw' and event null: a world stalemate, or an unverified world record, records nothing (Dom's world-fight rule, migration 202610080013).
export type Settled = { result: 'won' | 'lost' | 'draw'; verified: boolean; twist: string | null; ticks: number; event: string | null; reason?: string };
type Opts = { base?: string; fetch?: typeof fetch; timeoutMs?: number };

const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function fightOf(r: unknown): Fight | null {
  const f = r as Partial<Fight> | null;
  if (!f || typeof f !== 'object' || typeof f.token !== 'string' || !int(f.seed) || typeof f.enemy !== 'string' || !int(f.level) || !Array.isArray(f.flags)) return null;
  if (!(f.bar === null || int(f.bar)) || !(f.layer === null || typeof f.layer === 'string') || !int(f.startTick) || !int(f.lastTick) || !int(f.graceS) || typeof f.expiresAt !== 'string') return null;
  return { token: f.token, seed: f.seed, enemy: f.enemy, level: f.level, bar: f.bar, flags: f.flags, layer: f.layer, startTick: f.startTick, lastTick: f.lastTick, graceS: f.graceS, expiresAt: f.expiresAt };
}
export function settledOf(r: unknown): Settled | null {
  const s = r as Partial<Settled> | null;
  if (!s || typeof s !== 'object' || (s.result !== 'won' && s.result !== 'lost' && s.result !== 'draw') || typeof s.verified !== 'boolean' || !int(s.ticks) || !(s.event === null || typeof s.event === 'string')) return null;
  return { result: s.result, verified: s.verified, twist: typeof s.twist === 'string' ? s.twist : null, ticks: s.ticks, event: s.event, ...(typeof s.reason === 'string' ? { reason: s.reason } : {}) };
}

// One op. Never rejects: whatever goes wrong comes back as { offline: reason } within `timeoutMs`, even if the fetch ignores its signal.
async function call<T>(op: string, body: object, token: string | null, read: (result: unknown) => T | null, opts: Opts): Promise<T | Offline> {
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

export const startFight = (token: string | null, character: string, encounter: string, opts: Opts & { tick?: number } = {}) =>
  call('encounter_start', { character, encounter, ...(opts.tick === undefined ? {} : { tick: opts.tick }) }, token, fightOf, opts);
export const touchFight = (token: string | null, fight: string, tick: number, opts: Opts = {}) => call('encounter_touch', { token: fight, tick }, token, fightOf, opts);
// `record` is the FightRecord the Pit's recorder made (no repack: encodeRecord is the same gzip + base64url the server's decodeRecord reads). An unencodable record is an answer too.
export async function settleFight(token: string | null, fight: string, record: FightRecord, opts: Opts = {}): Promise<Settled | Offline> {
  let packed: string;
  try { packed = await encodeRecord(record); } catch { return { offline: 'bad-record' }; }
  return call('encounter_settle', { token: fight, record: packed }, token, settledOf, opts);
}
