// Typed calls into the migration's functions. Every one takes the account the token proved; the database re-checks the allowlist and the flag.
import type { Db } from './db.ts';

export type Json = Record<string, unknown>;
export type CareerRow = {
  seed_credit: number; world_credit: number; total_credit: number; rested: number; rested_at: number;
  heat: Json; beaten: string[]; story: string[]; version: number;
};
export type Snapshot = { marks: number; career: CareerRow | null; characters: Json[]; items: Json[]; quests: Json[]; journal: Json[]; talk: Json[] };
export type PitClaim = { claim_id: number; opponent: string; record: string; piece: string | null; tier: number | null; at: string };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const acct = (a: string): string => { if (!UUID.test(a)) throw Error(`malformed account id: ${JSON.stringify(a)}`); return a; };

export const open = async (db: Db, account: string): Promise<Snapshot> =>
  JSON.parse(await db.run(`select public.origins_open(:'a'::uuid)::text;`, { a: acct(account) }));
export const snapshot = (db: Db, account: string, marks: number, credit: number): Promise<string> =>
  db.run(`select public.origins_snapshot(:'a'::uuid, :'m'::int, :'c'::bigint);`, { a: acct(account), m: String(marks), c: String(credit) });
export const createCharacter = (db: Db, account: string, name: string): Promise<string> =>
  db.run(`select public.origins_create_character(:'a'::uuid, :'n');`, { a: acct(account), n: name });
export const pitPending = async (db: Db, account: string): Promise<PitClaim[]> =>
  JSON.parse(await db.run(`select coalesce(json_agg(p), '[]')::text from public.origins_pit_pending(:'a'::uuid) p;`, { a: acct(account) }));
// One spawn answers both halves of a step (statements run in order, ON_ERROR_STOP, so a refusal in the first throws before the second runs).
// The pending list is cut in SQL at `limit`, and built as jsonb: json_agg puts newlines between rows, which would split the two answers.
const pendingSql = `select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)::text from (select * from public.origins_pit_pending(:'a'::uuid) limit :'n'::int) p;`;
const lines = (out: string): [string, string] => { const [a, b, ...rest] = out.split('\n'); if (b === undefined || rest.length) throw Error('expected two answers from one statement pair'); return [a, b]; };
export const openWithPending = async (db: Db, account: string, limit: number): Promise<{ snap: Snapshot; pending: PitClaim[] }> => {
  const [snap, pending] = lines(await db.run(`select public.origins_open(:'a'::uuid)::text; ${pendingSql}`, { a: acct(account), n: String(limit) }));
  return { snap: JSON.parse(snap), pending: JSON.parse(pending) };
};
export const commitThenOpen = async (db: Db, account: string, batch: readonly Json[]): Promise<Snapshot> =>
  JSON.parse(lines(await db.run(`select public.origins_commit(:'a'::uuid, :'b'::jsonb)::text; select public.origins_open(:'a'::uuid)::text;`, { a: acct(account), b: JSON.stringify(batch) }))[1]);
export const commit = async (db: Db, account: string, batch: readonly Json[]): Promise<Json[]> =>
  JSON.parse(await db.run(`select public.origins_commit(:'a'::uuid, :'b'::jsonb)::text;`, { a: acct(account), b: JSON.stringify(batch) }));
// A shop shelf (migration 202610080012): the newest shelf this account's buys of one item left, {count, at} or null (a full shelf), and the database
// clock in ms. 'absent' when the migration is not applied: the shop then sells nothing (fail closed).
export type ShopShelf = { now: number; stock: { count: number; at: number } | null };
const HAS_SHOP_STOCK = `select to_regprocedure('public.origins_shop_stock(uuid,text,text)') is not null as shopstock \\gset\n`;
export const shopStock = async (db: Db, account: string, shop: string, item: string): Promise<ShopShelf | 'absent'> => {
  const out = await db.run(`${HAS_SHOP_STOCK}\\if :shopstock\nselect public.origins_shop_stock(:'a'::uuid, :'s', :'i')::text;\n\\else\nselect 'absent';\n\\endif\n`, { a: acct(account), s: shop, i: item });
  return out === 'absent' ? 'absent' : JSON.parse(out);
};

// One stored event of this account, or null (another account's id, an unknown id, an account that is not open: migration 202610060002).
export const event = async (db: Db, account: string, id: string): Promise<Json | null> =>
  JSON.parse((await db.run(`select coalesce(public.origins_event(:'a'::uuid, :'e')::text, 'null');`, { a: acct(account), e: id })) || 'null');

// X2 Stage 2 (migration 202610070009): one ACTIVE character per account, and the saved location presence reports for it.
// Fail-safe on order (Auditor/Lead, 2026-10-07): each call checks in the same psql run that 0009 is applied, so merged code on a database without
// 0009 (or after its down-script) still creates characters; it just sets no active one. No cache: the check costs no extra round trip.
const HAS_X2 = `select to_regprocedure('public.origins_set_active(uuid,text)') is not null as x2 \\gset\n`;
// create_character makes the new character active in the same transaction (psql \gset carries the id into the second statement; ON_ERROR_STOP aborts both).
export const createActiveCharacter = (db: Db, account: string, name: string): Promise<string> =>
  db.run(`begin;\nselect public.origins_create_character(:'a'::uuid, :'n') as cid \\gset\n${HAS_X2}\\if :x2\nselect :'cid' where public.origins_set_active(:'a'::uuid, :'cid');\n\\else\nselect :'cid';\n\\endif\ncommit;`, { a: acct(account), n: name });
// False when the character is not this account's (nothing written); 'absent' when 0009 is not applied.
export const setActive = async (db: Db, account: string, character: string): Promise<boolean | 'absent'> => {
  const out = await db.run(`${HAS_X2}\\if :x2\nselect public.origins_set_active(:'a'::uuid, :'c');\n\\else\nselect 'absent';\n\\endif\n`, { a: acct(account), c: character });
  return out === 'absent' ? 'absent' : out === 't';
};
export const active = async (db: Db, account: string): Promise<string | null> =>
  (await db.run(`select coalesce(public.origins_active(:'a'::uuid), '');`, { a: acct(account) })) || null;
export type SavedRow = { character: string; zone: string | null; x: number; z: number; updated_at: string };
export const saveLocation = async (db: Db, account: string, at: { x: number; z: number; zone: string | null; atMs: number }): Promise<{ character: string | null; stored: boolean }> =>
  JSON.parse(await db.run(`select public.origins_save_location(:'a'::uuid, :'x'::int, :'z'::int, nullif(:'zone', ''), :'t'::bigint)::text;`,
    { a: acct(account), x: String(at.x), z: String(at.z), zone: at.zone ?? '', t: String(at.atMs) }));
export const savedLocation = async (db: Db, account: string): Promise<SavedRow | null> =>
  JSON.parse((await db.run(`select coalesce(public.origins_saved_location(:'a'::uuid)::text, 'null');`, { a: acct(account) })) || 'null');

// The account's bound-metal row (migration 202610080004): {bronze, version}, null when it has none yet, 'absent' when 0004 is not applied (then nothing pays
// bronze: the `metal` op could not be versioned). Same fail-safe as X2: merged code on a database without the function still settles, without bronze.
export type MetalRow = { bronze: number; version: number };
const HAS_METAL_OF = `select to_regprocedure('public.origins_metal_of(uuid)') is not null as metalof \\gset\n`;
export const metalOf = async (db: Db, account: string): Promise<MetalRow | null | 'absent'> => {
  const out = await db.run(`${HAS_METAL_OF}\\if :metalof\nselect coalesce(public.origins_metal_of(:'a'::uuid)::text, 'null');\n\\else\nselect 'absent';\n\\endif\n`, { a: acct(account) });
  return out === 'absent' ? 'absent' : JSON.parse(out);
};

// The respawn window (migration 202610080006): milliseconds since this account's last PAID kill of a fight, on the database clock; null when none.
// 'absent' when the migration is not applied: the hook then pays nothing (fail closed), the fight is still recorded.
const HAS_LAST_PAID = `select to_regprocedure('public.origins_last_paid_kill(uuid,text)') is not null as lastpaid \\gset\n`;
export const lastPaidKill = async (db: Db, account: string, fight: string): Promise<number | null | 'absent'> => {
  const out = await db.run(`${HAS_LAST_PAID}\\if :lastpaid\nselect coalesce(public.origins_last_paid_kill(:'a'::uuid, :'f')::text, 'null');\n\\else\nselect 'absent';\n\\endif\n`, { a: acct(account), f: fight });
  return out === 'absent' ? 'absent' : JSON.parse(out);
};

// World creature fights (migration 202610080002): the parameters the server holds for a fight and its lifecycle. Every call answers `null` when the migration is not applied (the
// writer maps that to a 503), so merged code on a database without it fails closed instead of 500ing.
export type EncounterRun = {
  token: string; character: string; seed: number; enemy: string; level: number; expires_at: string; used: boolean; start_tick: number; last_tick: number;
  bar: number | null; flags: Json[]; layer: string | null; instance: string | null; grace_s: number; settled: boolean; result: string | null;
};
const HAS_ENCOUNTERS = `select to_regprocedure('public.origins_encounter_start(uuid,text,text,bigint,text,integer,integer,integer,jsonb,text,text)') is not null as enc \\gset\n`;
const encounterCall = async (db: Db, call: string, vars: Record<string, string>): Promise<string | null> => {
  const out = await db.run(`${HAS_ENCOUNTERS}\\if :enc\nselect ${call}::text;\n\\else\nselect 'absent';\n\\endif\n`, vars);
  return out === 'absent' ? null : out;
};
export type EncounterStart = { token: string; seed: number; enemy: string; level: number; tick: number; bar: number | null; flags: readonly Json[]; layer: string | null; instance: string | null };
export const encounterStart = async (db: Db, account: string, character: string, e: EncounterStart): Promise<EncounterRun | null> => {
  const out = await encounterCall(db, `public.origins_encounter_start(:'a'::uuid, :'c', :'t', :'s'::bigint, :'e', :'l'::int, :'k'::int, nullif(:'b', '')::int, :'f'::jsonb, nullif(:'y', ''), nullif(:'i', ''))`,
    { a: acct(account), c: character, t: e.token, s: String(e.seed), e: e.enemy, l: String(e.level), k: String(e.tick), b: e.bar === null ? '' : String(e.bar), f: JSON.stringify(e.flags), y: e.layer ?? '', i: e.instance ?? '' });
  return out === null ? null : JSON.parse(out);
};
export const encounterGet = async (db: Db, account: string, token: string): Promise<EncounterRun | 'none' | null> => {
  const out = await encounterCall(db, `coalesce(public.origins_encounter_get(:'a'::uuid, :'t'), 'null'::jsonb)`, { a: acct(account), t: token });
  return out === null ? null : out === 'null' ? 'none' : JSON.parse(out);
};
export const encounterTouch = async (db: Db, account: string, token: string, tick: number): Promise<EncounterRun | null> => {
  const out = await encounterCall(db, `public.origins_encounter_touch(:'a'::uuid, :'t', :'k'::int)`, { a: acct(account), t: token, k: String(tick) });
  return out === null ? null : JSON.parse(out);
};
// Consume the token, close the run, release the creature and apply the batch (event enc:<token> and any reward lines) in ONE transaction.
export const encounterSettle = async (db: Db, account: string, token: string, result: 'won' | 'lost', ticks: number, batch: readonly Json[]): Promise<Json | null> => {
  const out = await encounterCall(db, `public.origins_encounter_settle(:'a'::uuid, :'t', :'r', :'k'::int, :'b'::jsonb)`, { a: acct(account), t: token, r: result, k: String(ticks), b: JSON.stringify(batch) });
  return out === null ? null : JSON.parse(out);
};
// The sweep (a loss by abandonment for every fight past its grace); how many it settled, null when the migration is not applied.
export const encounterExpire = async (db: Db, limit: number): Promise<number | null> => {
  const out = await encounterCall(db, `public.origins_encounter_expire(:'n'::int)`, { n: String(limit) });
  return out === null ? null : Number(out);
};

// Zone 1 world spawns (migration 202610080014): the server owns each creature's life. Every call answers `null` when the migration is not applied (the writer maps that to a 503).
const HAS_SPAWNS = `select to_regprocedure('public.origins_spawn_kill(uuid,text,integer,integer,jsonb)') is not null as spawns \\gset\n`;
const spawnCall = async (db: Db, call: string, vars: Record<string, string>): Promise<string | null> => {
  const out = await db.run(`${HAS_SPAWNS}\\if :spawns\nselect ${call}::text;\n\\else\nselect 'absent';\n\\endif\n`, vars);
  return out === 'absent' ? null : out;
};
export type SpawnRow = { instance: string; kind: string; alive: boolean; respawnAt: string | null; generation: number };
export type SpawnEngage = { token: string; character: string; instance: string; generation: number; issuedAt: string; expiresAt: string };
export type SpawnRefusal = { refused?: string; respawnAt?: string | null };
export const spawnState = async (db: Db, instances: readonly string[]): Promise<{ now: string; spawns: SpawnRow[] } | null> => {
  const out = await spawnCall(db, `public.origins_spawn_state(array(select jsonb_array_elements_text(:'i'::jsonb)))`, { i: JSON.stringify(instances) });
  return out === null ? null : JSON.parse(out);
};
export const spawnEngage = async (db: Db, account: string, character: string, token: string, instance: string, kind: string): Promise<(SpawnEngage & SpawnRefusal) | null> => {
  const out = await spawnCall(db, `public.origins_spawn_engage(:'a'::uuid, :'c', :'t', :'i', :'k')`, { a: acct(account), c: character, t: token, i: instance, k: kind });
  return out === null ? null : JSON.parse(out);
};
export const spawnEngageGet = async (db: Db, account: string, token: string): Promise<SpawnEngage | 'none' | null> => {
  const out = await spawnCall(db, `coalesce(public.origins_spawn_engage_get(:'a'::uuid, :'t'), 'null'::jsonb)`, { a: acct(account), t: token });
  return out === null ? null : out === 'null' ? 'none' : JSON.parse(out);
};
export const spawnTouch = async (db: Db, account: string, token: string): Promise<{ token: string; expiresAt: string } | null> => {
  const out = await spawnCall(db, `public.origins_spawn_touch(:'a'::uuid, :'t')`, { a: acct(account), t: token });
  return out === null ? null : JSON.parse(out);
};
// The kill report: consume the token, mark the spawn dead until now() + respawnS, apply the batch (the kill event and its reward lines) in ONE transaction, or a refusal that wrote nothing.
export const spawnKill = async (db: Db, account: string, token: string, minMs: number, respawnS: number, batch: readonly Json[]): Promise<({ result?: string; instance?: string; respawnAt?: string } & SpawnRefusal) | null> => {
  const out = await spawnCall(db, `public.origins_spawn_kill(:'a'::uuid, :'t', :'m'::int, :'r'::int, :'b'::jsonb)`, { a: acct(account), t: token, m: String(minMs), r: String(respawnS), b: JSON.stringify(batch) });
  return out === null ? null : JSON.parse(out);
};
