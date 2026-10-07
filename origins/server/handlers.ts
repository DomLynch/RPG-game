// The op registry. Each handler gets the account the token proved and a parsed JSON body, and returns the JSON the client sees. Later PRs
// (inventory, quest journal, talk) plug their ops into `handlers`; nothing here lets a client name an account, a reward or an amount.
import { creditFromMarks } from '../progression/model.ts';
import { pitBatch } from './career.ts';
import { consumeHandler } from './consume.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict } from './errors.ts';
import type { Content } from './holdings.ts';
import { questAdvance } from './quest-advance.ts';
import type { StoryContent } from './story.ts';
import * as store from './store.ts';
import { talkPick } from './talk-pick.ts';
import { upgradeHandler } from './upgrade.ts';

export type Ctx = { db: Db; account: string };
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

const open: Handler = async ctx => openAccount(ctx);

const createCharacter: Handler = async (ctx, body) => {
  const name = body.name;
  if (typeof name !== 'string' || [...name].length < 1 || [...name].length > 32 || name !== name.trim() || /\p{Cc}/u.test(name)) throw new BadRequest('name: 1 to 32 characters, trimmed, no control characters');
  return { id: await store.createCharacter(ctx.db, ctx.account, name) };
};

// quest_advance and talk_pick run on the story content. The entry point (scripts/origins-writer.mjs) loads it once from the bundle
// ORIGINS_CONTENT names and passes storyOps(content) in; nothing here reads the env or a file. With none loaded both answer 503: the writer
// is up but not ready for them, which is what the defaults below serve.
export const storyOps = (content: StoryContent | null): Record<string, Handler> => ({ quest_advance: questAdvance(content), talk_pick: talkPick(content) });
export const handlers: Record<string, Handler> = { open, create_character: createCharacter, ...storyOps(null) };

// The item ops need the content (item definitions) the pure rules read; the writer is built with it. Nothing in a body names a definition.
export const withContent = (items: Content): Record<string, Handler> => ({ ...handlers, consume: consumeHandler(items), apply_upgrade: upgradeHandler(items) });
