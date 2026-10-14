// The boss ground telegraph (boss-telegraph.ts, ?telegraph=1): a pure read of the sim's windup, boss specials only, never written back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPPONENTS, RULES } from '../src/fight/moves.ts';
import { telegraphFlag, telegraphLook } from '../src/fight/boss-telegraph.ts';

test('the flag is explicit: only ?telegraph=1|on|ring turns it on', () => {
  assert.equal(telegraphFlag('?telegraph=1'), true);
  assert.equal(telegraphFlag('?special=shield&telegraph=on'), true);
  assert.equal(telegraphFlag(''), false);
  assert.equal(telegraphFlag('?telegraph=0'), false);
});

test('a boss windup fills the ring and flashes in the last roll window', () => {
  const boss = { specialShare: RULES.special.bossDamage, health: 100 };
  assert.deepEqual(telegraphLook({ ...boss, special: RULES.special.windup }), { fill: 0, flash: false });
  assert.equal(telegraphLook({ ...boss, special: RULES.special.windup / 2 })?.fill, 0.5);
  assert.equal(telegraphLook({ ...boss, special: 24 })?.flash, true);
  assert.equal(telegraphLook({ ...boss, special: 25 })?.flash, false);
});

test('nothing is drawn for a class special, outside a windup, or for a dead caster', () => {
  assert.equal(telegraphLook({ specialShare: RULES.special.damage, health: 100, special: 60 }), null);
  assert.equal(telegraphLook({ specialShare: RULES.special.bossDamage, health: 100, special: 0 }), null);
  assert.equal(telegraphLook({ specialShare: RULES.special.bossDamage, health: 0, special: 60 }), null);
  assert.equal(telegraphLook({ health: 100, special: 60 }), null);
});


// Caster tell (Combat #7a): any fighter mid-cast of a spell shows the ring, tinted with the spell's school; a boss special alone needs the flag.
import { spellColor, spellLook } from '../src/fight/boss-telegraph.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { readFileSync } from 'node:fs';
test('a spell cast fills the ring on either side, in its school colour, with no flag', () => {
  const id = SPELL_IDS[0]!, color = spellColor(id);
  assert.equal(typeof color, 'number', 'every spell id resolves to a school colour');
  assert.deepEqual(telegraphLook({ health: 100, special: RULES.special.windup / 2, spell: { id } }, false), { fill: 0.5, flash: false, color });
  assert.equal(telegraphLook({ health: 100, special: 24, spell: { id } }, false)?.flash, true, 'the roll window flashes');
});
test('every spell id has a school colour; the boss ring stays behind its flag; a dead or idle caster draws nothing', () => {
  for (const id of SPELL_IDS) assert.equal(typeof spellColor(id), 'number', id);
  assert.equal(spellColor('no-such-spell'), undefined);
  assert.equal(telegraphLook({ specialShare: RULES.special.bossDamage, health: 100, special: 60 }, false), null, 'boss ring off without the flag');
  assert.equal(telegraphLook({ health: 0, special: 60, spell: { id: SPELL_IDS[0]! } }, false), null);
  assert.equal(telegraphLook({ health: 100, special: 0, spell: { id: SPELL_IDS[0]! } }, false), null);
});

// ?spell=<id> look test: inert without the flag, and without a real spell id; resolved through the rows only.
test('the ?spell look test is absent without the flag or with an unknown id, and takes the skill from the address', () => {
  const id = SPELL_IDS[0]!;
  assert.equal(spellLook(''), undefined);
  assert.equal(spellLook('?telegraph=1&look=schools'), undefined);
  assert.equal(spellLook('?spell=no-such-spell'), undefined);
  assert.deepEqual(spellLook(`?spell=${id}`), { id, skill: 0 });
  assert.deepEqual(spellLook(`?spell=${id}&spellskill=60`), { id, skill: 60 });
  assert.deepEqual(spellLook(`?spell=${id}&spellskill=x`), { id, skill: 0 });
});
// Dom's bar (Lead 2026-10-13): the client spell path is data only. No spell id literal may appear in the page, the match, the telegraph or the scene; ids live in the spells-*.json rows and tests.
test('no spell id literal in main.ts, match.ts, boss-telegraph.ts or scene.ts', () => {
  const ids = new Set(SPELL_IDS);
  for (const file of ['src/main.ts', 'src/fight/match.ts', 'src/fight/boss-telegraph.ts', 'src/fight/scene.ts']) {
    const hits = [...readFileSync(file, 'utf8').matchAll(/(['"`])([a-z][a-z0-9-]{2,})\1/g)].map((m) => m[2]!).filter((w) => ids.has(w) && !Object.hasOwn(OPPONENTS, w));   // a creature the game already names (minotaur) is its opponent row, not a spell
    assert.deepEqual([...new Set(hits)], [], `${file} names a spell id: read it from the rows`);
  }
});
