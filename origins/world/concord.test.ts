// Greybox parity (the data reproduces today's walk-out numbers to 1 cm) and rescale proportionality (scale and zone size move every
// landmark and passage with them, and keep the relative plan).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONCORD, CONCORD_REGION, concordMounts } from './concord.ts';
import { place, toMetres, toWorld } from './derive.ts';
import { merge, resolveZone, type WorldData } from './resolve.ts';
import { CAMERA } from './schema.ts';

// Today's greybox (origin/expansion/origins-greybox: origins/preview/exchange.ts and main.ts), copied: that branch is not on trunk.
const GREYBOX = {
  PASSAGE: { halfWidth: 1.25, from: -15.4, to: -25 },
  STONE_CENTRE: { x: 0, z: -45 },
  BANK_STEP_Z: -67,
  FORGE: { x: -10.5, z: -60.5 },
  BOARD: { x: -12.2, z: -36 },
  PEOPLE: 14,
  WALK: 2.3, TURN: 1.9, REACH: 3, BACKDROP: 40, FAR: 180, FOV: 51,
};
const CM = 0.01;
const near = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) <= CM, `${what}: ${actual} vs ${expected}`);

function scene(data: WorldData = CONCORD) {
  const mounts = concordMounts(data), pit = resolveZone(data, CONCORD_REGION, 'pit-yard'), ex = resolveZone(data, CONCORD_REGION, 'exchange');
  assert.ok(mounts.ok && pit.ok && ex.ok);
  const world = (zone: typeof ex.value, mount: typeof mounts.value.pit, name: string) => {
    const p = place(zone, name);
    assert.ok(p.ok);
    return toWorld(p.value, mount);
  };
  return {
    pit: pit.value, exchange: ex.value, mounts: mounts.value,
    at: (name: string) => world(ex.value, mounts.value.exchange, name),
    passage: toMetres(pit.value).passages['gladiator-gate']!,
  };
}

test('greybox parity: every Exchange position and the gladiator gate land within 1 cm of today', () => {
  const s = scene();
  const forge = s.at('forge'), stone = s.at('covenant-stone'), bank = s.at('bank'), board = s.at('contract-board'), centre = toWorld(toMetres(s.pit).landmarks.centre!, s.mounts.pit);
  near(centre.x, 0, 'pit centre x'); near(centre.z, 0, 'pit centre z');
  near(forge.x, GREYBOX.FORGE.x, 'forge x'); near(forge.z, GREYBOX.FORGE.z, 'forge z');
  near(stone.x, GREYBOX.STONE_CENTRE.x, 'stone x'); near(stone.z, GREYBOX.STONE_CENTRE.z, 'stone z');
  near(bank.x, 0, 'bank x'); near(bank.z, GREYBOX.BANK_STEP_Z, 'bank step z');
  near(board.x, GREYBOX.BOARD.x, 'board x'); near(board.z, GREYBOX.BOARD.z, 'board z');
  const from = toWorld(s.passage.from, s.mounts.pit), to = toWorld(s.passage.to, s.mounts.pit);
  near(from.z, GREYBOX.PASSAGE.from, 'passage from'); near(to.z, GREYBOX.PASSAGE.to, 'passage to'); near(from.x, 0, 'passage x');
  near(s.passage.width / 2, GREYBOX.PASSAGE.halfWidth, 'passage half width');
  near(s.mounts.exchange.z, GREYBOX.PASSAGE.to, 'the Exchange starts where the passage ends');
  // facings: the forge opens to +x (toward the plaza), the bank faces back toward the gate (+z)
  const f = place(s.exchange, 'forge'), b = place(s.exchange, 'bank');
  assert.ok(f.ok && b.ok);
  near(Math.sin(s.mounts.exchange.heading + f.value.facing), 1, 'forge faces +x');
  near(Math.cos(s.mounts.exchange.heading + b.value.facing), 1, 'bank faces +z');
  assert.equal(toMetres(s.exchange).counts.npcs, GREYBOX.PEOPLE);
  for (const zone of [s.pit, s.exchange]) {
    assert.equal(zone.movement.walkSpeed, GREYBOX.WALK); assert.equal(zone.movement.turnRate, GREYBOX.TURN);
    assert.equal(zone.reach.interactRadius, GREYBOX.REACH); assert.equal(zone.view.backdropRadius, GREYBOX.BACKDROP);
    assert.equal(zone.view.drawDistance, GREYBOX.FAR);
  }
  assert.equal(CAMERA.far, GREYBOX.FAR); assert.equal(CAMERA.fovDeg, GREYBOX.FOV);
  assert.ok(Object.isFrozen(CAMERA) && Object.isFrozen(CAMERA.follow) && Object.isFrozen(CAMERA.passage));
});

const rescaled = (over: object) => merge(CONCORD, { regions: { [CONCORD_REGION]: over } }) as WorldData;

test('double the scale: every distance doubles, the relative layout is unchanged', () => {
  const one = scene(), two = scene(rescaled({ params: { scale: { metresPerUnit: 2 } } }));
  for (const [a, b] of [[one.pit, two.pit], [one.exchange, two.exchange]] as const) {
    const ma = toMetres(a), mb = toMetres(b);
    assert.deepEqual(b.layout, a.layout);
    near(mb.width, ma.width * 2, 'width'); near(mb.depth, ma.depth * 2, 'depth'); near(mb.area, ma.area * 4, 'area');
    for (const [k, l] of Object.entries(ma.landmarks)) { near(mb.landmarks[k]!.x, l.x * 2, `${k} x`); near(mb.landmarks[k]!.d, l.d * 2, `${k} d`); }
    for (const [k, p] of Object.entries(ma.passages)) { near(mb.passages[k]!.length, p.length * 2, k); near(mb.passages[k]!.to.d, p.to.d * 2, k); }
  }
  // in the world: every Exchange landmark is twice as far from the Pit's centre, in the same direction
  for (const name of Object.keys(one.exchange.layout)) {
    const a = one.at(name), b = two.at(name);
    near(b.x, a.x * 2, `${name} world x`); near(b.z, a.z * 2, `${name} world z`);
  }
  // the hero does not scale: movement and reach are metres
  assert.deepEqual(two.exchange.movement, one.exchange.movement);
});

test('resize one zone: its landmarks follow its size, its plan (u, v) does not move', () => {
  const big = scene(rescaled({ zones: { exchange: { zoneSize: { width: 80, depth: 75 } } } })), base = scene();
  for (const name of Object.keys(base.exchange.layout)) {
    const a = toMetres(base.exchange).landmarks[name]!, b = toMetres(big.exchange).landmarks[name]!;
    near(b.x, a.x * 2, `${name} x`); near(b.d, a.d * 1.5, `${name} d`);
  }
  assert.deepEqual(big.mounts, base.mounts); // the Pit did not move
});
