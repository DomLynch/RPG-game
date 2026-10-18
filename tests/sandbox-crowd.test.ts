// sandbox-mech: crowd. The moments a roar row can key on; trunk ships no roar rows, so the crowd is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import CROWD from '../src/audio/crowd-defs.json' with { type: 'json' };
import { momentsOf } from '../src/audio/arena.ts';
import type { CombatEvent } from '../src/fight/combat.ts';

test('trunk ships no roars', () => assert.deepEqual(CROWD.roars, []));
test('kill, parry, guard break and heavy hits are the roar moments; a light hit is none', () => {
  const ev = (e: object) => e as CombatEvent;
  assert.deepEqual([...momentsOf([ev({ type: 'Killed', actor: 0 }), ev({ type: 'Parried', actor: 1, target: 0 })])], ['kill', 'parry']);
  assert.deepEqual([...momentsOf([ev({ type: 'GuardBroken', actor: 0, target: 1 }), ev({ type: 'Hit', actor: 0, target: 1, charged: true })])], ['guardBreak', 'heavy']);
  assert.deepEqual([...momentsOf([ev({ type: 'Hit', actor: 0, target: 1, move: 'light' })])], []);
});
