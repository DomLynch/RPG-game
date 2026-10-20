// POST /origins/special_slots_get {character} and /origins/special_slots_set {character, slot1, slot2}: the two SPECIAL slots a signed-in character carries (migration 20261020150000), beside the page's per-device
// localStorage pick (src/core/special-equip.ts). Donor: AzerothCore character_action stores one id per button and leaves the rule to the game; here the table stores the id and THIS file is the rule.
// A slot is a skill id from the beta's `specialPick` list (career-rules.json betaCut, via inBetaSpecials: the list the record and claim judging use, so a pick the cut would refuse is never stored), or null for "not picked":
// the client then reads the row defaults (slot2Default) as the fallback. The same skill never sits in both slots. get returns what is stored (a stale pick the cut has since dropped reads as null, as equippedSpecials does).
import { inBetaSpecials } from '../../src/core/server.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import * as store from './store.ts';

const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/;
const SKILL_ID = /^[a-z][a-z0-9_]{0,31}$/;   // the shape migration 20261020150000 keeps; the pick list is the real rule
const absent = (): never => { throw new Refused(503, 'special slots: not installed yet'); };
const notYours = (): never => { throw new BadRequest('character: not one of this account\'s characters'); };
const character = (v: unknown): string => { if (typeof v !== 'string' || !CHARACTER.test(v)) throw new BadRequest('character: a character id'); return v; };
const seen = (row: store.SpecialSlotsRow): store.SpecialSlotsRow => ({ slot1: row.slot1 !== null && inBetaSpecials(row.slot1) ? row.slot1 : null, slot2: row.slot2 !== null && inBetaSpecials(row.slot2) ? row.slot2 : null });
/** A slot body field: absent or null = empty; else a skill id the cut offers. */
const slot = (v: unknown, name: string): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || !SKILL_ID.test(v)) throw new BadRequest(`${name}: a skill id, or null for none`);
  if (!inBetaSpecials(v)) throw new BadRequest(`${name}: not one of the beta's special picks`);
  return v;
};

export const specialSlotsGet: Handler = async (ctx, body) => {
  const out = await store.specialSlotsGet(ctx.db, ctx.account, character(body.character));
  if (out === 'absent') return absent();
  return out === null ? notYours() : seen(out);
};

export const specialSlotsSet: Handler = async (ctx, body) => {
  const c = character(body.character), slot1 = slot(body.slot1, 'slot1'), slot2 = slot(body.slot2, 'slot2');
  if (slot1 !== null && slot1 === slot2) throw new BadRequest('slot2: two different skills');
  const out = await store.specialSlotsSet(ctx.db, ctx.account, c, slot1, slot2);
  if (out === 'absent') return absent();
  return out === null ? notYours() : seen(out);
};
