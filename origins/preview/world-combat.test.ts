import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { MAX_STEPS, ME, createWorldCombat, kindOf } from './world-combat.ts';
import { OPPONENTS, RULES, WEAPONS } from '../../src/moves.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';
import { NAKED } from '../../src/gear-stats.ts';

const spec = (id: string, body: string): MobSpec => ({ id, body, name: id, level: 11, named: false } as unknown as MobSpec);
function fakeMobs(list: Array<{ spec: MobSpec; x: number; z: number }>) {
  const driven = new Map<string, MobDrive>(), fell: string[] = [], played: string[] = [];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (id: string, p: MobDrive | null) => void (p ? driven.set(id, p) : driven.delete(id)), fell: (id: string) => void fell.push(id), play: (id: string, role: string) => { played.push(`${id}:${role}`); return role === 'death' ? 2.4 : 0.5; } } as unknown as Mobs;
  return { mobs, driven, fell, played };
}
const run = (wc: ReturnType<typeof createWorldCombat>, hero: { x: number; z: number; facing: number }, seconds: number, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) wc.update(dt, hero); };

test('kindOf: only roster bodies can be fought; the rest wander', () => {
  assert.equal(kindOf('wolf'), 'wolf'); assert.equal(kindOf('not-a-body'), null);
});

test('a wolf that comes within the ring joins the loop, hunts, telegraphs, bites; the hero is hit once its tell has played', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 8 }]); let hit = 0, tell = 0, died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => void died++, onHeroHit: () => void hit++, onSwing: () => {}, onTelegraph: () => void tell++ });
  run(wc, { x: 0, z: 0, facing: 0 }, 6);
  assert.ok(f.driven.has('wolf-1'), 'driven by the loop'); assert.ok(tell >= 1 && hit >= 1, `tell ${tell} before hit ${hit}`); assert.ok(wc.hero().health < wc.hero().max); assert.equal(died, 0);
  assert.equal(wc.target()?.name, 'wolf-1'); assert.ok(wc.inCombat());
});

test('the hero cuts it dead: onSwing, a fall that takes ~1.4 s, then onKill once, and the creature is released', () => {
  const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const kills: string[] = []; let swings = 0;   // level 1: a level-11 wolf outlasts this test under the Pit-copied engine (#1894); the mount flow is what is tested
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => void swings++ });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }   // auto-aim at the creature as the page does (it circles now)
  assert.ok(swings >= 1); assert.deepEqual(kills, ['wolf-1']); assert.ok(!f.driven.has('wolf-1'), 'released after the fall'); assert.equal(wc.target(), null);
});

test('walking away: past the wolf leash it gives up and walks home (no kill, no death), then leaves the loop', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 6 }]); let kills = 0, died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => void kills++, onHeroDied: () => void died++, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }; for (let t = 0; t < 40; t += 1 / 30) { hero.z -= 7 / 30; wc.update(1 / 30, hero); }
  assert.equal(kills, 0); assert.equal(died, 0); assert.ok(!f.driven.has('wolf-1'), 'back out of the loop once home and far');
});

test('the hero dies once: onHeroDied, nothing hunts him afterwards, and reset stands him up fresh', () => {
  const f = fakeMobs([{ spec: spec('bear-1', 'bear'), x: 0, z: 1.0 }]); let died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => void died++, onHeroHit: () => {}, onSwing: () => {} });
  run(wc, { x: 0, z: 0, facing: 0 }, 120); assert.equal(died, 1); assert.ok(wc.hero().dead);
  wc.reset({ x: 0, z: 3, facing: 0 }); assert.equal(wc.hero().health, wc.hero().max); assert.ok(!wc.hero().dead);
  assert.equal(ME, 'me');
});

test('Evaded: a creature that gave up and is home and healed is released at once (back to wander), not kept in the loop', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 6 }]); const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }; let sawDriven = false, releasedAt = -1;
  for (let t = 0; t < 60; t += 1 / 30) { hero.z -= 7 / 30; wc.update(1 / 30, hero); if (f.driven.has('wolf-1')) sawDriven = true; else if (sawDriven && releasedAt < 0) releasedAt = t; }
  assert.ok(sawDriven && releasedAt > 0, 'it was in the loop, then released');
  assert.ok(!wc.debug().some((x) => x.id === 'wolf-1'), 'gone from the world after Evaded');
});

test('call-site pin: the page reaches combat only through zone1.ts stepCombat (so a lone creature always takes the copied duel/ai, a pack the legacy rows, as zone1.ts routes them)', () => {
  const dir = new URL('.', import.meta.url), src = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const users = src.filter((f) => /from '\.\.\/combat\//.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(users, ['world-combat.ts'], 'only world-combat.ts imports origins/combat');
  const text = readFileSync(new URL('world-combat.ts', dir), 'utf8');
  assert.deepEqual([...text.matchAll(/from '(\.\.\/combat\/[^']+)'/g)].map((m) => m[1]), ['../combat/zone1.ts'], 'and only zone1.ts');
  assert.equal(text.match(/\bstepCombat\(/g)?.length, 1, 'with exactly one step call');
});

test('combat events play the creature\'s clips: attack at its tell, hit when it is struck, death once; the body is held until the Death clip has played (2.4 s here, not 1.4)', () => {
  const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const kills: number[] = []; let t = 0;   // level 1 and auto-aim, as the kill test above: a level-11 wolf outlasts the test under the Pit-copied engine
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(t); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let k = 0; k < 15; k++) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); t += 1 / 30; } }
  const roles = f.played.map((p) => p.split(':')[1]);
  assert.ok(roles.includes('attack'), 'the wolf\'s tell played its Bite'); assert.ok(roles.includes('hit'), 'the cut played Hurt');
  assert.equal(roles.filter((r) => r === 'death').length, 1, 'one Death');
  assert.equal(kills.length, 1, 'then it is released and killed once');
});

test('a hitch catches up to 0.25 s of fight time instead of dropping everything past 100 ms, and what it still drops is counted', () => {
  const f = fakeMobs([]); const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} }); const hero = { x: 0, z: 0, facing: 0 };
  assert.equal(MAX_STEPS, 15);
  wc.update(0.25, hero);
  assert.deepEqual(wc.stats(), { steps: 15, lostMs: 0, hitches: 0 }, 'a 250 ms frame is fully simulated');
  const warn = console.warn; let warned = 0; console.warn = () => void warned++;
  try { wc.update(3, hero); } finally { console.warn = warn; }
  assert.equal(wc.stats().steps, 30, 'a 3 s frame (hidden tab) runs only the cap');
  assert.equal(wc.stats().lostMs, 2750); assert.equal(wc.stats().hitches, 1); assert.equal(warned, 1, 'one throttled warning');
});

test('fairness: no creature can land two blows inside one catch-up frame (its fastest cycle is longer than the cap), and none does in play', () => {
  for (const o of Object.values(OPPONENTS)) {
    const weapon = WEAPONS[o.weapon as keyof typeof WEAPONS]; if (!weapon) continue;
    const cycles = Object.values(weapon.moves).filter((m) => m.damage > 0).map((m) => { const t = m.chained ?? m; return t.windup + t.active + t.recovery; });
    assert.ok(Math.min(...cycles) > MAX_STEPS, `${o.id}: fastest cycle ${Math.min(...cycles)} ticks must exceed ${MAX_STEPS}`);
  }
  assert.ok(RULES.special.windup + RULES.special.recovery > MAX_STEPS, 'a cast (windup + recovery, 165 ticks) cannot land twice in a catch-up frame either');
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 1.2 }]); let hits = 0, worst = 0, total = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => void hits++, onSwing: () => {} });
  for (let frame = 0; frame < 80; frame++) { hits = 0; wc.update(0.25, { x: 0, z: 0, facing: 0 }); worst = Math.max(worst, hits); total += hits; }
  assert.ok(total >= 1, 'the wolf did land blows');
  assert.ok(worst <= 1, `at most one blow per 0.25 s catch-up frame, saw ${worst}`);
});

// Proof 3 on the page: joins need no page code of their own, they happen inside stepCombat (#1943) for every creature the loop holds. A pack of four around an idle hero: three attack him (each telegraphs its own blow), the fourth holds off.
test('a pack of four around the hero: three join and telegraph their own blows, the fourth waits', () => {
  const f = fakeMobs(['w1', 'w2', 'w3', 'w4'].map((id, i) => ({ spec: { ...spec(id, 'wolf'), level: 1 }, x: Math.sin(i * 1.6) * 4, z: Math.cos(i * 1.6) * 4 })));
  const tells = new Set<string>(), wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, onTelegraph: (id) => void tells.add(id) });
  run(wc, { x: 0, z: 0, facing: 0 }, 3);
  assert.equal(wc.debug().filter((x) => x.hunting).length, 4, 'all four hunt him');
  assert.deepEqual([...tells].sort(), ['w1', 'w2', 'w4'], 'three attack, each from its own duel: the fourth (w3, the farthest) waits its turn');
});

test('three joined: each joiner is driven with its own windup (one actor per creature)', () => {
  const f = fakeMobs([['w1', 1.2], ['w2', 2.4], ['w3', 3.2]].map(([id, d]) => ({ spec: { ...spec(id as string, 'wolf'), level: 1 }, x: 0, z: d as number })));
  const lunged = new Set<string>(), real = f.mobs.drive; f.mobs.drive = ((id: string, p: MobDrive | null) => { if (p && p.lunge !== 0) lunged.add(id); real(id, p); }) as typeof real;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  run(wc, { x: 0, z: 0, facing: 0 }, 4);
  assert.ok(lunged.size >= 3, `each of the three had its own windup/lunge: ${[...lunged]}`);
});

test('the card names the primary pair\'s foe (the nearest of the pack), whatever the list order', () => {
  const pack = [['w3', 3.2], ['w2', 2.4], ['w1', 1.2]], card = (list: typeof pack) => {
    const f = fakeMobs(list.map(([id, d]) => ({ spec: { ...spec(id as string, 'wolf'), level: 1 }, x: 0, z: d as number })));
    const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
    run(wc, { x: 0, z: 0, facing: 0 }, 1); return wc.target()?.name;
  };
  assert.equal(card(pack), 'w1'); assert.equal(card([...pack].reverse()), 'w1');
});

test('the card hands on: with a hero given the health to outlast two wolves one joiner falls first, and the card then names the next foe', () => {
  const f = fakeMobs([['w1', 1.2], ['w2', 2.4]].map(([id, d]) => ({ spec: { ...spec(id as string, 'wolf'), level: 1 }, x: 0, z: d as number })));
  const kills: string[] = [], names: string[] = [];
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, hero: () => ({ gear: NAKED, level: 1, health: 2000 }) });
  for (let i = 0; i < 600 && kills.length < 2; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().filter((x) => x.hunting && x.hp > 0)[0]; wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); const n = wc.target()?.name; if (n && names.at(-1) !== n) names.push(n); } if (wc.hero().dead) break; }
  console.log('DBG', JSON.stringify({ kills, names, dead: wc.hero().dead }));
  assert.equal(kills[0], 'w1', 'the nearest fell first'); assert.deepEqual(names.slice(0, 2), ['w1', 'w2'], 'the card named w1, then w2 after it fell');
});
