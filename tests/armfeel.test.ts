// ?look=armfeel (src/armfeel.ts): the flag, the flinch's numbers (Dom's Armagedom handoff), the blade's hit hold and its cap, and the promise that
// matters most: presentation only, so a fight's records and replays are byte-identical with the flag on or off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ARMFEEL, BURST, FLINCH_GAIN, FULL_TIER_STOP_MS, Flinch, armfeelFrom, energyOf, isFleshHit, newParticle, spawn, tickParticle, weaponHoldMs } from '../src/armfeel.ts';
import { createBurstPool } from '../src/armfeel-fx.ts';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, packRecord } from '../src/record.ts';
import { opponentAt, profileAt } from '../src/moves.ts';
import { idleIntent, legal, type CombatEvent } from '../src/duel.ts';

test('the setting: High for everyone; ?feel= (with or without the old ?look=armfeel) picks Low or Off; reduced motion starts at Low', () => {
  assert.equal(armfeelFrom(''), 'high');
  assert.equal(armfeelFrom('?look=souls'), 'high');
  assert.equal(armfeelFrom('?look=armfeel'), 'high');
  assert.equal(armfeelFrom('?feel=low'), 'low');
  assert.equal(armfeelFrom('?look=armfeel&feel=off'), 'off');
  assert.equal(armfeelFrom('?feel=bogus'), 'high');
  assert.equal(armfeelFrom('', true), 'low');
  assert.equal(armfeelFrom('?feel=high', true), 'high', 'an explicit feel wins over reduced motion');
});

test('the flinch: 0.45 rad lean and a 0.16 nudge along the blow, 0.9 on a kill, decaying 12 per second after the hold', () => {
  const f = new Flinch('high'); f.hit(0, 1, false);   // the blow travels +z
  const held = f.update(0.01);   // still inside the 45 ms hold: full energy
  assert.ok(Math.abs(held.lean - ARMFEEL.lean) < 1e-9 && Math.abs(held.dz - ARMFEEL.nudge) < 1e-9 && Math.abs(held.dx) < 1e-9);
  const later = f.update(0.1);   // 35 ms of hold left, then 65 ms of decay
  assert.ok(Math.abs(later.lean - ARMFEEL.lean * Math.exp(-12 * 0.065)) < 1e-9, `lean ${later.lean}`);
  const k = new Flinch('high'); k.hit(1, 0, true);
  const kp = k.update(0.0);
  assert.ok(Math.abs(kp.lean - ARMFEEL.leanKill) < 1e-9 && Math.abs(kp.dx - ARMFEEL.nudge) < 1e-9, 'a kill leans 0.9 along +x for heading π/2');
  assert.ok(Math.abs(k.update(0.2).lean - ARMFEEL.leanKill * Math.exp(-10 * (0.2 - 0.08))) < 1e-9, 'a kill holds 80 ms and decays 10 per second');
  for (let i = 0; i < 40; i++) f.update(0.05);
  assert.equal(f.active, false, 'it settles and stops asking for a pose');
});

test('Low: energy 0.4 and no hold; Off: nothing at all', () => {
  const low = new Flinch('low'); low.hit(0, 1, false);
  const p = low.update(0.01);
  assert.ok(Math.abs(p.lean - ARMFEEL.lean * ARMFEEL.lowEnergy * Math.exp(-12 * 0.01)) < 1e-9, 'Low decays at once (no hold)');
  const off = new Flinch('off'); off.hit(0, 1, true);
  assert.deepEqual(off.update(0.01), { lean: 0, dx: 0, dz: 0 });
  assert.equal([energyOf('high'), energyOf('low'), energyOf('off')].join(), '1,0.4,0');
});

const hit = (move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor: 0, target: 1, move } as CombatEvent);
test('the blade hold is a floor, never an addition: every real hit already stops longer, so it adds nothing and a light hit never freezes longer than today', () => {
  const light = 50 + 3000 / 60;   // main.ts Hit 50 ms + the half tier's 3 frames: already past the 40 / 60 / 80 ms holds
  assert.equal(weaponHoldMs('high', light, [hit('light_right')], 'half'), 0);
  assert.equal(weaponHoldMs('high', FULL_TIER_STOP_MS, [hit('heavy_overhead')], 'full'), 0);
  assert.equal(weaponHoldMs('high', 303, [{ ...hit('light_right'), type: 'Killed' } as CombatEvent], 'half'), 0);
  assert.equal(weaponHoldMs('high', 30, [hit('light_right')], 'half'), 10, 'a stop shorter than the floor is lifted to it (40 ms)');
  assert.ok(30 + weaponHoldMs('high', 30, [{ ...hit('x'), type: 'Killed' } as CombatEvent], 'half') <= FULL_TIER_STOP_MS);
  assert.equal(weaponHoldMs('low', 30, [hit('light_right')], 'half'), 0);
  assert.equal(weaponHoldMs('off', 30, [hit('light_right')], 'half'), 0);
  assert.equal(weaponHoldMs('high', 0, [], null), 0, 'no contact, no hold');
});

test('the hero keeps a quarter of the flinch; the opponent all of it', () => {
  assert.deepEqual(FLINCH_GAIN, { hero: 0.25, opponent: 1 });
  const hero = new Flinch('high'); hero.hit(0, 1, false, FLINCH_GAIN.hero);
  assert.ok(Math.abs(hero.update(0).lean - ARMFEEL.lean * 0.25) < 1e-9);
});

test('the burst: 8 on a hit, 12 on a kill, 3 on Low, at the handoff\'s speeds, sizes and lives, from one fixed 48-slot pool with nothing allocated per hit', () => {
  const p = newParticle();
  spawn(p, 0, 8, 1, 1.25, 2, 0, 1, false, 'high');
  assert.deepEqual([p.life, p.size, p.vx, p.vy, p.vz], [0.3, 0.12, BURST.spread + 0, BURST.lift, 1]);
  spawn(p, 4, 12, 0, 0, 0, 0, 0, true, 'high');
  assert.deepEqual([p.life, p.size, p.vy], [0.42, 0.16, BURST.lift + BURST.liftStep]);
  spawn(p, 0, 3, 0, 0, 0, 0, 0, false, 'low'); assert.equal(p.size, 0.055);
  assert.equal(tickParticle(p, 0.31), false, 'a hit particle is gone after 0.3 s');
  const pool = createBurstPool(new THREE.Scene());
  assert.equal(pool.capacity, 48);
  const matrices = pool.mesh.instanceMatrix.array, colors = pool.mesh.instanceColor!.array;
  pool.burst('high', 0, 1, 0, 0, 1, false); pool.update(0.016); assert.equal(pool.alive, 8);
  pool.burst('high', 0, 1, 0, 0, 1, true); pool.update(0.016); assert.equal(pool.alive, 20);
  pool.update(0.5); assert.equal(pool.alive, 0); assert.equal(pool.mesh.visible, false);
  for (let i = 0; i < 1000; i++) { pool.burst('high', 0, 1, 0, 0, 1, i % 5 === 0); pool.update(0.016); }
  assert.ok(pool.alive <= 48, 'the ring never holds more than its 48 slots');
  assert.equal(pool.mesh.instanceMatrix.array, matrices); assert.equal(pool.mesh.instanceColor!.array, colors);
  assert.equal(pool.mesh.castShadow, false); assert.equal(pool.mesh.count, 48);
  assert.ok(pool.mesh.geometry instanceof THREE.SphereGeometry, 'round droplets, not cubes');
  assert.ok((pool.mesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial && (pool.mesh.material as THREE.MeshBasicMaterial).toneMapped, 'unlit, tone-mapped like the scene: the colour is the blood\'s own, no glow');
  assert.ok(BURST.color === '#8b1010' && BURST.endColor === '#6b0a0a', 'dark crimson, a touch darker at the end of life');
  pool.burst('off', 0, 1, 0, 0, 1, false); pool.clear(); pool.burst('off', 0, 1, 0, 0, 1, true); pool.update(0.016); assert.equal(pool.alive, 0, 'Off bursts nothing');
});

test('only a landed blow on the body bleeds: not a block, a parry or a guard break', () => {
  assert.equal(isFleshHit(hit('light_right')), true);
  for (const type of ['Blocked', 'Parried', 'GuardBroken'] as const) assert.equal(isFleshHit({ ...hit('light_right'), type } as CombatEvent), false, type);
});

test('no body flash: a struck body is never tinted white (Dom 2026-10-06: the flash read as a glitch)', async () => {
  const fx = await import('../src/armfeel-fx.ts'), feel = await import('../src/armfeel.ts');
  assert.equal('BodyFlash' in fx, false); assert.equal('FLASH' in feel, false);
});

// A seeded fight, recorded the way main.ts records it, packed to bytes: with the armfeel objects driven the whole time or never touched, the bytes are the same.
function fightBytes(drive: boolean): string {
  const rec = createRecorder({ build: 'armfeel', opponent: 'goblin', weapon: 'longsword', level: 18, seed: 7 });
  const profile = profileAt(OPPONENTS.goblin, 18);
  let p = initialPractice(7, opponentAt(OPPONENTS.goblin, 18), 'longsword');
  const flinch = new Flinch('high');
  for (let t = 0; t < 2400 && !p.finish; t++) {
    const f = p.duel.fighters[0];
    const intent = f.phase === 'sheathed' ? { ...idleIntent(), action: 'light' as const } : legal(f, 'light') ? { ...idleIntent(), action: 'light' as const } : idleIntent();
    p = stepPractice(p, rec.push(intent), profile);
    if (drive) { for (const e of p.events) if (e.type === 'Hit') flinch.hit(0, 1, false); flinch.update(1 / 60); weaponHoldMs('high', 100, p.events, 'half'); }
  }
  return Buffer.from(packRecord(rec.finish(p.finish ? 'killed' : 'abandoned'))).toString('hex');
}
test('records and replays are byte-identical with the feel driven or not', () => {
  assert.equal(fightBytes(true), fightBytes(false));
});
test('the simulation never reads armfeel: no sim file imports it', () => {
  for (const file of ['duel', 'moves', 'ai', 'sim', 'record', 'blade', 'blade-paths', 'roster', 'finishers', 'detmath', 'combat', 'match', 'replay'])
    assert.doesNotMatch(readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), /armfeel/, `${file}.ts must not import armfeel`);
});
