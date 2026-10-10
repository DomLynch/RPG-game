// P2: the zones use the engine's contact effects (src/fight/zone-fx.ts createZoneFx, one createFightFx per active pair), the same for every zone.
//   - the engine hands the client each pair's Pit events (takeContacts), attributed to the creature, with the pair's duel;
//   - no zone module (origins/**) takes its effects from anywhere but src/fight: the Pit's effect modules in src/ are the engine's, a zone page never imports them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWorldCombat, finishOf, type MobPose } from '../src/fight/index.ts';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = `${dir}/${e.name}`;
  return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(rel)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [rel] : [];
});
const EFFECT_MODULES = /\/src\/(armfeel-fx|armfeel|camera-kick|charge-fx|clash-sparks|foot-dust|hit-impact|skill-impact|special-fx[\w-]*)(\.ts)?['"]/;

test('no zone module imports an effect from outside src/fight (the zones use createFightFx through createZoneFx)', () => {
  const bad = walk('origins').flatMap((f) => readFileSync(join(root, f), 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l }))
    .filter(({ l }) => /^\s*(import|export)\b.*\bfrom\b/.test(l) && EFFECT_MODULES.test(l.replace(/\.\.\//g, '/src/').replace(/\/src\/src\//g, '/src/'))));
  assert.deepEqual(bad.map(({ f, i }) => `${f}:${i}`), [], 'take the effect from src/fight (createZoneFx / createFightFx), not from the Pit\'s src/ module');
});

test('takeContacts: a creature that bites the hero yields its Pit events, tagged with the creature, its kind and the pair\'s duel; a second call is empty', () => {
  const list = [{ spec: { id: 'wolf-1', body: 'wolf', level: 11, name: 'wolf-1' }, x: 0, z: 2 }];
  const mobs = {
    within: (x: number, z: number, r: number) => list.filter((m) => Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })),
    drive: (() => {}) as (id: string, pose: MobPose | null) => void,
  };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {} });
  const seen: ReturnType<typeof wc.takeContacts> = [];
  for (let t = 0; t < 8; t += 1 / 30) { wc.update(1 / 30, { x: 0, z: 0, facing: 0 }); seen.push(...wc.takeContacts()); }
  assert.ok(seen.length > 0, 'the pair produced contacts');
  assert.ok(seen.every((c) => c.foe === 'wolf-1' && c.kind === 'wolf' && c.duel.fighters.length === 2 && typeof c.hero.x === 'number' && typeof c.foeAt.health === 'number'));
  assert.ok(seen.some((c) => c.events.some((e) => e.type === 'Hit' && e.target === 0)), 'the wolf\'s bite is among them');
  assert.deepEqual(wc.takeContacts(), [], 'drained');
});

test('the kill keeps its contact and its finish: the Killed event reaches takeContacts after the bout is gone, with the engine\'s pick (plainDeath unless the client can play more)', () => {
  const list = [{ spec: { id: 'wolf-1', body: 'wolf', level: 1, name: 'wolf-1' }, x: 0, z: 1.2 }], poses: Array<MobPose | null> = [];
  const mobs = {
    within: (x: number, z: number, r: number) => list.filter((m) => Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })),
    drive: ((_id: string, p: MobPose | null) => void poses.push(p)) as (id: string, pose: MobPose | null) => void,
  };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {} });
  const seen: ReturnType<typeof wc.takeContacts> = [];
  for (let i = 0; i < 400 && !seen.some((c) => c.events.some((e) => e.type === 'Killed')); i++) {
    wc.press();
    for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); seen.push(...wc.takeContacts()); }
  }
  const kill = seen.find((c) => c.events.some((e) => e.type === 'Killed'));
  assert.ok(kill, 'the kill frame\'s contact was handed over (it used to be dropped with the bout)');
  assert.equal(kill.finisher, 'plainDeath');
  assert.ok(poses.some((p) => p?.fall !== undefined && p.finisher === 'plainDeath'), 'the death pose carries the finisher');
});

test('finishOf: the engine\'s pick cut down to the creature\'s row and to what the client can play, plainDeath otherwise', () => {
  const finish = { victim: 1 as const, location: 'torso' as const, move: 'light_right' as const, heading: 0 };
  const all = () => true;
  for (const kind of ['wolf', 'boar', 'bear']) for (let h = 0; h < 40; h++) assert.ok(['decapitation', 'plainDeath'].includes(finishOf(kind, { ...finish, heading: h }, ['longsword', 'bite'], all)), `${kind} only carries its row`);
  assert.equal(finishOf('wolf', finish, ['longsword', 'bite']), 'plainDeath', 'the default client plays the plain death only');
  assert.equal(finishOf('skeleton', finish, ['longsword', 'bite'], all), 'plainDeath', 'a creature with no row has no ceremony');
  assert.equal(finishOf('wolf', { ...finish, move: 'kick' }, ['longsword', 'bite'], all), 'plainDeath', 'a kick kill has no ceremony');
});
