import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// scripts/origins-bow-smoke.mjs is a TOOL (a disposable-Postgres end-to-end run, about 90 s, NOT run by CI: it needs initdb as a non-root user) and it runs under the LIVE rules, so it cannot import era-off. This test keeps its
// shape in the unit suite: the ledger path is the real ops, the verdict is read against heroLimitOf, the fixture trap is noted, and the Power Shot case stays an EXPECTED-FAIL marked "until RV83" (flip it when the engine fires it).
//   runuser -u frankrows -- env PG_BIN=/usr/lib/postgresql/16/bin node --experimental-strip-types scripts/origins-bow-smoke.mjs
const SCRIPT = readFileSync(new URL('../scripts/origins-bow-smoke.mjs', import.meta.url), 'utf8');
const code = SCRIPT.replace(/\/\/.*$/gm, '');

test('bow smoke script: labelled NOT PROD, live rules (no era-off), the ledger path is the real ops and the verdict is read against heroLimitOf', () => {
  assert.match(SCRIPT, /^\/\/ NOT PROD\./, 'the header says NOT PROD');
  assert.ok(!code.includes('era-off'), 'live rules: the script never imports era-off');
  for (const piece of ['ground_take', 'gear_equip', 'heroLimitOf', "'ground:zone1.bow-1'", "'item:starter.bow'", 'equipped:main', "'weapon'"]) assert.ok(code.includes(piece), `the script drives / asserts ${piece}`);
  assert.ok(!/frankendom\.com|supabase\.co|DATABASE_URL/.test(code), 'no prod host or connection string (disposable cluster only)');
});

test('bow smoke script: the career fixture trap is noted and the Power Shot case is an EXPECTED-FAIL until RV83', () => {
  assert.ok(/origins_career/.test(code) && /cumulative\(11\)/.test(code), 'a career row is upserted before the equip (Legionary rank)');
  assert.ok(/EXPECTED-FAIL \(until RV83\)/.test(code), 'the Power Shot case is marked EXPECTED-FAIL until RV83');
});
