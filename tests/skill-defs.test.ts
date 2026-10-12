// Skills as data (core slice 5): src/fight/skill-defs.json through skills.ts. The rows must be exactly what the code tables they replaced said (record byte order, move ids, names, who offers what),
// and the loader must refuse a bad table at load. A new skill is ONE row plus its MoveDef verb.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSkillDefs } from '../src/fight/skills.ts';
import { DAY_ONE_SKILL, MOVES, SKILL_BY_CODE, SKILL_MOVE, SKILL_ROWS, isSkillId, skillOfMove } from '../src/fight/moves.ts';
import { SKILLS, skillOf } from '../src/core/loot.ts';

const raw = JSON.parse(readFileSync(new URL('../src/fight/skill-defs.json', import.meta.url), 'utf8')) as { skills: Record<string, unknown>[] };
const ROW = { id: 'x', code: 12, move: 'skill_x', name: 'X', opponent: null, clip: 'light' };

test('the rows are what the code tables said: record byte order, moves, names and who offers them', () => {
  assert.deepEqual([...SKILL_BY_CODE], [null, 'witchfire', 'pommel', 'lunge', 'reaping', 'shove', 'jab', 'cleave', 'stomp', 'miasma', 'ironrush', 'hewer']);
  for (const id of SKILL_BY_CODE.slice(1) as string[]) assert.equal(SKILL_MOVE[id], `skill_${id}`);
  assert.deepEqual(Object.fromEntries(Object.entries(SKILLS).map(([id, s]) => [id, [s.opponent, s.name]])), {
    witchfire: ['witch', 'Witch-fire'], pommel: [null, 'Pommel Strike'], lunge: ['nightborn', 'Estoc Lunge'], reaping: ['executioner', 'Reaping Blow'], shove: ['veteran', 'Scutum Shove'], jab: ['goblin', 'Dirty Jab'],
    cleave: ['pitborn', "Butcher's Cleave"], stomp: ['dwarf', 'Anvil Stomp'], miasma: ['plaguedoctor', 'Miasma'], ironrush: ['knight', 'Iron Rush'], hewer: ['shieldmaiden', 'Shield-Hewer'] });
  assert.equal(DAY_ONE_SKILL, 'pommel');
  assert.equal(skillOf('witch'), 'witchfire'); assert.equal(skillOf('minotaur'), null);
  assert.ok(isSkillId('shove') && !isSkillId('fireball') && !isSkillId('constructor'));
  assert.equal(skillOfMove('skill_miasma'), 'miasma'); assert.equal(skillOfMove('thrust'), null);
  assert.deepEqual(Object.values(SKILL_ROWS).filter((r) => r.tell).map((r) => r.id), ['pommel']);
});
test('adding a skill is one row: a test row loads, takes the next record byte and resolves', () => {
  const t = loadSkillDefs({ skills: [...raw.skills, ROW] }, { ...MOVES, skill_x: {} });
  assert.deepEqual(t.byCode.slice(-2), ['hewer', 'x']); assert.equal(t.rows.x!.move, 'skill_x');
});
test('the loader refuses a bad table at load', () => {
  const ok = raw.skills, load = (rows: unknown[], moves: object = { ...MOVES, skill_x: {} }) => loadSkillDefs({ skills: rows }, moves);
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { ...ROW, id: 'pommel' }]), /duplicate-id/);
  assert.throws(() => load([...ok, { ...ROW, code: undefined }]), /missing-field: code is required/);
  assert.throws(() => load([...ok, ROW], MOVES), /is no move in moves.ts MOVES/);
  assert.throws(() => load([...ok, { ...ROW, move: 'skill_y' }], { ...MOVES, skill_y: {} }), /move is skill_<id>/);
  assert.throws(() => load([...ok, { ...ROW, code: 2 }]), /code 2 is not a free number/);
  assert.throws(() => load([...ok, { ...ROW, code: 14 }]), /no gap/);
  assert.throws(() => load([...ok, { ...ROW, clip: 'slow' }]), /clip is heavy, thrust or light/);
  assert.throws(() => load(ok.map((r) => ({ ...r, dayOne: undefined }))), /exactly one row is the dayOne/);
  assert.throws(() => load([...ok, { ...ROW, dayOne: true }]), /exactly one row is the dayOne/);
});
