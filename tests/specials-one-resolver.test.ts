import './lib/era-off.ts';
// One source of truth for SPECIAL 1 / SPECIAL 2 (Dom 2026-10-20: "carry through EVERYWHERE from one data layer"): the player's pair is read ONLY through src/core/special-equip.ts
// (stored picks -> the betaCut specialPick rows -> the slot defaults) by the Pit page (src/main.ts), the Zone 1 walk (origins/preview/main.ts) and the duel opened from Zone 1
// (origins/preview/pit-duel.ts); the clip, the label and the sound then come from the skill id alone (skill-defs.json specialClip, specialName, the special rows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equippedSpecial, equippedSpecials } from '../src/core/special-equip.ts';
import { SKILL_ROWS, specialName } from '../src/fight/index.ts';
import { specialRow, type SpecialRole } from '../src/fight/characters.ts';

const read = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PAGES = ['src/main.ts', 'origins/preview/main.ts', 'origins/preview/pit-duel.ts'] as const;

test('the three pages read the pick pair through equippedSpecial and no other store', () => {
  for (const p of PAGES) {
    const src = read(p);
    assert.match(src, /equippedSpecial\(/, `${p} reads the player's picks through equippedSpecial`);
    assert.ok(!/special\.slots/.test(src), `${p} never opens the pick store itself`);
    assert.ok(!/specialPick|slot1Default|slot2Default/.test(src.replace(/\/\/.*$/gm, '')), `${p} never re-derives the defaults: the resolver owns them`);
  }
});

test('the pair is the resolver\'s: slot 0 and 1 of equippedSpecials, both filled by the rows\' defaults on a fresh player', () => {
  const pair = equippedSpecials();
  assert.equal(equippedSpecial(0), pair[0]); assert.equal(equippedSpecial(1), pair[1]);
  assert.ok(pair[0] && pair[1] && pair[0] !== pair[1], `a fresh player starts with two different specials: ${pair.join(' / ')}`);
});

test('every pickable special resolves the same clip and label whichever page asks (a pure function of the skill id and the weapon)', () => {
  for (const id of [equippedSpecial(0)!, equippedSpecial(1)!]) {
    const row = SKILL_ROWS[id as keyof typeof SKILL_ROWS];
    assert.ok(row, `${id} is a skill row`);
    const role = (row as unknown as { specialClip?: SpecialRole }).specialClip;
    assert.ok(role, `${id} names its own clip`);
    assert.ok(specialRow(role).weapons.includes('longsword'), `${role} plays on the longsword`);
    assert.ok(specialName('longsword', id as never, row.name), `${id} has a label`);
  }
});
