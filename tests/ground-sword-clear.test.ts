// The starter weapon is not a fight first (Strategy 2026-10-16: "a starter weapon that needs a win first is a fake barrier"): the rusty sword lies at the Cinder Fields camp's edge, outside the aggro
// radius PLUS the roam of every creature of the camp and of the lone opener (a creature that has wandered to the edge of its roam still has not noticed a walker beyond its aggro), with a margin, and
// not on the place centre, where the kobold legend of the Ash Pits stands (origins/boss/legend-spawns.json). Reads the placed list (origins/preview/mobs.golden.json) and the ground row.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GROUND_ITEMS } from '../origins/world/ground-items.ts';
import { groundPointOf } from '../origins/world/ground-point.ts';

type Placed = { id: string; zone: string; home: { x: number; z: number }; roam: number; aggro: number };
const MARGIN_M = 1.5, LEGEND_CLEAR_M = 13;   // a walker's own stride, and the troll camp's 13.5 m edge rule less the half metre the legend roams
const placed = JSON.parse(readFileSync('origins/preview/mobs.golden.json', 'utf8')) as Placed[];

test('the rusty sword lies outside the aggro and roam of every Cinder Fields creature, and off the legend\'s spot', () => {
  const row = GROUND_ITEMS['ground:zone1.rusty-sword-1']!, at = groundPointOf(row)!, centre = groundPointOf({ zone: row.zone, place: row.place })!;
  const field = placed.filter((m) => m.zone === 'cinder-fields' && /^(scavengers|opener)/.test(m.id));
  assert.ok(field.length >= 5, 'the camp of four and the opener are in the list');
  for (const m of field) {
    const d = Math.hypot(m.home.x - at.x, m.home.z - at.z), reach = m.roam + m.aggro + MARGIN_M;
    assert.ok(d >= reach, `${m.id} is ${d.toFixed(1)} m from the sword, inside its reach of ${reach} m (roam ${m.roam} + aggro ${m.aggro} + ${MARGIN_M})`);
  }
  assert.ok(Math.hypot(at.x - centre.x, at.z - centre.z) >= LEGEND_CLEAR_M, 'the sword is off the place centre, where the legend stands');
});
