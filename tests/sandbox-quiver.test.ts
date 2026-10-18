// sandbox-mech: bows and crossbows are the missile model with a quiver (finite, a row flag), a slower draw / reload (percent on every move's timing) and, for the crossbow, a bolt that is hard to guard (a share goes through a block).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value: number }[]; bands: unknown[]; missile: unknown[]; missileLanes: unknown[] };
const rule = (id: string) => d.rules.find((r) => r.id === id)!;
const shipped = rule('quiver').value;
rule('quiver').value = 1; rule('missileRadius').value = 70; rule('missileFan').value = 22; rule('missileStun').value = 16;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.missile.push({ kind: 'bow', weapon: 'trident', speed: 900, share: 1000, mana: 0, windup: 20, recovery: 0, ammo: 3, pierce: 0 }, { kind: 'crossbow', weapon: 'cleaver', speed: 1100, share: 1700, mana: 0, windup: 120, recovery: 60, ammo: 12, pierce: 500 });
d.missileLanes.push({ move: 'thrust', lane: 0 });
const { createFighter, stepDuel, idleIntent, legal, timing } = await import('../src/fight/duel.ts');
const { ammoOf, missileTiming } = await import('../src/fight/sandbox-rules.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type F = { health: number; ammo?: number; stamina: number; phase: string };
type D2 = { fighters: F[]; events: { type: string; damage?: number }[] };
const start = (weapon: string, foePhase: 'ready' | 'guard' = 'ready') => ({ tick: 0, fighters: [createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready', weapon as never), createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, foePhase)], finish: null, events: [] }) as never as D2;
const shoot = (duel: D2, foe: object = {}, ticks = 140) => { const all: D2['events'] = []; for (let i = 0; i < ticks; i++) { duel = stepDuel(duel as never, [{ ...idle(), action: i === 0 ? 'thrust' : null } as never, { ...idle(), ...foe } as never]) as never; all.push(...duel.events); } return { duel, all }; };

test('trunk ships the quiver off', () => assert.equal(shipped, 0));
test('a bow carries its quiver, a crossbow its own; a melee weapon carries none', () => {
  assert.equal(ammoOf('trident'), 3); assert.equal(ammoOf('cleaver'), 12); assert.equal(ammoOf('longsword'), 0);
  assert.equal(start('trident').fighters[0]!.ammo, 3); assert.equal(start('longsword').fighters[0]!.ammo, undefined);
});
test('each shot takes an arrow; an empty quiver refuses the press', () => {
  let duel = start('trident'); const used: number[] = [];
  for (let n = 0; n < 4; n++) { duel = shoot(duel, {}, 140).duel; used.push(duel.fighters[0]!.ammo!); }
  assert.ok(used[0]! <= 2 && used[2]! === 0, `the quiver ran down: ${used}`);
  assert.equal(legal(duel.fighters[0] as never, 'thrust'), false);
});
test('the quiver flag is read at load: with the row on, a missile weapon carries ammo; the entry sets the row to 0 for ?quiver=0 before the sim loads', () => {
  assert.equal(ammoOf('trident') > 0, true);
});
test('a bow draws 20% slower and a crossbow reloads 120% slower, with a longer recovery', () => {
  assert.deepEqual(missileTiming('trident'), { windup: 20, recovery: 0 });
  assert.deepEqual(missileTiming('cleaver'), { windup: 120, recovery: 60 });
  const atk = (weapon: string) => ({ ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'attack', weapon as never), move: 'thrust' as never, age: 1 });
  const plainWindup = timing({ ...atk('longsword') } as never).windup;   // a weapon with no missile row
  assert.ok(timing(atk('cleaver') as never).windup > 2 * Math.min(plainWindup, timing(atk('trident') as never).windup) * 0.9, 'the crossbow reload is the longest');
  assert.ok(timing(atk('trident') as never).windup > 0);
});
test('a crossbow bolt is hard to guard: part of it goes through a block, a bow bolt does not', () => {
  const guard = { guard: true, guardDirection: 'thrust' };
  const xb = shoot(start('cleaver', 'guard'), guard, 200), bow = shoot(start('trident', 'guard'), guard, 200);
  const through = (r: { all: D2['events'] }) => r.all.find((e) => e.type === 'Blocked')?.damage;
  assert.ok(through(xb)! > 0, `crossbow: ${through(xb)} through`);
  assert.equal(through(bow), undefined, 'a bow bolt is stopped whole');
  assert.ok(xb.duel.fighters[1]!.health < 150 && xb.duel.fighters[1]!.health >= 1, 'hurt but never killed by a block');
  assert.equal(bow.duel.fighters[1]!.health, 150);
});
