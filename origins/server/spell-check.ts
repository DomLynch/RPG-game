// A record's spell block ({ id, skill }, one per record) is the client's claim; the server holds the two things that can vouch for it. The spell must be in the account's grimoire (migration 0027,
// the spell-taken ledger), and the skill the record fought with must not pass the character's stored skill in the spell's school: SKILL.base + min(placed points, banked xp / XP_PER_POINT).
// Both are read at settle, before this settle's own practice and spell lines apply (frozen the way worn gear is). A failed check is a lost record that pays nothing.
import { SHEET_SKILLS } from '../../src/fight/server.ts';
import { SPELL_SCHOOL } from '../../src/fight/boss-spells.ts';   // server code only: server.ts no longer re-exports the 700-spell catalogue (it kept it out of the entry bundle)
import type { Db } from './db.ts';
import { XP_PER_POINT } from './practice.ts';
import * as store from './store.ts';

export type SpellClaim = { readonly id: string; readonly skill: number };
export type SpellVerdict = { ok: true } | { ok: false; reason: string };
export type SpellHeld = { grimoire: Readonly<Record<string, unknown>>; xp: Readonly<Record<string, number>>; placed: Readonly<Record<string, number>> };

export function checkSpell(spell: SpellClaim, held: SpellHeld): SpellVerdict {
  const school = Object.hasOwn(SPELL_SCHOOL, spell.id) ? SPELL_SCHOOL[spell.id]! : null;
  if (school === null) return { ok: false, reason: `the record casts "${spell.id}", which is no spell` };
  if (!Object.hasOwn(held.grimoire, spell.id)) return { ok: false, reason: `the record casts "${spell.id}", which is not in this account's grimoire` };
  const row = SHEET_SKILLS.find((s) => s.id === school);
  if (!row) return { ok: false, reason: `the spell's school "${school}" is no skill row` };
  if (!Number.isInteger(spell.skill) || spell.skill < 0 || spell.skill > 100) return { ok: false, reason: 'the record\'s spell skill is a whole number from 0 to 100' };
  const stored = row.base + Math.min(Math.max(0, Math.floor(held.placed[school] ?? 0)), Math.floor((held.xp[school] ?? 0) / XP_PER_POINT));
  return spell.skill <= stored ? { ok: true } : { ok: false, reason: `the record casts at ${spell.skill}, past the ${stored} this character has in ${school}` };
}

export async function expectedSpell(db: Db, account: string, character: string, spell: SpellClaim): Promise<SpellVerdict> {
  const out = await db.run(`select json_build_object('grimoire', coalesce(public.origins_grimoire_get(:'a'::uuid)::jsonb, '{}'::jsonb), 'xp', coalesce((select json_object_agg(skill, xp) from public.origins_skill_xp where character = :'c'), '{}'::json))::text;`, { a: account, c: character });
  const held = JSON.parse(out) as { grimoire: Record<string, unknown>; xp: Record<string, number> };
  const build = await store.buildGet(db, account, character);
  return checkSpell(spell, { grimoire: held.grimoire, xp: held.xp, placed: build !== null && build !== 'absent' ? build.placed : {} });
}
