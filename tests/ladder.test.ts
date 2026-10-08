import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LADDER, opponentFor, won, nextOpponent, passKey } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { ENCOUNTERS, ROSTER } from '../src/roster.ts';

test('the ladder is the encounter order minus the held recipes: the four creatures wait for after beta, the five men keep their order', () => {
  assert.deepEqual(LADDER.map(o => o.id), ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf', 'plaguedoctor', 'knight', 'witch', 'shieldmaiden']);
  assert.deepEqual(ENCOUNTERS.filter(o => o.hold).map(o => o.id), ['minotaur', 'wolf', 'boar', 'wraith', 'werewolf', 'skeleton'], 'held recipes stay listed for the journal, greyed');
  for (const rung of LADDER) assert.ok(OPPONENTS[rung.id], `${rung.id} exists in the roster`);
  // A saved encounter that was put on hold after it was saved resolves to the first rung, never to the held man.
  for (const held of ['minotaur', 'wolf', 'boar', 'wraith', 'werewolf', 'skeleton'] as const) assert.equal(opponentFor(held), OPPONENTS.veteran, `${held} saved before the hold`);
  assert.equal(opponentFor('executioner'), OPPONENTS.executioner);
  // Held GLBs are out of the beta bundle: scene.ts's glob (a literal, so it cannot read the roster) must exclude exactly the held bodies. The Ash Wolf is held from the ladder but its GLB is NOT excluded: the open world dresses it as the duel foe, and the glob is ?url so it only emits a lazily fetched file, never JS bundle weight.
  const scene = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  for (const { id } of ENCOUNTERS.filter(o => o.hold && o.id !== 'wolf' && o.id !== 'boar')) assert.ok(scene.includes(`'!./assets/${ROSTER[id].body}.glb'`), `scene.ts excludes ${id}'s GLB from the bundle`);
  for (const { id } of LADDER) assert.ok(!scene.includes(`'!./assets/${ROSTER[id].body}.glb'`), `scene.ts must not exclude a live rung (${id})`);
});

// The order (Dom via Strategy 2026-09-27): fight 1 the Centurion, then random picks from the pass's unbeaten; all ten beaten = a new pass.
test('the ladder order: each win picks from the pass\'s unbeaten, never a man twice in a pass; the tenth win starts a new pass without an instant repeat', () => {
  const ids = LADDER.map(o => o.id);
  for (let seed = 0; seed < 200; seed++) {
    let current = 'veteran' as (typeof ids)[number], pass: string[] = [];
    const met = [current];
    for (let win = 0; win < 9; win++) { const next = nextOpponent(current, pass, passKey(`guest-${seed}`, win + 1)); current = next.id; pass = next.pass; met.push(current); }
    assert.deepEqual([...met].sort(), [...ids].sort(), `seed ${seed}: one pass meets all ten once`);
    assert.equal(pass.length, 9, 'nine beaten, the tenth standing');
    const fresh = nextOpponent(current, pass, passKey(`guest-${seed}`, 10));
    assert.deepEqual(fresh.pass, [], 'the tenth win ends the pass: all ten back');
    assert.notEqual(fresh.id, current, 'but not the man just beaten');
  }
  const picks = new Set(Array.from({ length: 200 }, (_, i) => nextOpponent('veteran', [], passKey(`guest-${i}`, 1)).id));
  assert.equal(picks.size, 9, 'after the Centurion any of the other nine can come: the order is not fixed');
  assert.equal(nextOpponent('veteran', [], 7).name, LADDER.find(o => o.id === nextOpponent('veteran', [], 7).id)!.name);
  assert.deepEqual(nextOpponent('pitborn', ['minotaur', 'nonsense', 'pitborn'], 3).pass, ['pitborn'], 'held or unknown ids in a saved pass drop out');
  assert.equal(passKey('guest-1', 4), passKey('guest-1', 4), 'the same profile and win count draw the same: a refresh names the same man');
  assert.notEqual(passKey('guest-1', 4), passKey('guest-1', 5));
});

test('the opponent comes from saved progress, a URL override beats it, and anything unknown falls back to the Veteran', () => {
  assert.equal(opponentFor(undefined).id, 'veteran');
  assert.equal(opponentFor('pitborn').id, 'pitborn');
  assert.equal(opponentFor('pitborn', 'veteran').id, 'veteran', 'URL override wins');
  assert.equal(opponentFor('veteran', 'pitborn').id, 'pitborn');
  for (const junk of ['', 'cyclops', '__proto__', 'constructor', 'toString']) assert.equal(opponentFor(junk).id, 'veteran', `junk rung ${JSON.stringify(junk)}`);
  assert.equal(opponentFor('pitborn', 'nobody').id, 'veteran', 'a junk override never crashes and never exposes a prototype');
});

test('only a clean win over the opponent counts as climbing', () => {
  assert.equal(won(null), false);
  assert.equal(won({ victim: 1, location: 'torso', move: 'light_right', heading: 0 }), true);
  assert.equal(won({ victim: 0, location: 'torso', move: 'light_right', heading: 0 }), false, 'the player fell');
  assert.equal(won({ victim: 1, location: 'torso', move: 'light_right', heading: 0, draw: true }), false, 'a draw is not a win');
});
