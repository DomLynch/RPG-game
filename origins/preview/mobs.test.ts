// Origins slice 1, bite 1 (?region=1): the Frontier's creatures. Placement from the Region 1 data, the seeded wander, the aggro test with its
// hysteresis, the facing, the cap and the cull. Pure: no DOM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FRONTIER, frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobLook } from './mob-looks.ts';
import { TUNING, aggroTest, headingTo, hiddenInFight, mobSpecs, mobStand, newMob, nextRandom, pickVisible, previewRows, spawnAmong, stepMob, turnToward, wanderTarget, type Mob, type MobSpec } from './mobs.ts';

const F = frontierPlan(), B = frontierBuild(F), SPECS = mobSpecs(F, B), ZONES = new Map(F.zones.map((z) => [z.zone, z]));
const standOf = (s: MobSpec) => mobStand(B, ZONES.get(s.zone)!);
const byZone = (zone: string) => SPECS.filter((s) => s.zone === zone);
const at = (x: number, z: number) => ({ x, z });

test('the Frontier is populated from the data: scavengers on the Cinder Fields, brood and the Mere-Mother at the Black Mere, ghouls at the Blood Ruin', () => {
  assert.equal(byZone('cinder-fields').filter((s) => !s.named).length, 6, 'a camp of four (a leader and three, Strategy), one lone opener near the entry (zone-rules), and the one Ash Boar at the hold road');
  assert.deepEqual(byZone('ferry-landing').map((s) => s.id), ['opener-ferry-landing-1'], 'the landing has one creature: its opener');
  assert.deepEqual([...new Set(byZone('cinder-fields').map((s) => s.character))].sort(), ['character:ash-boar', 'character:cinder-scavenger', 'character:hrungnir']);
  assert.deepEqual(byZone('black-mere').map((s) => s.character).sort(), ['character:mere-brood', 'character:mere-brood', 'character:mere-brood', 'character:mere-brood', 'character:mere-mother', 'character:peg-powler']);
  assert.deepEqual(byZone('blood-ruin').map((s) => s.character), ['character:ruin-ghoul', 'character:ruin-ghoul', 'character:ruin-ghoul', 'character:cinder-bear'], 'the ghouls, then the one Cinder Bear at the ruin jetty');
  assert.deepEqual(byZone('east-road').map((s) => s.character), ['character:court-thrall']);
  for (const quiet of ['cinder-hold', 'mere-end']) assert.equal(byZone(quiet).length, 0, `${quiet}: a town has no creatures in it (the landing is not a town: it has its opener)`);
  assert.equal(SPECS.length, 19);
  assert.equal(new Set(SPECS.map((s) => s.id)).size, SPECS.length, 'ids are unique');
});

test('each creature carries the body, level and encounter its character record names; the named ones are the encounters\' bosses', () => {
  const row = (character: string) => SPECS.find((s) => s.character === character)!;
  assert.deepEqual([row('character:cinder-scavenger').body, row('character:mere-brood').body, row('character:ruin-ghoul').body], ['goblin', 'goblin', 'goblin']);
  assert.deepEqual([row('character:hrungnir').body, row('character:peg-powler').body, row('character:mere-mother').body, row('character:court-thrall').body], ['knight', 'witch', 'witch', 'pitborn']);
  assert.equal(row('character:hrungnir').encounter, 'encounter:bounty-hrungnir');
  assert.equal(row('character:mere-mother').level, 15);
  assert.equal(row('character:cinder-scavenger').encounter, null);
  assert.equal(row('character:cinder-scavenger').name, 'Cinder scavenger');
  assert.ok(SPECS.every((s) => (s.named) === (s.encounter !== null)));
  assert.ok(SPECS.every((s) => s.level >= 11 && s.level <= 17));
});

test('every home stands inside its own zone, clear of every building, and nobody starts near the Exchange', () => {
  for (const s of SPECS) {
    assert.ok(standOf(s)(s.home.x, s.home.z), `${s.id} home is not walkable ground`);
    assert.ok(F.zones.find((z) => z.zone === s.zone)!.region === FRONTIER);
  }
  const exchangeEdge = F.road.to;
  assert.ok(SPECS.every((s) => Math.hypot(s.home.x - exchangeEdge.x, s.home.z - exchangeEdge.z) > 15), 'no creature starts at the Exchange gate');
});

test('placement is deterministic', () => {
  assert.deepEqual(mobSpecs(F, B), SPECS);
});

test('the seeded random is reproducible and in [0, 1)', () => {
  let a = 1234, b = 1234;
  for (let i = 0; i < 500; i++) {
    const [x, ax] = nextRandom(a), [y, by] = nextRandom(b);
    assert.equal(x, y); assert.ok(x >= 0 && x < 1); a = ax; b = by;
  }
});

function run(spec: MobSpec, seconds: number, hero: { x: number; z: number } | null, dt = 0.05, from?: Mob) {
  const stand = standOf(spec); let m = from ?? newMob(spec, 0); const trail: Mob[] = [];
  for (let t = 0; t < seconds; t += dt) { m = stepMob(m, spec, hero, dt, stand); trail.push(m); }
  return { m, trail, stand };
}

test('wander: the same seed walks the same route, and it differs between creatures', () => {
  const a = SPECS[0]!, b = SPECS[1]!;
  assert.deepEqual(run(a, 60, null).trail, run(a, 60, null).trail);
  assert.notDeepEqual(run(a, 60, null).trail.at(-1)!.facing, run(b, 60, null).trail.at(-1)!.facing);
});

test('wander: every creature actually moves, stays within its roam of home and on walkable ground for ten minutes', () => {
  for (const [i, s] of SPECS.entries()) {
    const stand = standOf(s); let m = newMob(s, i), moved = 0, last = { x: m.x, z: m.z };
    for (let t = 0; t < 600; t += 0.1) {
      m = stepMob(m, s, null, 0.1, stand);
      assert.ok(stand(m.x, m.z), `${s.id} left the walkable ground at ${t.toFixed(1)}s`);
      assert.ok(Math.hypot(m.x - s.home.x, m.z - s.home.z) <= s.roam + 0.5, `${s.id} strayed ${Math.hypot(m.x - s.home.x, m.z - s.home.z).toFixed(1)} m from home`);
      moved += Math.hypot(m.x - last.x, m.z - last.z); last = { x: m.x, z: m.z };
    }
    assert.ok(moved > 8, `${s.id} barely moved (${moved.toFixed(1)} m in ten minutes)`);
  }
});

test('wander: a creature never takes a step off walkable ground even when its target lies past a wall', () => {
  const s = SPECS[0]!, wall = (x: number) => x < s.home.x + 1;   // east of home is "outside"
  let m: Mob = { ...newMob(s, 0), mode: 'wander', tx: s.home.x + 5, tz: s.home.z, wait: 3 };
  for (let t = 0; t < 30; t += 0.05) { m = stepMob(m, s, null, 0.05, (x) => wall(x)); assert.ok(m.x < s.home.x + 1 + 0.001, 'stepped through the wall'); }
});

test('wanderTarget: only walkable points inside the roam; an unwalkable roll leaves it standing', () => {
  const s = SPECS[0]!, stand = standOf(s); let rng = 99, hits = 0;
  for (let i = 0; i < 200; i++) {
    const r = wanderTarget(s, rng, stand); rng = r.rng;
    if (r.to) { hits++; assert.ok(Math.hypot(r.to.x - s.home.x, r.to.z - s.home.z) <= s.roam + 1e-9); assert.ok(stand(r.to.x, r.to.z)); }
  }
  assert.ok(hits > 150);
  assert.equal(wanderTarget(s, 5, () => false).to, null);
});

test('aggro: inside the ring a creature stops, and turns to face the hero', () => {
  const s = SPECS[0]!, m0 = newMob(s, 0), hero = at(m0.x + 4, m0.z + 3);   // 5 m off, inside the ring
  assert.ok(aggroTest(m0, s, hero));
  const { m, trail } = run(s, 4, hero, 0.05, { ...m0, mode: 'wander', tx: m0.x - 6, tz: m0.z, wait: 2 });
  assert.equal(m.mode, 'aggro');
  assert.ok(trail.every((t) => t.x === m0.x && t.z === m0.z), 'it does not walk while it is watching the hero');
  assert.ok(Math.abs(turnToward(m.facing, headingTo(m, hero), 10) - m.facing) < 1e-6, 'it faces the hero');
});

test('aggro: the ring edge has hysteresis, so a hero on the rim does not flicker the creature', () => {
  const s = SPECS[0]!, m0 = newMob(s, 0), outside = at(m0.x + s.aggro + 0.5, m0.z), rim = at(m0.x + s.aggro + TUNING.hold - 0.2, m0.z), far = at(m0.x + s.aggro + TUNING.hold + 0.5, m0.z);
  assert.equal(aggroTest(m0, s, outside), false, 'calm outside the ring');
  assert.equal(aggroTest({ ...m0, mode: 'aggro' }, s, rim), true, 'still watching just past the ring');
  assert.equal(aggroTest({ ...m0, mode: 'aggro' }, s, far), false, 'lets go beyond the hold');
  assert.equal(aggroTest(m0, s, null), false, 'no hero, no aggro');
});

test('aggro: when the hero leaves it pauses, then goes back to wandering', () => {
  const s = SPECS[0]!, m0 = newMob(s, 0), near = at(m0.x + 3, m0.z), gone = at(m0.x + 80, m0.z);
  const watching = run(s, 2, near, 0.05, m0).m, back = run(s, 40, gone, 0.05, watching);
  assert.equal(watching.mode, 'aggro');
  assert.ok(back.trail.some((t) => t.mode === 'wander'), 'it resumed its round');
  assert.ok(back.trail.every((t) => t.mode !== 'aggro'));
});

test('named creatures notice from further off than the common ones', () => {
  const named = SPECS.find((s) => s.named)!, common = SPECS.find((s) => !s.named)!;
  assert.ok(named.aggro > common.aggro);
});

test('turnToward swings the short way round and never overshoots', () => {
  assert.ok(Math.abs(turnToward(0, 1, 0.3) - 0.3) < 1e-9);
  assert.ok(Math.abs(turnToward(Math.PI - 0.1, -Math.PI + 0.1, 0.05) - (Math.PI - 0.05)) < 1e-9, 'across the ±π seam, the short way');
  assert.ok(Math.abs(turnToward(0.2, 0.25, 1) - 0.25) < 1e-9);
  assert.ok(Math.abs(headingTo(at(0, 0), at(0, 5))) < 1e-9, 'facing +z is heading 0');
  assert.ok(Math.abs(headingTo(at(0, 0), at(5, 0)) - Math.PI / 2) < 1e-9);
});

test('visible set: the nearest twelve inside 45 m, nearest first; the rest culled', () => {
  const ring = Array.from({ length: 20 }, (_, i) => at(i * 3, 0));   // 0..57 m out
  const seen = pickVisible(ring, at(0, 0));
  assert.equal(seen.length, 12);
  assert.deepEqual(seen, [...Array(12).keys()]);
  assert.deepEqual(pickVisible(ring, at(0, 0), 99), [...Array(16).keys()], 'nothing past 45 m (index 15 is 45 m out)');
  assert.deepEqual(pickVisible(ring, at(1000, 0)), []);
  assert.equal(pickVisible(SPECS.map((s) => s.home), SPECS[0]!.home).length <= TUNING.cap, true);
});

test("every creature on the Frontier has a look in Characters' mob-looks table, on the body the plan gives it", () => {
  for (const s of SPECS) {
    const look = mobLook(s.character);
    assert.ok(look, `${s.id} (${s.character}) has no mob look`);
    assert.equal(look.opponent, s.body, `${s.id}: the look dresses a ${look.opponent}, the plan gives it a ${s.body}`);
  }
});

// Dom's spawn ruling (2026-10-07, "simplest"; the bundle's spawnAmong uses 25/35 and [15, 25]): the Zone 1 hero starts 25-35 m from the nearest creature (past the 14 m tap reach and every notice ring, close enough to see them);
// under ?wolf the nearest wolf is 15-25 m ahead and the hero faces the wolf camp. The bounds are the ruling, so they are written out here and not derived from the constants.
test('the hero spawns in sight of the creatures but outside their reach: 25-35 m from the nearest, never inside a notice ring; under ?wolf 15-25 m from the nearest wolf, facing it', () => {
  const at = spawnAmong(F, B, SPECS)!;
  assert.ok(at, 'a spawn exists');
  const zone = F.zones.find((z) => z.zone === SPECS.find((s) => Math.hypot(s.home.x - at.x, s.home.z - at.z) < 45)!.zone)!;
  assert.ok(mobStand(B, zone)(at.x, at.z), 'a free spot in the zone');
  const dist = (s: MobSpec) => Math.hypot(s.home.x - at.x, s.home.z - at.z), nearest = Math.min(...SPECS.map(dist));
  assert.ok(nearest >= 25 && nearest <= 35, `the nearest creature is ${nearest.toFixed(1)} m: past the 14 m tap reach, in sight`);
  assert.ok(SPECS.filter((s) => dist(s) < 45).length >= 4, 'at least four creatures within sight (45 m)');
  assert.deepEqual(spawnAmong(F, B, SPECS), at, 'deterministic');
  const wolfSpecs = mobSpecs(F, B, previewRows('?wolf')), w = spawnAmong(F, B, wolfSpecs)!, wolves = wolfSpecs.filter((s) => s.body === 'wolf');
  const wd = Math.min(...wolves.map((s) => Math.hypot(s.home.x - w.x, s.home.z - w.z))), others = Math.min(...wolfSpecs.filter((s) => s.body !== 'wolf').map((s) => Math.hypot(s.home.x - w.x, s.home.z - w.z)));
  assert.ok(wolves.length >= 2 && wd >= 15 && wd <= 25, `nearest wolf ${wd.toFixed(1)} m`);
  assert.ok(others >= 25, `the goblins stay ${others.toFixed(1)} m off`);
  const c = wolves.reduce((n, s) => ({ x: n.x + s.home.x / wolves.length, z: n.z + s.home.z / wolves.length }), { x: 0, z: 0 }), dh = w.facing - headingTo(w, c);
  assert.ok(Math.abs(Math.atan2(Math.sin(dh), Math.cos(dh))) < 0.01, 'he faces the wolf camp');
});

test('the placed list is exactly what it was before the rows (origins/preview/mobs.golden.json: the trunk list before the mob rows, plus the two openers the zone rules added: cinder-fields and ferry-landing)', () => {
  const golden = JSON.parse(readFileSync(new URL('./mobs.golden.json', import.meta.url), 'utf8')) as MobSpec[];
  assert.deepEqual(JSON.parse(JSON.stringify(SPECS)), golden, '19 creatures: the 17 before, unchanged, plus the Cinder Bear and the Ash Boar (appended last so the others keep their seeds)');
});

test('?wolf adds the Ash Wolf camp to the Cinder Fields for that page only: without it nothing changes, with it three wolves stand on their own body', () => {
  assert.deepEqual(mobSpecs(F, B, previewRows('?region=1')), SPECS, 'no flag: the placed list is the golden one');
  const wolves = mobSpecs(F, B, previewRows('?region=1&wolf')).filter((s) => s.character === 'character:ash-wolf');
  assert.equal(wolves.length, 3, 'campSize 2..3: the camp is the row\'s upper size');
  assert.ok(wolves.every((w) => w.body === 'wolf' && w.zone === 'cinder-fields' && w.level >= 11 && w.level <= 13 && !w.named && standOf(w)(w.home.x, w.home.z)));
});

test('a world fight hides only the duel\'s foe: packmates beside the hero and far creatures stay in view (Dom, 2026-10-08: 2 vs 1 is fine, nothing hides at engage; re-pinned from the 20 m freeze radius, which seamless combat removed)', () => {
  assert.equal(hiddenInFight('wolves-1', 'wolves-1'), true, 'the duel draws the foe');
  assert.equal(hiddenInFight('wolves-2', 'wolves-1'), false, 'a packmate beside the hero stays visible');
  assert.equal(hiddenInFight('goblin-1', 'wolves-1'), false, 'a far creature is still drawn: nothing past a radius is hidden any more');
  assert.equal(hiddenInFight('goblin-1', null), false);
});

test('the world keeps living during a world duel: the walk loop never stops, it keeps ticking the creatures, fires and arena while the duel draws, and the foe\'s world body stays hidden (Dom, 2026-10-08: one always-on world; re-pinned from the separate liveWorld tick)', () => {
  const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8'), view = readFileSync(new URL('./mobs-view.ts', import.meta.url), 'utf8');
  assert.match(main, /attach\(\) \{[^\n]*mobs\?\.engage\(spec\.id\); duelDrawing = true;/, 'attach hides the foe and hands the drawing to the duel');
  assert.match(main, /detach\(\) \{[^\n]*mobs\?\.engage\(null\); duelDrawing = false;/, 'detach gives it back');
  assert.match(main, /if \(duelDrawing\) \{[^\n]*\n\s*mobs\?\.update\(dt, state, cardId\);[^\n]*\n\s*return;/, 'while the duel draws, the walk loop still steps the creatures and does not render');
  assert.match(main, /if \(!WORLDFIGHT\) renderer\.setAnimationLoop\(null\);/, 'a world fight never stops the loop');
  assert.match(view, /v\.group\.visible = v\.ring\.visible = !hiddenInFight\(s\.id, engaged\);/);
});

test('"Back to the fields" takes a tap in a world fight: #leave is in the world layer\'s pointer-events:auto list (Web, 2026-10-08: the canvas got the hit)', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const auto = /([^{}]*)\{\s*pointer-events:\s*auto;\s*\}/g, lists = [...html.matchAll(auto)].map((m) => m[1]!);
  assert.ok(lists.some((l) => l.includes('#duel.world #leave')), 'the world layer is pointer-events:none; #leave must opt back in');
});
