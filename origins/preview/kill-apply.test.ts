import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer } from '../progression/model.ts';
import { applyServerKill } from './kill-apply.ts';
import type { Killed } from './spawn-net.ts';

const career = newCareer(0), session = { career, settled: new Set<string>(), fights: 0 };
const killed = (cp: number): Killed => ({ result: 'killed', instance: 'wolves-1', respawnAt: null, loot: [], cp, bronze: 3, beta: true });

test('a paid server kill moves the saved career on screen by exactly its CP, in the session and in the saved baseline', () => {
  const got = applyServerKill(session, { saved: career }, killed(20))!;
  assert.deepEqual([got.cp, got.session.career.credit, (got.source as { saved: { credit: number } }).saved.credit], [20, career.credit + 20, career.credit + 20]);
  assert.equal(session.career.credit, career.credit, 'the old session is not mutated');
});

test('nothing changes for an offline answer, an offline page (preview career), or a kill that paid 0', () => {
  assert.equal(applyServerKill(session, { saved: career }, { offline: 'timeout' }), null);
  assert.equal(applyServerKill(session, { offline: 'no-session' }, killed(20)), null);
  assert.equal(applyServerKill(session, { saved: career }, killed(0)), null);
});
