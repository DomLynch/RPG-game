// POST /origins/title_get {character}: a character's fame (0..15000), karma (-15000..15000) and the title those two earn (Characters' title rows, src/fight/title-rows.json). Storage and read only; who awards either comes later.
import { titleFor } from '../../src/fight/server.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import * as store from './store.ts';

const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/;

export const titleGet: Handler = async (ctx, body) => {
  if (typeof body.character !== 'string' || !CHARACTER.test(body.character)) throw new BadRequest('character: a character id');
  const r = await store.renownGet(ctx.db, ctx.account, body.character);
  if (r === 'absent') throw new Refused(503, 'title: fame and karma are not installed yet');
  if (r === null) throw new BadRequest('character: not one of this account\'s characters');
  return { fame: r.fame, karma: r.karma, title: titleFor(r.fame, r.karma) };
};
