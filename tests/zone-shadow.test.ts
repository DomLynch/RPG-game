// The zone page's sun shadow is rows (fx-rows.json): the desktop map, a phone map the size the Pit uses on a phone, and how often a phone re-renders it (T4 CPU profile 2026-10-20: the shadow pass was ~6% of the main thread).
// The page reads them through fxNum; a phone turns autoUpdate off and asks for an update every Nth render. This pins the rows' sanity and that main.ts uses them, so the literal does not come back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fxNum } from '../src/fight/fx-rows.ts';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');

test('the shadow rows: a phone map no bigger than the desktop map and a power of two, an update interval of at least 1', () => {
  const desktop = fxNum('zone.shadow.map'), phone = fxNum('zone.shadow.phone-map'), every = fxNum('zone.shadow.phone-every');
  assert.ok(phone <= desktop && phone > 0 && Number.isInteger(Math.log2(phone)) && Number.isInteger(Math.log2(desktop)), `maps ${phone} / ${desktop}`);
  assert.ok(Number.isInteger(every) && every >= 1, `every ${every}`);
});

test('the zone page sizes the sun shadow from the rows, and a phone re-renders it every Nth render', () => {
  assert.match(main, /fxNum\(PHONE \? 'zone\.shadow\.phone-map' : 'zone\.shadow\.map'\)/);
  assert.match(main, /shadowEvery = PHONE \? Math\.max\(1, fxNum\('zone\.shadow\.phone-every'\)\) : 1/);
  assert.match(main, /renderer\.shadowMap\.autoUpdate = false/);
  assert.match(main, /draws\+\+ % shadowEvery === 0\) renderer\.shadowMap\.needsUpdate = true/);
  assert.doesNotMatch(main, /mapSize\.set\(PHONE \? 1024 : 2048/, 'the literal is a row now');
});
