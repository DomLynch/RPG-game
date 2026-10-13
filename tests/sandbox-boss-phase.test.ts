// sandbox-mech: boss phases. Under a row's health threshold a boss's special hits harder and is ready sooner, once per fight; trunk ships no rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import PHASE_DEFS from '../src/fight/boss-phase-defs.json' with { type: 'json' };

const shipped = (PHASE_DEFS as unknown as { phases: unknown[] }).phases.length;
(PHASE_DEFS as unknown as { phases: unknown[] }).phases = [{ id: 'enrage', special: '*', below: 50, share: 1500, cooldown: 25, label: 'ENRAGED', note: 'harder, sooner' }];
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { phaseText } = await import('../src/fight/sandbox-rules.ts');
type Duel = Parameters<typeof stepDuel>[0];

test('trunk ships no phase rows', () => assert.equal(shipped, 0));
test('under 50% health the boss special hits 1.5x and is ready sooner, once', () => {
  const boss = { ...createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.2, skillCooldown: 1200 };
  const bossHurt = { ...boss, health: Math.floor(boss.maxHealth * 0.4) };
  let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'), bossHurt], finish: null, events: [] };
  d = stepDuel(d, [idleIntent(), idleIntent()]);
  assert.ok(d.events.some((e) => e.type === 'PhaseChanged' && e.actor === 1), 'the phase fired');
  assert.ok(Math.abs(d.fighters[1].specialShare! - 0.3) < 1e-9);
  assert.ok(d.fighters[1].skillCooldown <= 300, 'ready within a quarter of the normal cooldown');
  const again = stepDuel(d, [idleIntent(), idleIntent()]);
  assert.ok(!again.events.some((e) => e.type === 'PhaseChanged'), 'once per fight');
  assert.ok(Math.abs(again.fighters[1].specialShare! - 0.3) < 1e-9);
  assert.deepEqual(phaseText('enrage'), { label: 'ENRAGED', note: 'harder, sooner' });
});
test('a healthy boss does not phase', () => {
  const boss = { ...createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.2, skillCooldown: 1200 };
  const d = stepDuel({ tick: 0, fighters: [createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'), boss], finish: null, events: [] } as Duel, [idleIntent(), idleIntent()]);
  assert.ok(!d.events.some((e) => e.type === 'PhaseChanged'));
});
test('only the foe phases: a hurt player with a special does not enrage', () => {
  const me = { ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'), specialShare: 0.2, skillCooldown: 1200 };
  const hurt = { ...me, health: Math.floor(me.maxHealth * 0.4) };
  const d = stepDuel({ tick: 0, fighters: [hurt, createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready')], finish: null, events: [] } as Duel, [idleIntent(), idleIntent()]);
  assert.ok(!d.events.some((e) => e.type === 'PhaseChanged'));
  assert.equal(d.fighters[0].specialShare, 0.2);
});
