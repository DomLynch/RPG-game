// The sandbox is ONE era switch (sandbox-era.ts, BULK-CS RV78): a record below v78 replays the old fight byte for byte, so no stored kill link is retired.
//   - the switch itself: underSandbox sets it from the record's version and restores it, setSandbox is idempotent and re-reads the rules once per change;
//   - the stored eras (tests/fixtures/era-records.json, v31..v77, append-only) still replay to their pins on this build (tests/record-era-fixtures.test.ts runs the same check; here with the era named);
//   - class specials with the era OFF are the fights trunk fought: the hash of a class-special battery (the opponent casts its own class special, nothing picked) equals the one taken at trunk b40785691, before the sandbox landed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_SANDBOX_VERSION, SANDBOX_ON, onSandboxEra, setSandbox, underSandbox } from '../src/fight/sandbox-era.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { checkEraFixtures, FIXTURE } from '../scripts/record-era-fixtures.mjs';
import { classSpecialBatteryHash } from './lib/class-special-battery.ts';
import { readFileSync } from 'node:fs';

const TRUNK_CLASS_SPECIAL_HASH = '86d365dc78c174b6';   // classSpecialBatteryHash() at trunk b40785691 (8 opponents x levels 6 and 36 x 2 strategies x 3 seeds, setStab(true))

test('the era switch: a record below v78 runs with the sandbox OFF, v78 and live fights ON, and the previous state comes back', () => {
  assert.equal(FIRST_SANDBOX_VERSION, 78);
  assert.equal(SANDBOX_ON, true, 'a live fight is in the sandbox era');
  assert.equal(underSandbox(77, () => SANDBOX_ON), false);
  assert.equal(underSandbox(31, () => SANDBOX_ON), false);
  assert.equal(underSandbox(78, () => SANDBOX_ON), true);
  assert.equal(SANDBOX_ON, true, 'restored');
  assert.throws(() => underSandbox(10, () => { throw new Error('x'); }), /x/);
  assert.equal(SANDBOX_ON, true, 'restored after a throw');
});

test('rules are re-read once per era change, never on a no-op', () => {
  let calls = 0; onSandboxEra(() => { calls++; });
  try {
    setSandbox(true); assert.equal(calls, 0, 'already on');
    setSandbox(false); setSandbox(false); assert.equal(calls, 1);
    setSandbox(true); assert.equal(calls, 2);
  } finally { setSandbox(true); }
});

test('every stored era record (v31..v77 and the newest) still replays to its pin on this build: no kill link is retired', async () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { records: { name: string; expect: { v: number } }[] };
  const { problems } = await checkEraFixtures(fixture);
  assert.deepEqual(problems, []);
  assert.ok(fixture.records.some((e) => e.expect.v < FIRST_SANDBOX_VERSION), 'there are stored records below the sandbox era');
});

test('class specials with the era OFF are the fights trunk fought (hash taken at trunk b40785691)', () => {
  setStab(true);
  try { assert.equal(underSandbox(FIRST_SANDBOX_VERSION - 1, () => classSpecialBatteryHash()), TRUNK_CLASS_SPECIAL_HASH); } finally { setStab(false); }
});
