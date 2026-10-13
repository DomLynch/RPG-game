// POST /origins/skills_get {character} and /origins/skill_focus {character, skill, on}: the character's practice pool (migration 0026) beside its build: per skill the base, the ceiling the placed points set, the xp banked, the value that xp has filled,
// and the focus flag (skill_focus flips the flag: practice doubles on a focused skill). skills_get is read-only; the values are computed here from the same rows the verifier uses (skillValue), never stored.
import { SHEET_SKILLS } from '../../src/fight/server.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import { skillValue } from './practice.ts';
import * as store from './store.ts';

const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/;

export const skillsGet: Handler = async (ctx, body) => {
  if (typeof body.character !== 'string' || !CHARACTER.test(body.character)) throw new BadRequest('character: a character id');
  const build = await store.buildGet(ctx.db, ctx.account, body.character);
  if (build === 'absent') throw new Refused(503, 'skills: the build field is not installed yet');
  if (build === null) throw new BadRequest('character: not one of this account\'s characters');
  const pool = await store.skillPool(ctx.db, ctx.account, body.character);
  if (pool === 'absent') throw new Refused(503, 'skills: the practice pool is not installed yet');
  if (pool === null) throw new BadRequest('character: not one of this account\'s characters');
  return { skills: SHEET_SKILLS.map((s) => { const placed = build.placed[s.id] ?? 0, row = pool[s.id] ?? { xp: 0, focus: false }; return { skill: s.id, base: s.base, ceiling: s.base + placed, xp: row.xp, value: skillValue(s.base, placed, row.xp), focus: row.focus }; }) };
};

export const skillFocus: Handler = async (ctx, body) => {
  if (typeof body.character !== 'string' || !CHARACTER.test(body.character)) throw new BadRequest('character: a character id');
  if (typeof body.skill !== 'string' || !SHEET_SKILLS.some((s) => s.id === body.skill)) throw new BadRequest('skill: a skill row id');
  if (typeof body.on !== 'boolean') throw new BadRequest('on: true or false');
  const out = await store.skillFocus(ctx.db, ctx.account, body.character, body.skill, body.on);
  if (out === 'absent') throw new Refused(503, 'skills: the practice pool is not installed yet');
  if (out === null) throw new BadRequest('character: not one of this account\'s characters');
  return { skill: body.skill, ...out };
};
