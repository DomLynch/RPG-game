import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { MAX_STEPS, ME, createWorldCombat, kindOf } from '../../src/fight/index.ts';
import { OPPONENTS, RULES, WEAPONS } from '../../src/fight/moves.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';
import { NAKED } from '../../src/fight/gear-stats.ts';
import { sheetOf, type Sheet } from '../../src/fight/sheet-rows.ts';
import { sheetFor } from '../../src/fight/gear-numbers.ts';
import type { Loot } from '../../src/core/loot.ts';

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
  assert.equal(wc.target()?.name, 'wolf-1'); assert.equal(wc.target()?.id, 'wolf-1', 'the target carries its creature id (the creature card follows the fight by it)'); assert.ok(wc.inCombat());
});

test('the hero cuts it dead: onSwing, a fall that takes ~1.4 s, then onKill once, and the creature is released', () => {
  const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const kills: string[] = []; let swings = 0;   // level 1: a level-11 wolf outlasts this test under the Pit-copied engine (#1894); the mount flow is what is tested
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => void swings++ });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }   // auto-aim at the creature as the page does (it circles now)
  assert.ok(swings >= 1); assert.deepEqual(kills, ['wolf-1']); assert.ok(!f.driven.has('wolf-1'), 'released after the fall'); assert.equal(wc.target(), null);
});

test('K5: the loop reports every hit on a creature (fight-seeded, with its hp fraction), a tick each frame it is up, and its release, so its wounds row can draw the blood', () => {
  const run1 = () => {
    const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const hits: { seed: number; kill: boolean; hpFrac: number; fromX: number; fromZ: number }[] = [], gone: string[] = []; let ticks = 0, kills = 0;
    const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills++; }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, onCreatureHit: (_s, h) => void hits.push(h), onCreatureTick: () => void ticks++, onCreatureGone: (id) => void gone.push(id) });
    for (let i = 0; i < 400 && kills === 0; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }
    return { hits, ticks, gone, kills };
  };
  const a = run1(), b = run1();
  assert.ok(a.hits.length >= 1 && a.ticks > 0, `hits ${a.hits.length}, ticks ${a.ticks}`);
  assert.ok(a.hits.every((h) => h.hpFrac >= 0 && h.hpFrac <= 1), 'hp fraction in [0, 1]');
  assert.equal(a.hits.filter((h) => h.kill).length, 1, 'exactly the last hit is the kill');
  assert.equal(a.hits.at(-1)!.kill, true); assert.equal(a.hits.at(-1)!.hpFrac, 0);
  assert.ok(a.hits[0]!.hpFrac < 1, 'the first hit is reported after it landed');
  assert.deepEqual(a.gone, ['wolf-1'], 'released once, after the fall');
  assert.deepEqual(b, a, 'the same fight reports the same seeds and hp: a replay bleeds the same');
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

test('call-site pin: the loop (src/fight/world-combat.ts) reaches combat only through the engine world.ts stepCombat, and no page file under origins/preview imports world.ts itself', () => {
  const dir = new URL('.', import.meta.url), src = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  assert.deepEqual(src.filter((f) => /src\/fight\/world\.ts'/.test(readFileSync(new URL(f, dir), 'utf8'))), [], 'the page goes through src/fight/index.ts');
  const text = readFileSync(new URL('../../src/fight/world-combat.ts', import.meta.url), 'utf8');
  assert.deepEqual([...text.matchAll(/from '(\.\/world\.ts)'/g)].map((m) => m[1]), ['./world.ts'], 'one door into the world loop');
  assert.equal(text.match(/\bstepCombat\(/g)?.length ?? 0, 0, 'which does not step it itself');
  assert.equal(text.match(/\bstepHero\(/g)?.length, 1, 'but through the one frame step (world-record.ts stepHero, which the server replays), called once');
  assert.equal(readFileSync(new URL('../../src/fight/world-record.ts', import.meta.url), 'utf8').match(/\bstepCombat\(/g)?.length, 1, 'whose body holds the one stepCombat call');
});

test('a creature that is struck down falls, is released and killed once (the engine\'s actor plays its Death from the duel)', () => {
  const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const kills: number[] = []; let t = 0;   // level 1 and auto-aim, as the kill test above: a level-11 wolf outlasts the test under the Pit-copied engine
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(t); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let k = 0; k < 15; k++) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); t += 1 / 30; } }
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
  const f = fakeMobs(['w1', 'w2', 'w3', 'w4'].map((id, i) => ({ spec: { ...spec(id, 'wolf'), level: 1 }, x: Math.sin(i * 1.6) * (i === 2 ? 4.5 : 4), z: Math.cos(i * 1.6) * (i === 2 ? 4.5 : 4) })));   // w3 half a metre farther: the pose's cm rounding no longer decides the tie
  const tells = new Set<string>(), wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, onTelegraph: (id) => void tells.add(id) });
  run(wc, { x: 0, z: 0, facing: 0 }, 3);
  assert.equal(wc.debug().filter((x) => x.hunting).length, 4, 'all four hunt him');
  assert.deepEqual([...tells].sort(), ['w1', 'w2', 'w4'], 'three attack, each from its own duel: the fourth (w3, the farthest) waits its turn');
});

test('three joined: each joiner is driven with its own windup (one actor per creature)', () => {
  const f = fakeMobs([['w1', 1.2], ['w2', 2.4], ['w3', 3.2]].map(([id, d]) => ({ spec: { ...spec(id as string, 'wolf'), level: 1 }, x: 0, z: d as number })));
  const lunged = new Set<string>(), real = f.mobs.drive; f.mobs.drive = ((id: string, p: MobDrive | null) => { if (p?.duel?.fighters[1].phase === 'attack') lunged.add(id); real(id, p); }) as typeof real;
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

test('a frame that runs no step (dt 0: the clock\'s first frame, or a very short one) asks the page to move the hero nowhere: the loop\'s body only follows the page after its first step', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 90, z: 90 }]), wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, onTelegraph: () => {} });
  const hero = { x: -70, z: -110, facing: 0 };
  assert.deepEqual(wc.update(0, hero), { dx: 0, dz: 0 }, 'live Zone 2 teleported the hero to (0, 0) on this frame (3 loads in 8)');
  assert.deepEqual(wc.update(1 / 60, hero), { dx: 0, dz: 0 }, 'and a normal frame after it still moves him nowhere');
});

test('the hero is rebuilt from hero() at the next clean window open: a sheet that arrives after load is the live fighter (the record\'s heroBody() reads the same hero())', () => {
  const sheet = sheetOf({ level: 10, placed: { health: 10 } })!; assert.ok(sheet, 'a placed point moves the dials');
  const make = (hero: () => { gear: typeof NAKED; level: number; sheet?: Sheet }) => {
    const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 8 }]);
    return createWorldCombat({ mobs: () => f.mobs, hero, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  };
  const server: { sheet?: Sheet } = {};   // what the server's view has sent so far
  const late = make(() => ({ gear: NAKED, level: 1, ...(server.sheet ? { sheet: server.sheet } : {}) })), born = make(() => ({ gear: NAKED, level: 1, sheet })), bare = make(() => ({ gear: NAKED, level: 1 }));
  server.sheet = sheet;   // the server's view and the build fetch arrive after load
  for (const wc of [late, born, bare]) wc.update(1 / 30, { x: 0, z: 0, facing: 0 });
  assert.equal(late.hero().max, born.hero().max, 'the late hero is the one a sheeted-at-load hero is');
  assert.notEqual(late.hero().max, bare.hero().max, 'and not the bare one');
});

test('sheet-in-world gate: while the loadout is not ready no creature joins (no fight on the bare body), and when it is the fight starts on the sheet with its armour in the trace', () => {
  const sheet = sheetOf({ level: 20, placed: { health: 10, armour: 10 } })!; assert.ok(sheet.armour, 'armour is on the sheet');
  const state: { ready: boolean; sheet?: Sheet } = { ready: false };
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 2 }]);
  const wc = createWorldCombat({ mobs: () => f.mobs, loadoutReady: () => state.ready, hero: () => ({ gear: NAKED, level: 1, ...(state.sheet ? { sheet: state.sheet } : {}) }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 };
  run(wc, hero, 1);   // the wolf is on top of him but the loadout has not answered
  assert.equal(wc.debug().length, 1, 'no creature joined while the loadout was late'); assert.equal(wc.trace().ready, false); assert.equal(f.driven.size, 0, 'and none was driven');
  const bareMax = wc.trace().maxHealth;
  state.sheet = sheet; state.ready = true;   // the build and the worn-gear view answer
  run(wc, hero, 1);
  assert.equal(wc.debug().length, 2, 'now the wolf joins'); const t = wc.trace();
  assert.equal(t.ready, true); assert.ok(t.maxHealth > bareMax, 'and the hero it fights has the sheet\'s health, not the bare 150'); assert.equal(t.sheet?.armour, sheet.armour, 'the armour dial is in the trace');
});

test('idle hero sheet: with no creature near, the bar is the sheet\'s the moment the loadout gate opens (159-style max at ready idle), and stays the bare body while the gate is closed', () => {
  const sheet = sheetOf({ level: 20, placed: { health: 10, armour: 10 } })!;
  const state: { ready: boolean; sheet?: Sheet } = { ready: false };
  const f = fakeMobs([]);   // nobody to fight: the hero only stands there
  const wc = createWorldCombat({ mobs: () => f.mobs, loadoutReady: () => state.ready, hero: () => ({ gear: NAKED, level: 1, ...(state.sheet ? { sheet: state.sheet } : {}) }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 };
  const bare = wc.hero().max;
  state.sheet = sheet; run(wc, hero, 1);
  assert.equal(wc.hero().max, bare, 'the sheet has arrived but the gate is closed: he stays the bare body (no half-built hero)');
  state.ready = true; run(wc, hero, 1);
  assert.ok(wc.hero().max > bare, 'gate open, idle: the bar is the sheet\'s before any fight'); assert.equal(wc.hero().health, wc.hero().max, 'and full');
  assert.equal(wc.trace().maxHealth, wc.hero().max); assert.equal(wc.trace().sheet?.armour, sheet.armour);
});

test('idle hero sheet costs nothing per frame: hero() is read at the gate\'s ready edge and when the page says the build or gear answered, and not once over hundreds of idle frames', () => {
  const sheet = sheetOf({ level: 20, placed: { health: 10 } })!, sheet2 = sheetOf({ level: 20, placed: { health: 20 } })!;
  const state: { ready: boolean; sheet?: Sheet; reads: number } = { ready: false, reads: 0 };
  const f = fakeMobs([]);
  const wc = createWorldCombat({ mobs: () => f.mobs, loadoutReady: () => state.ready, hero: () => { state.reads++; return { gear: NAKED, level: 1, ...(state.sheet ? { sheet: state.sheet } : {}) }; }, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }, bare = wc.hero().max;
  // The sim step already reads hero().level once per step (gearOf for stepHero): that is the baseline per second, with the gate closed and nothing to rebuild. The rebuild adds NOTHING to it.
  const r0 = state.reads; run(wc, hero, 5); const baseline = state.reads - r0;
  state.sheet = sheet; state.ready = true; run(wc, hero, 1);
  const edge = wc.hero().max; assert.ok(edge > bare, 'the ready edge rebuilt him on the sheet');
  const r1 = state.reads; run(wc, hero, 5);   // ~150 idle frames after the edge
  assert.equal(state.reads - r1, baseline, 'idle frames after the edge read hero() exactly as often as before it: no sheet build per frame');
  state.sheet = sheet2; run(wc, hero, 1); assert.equal(wc.hero().max, edge, 'a change nobody announced is not polled for (it is picked up at the next join)');
  wc.heroChanged(); run(wc, hero, 1); assert.ok(wc.hero().max > edge, 'heroChanged() rebuilds him once on the new sheet');
  const r2 = state.reads; run(wc, hero, 5); assert.equal(state.reads - r2, baseline, 'and then back to the baseline');
});

// Backend's disposable-Postgres repro (real writer handlers on trunk 2941e7a88, no prod write): build_get {"level":12,"placed":{"armour":4,"attack":4,"health":4},"version":2} and the worn set head Helmet, chest Body, legs Greaves, main Warhammer,
// all dwarf pieces at Legionary (tier 2). The page's own derivation (gear-numbers sheetFor, the path main.ts hero() takes) feeds the loop; the trace line is the receipt for the PR body.
test('sheet-in-world, the real build row: a level-12 build with 4/4/4 placed and a worn dwarf set fights with the sheet\'s hp, armour and attack, not the bare body', () => {
  const own = { level: 12, placed: { armour: 4, attack: 4, health: 4 } };
  const piece = (id: string) => [id, { opponent: 'dwarf', attempt: 1, healthLeft: 1, recordId: null, day: '2026-10-16', tier: 2 }] as const;
  const loot = { owned: ['dwarf.Helmet', 'dwarf.Body', 'dwarf.Greaves', 'dwarf.Warhammer'], equipped: { head: 'dwarf.Helmet', chest: 'dwarf.Body', legs: 'dwarf.Greaves', main: 'dwarf.Warhammer' }, taken: Object.fromEntries(['dwarf.Helmet', 'dwarf.Body', 'dwarf.Greaves', 'dwarf.Warhammer'].map(piece)) } as unknown as Loot;
  const geared = sheetFor(loot, own)!, buildOnly = sheetFor(undefined, own)!;
  assert.ok(geared && buildOnly, 'the stored build is legal, so the page gets a sheet');
  const bare = createWorldCombat({ mobs: () => fakeMobs([]).mobs, hero: () => ({ gear: NAKED, level: 12 }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 2 }]);
  const wc = createWorldCombat({ mobs: () => f.mobs, loadoutReady: () => true, hero: () => ({ gear: NAKED, level: 12, sheet: geared }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  run(wc, { x: 0, z: 0, facing: 0 }, 1);
  const t = wc.trace(); console.log('TRACE ' + JSON.stringify({ build: own, gear: ['head', 'chest', 'legs', 'main'], bareMaxHealth: bare.trace().maxHealth, buildOnlySheet: buildOnly, trace: t }));
  assert.equal(wc.debug().length, 2, 'the wolf joined the fight'); assert.deepEqual(t.sheet, geared, 'the loop fights on the page\'s sheet');
  assert.ok(t.maxHealth > bare.trace().maxHealth, 'the placed health points are in the bar'); assert.ok((t.sheet?.armour ?? 0) > (buildOnly.armour ?? 0), 'the worn set adds armour on top of the placed points'); assert.ok((t.sheet?.attack ?? 0) > 0);
});

// Backend's second repro (same harness): level 20, build_get {"level":20,"placed":{"armour":6,"attack":7,"health":7},"version":2}, all nine paperdoll slots worn at Legionary (tier 2).
test('sheet-in-world, the level-20 row with the full paperdoll: the nine worn pieces and 6/7/7 placed points are all in the sheet the loop fights on', () => {
  const own = { level: 20, placed: { armour: 6, attack: 7, health: 7 } };
  const equipped = { head: 'dwarf.Helmet', crest: 'executioner.Crest', chest: 'dwarf.Body', arms: 'dwarf.Arms', hands: 'dwarf.Gloves', legs: 'dwarf.Greaves', feet: 'dwarf.Boots', main: 'dwarf.Warhammer', off: 'shieldmaiden.Shield' };
  const ids = Object.values(equipped), taken = Object.fromEntries(ids.map((id) => [id, { opponent: id.split('.')[0], attempt: 1, healthLeft: 1, recordId: null, day: '2026-10-16', tier: 2 }]));
  const loot = { owned: ids, equipped, taken } as unknown as Loot;
  const geared = sheetFor(loot, own)!, buildOnly = sheetFor(undefined, own)!;
  assert.ok(geared && buildOnly, 'the stored build is legal (20 points at level 20)');
  const bare = createWorldCombat({ mobs: () => fakeMobs([]).mobs, hero: () => ({ gear: NAKED, level: 20 }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 2 }]);
  const wc = createWorldCombat({ mobs: () => f.mobs, loadoutReady: () => true, hero: () => ({ gear: NAKED, level: 20, sheet: geared }), onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  run(wc, { x: 0, z: 0, facing: 0 }, 1);
  const t = wc.trace(); console.log('TRACE20 ' + JSON.stringify({ build: own, gear: Object.keys(equipped), bareMaxHealth: bare.trace().maxHealth, buildOnlySheet: buildOnly, trace: t }));
  assert.equal(wc.debug().length, 2, 'the wolf joined the fight'); assert.deepEqual(t.sheet, geared);
  assert.ok(t.maxHealth > bare.trace().maxHealth); assert.ok((t.sheet?.armour ?? 0) > (buildOnly.armour ?? 0), 'the worn set adds armour on top of the placed points'); assert.ok((t.sheet?.attack ?? 0) >= (buildOnly.attack ?? 0));
});
