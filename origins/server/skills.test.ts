import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { skillFocus, skillsGet } from './skills.ts';
import { skillValue } from './practice.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', PC = 'pc:one';
const fake = (o: { build?: unknown; pool?: unknown; poolMissing?: boolean; focus?: unknown } = {}): Db => ({
  async run(sql) {
    if (sql.includes('origins_get_build')) return o.build === undefined ? JSON.stringify({ level: 10, placed: { sword: 6, fire: 2 }, respreadRank: 0, version: 1 }) : JSON.stringify(o.build);
    if (sql.includes('origins_skill_pool') || sql.includes('origins_skill_focus')) { if (o.poolMissing) return 'absent'; }
    if (sql.includes('public.origins_skill_focus(')) return o.focus === undefined ? 'null' : JSON.stringify(o.focus);
    if (sql.includes('origins_skill_pool')) return o.pool === null ? 'null' : JSON.stringify(o.pool ?? {});
    if (sql.includes('to_regprocedure')) return '';
    throw Error(`unexpected sql ${sql}`);
  },
});
const get = (db: Db, body: Record<string, unknown> = { character: PC }) => skillsGet({ db, account: A }, body) as Promise<{ skills: { skill: string; base: number; ceiling: number; xp: number; value: number; focus: boolean }[] }>;

test('skillValue: base plus the points xp has filled, never past the placed points', () => {
  assert.equal(skillValue(5, 6, 0), 5); assert.equal(skillValue(5, 6, 250), 7); assert.equal(skillValue(5, 6, 99999), 11); assert.equal(skillValue(5, 0, 500), 5);
});

test('skills_get: every sheet skill, with ceiling, banked xp, filled value and focus', async () => {
  const { skills } = await get(fake({ pool: { sword: { xp: 250, focus: true }, fire: { xp: 900, focus: false } } }));
  const by = Object.fromEntries(skills.map((s) => [s.skill, s]));
  assert.deepEqual(Object.keys(by).sort(), ['axe', 'bow', 'earth', 'fire', 'frost', 'holy', 'poison', 'shadow', 'spear', 'sword', 'wind']);
  assert.equal(by.sword!.ceiling, by.sword!.base + 6); assert.equal(by.sword!.value, by.sword!.base + 2); assert.equal(by.sword!.xp, 250); assert.equal(by.sword!.focus, true);
  assert.equal(by.fire!.value, by.fire!.base + 2, 'xp past the ceiling does not lift the value');
  assert.equal(by.axe!.xp, 0); assert.equal(by.axe!.value, by.axe!.base); assert.equal(by.axe!.focus, false);
});

test('skills_get: a bad character id, a character that is not yours, and a missing pool are refused', async () => {
  await assert.rejects(get(fake(), { character: 'x' }), BadRequest);
  await assert.rejects(get(fake({ build: null })), BadRequest);
  await assert.rejects(get(fake({ poolMissing: true })), (e: unknown) => e instanceof Refused && e.status === 503);
});

test('skill_focus: flips one sheet skill, refuses a bad skill, a non-boolean, a stranger and a missing migration', async () => {
  const f = (db: Db, body: Record<string, unknown>) => skillFocus({ db, account: A }, body);
  assert.deepEqual(await f(fake({ focus: { xp: 40, focus: true } }), { character: PC, skill: 'sword', on: true }), { skill: 'sword', xp: 40, focus: true });
  await assert.rejects(f(fake(), { character: PC, skill: 'nope', on: true }), BadRequest);
  await assert.rejects(f(fake(), { character: PC, skill: 'sword', on: 'yes' }), BadRequest);
  await assert.rejects(f(fake(), { character: PC, skill: 'sword', on: true }), BadRequest);
  await assert.rejects(f(fake({ poolMissing: true }), { character: PC, skill: 'sword', on: true }), (e: unknown) => e instanceof Refused && e.status === 503);
});
