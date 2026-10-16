// [zone ready] is declared only after a CLEAN plan: a look at the scene (planUpload) taken after every kind and the hero were warmed that found nothing left to compile or upload. Declared between two looks (the 3 s re-plan), a material that
// streamed in after the last plan links at the first engage (seamless row #87: 71 programs at ready, 72 after the engage; 73 vs 71 on the same tree). The behaviour is the browser row (scripts/origins-seamless-check.mjs, 0 new programs after
// ready, and its receipt names each new program's owner); this pins the shape of the gate in origins/preview/main.ts so a refactor cannot drop the clean-plan condition.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
const body = (start: string, end: string) => { const a = main.indexOf(start), b = main.indexOf(end, a); assert.ok(a >= 0 && b > a, `${start} ... ${end} found`); return main.slice(a, b); };

test('the zone goes ready only after a clean plan taken once everything was warmed', () => {
  assert.match(body('function zoneReadyCheck()', 'zoneReadyAt = Math.round'), /!allWarmed\(\) \|\| !cleanPlan \|\| uploadQueue\.length \|\| programsInFlight \|\| uploadTotal === 0/);
  assert.match(body('function warmUpload(', 'const t0 = performance.now();'), /uploadQueue = planUpload\(\); cleanPlan = !uploadQueue\.length && allWarmed\(\);/);
});

test('the seamless receipt names the owner of every program that links after ready', () => {
  const script = readFileSync(new URL('../scripts/origins-seamless-check.mjs', import.meta.url), 'utf8');
  assert.match(script, /receipt\.newProgramOwners = /);
  assert.match(main, /programOwners: programOwners\(\)/);
});
