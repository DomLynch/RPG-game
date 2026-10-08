import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, ENGAGE_MAX, engage, engagedOf, hostile, inCombat, release, releasePlayer, type EngageState } from './engage.ts';

const on = (s: EngageState, player: string, creature: string): EngageState => {
  const r = engage(s, player, creature);
  assert.ok(r.ok, `${creature} engages ${player}`);
  return r.state;
};

test('engage sets hostile on the creature and combat on the player; release ends combat when the list empties', () => {
  let s = on(EMPTY, 'p1', 'wolf-1');
  assert.deepEqual([hostile(s, 'wolf-1'), inCombat(s, 'p1'), hostile(s, 'wolf-2'), inCombat(s, 'p2')], [true, true, false, false]);
  s = on(s, 'p1', 'wolf-2');
  assert.deepEqual(engagedOf(s, 'p1'), ['wolf-1', 'wolf-2'], 'engage order');
  s = release(s, 'wolf-1');
  assert.deepEqual([hostile(s, 'wolf-1'), inCombat(s, 'p1')], [false, true]);
  s = release(s, 'wolf-2');
  assert.deepEqual([inCombat(s, 'p1'), s.engaged.size], [false, 0], 'combat ends when the list empties');
});

test('at most 7 attackers: the eighth is refused and stays unengaged', () => {
  let s = EMPTY;
  for (let i = 0; i < ENGAGE_MAX; i++) s = on(s, 'p1', `c${i}`);
  const r = engage(s, 'p1', 'c7');
  assert.deepEqual(r, { ok: false, reason: 'full' });
  assert.equal(hostile(s, 'c7'), false);
  s = on(release(s, 'c0'), 'p1', 'c7');
  assert.equal(engagedOf(s, 'p1').length, ENGAGE_MAX, 'a freed slot takes the next one');
});

test('one creature fights one player; re-engaging the same pair changes nothing; inputs are never mutated', () => {
  const s = on(EMPTY, 'p1', 'boar');
  assert.deepEqual(engage(s, 'p2', 'boar'), { ok: false, reason: 'taken' });
  assert.deepEqual(engage(s, 'p1', 'boar'), { ok: true, state: s });
  const before = JSON.stringify([...s.engaged]);
  on(s, 'p1', 'bear'); release(s, 'boar'); releasePlayer(s, 'p1');
  assert.equal(JSON.stringify([...s.engaged]), before);
  assert.equal(release(s, 'nobody'), s);
});

test('releasePlayer frees every creature on that list and leaves other players alone', () => {
  let s = on(on(on(EMPTY, 'p1', 'a'), 'p1', 'b'), 'p2', 'c');
  s = releasePlayer(s, 'p1');
  assert.deepEqual([hostile(s, 'a'), hostile(s, 'b'), hostile(s, 'c'), inCombat(s, 'p1'), inCombat(s, 'p2')], [false, false, true, false, true]);
  assert.equal(releasePlayer(s, 'p9'), s);
});
