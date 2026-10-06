// ?look=armfeel (src/armfeel.ts): the flag, the flinch's numbers (Dom's Armagedom handoff), the blade's hit hold and its cap, and the promise that
// matters most: presentation only, so a fight's records and replays are byte-identical with the flag on or off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARMFEEL, FULL_TIER_STOP_MS, Flinch, armfeelFrom, energyOf, weaponHoldMs } from '../src/armfeel.ts';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, packRecord } from '../src/record.ts';
import { opponentAt, profileAt } from '../src/moves.ts';
import { idleIntent, legal, type CombatEvent } from '../src/duel.ts';

test('the flag: only ?look=armfeel; High unless &feel= says otherwise; reduced motion starts at Low', () => {
  assert.equal(armfeelFrom(''), undefined);
  assert.equal(armfeelFrom('?look=souls'), undefined);
  assert.equal(armfeelFrom('?look=armfeel'), 'high');
  assert.equal(armfeelFrom('?look=armfeel&feel=low'), 'low');
  assert.equal(armfeelFrom('?look=armfeel&feel=off'), 'off');
  assert.equal(armfeelFrom('?look=armfeel&feel=bogus'), 'high');
  assert.equal(armfeelFrom('?look=armfeel', true), 'low');
  assert.equal(armfeelFrom('?look=armfeel&feel=high', true), 'high', 'an explicit feel wins over reduced motion');
});

test('the flinch: 0.45 rad lean and a 0.16 nudge along the blow, 0.9 on a kill, decaying 12 per second after the hold', () => {
  const f = new Flinch('high'); f.hit(0, false);   // heading 0: the blow travels +z
  const held = f.update(0.01);   // still inside the 45 ms hold: full energy
  assert.ok(Math.abs(held.lean - ARMFEEL.lean) < 1e-9 && Math.abs(held.dz - ARMFEEL.nudge) < 1e-9 && Math.abs(held.dx) < 1e-9);
  const later = f.update(0.1);   // 35 ms of hold left, then 65 ms of decay
  assert.ok(Math.abs(later.lean - ARMFEEL.lean * Math.exp(-12 * 0.065)) < 1e-9, `lean ${later.lean}`);
  const k = new Flinch('high'); k.hit(Math.PI / 2, true);
  const kp = k.update(0.0);
  assert.ok(Math.abs(kp.lean - ARMFEEL.leanKill) < 1e-9 && Math.abs(kp.dx - ARMFEEL.nudge) < 1e-9, 'a kill leans 0.9 along +x for heading π/2');
  assert.ok(Math.abs(k.update(0.2).lean - ARMFEEL.leanKill * Math.exp(-10 * (0.2 - 0.08))) < 1e-9, 'a kill holds 80 ms and decays 10 per second');
  for (let i = 0; i < 40; i++) f.update(0.05);
  assert.equal(f.active, false, 'it settles and stops asking for a pose');
});

test('Low: energy 0.4 and no hold; Off: nothing at all', () => {
  const low = new Flinch('low'); low.hit(0, false);
  const p = low.update(0.01);
  assert.ok(Math.abs(p.lean - ARMFEEL.lean * ARMFEEL.lowEnergy * Math.exp(-12 * 0.01)) < 1e-9, 'Low decays at once (no hold)');
  const off = new Flinch('off'); off.hit(0, true);
  assert.deepEqual(off.update(0.01), { lean: 0, dx: 0, dz: 0 });
  assert.equal([energyOf('high'), energyOf('low'), energyOf('off')].join(), '1,0.4,0');
});

const hit = (move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor: 0, target: 1, move } as CombatEvent);
test('the blade hold: 40 on a light hit, 60 on a heavy, 80 on a kill, never past the heaviest stop a hit has today', () => {
  const light = 50 + 3000 / 60;   // main.ts Hit 50 ms + the half tier's 3 frames
  assert.equal(weaponHoldMs('high', light, [hit('light_right')], 'half'), 40);
  assert.ok(light + weaponHoldMs('high', light, [hit('light_right')], 'half') <= FULL_TIER_STOP_MS);
  assert.equal(weaponHoldMs('high', FULL_TIER_STOP_MS, [hit('heavy_overhead')], 'full'), 0, 'a heavy already stops as long as a hit may');
  assert.equal(weaponHoldMs('high', 303, [{ ...hit('light_right'), type: 'Killed' } as CombatEvent], 'half'), 0, 'a kill already stops longer than that');
  assert.ok(weaponHoldMs('high', 150, [{ ...hit('light_right'), type: 'Killed' } as CombatEvent], 'half') <= FULL_TIER_STOP_MS - 150, 'a short stop is topped up only to the cap');
  assert.equal(weaponHoldMs('low', light, [hit('light_right')], 'half'), 0);
  assert.equal(weaponHoldMs('off', light, [hit('light_right')], 'half'), 0);
  assert.equal(weaponHoldMs('high', 0, [], null), 0, 'no contact, no hold');
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
    if (drive) { for (const e of p.events) if (e.type === 'Hit') flinch.hit(e.heading ?? 0, false); flinch.update(1 / 60); weaponHoldMs('high', 100, p.events, 'half'); }
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
