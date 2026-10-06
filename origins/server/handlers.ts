// The op registry. Each handler gets the account the token proved and a parsed JSON body, and returns the JSON the client sees. Later PRs
// (inventory, quest journal, talk) plug their ops into `handlers`; nothing here lets a client name an account, a reward or an amount.
import { creditFromMarks } from '../progression/model.ts';
import { pitBatch } from './career.ts';
import { DbError, type Db } from './db.ts';
import * as store from './store.ts';

export type Ctx = { db: Db; account: string };
export type Handler = (ctx: Ctx, body: store.Json) => Promise<unknown>;
export class BadRequest extends Error {}

const MAX_PENDING = 50;   // one open settles at most this many Pit claims; the rest wait for the next open

// Snapshot the account's Pit credit once, then pay every verified Pit win the snapshot did not already count. Returns the fresh snapshot.
export async function openAccount(ctx: Ctx): Promise<store.Snapshot> {
  const { db, account } = ctx;
  let snap = await store.open(db, account);
  if (snap.career === null) {
    try { await store.snapshot(db, account, snap.marks, creditFromMarks(snap.marks)); }
    catch (e) { if (!(e instanceof DbError && e.code === 'O0002')) throw e; }   // marks moved under us: read them again below
    snap = await store.open(db, account);
    if (snap.career === null) throw new DbError('O0002', 'marks moved: open again');
  }
  for (const claim of (await store.pitPending(db, account)).slice(0, MAX_PENDING)) {
    const { batch } = pitBatch(account, snap.career!, claim);
    try { await store.commit(db, account, batch); }
    catch (e) { if (!(e instanceof DbError && e.code === 'O0001')) throw e; }   // already paid by a concurrent open: the event id is the lock
    snap = await store.open(db, account);
  }
  return snap;
}

const open: Handler = async ctx => openAccount(ctx);

const createCharacter: Handler = async (ctx, body) => {
  const name = body.name;
  if (typeof name !== 'string' || [...name].length < 1 || [...name].length > 32 || name !== name.trim() || /\p{Cc}/u.test(name)) throw new BadRequest('name: 1 to 32 characters, trimmed, no control characters');
  return { id: await store.createCharacter(ctx.db, ctx.account, name) };
};

export const handlers: Record<string, Handler> = { open, create_character: createCharacter };
