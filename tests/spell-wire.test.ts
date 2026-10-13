// The client spell wire (Combat, programme 2b): main.ts hands the grimoire pick to the Match's spell port through the rows (spell-pick.ts); a fight that records carries the spell, and a pick that is not owned casts nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { pickSpell } from '../src/fight/spell-pick.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';

const id = SPELL_IDS[0]!;
const make = (equipped: string | undefined, owned: readonly string[]) => {
  const storage = { getItem: () => null, setItem: () => {} };
  return new Match(OPPONENTS.goblin, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), spell: () => pickSpell(equipped, owned, {}) }, 731, 'longsword', null, 16);
};

test('an equipped, owned spell is on the player in a paying fight and the record carries it', () => {
  const m = make(id, [id]);
  assert.equal(m.mode, 'career');
  assert.equal(m.spell?.id, id);
  assert.equal(m.practice.duel.fighters[0].spell?.id, id);
  assert.notEqual(m.recorder, null);
  assert.equal(m.recorder!.finish('abandoned').spell?.id, id, 'the record names the spell the server will check');
});

test('nothing equipped, or a pick that is not in the grimoire, casts nothing', () => {
  assert.equal(make(undefined, [id]).spell, undefined);
  assert.equal(make(id, []).spell, undefined);
  assert.equal(make('no-such-spell', ['no-such-spell']).spell, undefined);
});

test('main.ts reaches the pick only through the core door and spell-pick: no spell id, no number', () => {
  const src = readFileSync('src/main.ts', 'utf8');
  assert.match(src, /spell: \(\) => pickSpell\(equippedSpell\(\), ownedSpells\(\), (\{\}|skills\.values\(\))\)/);
  assert.match(src, /import \{[^}]*\bequippedSpell\b[^}]*\bownedSpells\b[^}]*\} from '\.\/core\/index\.ts'/);
});

// Dom's bar (Lead 2026-10-13): the client spell path is data only. No spell id literal may appear in the page, the match, the HUD, the pick or the equip store; ids live in the spells-*.json rows and tests.
test('no spell id literal in the client spell path', () => {
  const ids = new Set(SPELL_IDS);
  for (const file of ['src/main.ts', 'src/fight/match.ts', 'src/fight/hud.ts', 'src/fight/spell-pick.ts', 'src/core/spell-equip.ts']) {
    const hits = [...readFileSync(file, 'utf8').matchAll(/(['"`])([a-z][a-z0-9-]{2,})\1/g)].map((m) => m[2]!).filter((w) => ids.has(w) && !Object.hasOwn(OPPONENTS, w));   // a creature the game already names (minotaur) is its opponent row, not a spell
    assert.deepEqual([...new Set(hits)], [], `${file} names a spell id: read it from the rows`);
  }
});
