// POST /origins/grimoire_get {}: the account's spell book, one entry per legend whose spell it has taken ({legend, bricks}), sorted by legend id. Read-only; spells are taken only by the verified encounter settle.
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import * as store from './store.ts';

export const grimoireGetHandler: Handler = async (ctx) => {
  const book = await store.grimoireGet(ctx.db, ctx.account);
  if (book === 'absent') throw new Refused(503, 'grimoire: the spell book is not installed yet');
  if (book === null) throw new BadRequest('account: not allowed');
  return { spells: Object.keys(book).sort().map((legend) => ({ legend, bricks: book[legend] })) };
};
