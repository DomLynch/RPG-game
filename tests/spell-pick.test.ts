// The client's spell pick (src/fight/spell-pick.ts): rows only, owned only, the skill from the character's value in the spell's school.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickSpell, schoolOfSpell } from '../src/fight/spell-pick.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { SHEET_SKILLS } from '../src/fight/sheet-rows.ts';

const id = SPELL_IDS[0]!, school = schoolOfSpell(id)!, row = SHEET_SKILLS.find((s) => s.id === school)!;
test('every spell id names a school that is a sheet skill row', () => {
  for (const s of SPELL_IDS) assert.ok(SHEET_SKILLS.some((r) => r.id === schoolOfSpell(s)), s);
});
test('no pick unless the spell is a row, equipped and owned', () => {
  assert.equal(pickSpell(undefined, [id], {}), undefined);
  assert.equal(pickSpell(id, [], {}), undefined, 'not in the grimoire');
  assert.equal(pickSpell('no-such-spell', ['no-such-spell'], {}), undefined, 'not a row');
});
test('the skill is the character\'s value in the school, whole, kept between the row\'s base and cap', () => {
  assert.deepEqual(pickSpell(id, [id], {}), { id, skill: row.base }, 'absent = at base');
  assert.equal(pickSpell(id, [id], { [school]: row.base + 3.9 })?.skill, Math.floor(row.base + 3.9));
  assert.equal(pickSpell(id, [id], { [school]: 1000 })?.skill, row.cap, 'never past the cap');
  assert.equal(pickSpell(id, [id], { [school]: -5 })?.skill, row.base, 'never under the base');
  assert.equal(pickSpell(id, [id], { [school]: NaN })?.skill, row.base);
});
test('the pick module names no spell id (Dom: data only)', () => {
  const ids = new Set(SPELL_IDS), src = readFileSync('src/fight/spell-pick.ts', 'utf8');
  assert.deepEqual([...src.matchAll(/(['"`])([a-z][a-z0-9-]{2,})\1/g)].map((m) => m[2]!).filter((w) => ids.has(w)), []);
});
