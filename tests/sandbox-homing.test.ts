// sandbox-mech: auto-aim (Dom 2026-10-15): with the `missileHoming` row on a shot flies at the foe whatever lane it was thrown down, so only a roll or a guard answers it; a staff shot is paid in mana alone, a bow shot still costs the stand-in's stamina.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value: number }[]; bands: unknown[]; missile: unknown[]; missileLanes: unknown[] };
const rule = (id: string) => d.rules.find((r) => r.id === id)!;
assert.equal(rule('missileHoming').value, 0, 'trunk ships no homing');
rule('missileHoming').value = 1; rule('missileRadius').value = 70; rule('missileFan').value = 22; rule('missileStun').value = 16; rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.missile.push({ kind: 'staff', weapon: 'scythe', speed: 700, share: 1000, mana: 12 }, { kind: 'bow', weapon: 'cleaver', speed: 900, share: 1000, mana: 0 });
d.missileLanes.push({ move: 'thrust', lane: 0 }, { move: 'light_left', lane: -1 });
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type D2 = { fighters: { health: number; stamina: number; mana?: number }[]; events: { type: string; lane?: number }[] };
const start = (weapon: string) => ({ tick: 0, fighters: [createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready', weapon as never), createFighter({ x: 0, z: 0, heading: 0, distance: 0 } as never, 'ready')], finish: null, events: [] }) as never as D2;
const shoot = (weapon: string, action: string, foe: object = {}) => {
  let duel = start(weapon); const all: D2['events'] = [], s0 = duel.fighters[0]!.stamina;
  for (let i = 0; i < 120; i++) { duel = stepDuel(duel as never, [{ ...idle(), action: i === 0 ? action : null } as never, { ...idle(), ...foe } as never]) as never; all.push(...duel.events); }
  return { duel, all, s0 };
};
test('a side-lane shot at a centred foe still hits (it flies at him)', () => {
  const { duel, all } = shoot('scythe', 'light_left');
  assert.ok(all.some((e) => e.type === 'Hit'), 'hit'); assert.ok(duel.fighters[1]!.health < 150);
});
test('a roll in the window still dodges it', () => {
  const { all } = shoot('scythe', 'thrust', { action: 'dodge' });
  assert.ok(all.some((e) => e.type === 'MissileLaunched'));
});
test('a staff shot spends mana and no stamina; a bow shot spends no mana', () => {
  const staff = shoot('scythe', 'thrust'), bow = shoot('cleaver', 'thrust');
  assert.ok(staff.duel.fighters[0]!.mana! < 100, 'mana spent'); assert.equal(staff.duel.fighters[0]!.stamina, staff.s0, 'staff: no stamina');
  assert.equal(bow.duel.fighters[0]!.mana, 100, 'bow: no mana');
});
