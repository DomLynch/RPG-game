import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LADDER, opponentFor, won, nextAfter } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { ENCOUNTERS, ROSTER } from '../src/roster.ts';

test('the ladder is the encounter order minus the held recipes: the Minotaur and Werewolf wait for after beta, the rest keep their order', () => {
  assert.deepEqual(LADDER.map(o => o.id), ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'wraith', 'skeleton']);
  assert.deepEqual(ENCOUNTERS.filter(o => o.hold).map(o => o.id), ['minotaur', 'werewolf'], 'held recipes stay listed for the journal, greyed');
  assert.equal(nextAfter('veteran')?.id, 'pitborn'); assert.equal(nextAfter('veteran')?.name, 'the Pitborn');
  assert.equal(nextAfter('pitborn')?.id, 'goblin'); assert.equal(nextAfter('pitborn')?.name, 'the Goblin');
  assert.equal(nextAfter('goblin')?.id, 'nightborn'); assert.equal(nextAfter('goblin')?.name, 'the Nightborn');
  assert.equal(nextAfter('nightborn')?.id, 'executioner'); assert.equal(nextAfter('nightborn')?.name, 'the Executioner');
  assert.equal(nextAfter('executioner')?.id, 'wraith', 'the held Minotaur is skipped');
  assert.equal(nextAfter('wraith')?.id, 'skeleton', 'the held Werewolf is skipped');
  assert.equal(nextAfter('skeleton'), undefined, 'the last rung offers no next opponent');
  assert.equal(nextAfter('minotaur'), undefined, 'a held id is not a rung');
  for (const rung of LADDER) assert.ok(OPPONENTS[rung.id], `${rung.id} exists in the roster`);
  // A saved encounter that was put on hold after it was saved resolves to the first rung, never to the held man.
  assert.equal(opponentFor('minotaur'), OPPONENTS.veteran); assert.equal(opponentFor('werewolf'), OPPONENTS.veteran); assert.equal(opponentFor('wraith'), OPPONENTS.wraith);
  // Held GLBs are out of the beta bundle: scene.ts's glob (a literal, so it cannot read the roster) must exclude exactly the held bodies.
  const scene = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  for (const { id } of ENCOUNTERS.filter(o => o.hold)) assert.ok(scene.includes(`'!./assets/${ROSTER[id].body}.glb'`), `scene.ts excludes ${id}'s GLB from the bundle`);
  for (const { id } of LADDER) assert.ok(!scene.includes(`'!./assets/${ROSTER[id].body}.glb'`), `scene.ts must not exclude a live rung (${id})`);
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
