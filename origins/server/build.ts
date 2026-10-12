// POST /origins/build_get {character} and /origins/build_set {character, placed, version}: a character's BUILD (programme 2a, locked): its level (1-50) and where each point went, on any dial or skill id.
// EVERY save runs the shared validateBuild (rows decide ids, bases, caps and the budget: one point a level); this file has no checks of its own on those. What it adds is the re-spread rule:
// taking points off anything is free until level 10, then once per rank-up (rank = level / 10, the stored respreadRank is the last one used). Spending unspent points is always free.
// The level is the server's (levelSet), never the client's.
import { validateBuild } from '../../src/fight/sheet-rows.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import * as store from './store.ts';

export const FREE_RESPREAD_LEVEL = 10, RANK_LEVELS = 10;
const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/;

// The ONE seam to the shared validator: the problems with this level + placement, [] when legal.
export const problemsOf = (level: number, placed: Readonly<Record<string, number>>): string[] => validateBuild({ level, placed });

const character = (v: unknown): string => {
  if (typeof v !== 'string' || !CHARACTER.test(v)) throw new BadRequest('character: a character id');
  return v;
};
const absent = (): never => { throw new Refused(503, 'build: the build field is not installed yet'); };
const notYours = (): never => { throw new BadRequest('character: not one of this account\'s characters'); };

export const buildGet: Handler = async (ctx, body) => {
  const row = await store.buildGet(ctx.db, ctx.account, character(body.character));
  if (row === 'absent') return absent();
  return row ?? notYours();
};

export const buildSet: Handler = async (ctx, body) => {
  const c = character(body.character);
  if (typeof body.placed !== 'object' || body.placed === null || Array.isArray(body.placed)) throw new BadRequest('placed: an object of points per dial or skill id');
  if (!Number.isInteger(body.version) || (body.version as number) < 0) throw new BadRequest('version: the version build_get gave');
  const cur = await store.buildGet(ctx.db, ctx.account, c);
  if (cur === 'absent') return absent();
  if (cur === null) return notYours();
  const placed: Record<string, number> = {};
  for (const [id, n] of Object.entries(body.placed)) {
    if (typeof n !== 'number') throw new BadRequest(`placed.${id}: a whole number`);
    if (n !== 0) placed[id] = n;
  }
  const problems = problemsOf(cur.level, placed);
  if (problems.length) throw new BadRequest(`placed: ${problems.join('; ')}`);
  const took = Object.keys({ ...cur.placed, ...placed }).some(id => (placed[id] ?? 0) < (cur.placed[id] ?? 0));
  const rank = Math.floor(cur.level / RANK_LEVELS);
  let respreadRank = cur.respreadRank;
  if (took && cur.level > FREE_RESPREAD_LEVEL) {
    if (cur.respreadRank >= rank) throw new Refused(409, 'placed: the re-spread for this rank is spent; the next one comes at the next rank-up', 'respread-spent');
    respreadRank = rank;
  }
  const out = await store.buildSet(ctx.db, ctx.account, c, placed, respreadRank, body.version as number);
  if (out === 'absent') return absent();
  if (out === null) return notYours();
  if (out.conflict) throw new Refused(409, 'version: the build moved, read it again', 'moved');
  return out;
};
