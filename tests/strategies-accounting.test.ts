import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryContacts } from './strategies.ts';
import { createFighter, idleIntent, stepDuel, type Duel, type CombatEvent, type Intent } from '../src/duel.ts';
import { MOVES, RULES } from '../src/moves.ts';

for (const defender of [0, 1] as const) test(`battery: real blocked heavy chips defender ${defender}, never attacker`, () => {
  let d: Duel = { tick: 0, fighters: [
    createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'),
    createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'),
  ], finish: null, events: [] };
  const attacker = defender === 0 ? 1 : 0;
  d.fighters[defender] = { ...d.fighters[defender], phase: 'guard', guardDirection: 'overhead', age: RULES.parry + RULES.perfectBlock + 1 };
  d.fighters[attacker] = { ...d.fighters[attacker], phase: 'attack', move: 'heavy_overhead', lastMove: 'heavy_overhead', age: MOVES.heavy_overhead.windup - 1 };
  const intents: [Intent, Intent] = [idleIntent(), idleIntent()];
  intents[defender].guard = true; intents[defender].guardDirection = 'overhead';
  d = stepDuel(d, intents);
  const block = d.events.find(e => e.type === 'Blocked');
  assert.ok(block && (block.damage ?? 0) > 0);
  assert.equal(d.fighters[defender].health, RULES.health - block.damage!);
  assert.equal(batteryContacts(d.events, defender), 1);
  assert.equal(batteryContacts(d.events, attacker), 0);
});

test('battery: clean block and non-damaging guard break are not damage; terminal and wall events are not opponent contacts', () => {
  const events: CombatEvent[] = [
    { tick: 1, type: 'Blocked', actor: 0, target: 1, damage: 0 },
    { tick: 2, type: 'GuardBroken', actor: 1, target: 0, damage: 0 },
    { tick: 3, type: 'Hit', actor: 1, target: 0, damage: 12 },
    { tick: 3, type: 'Killed', actor: 1, target: 0, damage: 12 },
    { tick: 4, type: 'Whipped', actor: 0, target: 0, damage: 3 },
  ];
  assert.equal(batteryContacts(events, 0), 1);
  assert.equal(batteryContacts(events, 1), 0);
  assert.equal(batteryContacts(events.slice(0, 2), 0), 0);
});
