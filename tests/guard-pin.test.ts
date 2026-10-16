// The head pin is exact (tests/lib/sim-digest.ts pinProblem, used by record-version-guard and world-sim-guard; Lead 2026-10-15, hardening): the digest equals the pin AND the version
// equals the version it was pinned for. The older rule let a version bump that left the pin stale pass on any digest; it was never hit on trunk (0 of 97 commits), and this pins that
// it cannot be.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pinProblem } from './lib/sim-digest.ts';

const at = (digest: string, version: number) => pinProblem({ digest, pin: 'aaa', version, pinnedFor: 63, name: 'RECORD_VERSION', versionFile: 'src/fight/record.ts', pinName: 'SIM_DIGEST' });
const oldRule = (digest: string, version: number) => (digest === 'aaa' ? version === 63 : version > 63);

test('the head pin holds only when the digest equals the pin and the version equals pinnedFor', () => {
  assert.equal(at('aaa', 63), null);
});

test('mutation: a version bumped with a STALE pin is refused (the older rule passed it on any digest) and the message says re-pin', () => {
  assert.equal(oldRule('bbb', 64), true, 'the gap: the older rule passed a bump whose new code nothing pinned');
  assert.match(at('bbb', 64)!, /re-pin at the head \(set SIM_DIGEST = 'bbb' and PINNED_FOR_VERSION = 64\)/);
  assert.match(at('aaa', 64)!, /re-pin at the head/, 'a format-only bump with the digest unchanged still moves PINNED_FOR_VERSION');
});

test('a sim change without a bump is refused with the bump message, as before; a version below its pin is refused', () => {
  assert.equal(oldRule('bbb', 63), false);
  assert.match(at('bbb', 63)!, /changed \(digest bbb\) but RECORD_VERSION is still 63\. Bump RECORD_VERSION in src\/fight\/record\.ts, then set SIM_DIGEST = 'bbb' and PINNED_FOR_VERSION = 64/);
  assert.match(at('aaa', 62)!, /went backwards/);
});
