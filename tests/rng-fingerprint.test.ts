// The RNG draw fingerprint (scripts/rng-fingerprint.mjs, Lead brief 2026-10-06): when a level is added or a table retuned, existing fights and
// replays must stay bit-identical unless the change means to alter them. A changed fingerprint is allowed only with a RECORD_VERSION bump, and
// the bump comes with a regenerated fixture and the reason in the PR: `npm run fingerprint:update`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprints, stream, FIXTURE, LEVEL_SET, SEEDS, TICKS } from '../scripts/rng-fingerprint.mjs';
import { NO_PATRON_VERSION, RECORD_VERSION } from '../src/record.ts';
import { OPPONENTS } from '../src/moves.ts';

const pinned = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ReturnType<typeof fingerprints>;

test('the fixture covers every opponent x level x seed x scripted player, at the current RECORD_VERSION', () => {
  assert.equal(Object.keys(pinned.cells).length, Object.keys(OPPONENTS).length * LEVEL_SET.length * SEEDS.length * 2);
  assert.deepEqual(pinned.levels, LEVEL_SET); assert.deepEqual(pinned.seeds, SEEDS); assert.equal(pinned.ticks, TICKS);
  assert.equal(pinned.version, NO_PATRON_VERSION, `the no-patron version is ${NO_PATRON_VERSION} but the fingerprint fixture is for ${pinned.version}: run \`npm run fingerprint:update\` and put the reason for the bump in the PR`);
});

test('no fight\'s RNG draws or end state changed without a RECORD_VERSION bump', () => {
  const now = fingerprints().cells as Record<string, unknown>, changed: string[] = [];
  for (const [key, was] of Object.entries(pinned.cells as Record<string, unknown>)) if (JSON.stringify(now[key]) !== JSON.stringify(was)) changed.push(`${key}: ${JSON.stringify(was)} -> ${JSON.stringify(now[key])}`);
  assert.deepEqual(changed.slice(0, 5), [], `${changed.length} fingerprint(s) changed at RECORD_VERSION ${RECORD_VERSION}: a sim, AI or table change moved existing fights. If that is intended, bump RECORD_VERSION (src/record.ts, with its REACH), run \`npm run fingerprint:update\` and say why in the PR; if not, undo it`);
});

test('the stream fingerprint counts draws and hashes their values in order', () => {
  const lcg = (s: number) => (Math.imul(s, 1664525) + 1013904223) >>> 0;
  let s = 731; for (let i = 0; i < 5; i++) s = lcg(s);
  const five = stream(731, s), other = stream(732, lcg(lcg(lcg(lcg(lcg(732))))));
  assert.equal(five.draws, 5); assert.notEqual(five.values, other.values);
  assert.equal(stream(731, 731).draws, 0);
  assert.throws(() => stream(731, 12345, 1000), /orbit/, 'a seed some other writer set is refused, not silently counted');
});
