// The op registry. Each handler gets the account the token proved and a parsed JSON body, and returns the JSON the client sees. Later PRs
// (inventory, quest journal, talk) plug their ops into `handlers`; nothing here lets a client name an account, a reward or an amount.
import { creditFromMarks } from '../progression/model.ts';
import { pitBatch } from './career.ts';
import { consumeHandler } from './consume.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict, Refused } from './errors.ts';
import type { Content } from './holdings.ts';
import type { WhereFn } from '../presence/where.ts';
import { questAdvance } from './quest-advance.ts';
import type { StoryContent } from './story.ts';
import * as store from './store.ts';
import { talkPick } from './talk-pick.ts';
import { shopBuyHandler } from './shop-buy.ts';
import { upgradeHandler } from './upgrade.ts';

// `where` asks presence where the account stands (X1: the only source of a player's place); a handler without it treats the player as nowhere.
export type Ctx = { db: Db; account: string; where?: WhereFn };
export type Handler = (ctx: Ctx, body: store.Json) => Promise<unknown>;
export { BadRequest, Conflict };

const MAX_PENDING = 50;   // one open settles at most this many Pit claims; the rest wait for the next open

// Snapshot the account's Pit credit once, then pay every verified Pit win the snapshot did not already count. Returns the fresh snapshot.
export async function openAccount(ctx: Ctx): Promise<store.Snapshot> {
  const { db, account } = ctx;
  let { snap, pending } = await store.openWithPending(db, account, MAX_PENDING);
  if (snap.career === null) {
    try { await store.snapshot(db, account, snap.marks, creditFromMarks(snap.marks)); }
    catch (e) { if (!(e instanceof DbError && e.code === 'O0002')) throw e; }   // marks moved under us: read them again below
    ({ snap, pending } = await store.openWithPending(db, account, MAX_PENDING));
    if (snap.career === null) throw new DbError('O0002', 'marks moved: open again');
  }
  // One spawn per claim (the commit and the re-read together), not two: an open costs 1 + pending psql processes, at most 1 + MAX_PENDING.
  for (const claim of pending) {
    const { batch } = pitBatch(account, snap.career!, claim);
    try { snap = await store.commitThenOpen(db, account, batch); }
    catch (e) {
      if (!(e instanceof DbError && e.code === 'O0001')) throw e;   // already paid by a concurrent open: the event id is the lock
      snap = await store.open(db, account);
    }
  }
  return snap;
}

// The first open of an account makes its first character (Lead's ruling 2026-10-09, #1837's follow-up): no page code creates one, so without this a signed-in player had characterId null and
// no kill, loot, bronze or gear could persist (prod had 0 characters). Idempotent: an account with a character is returned as it is. The name is `Wanderer <first 6 of the account id>`; on a
// unique-name clash (a racing open made it first) the account is re-read, and only if it still has none is the name retried with 8 and then the full id, so this can never fail the open.
// create_character makes the new one active. The serial write queue (#1833) runs one account's opens in turn; the clash handling is the backstop when it does not.
export async function withFirstCharacter(ctx: Ctx, snap: store.Snapshot): Promise<store.Snapshot> {
  if (snap.characters.length > 0) return snap;
  const id = ctx.account.replace(/-/g, '');
  for (const n of [6, 8, id.length]) {
    try { await store.createActiveCharacter(ctx.db, ctx.account, `Wanderer ${id.slice(0, n)}`); break; }
    catch (e) {
      if (!(e instanceof DbError && e.code === '23505')) throw e;
      const again = await store.open(ctx.db, ctx.account);
      if (again.characters.length > 0) return again;
    }
  }
  return store.open(ctx.db, ctx.account);
}

// The active character (X2 Stage 2, Lead's ruling: ONE per account, set in the writer). `open {character}` makes one of the account's own characters the
// active one before the snapshot; open without it leaves the active character as it was. create_character makes the new character active. Presence keys by
// account and never sees a character id: the writer maps account -> active character when it stores and serves the saved location (location.ts).
const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/;
const open: Handler = async (ctx, body) => {
  if (body.character !== undefined) {
    if (typeof body.character !== 'string' || !CHARACTER.test(body.character)) throw new BadRequest('character: a character id');
    const set = await store.setActive(ctx.db, ctx.account, body.character);
    if (set === 'absent') throw new Refused(503, 'character: choosing a character is not installed yet');   // 0009 not applied: the writer is up, the table is not
    if (!set) throw new BadRequest('character: not one of this account\'s characters');
  }
  // The bronze balance rides on open (save end to end: a reload shows the bronze a kill paid). null = the metals read (0004) is not installed.
  const [snap, metal] = [await withFirstCharacter(ctx, await openAccount(ctx)), await store.metalOf(ctx.db, ctx.account)];
  return { ...snap, bronze: metal === 'absent' ? null : (metal?.bronze ?? 0) };
};

const createCharacter: Handler = async (ctx, body) => {
  const name = body.name;
  if (typeof name !== 'string' || [...name].length < 1 || [...name].length > 32 || name !== name.trim() || /\p{Cc}/u.test(name)) throw new BadRequest('name: 1 to 32 characters, trimmed, no control characters');
  return { id: await store.createActiveCharacter(ctx.db, ctx.account, name) };
};

// quest_advance and talk_pick run on the story content. The entry point (scripts/origins-writer.mjs) loads it once from the bundle
// ORIGINS_CONTENT names and passes storyOps(content) in; nothing here reads the env or a file. With none loaded both answer 503: the writer
// is up but not ready for them, which is what the defaults below serve.
export const storyOps = (content: StoryContent | null): Record<string, Handler> => ({ quest_advance: questAdvance(content), talk_pick: talkPick(content) });
export const handlers: Record<string, Handler> = { open, create_character: createCharacter, ...storyOps(null) };

// The item ops need the content (item definitions) the pure rules read; the writer is built with it. Nothing in a body names a definition.
export const withContent = (items: Content): Record<string, Handler> => ({ ...handlers, consume: consumeHandler(items), apply_upgrade: upgradeHandler(items), shop_buy: shopBuyHandler(items, items.shops ?? new Map()) });
