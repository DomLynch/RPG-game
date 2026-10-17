import assert from 'node:assert/strict';
import test from 'node:test';
import ROLES from '../origins/crowd/roles.json' with { type: 'json' };
import { CROWD, ROLE_RING } from '../origins/crowd/crowd.ts';

// The crowd roles' behaviour was role names in crowd.ts (branch-on-content-id, rule (j)); it is flags on the roles.json rows now. Pinned (JSON text, key order counts) to the shipped rows, and the ring numbers they already carried.
test('the crowd role rows carry the flags the code reads', () => {
  assert.equal(JSON.stringify(ROLES.roles), JSON.stringify([
    { id: 'duellist', radius: 5, pace: 0.006, opener: true },
    { id: 'brute', radius: 5.5, pace: 0.003, after: 'duellist' },
    { id: 'skirmisher', ringEdge: 'min', pace: 0.012, quickHandover: true },
    { id: 'leader', ringEdge: 'max', pace: 0.002, packLeader: true },
  ]));
  assert.equal(JSON.stringify(ROLE_RING), JSON.stringify({ duellist: { radius: 5, pace: 0.006 }, brute: { radius: 5.5, pace: 0.003 }, skirmisher: { radius: CROWD.ring.min, pace: 0.012 }, leader: { radius: CROWD.ring.max, pace: 0.002 } }));
});
