// The Exchange greybox reads the world data (exchange-plan.ts over origins/world/concord.ts) and still stands where it stood: every
// placed piece, awning, figure, brazier, the frieze and the hearth within 1 cm of the pre-switch greybox (exchange-pins.json, captured
// from every piece() call of origins/preview/exchange.ts at 345571fb). Pure: no three.js, no DOM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CONCORD, CONCORD_REGION } from '../world/concord.ts';
import { merge, type WorldData } from '../world/resolve.ts';
import { exchangeAnchors, exchangePlan } from './exchange-plan.ts';

type Pin = { layer: string; shape: [string, ...number[]]; at: [number, number, number]; rotY: number; foot: number; tint: number[] };
const PINS = JSON.parse(readFileSync(new URL('./exchange-pins.json', import.meta.url), 'utf8')) as {
  pieces: Pin[]; awnings: { at: number[]; color: string }[]; people: { at: number[]; color: string }[]; frieze: number[]; braziers: number[][]; hearth: number[];
};
const CM = 0.01;
const near = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) <= CM, `${what}: ${actual} vs ${expected} (more than 1 cm)`);

test('every placed piece of the Exchange matches the pre-switch greybox within 1 cm', () => {
  const plan = exchangePlan();
  assert.equal(plan.pieces.length, PINS.pieces.length, 'piece count');
  plan.pieces.forEach((p, i) => {
    const pin = PINS.pieces[i]!, what = `piece ${i} (${pin.layer} ${pin.shape[0]})`;
    assert.equal(p.layer, pin.layer, `${what} layer`);
    assert.equal(p.shape[0], pin.shape[0], `${what} shape`);
    const [, ...size] = p.shape, [, ...pinned] = pin.shape;
    assert.equal(size.length, pinned.length, `${what} size count`);
    size.forEach((v, k) => near(v, pinned[k]!, `${what} size ${k}`));
    near(p.x, pin.at[0], `${what} x`); near(p.y, pin.at[1], `${what} y`); near(p.z, pin.at[2], `${what} z`);
    near(p.rotY, pin.rotY, `${what} turn`); near(p.foot, pin.foot, `${what} foot`);
    p.tint.forEach((v, k) => near(v, pin.tint[k]!, `${what} tint`));
  });
  assert.equal(plan.awnings.length, PINS.awnings.length);
  plan.awnings.forEach((a, i) => { const pin = PINS.awnings[i]!; near(a.x, pin.at[0]!, `awning ${i} x`); near(a.y, pin.at[1]!, `awning ${i} y`); near(a.z, pin.at[2]!, `awning ${i} z`); assert.equal(a.color, pin.color); });
  assert.equal(plan.people.length, PINS.people.length);
  plan.people.forEach((f, i) => { const pin = PINS.people[i]!; near(f.x, pin.at[0]!, `figure ${i} x`); near(f.z, pin.at[1]!, `figure ${i} z`); assert.equal(f.color, pin.color); });
  assert.equal(plan.braziers.length, PINS.braziers.length);
  plan.braziers.forEach((b, i) => { near(b.x, PINS.braziers[i]![0]!, `brazier ${i} x`); near(b.z, PINS.braziers[i]![1]!, `brazier ${i} z`); });
  near(plan.frieze.x, PINS.frieze[0]!, 'frieze x'); near(plan.frieze.y, PINS.frieze[1]!, 'frieze y'); near(plan.frieze.z, PINS.frieze[2]!, 'frieze z');
  near(plan.hearth.x, PINS.hearth[0]!, 'hearth x'); near(plan.hearth.y, PINS.hearth[1]!, 'hearth y'); near(plan.hearth.z, PINS.hearth[2]!, 'hearth z');
});

test('the anchors are the world data: moving a landmark in concord.ts moves its pieces, and nothing else', () => {
  const moved = merge(CONCORD, { regions: { [CONCORD_REGION]: { zones: { exchange: { layout: { forge: { u: 0.3 } } } } } } }) as WorldData;
  const a = exchangeAnchors(), b = exchangeAnchors(moved);
  near(b.forge.x - a.forge.x, (0.3 - 0.2375) * 40, 'forge moved by its u');
  assert.deepEqual({ ...b, forge: a.forge }, a, 'the other anchors stay');
  const before = exchangePlan(a).pieces, after = exchangePlan(b).pieces;
  const shifted = after.filter((p, i) => Math.abs(p.x - before[i]!.x) > CM);
  assert.ok(shifted.length >= 9, 'the smithy pieces follow the forge');
  for (const p of shifted) near(p.x - before[after.indexOf(p)]!.x, b.forge.x - a.forge.x, 'each moves by the same amount');
});
