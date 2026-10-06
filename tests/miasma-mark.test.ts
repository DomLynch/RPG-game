import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CombatEvent } from '../src/duel.ts';
import { MARK, markAlpha, marksFlag, miasmaOf } from '../src/miasma-mark.ts';

const hit = (over: Partial<CombatEvent>): CombatEvent => ({ tick: 1, type: 'Hit', actor: 1, target: 0, move: 'skill_miasma', ...over }) as CombatEvent;

test('the flag is ?look=marks only, alone or in a list', () => {
  assert.equal(marksFlag('?look=marks'), true); assert.equal(marksFlag('?x=1&look=schools,marks'), true);
  assert.equal(marksFlag(''), false); assert.equal(marksFlag('?look=schools'), false);
});

test('only a landed Miasma blow marks; a guarded one is half; no other skill, no miss, no status invented', () => {
  assert.deepEqual(miasmaOf(hit({})), { target: 0, strength: 1 });
  assert.deepEqual(miasmaOf(hit({ guarded: true })), { target: 0, strength: 0.5 });
  assert.equal(miasmaOf(hit({ move: 'skill_lunge' })), null); assert.equal(miasmaOf(hit({ move: 'light_left' })), null);
  assert.equal(miasmaOf(hit({ type: 'Whiff' as CombatEvent['type'] })), null); assert.equal(miasmaOf(hit({ target: undefined })), null);
});

test('the mark lasts MARK.seconds and eases out over the last MARK.fade', () => {
  assert.equal(markAlpha(MARK.seconds), 1); assert.equal(markAlpha(MARK.fade), 1); assert.equal(markAlpha(MARK.fade / 2), 0.5); assert.equal(markAlpha(0), 0);
  assert.equal(MARK.seconds, 2);
});

test('the wash stays on his own silhouette: about a body wide, centred on the torso, lower alpha than v1 (Lead on #1540: it must never reach the player)', () => {
  assert.ok(MARK.glowSize <= 1.2 && MARK.glowSize >= 0.9); assert.ok(MARK.glowAlpha <= 0.4);
});
