// A0 (2026-10-18): the schema fields and the `level` key the Test Zone's zone row needs, declared on trunk. Each field is accepted with a valid value and refused out of range; `level` is for an unlisted zone only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { resolveZone } from '../origins/zones/resolve.ts';
import type { Spec } from '../origins/zones/biomes.ts';

const spec = (over: Record<string, unknown>): Spec => over as unknown as Spec;
const problems = (over: Record<string, unknown>): string[] => resolveZone('90', spec(over)).problems;

test('the Test Zone look fields resolve clean with valid values', () => {
  assert.deepEqual(problems({
    look: { props: { rim: true }, buildings: 'goblin', dress: 'fortress', ground: { material: 'fortress-ground' }, creatures: { alert: false, name: false, card: 'target', ring: false, lock: 'soft', growl: true } },
    camera: { combatPreset: '5', landscapeZoom: 1.5, fightBack: 1.2, fightBackPortrait: 1.1, combat: { margin: 2 } },
    boundary: { margin: 8, slow: 0.3, line: 'The mist is too thick to go further.' },
    sound: { ambience: 'fortress-wind' },
  }), []);
});

test('each new numeric or enum field is refused out of range, and an unknown field next to them is still refused', () => {
  assert.ok(problems({ boundary: { slow: 2 } }).length > 0, 'boundary.slow is 0.05..1');
  assert.ok(problems({ boundary: { margin: 31 } }).length > 0, 'boundary.margin is 0..30');
  assert.ok(problems({ camera: { landscapeZoom: 0.5 } }).length > 0, 'camera.landscapeZoom is 1..3');
  assert.ok(problems({ camera: { fightBack: 3 } }).length > 0, 'camera.fightBack is 1..2');
  assert.ok(problems({ look: { creatures: { card: 'half' } } }).length > 0, 'look.creatures.card is full or target');
  assert.ok(problems({ look: { creatures: { lock: 'firm' } } }).length > 0, 'look.creatures.lock is hard or soft');
  assert.ok(problems({ look: { buildingz: 'goblin' } }).length > 0, 'an unknown field is refused');
});

test('`level` is allowed on an unlisted zone row only, a whole number >= 1', () => {
  const base = JSON.parse(readFileSync(new URL('../origins/zone-rows/zone1.row.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  assert.equal(zoneFromRow(90, { ...base, id: 90, unlisted: true, level: 7 }).level, 7);
  assert.equal(zoneFromRow(2, { ...base, id: 2 }).level, 2, 'no level key: Zone N = level N');
  assert.throws(() => zoneFromRow(90, { ...base, id: 90, level: 7 }), /"level" is only for an unlisted/);
  assert.throws(() => zoneFromRow(90, { ...base, id: 90, unlisted: false, level: 7 }), /"level" is only for an unlisted/);
  assert.throws(() => zoneFromRow(90, { ...base, id: 90, unlisted: true, level: 0 }), /whole number >= 1/);
  assert.throws(() => zoneFromRow(90, { ...base, id: 90, unlisted: true, level: 2.5 }), /whole number >= 1/);
});
