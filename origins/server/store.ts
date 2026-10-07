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
// One stored event of this account, or null (another account's id, an unknown id, an account that is not open: migration 202610060002).
export const event = async (db: Db, account: string, id: string): Promise<Json | null> =>
  JSON.parse((await db.run(`select coalesce(public.origins_event(:'a'::uuid, :'e')::text, 'null');`, { a: acct(account), e: id })) || 'null');

// X2 Stage 2 (migration 202610070009): one ACTIVE character per account, and the saved location presence reports for it.
// create_character makes the new character active in the same transaction (psql \gset carries the id into the second statement; ON_ERROR_STOP aborts both).
export const createActiveCharacter = (db: Db, account: string, name: string): Promise<string> =>
  db.run(`begin;\nselect public.origins_create_character(:'a'::uuid, :'n') as cid \\gset\nselect :'cid' where public.origins_set_active(:'a'::uuid, :'cid');\ncommit;`, { a: acct(account), n: name });
// False when the character is not this account's (nothing written).
export const setActive = async (db: Db, account: string, character: string): Promise<boolean> =>
  (await db.run(`select public.origins_set_active(:'a'::uuid, :'c');`, { a: acct(account), c: character })) === 't';
export const active = async (db: Db, account: string): Promise<string | null> =>
  (await db.run(`select coalesce(public.origins_active(:'a'::uuid), '');`, { a: acct(account) })) || null;
export type SavedRow = { character: string; zone: string | null; x: number; z: number; updated_at: string };
export const saveLocation = async (db: Db, account: string, at: { x: number; z: number; zone: string | null; atMs: number }): Promise<{ character: string | null; stored: boolean }> =>
  JSON.parse(await db.run(`select public.origins_save_location(:'a'::uuid, :'x'::int, :'z'::int, nullif(:'zone', ''), :'t'::bigint)::text;`,
    { a: acct(account), x: String(at.x), z: String(at.z), zone: at.zone ?? '', t: String(at.atMs) }));
export const savedLocation = async (db: Db, account: string): Promise<SavedRow | null> =>
  JSON.parse((await db.run(`select coalesce(public.origins_saved_location(:'a'::uuid)::text, 'null');`, { a: acct(account) })) || 'null');
