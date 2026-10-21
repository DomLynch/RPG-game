import './lib/era-on.ts';   // the LIVE rules (sandbox era on, RV79+ rows): origins/preview/world-combat.test.ts runs only era-off (tests/origins-world-combat.test.ts), so "the hero cuts it dead" was never checked on the rules the game plays
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat } from '../src/fight/index.ts';
import type { MobDrive, MobPick } from '../origins/preview/mobs-view.ts';
import type { MobSpec } from '../origins/preview/mobs.ts';

// The twin of origins/preview/world-combat.test.ts "the hero cuts it dead", on the live rules. That test's fixed 1.2 m stand-and-mash gap sits on a razor-thin timing window (2026-10-21 probe, scripts/zone1-fairness-cutdead-probe.ts:
// at RV78 gaps 0.8, 1.2 and 2.4 m kill, at RV79 and later only 1.0 m does, and a gap either kills untouched or dies), so this twin asserts the property that matters, not one distance: a level-1 wolf can be cut dead on the
// live rules from SOME gap in the swinging range, once, with the fall played and the creature released; and a level-1 wolf and the troll/salamander both reach the hero (the loop engages them) on the live rules.
const spec = (id: string, body: string, level: number): MobSpec => ({ id, body, name: id, level, named: false } as unknown as MobSpec);

function fight(body: string, level: number, gap: number, presses = 400): { kills: string[]; released: boolean; swings: number; heroDead: boolean; heroHealth: number } {
  const id = `${body}-1`, home = { x: 0, z: gap }, driven = new Map<string, MobDrive>(), fell: string[] = [], kills: string[] = []; let swings = 0;
  const list = [{ spec: spec(id, body, level), x: home.x, z: home.z }];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (mid: string, p: MobDrive | null) => { if (p) driven.set(mid, p); else driven.delete(mid); } };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s: { id: string }) => { fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => void swings++ } as never);
  for (let i = 0; i < presses && kills.length === 0 && !wc.hero().dead; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === id); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }
  return { kills, released: !driven.has(id), swings, heroDead: wc.hero().dead, heroHealth: wc.hero().health };
}

test('the hero cuts a level-1 wolf dead on the LIVE rules from some swinging gap: one kill, the creature released, the hero alive', () => {
  const gaps = Array.from({ length: 21 }, (_, i) => Math.round((0.6 + i * 0.1) * 10) / 10), results = gaps.map((gap) => ({ gap, ...fight('wolf', 1, gap) })), winners = results.filter((r) => r.kills.length === 1 && !r.heroDead);
  assert.ok(winners.length >= 1, `no gap from 0.6 to 2.6 m lets the masher kill a level-1 wolf on the live rules: ${JSON.stringify(results.map((r) => ({ gap: r.gap, kills: r.kills.length, dead: r.heroDead })))}`);
  for (const w of winners) { assert.ok(w.swings >= 1); assert.deepEqual(w.kills, ['wolf-1']); assert.ok(w.released, `gap ${w.gap}: released after the fall`); }
});

test('the live-rules loop engages the Zone 1 creatures: a troll and a salamander at 6 m reach the hero (he is hurt within 60 s of standing still)', () => {
  for (const [body, level] of [['cave-troll', 3], ['giant-salamander', 1]] as const) {
    const id = `${body}-1`, driven = new Map<string, MobDrive>(), list = [{ spec: spec(id, body, level), x: 0, z: 6 }];
    const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })).filter((m) => m.dist <= r), drive: (mid: string, p: MobDrive | null) => { if (p) { driven.set(mid, p); list[0]!.x = p.x; list[0]!.z = p.z; } } };
    const wc = createWorldCombat({ mobs: () => mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} } as never);
    for (let t = 0; t < 60 && !wc.hero().dead; t += 1 / 30) { const d = driven.get(id); wc.update(1 / 30, { x: 0, z: 0, facing: d ? Math.atan2(d.x, d.z) : 0 }); if (wc.hero().health < wc.hero().max) break; }
    assert.ok(driven.has(id) && wc.hero().health < wc.hero().max, `${body}: engaged and landed a blow on a hero who stood still`);
  }
});
