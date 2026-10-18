// sandbox-mech: missiles. A missile weapon's swing throws a bolt instead of striking: forward / left / right lanes, a travel time, judged against where the body stands when it arrives; a same-side guard blocks, a body off the line is missed,
// a throw from inside the inner band is a hard miss, a bolt costs mana. No rows (trunk) = every weapon melee.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value: number }[]; bands: unknown[]; missile: unknown[]; missileLanes: unknown[] };
const rule = (id: string) => d.rules.find((r) => r.id === id)!;
const shipped = [d.missile.length, d.missileLanes.length];
rule('missileRadius').value = 70; rule('missileFan').value = 22; rule('missileStun').value = 16; rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.missile.push({ weapon: 'scythe', speed: 700, share: 1000, mana: 12 });
d.missileLanes.push({ move: 'thrust', lane: 0 }, { move: 'light_left', lane: -1 }, { move: 'light_right', lane: 1 }, { move: 'heavy_overhead', lane: 0, mult: 1500 });
const { createFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type F = { health: number; mana?: number; stamina: number; missile?: { arrives: number }; phase: string };
type D2 = { fighters: F[]; events: { type: string; actor: number; damage?: number; lane?: number; move?: string; stamina?: number }[] };

const start = (gap: number, foe = { x: 0, z: 0 }, foeGuard = false) => ({ tick: 0, fighters: [createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready', 'scythe'), createFighter({ ...foe, heading: 0, distance: 0 } as never, foeGuard ? 'guard' : 'ready')], finish: null, events: [] }) as never as D2;
function throwAt(duel: D2, action: string, foeIntent: object = {}, ticks = 120) {
  const all: D2['events'] = [];
  for (let i = 0; i < ticks; i++) { duel = stepDuel(duel as never, [{ ...idle(), action: i === 0 ? action : null } as never, { ...idle(), ...foeIntent } as never]) as never; all.push(...duel.events); }
  return { duel, all };
}

test('trunk ships no missiles', () => assert.deepEqual(shipped, [0, 0]));
test('a forward thrust throws a bolt that arrives later and hits a body on the line', () => {
  const { duel, all } = throwAt(start(3), 'thrust');
  const launch = all.find((e) => e.type === 'MissileLaunched'), hit = all.find((e) => e.type === 'Hit');
  assert.ok(launch && hit, 'launched and hit'); assert.equal(launch.lane, 0);
  assert.ok(duel.fighters[1]!.health < 150, 'the foe is hurt');
  assert.ok(!all.some((e) => e.type === 'AttackMissed'));
});
test('a left bolt misses a body in the middle but hits one standing on its lane', () => {
  const centre = throwAt(start(3), 'light_left');
  assert.ok(centre.all.some((e) => e.type === 'MissileLaunched' && e.lane === -1) && !centre.all.some((e) => e.type === 'Hit'), 'a centred body is off the side lane');
  const a = (22 * Math.PI) / 180, onLane = throwAt(start(3, { x: 3 * Math.sin(a), z: 3 - 3 * Math.cos(a) }), 'light_left');
  assert.ok(onLane.all.some((e) => e.type === 'Hit' && e.lane === -1), 'a body standing on the lane is hit');
  const right = throwAt(start(3, { x: -3 * Math.sin(a), z: 3 - 3 * Math.cos(a) }), 'light_right');
  assert.ok(right.all.some((e) => e.type === 'Hit' && e.lane === 1), 'and the right bolt takes the other side');
});
test('thrown from inside the inner band it is a hard miss: nothing flies', () => {
  const { all } = throwAt(start(1.2), 'thrust');
  assert.ok(!all.some((e) => e.type === 'MissileLaunched'));
  assert.ok(all.some((e) => e.type === 'AttackMissed'));
});
test('a same-side guard blocks the bolt: no damage, a stamina chip', () => {
  const { duel, all } = throwAt(start(3, { x: 0, z: 0 }, true), 'thrust', { guard: true, guardDirection: 'thrust' });
  const blocked = all.find((e) => e.type === 'Blocked') as { stamina?: number } | undefined;
  assert.ok(blocked, 'blocked'); assert.ok(blocked.stamina! > 0, 'a stamina chip');
  assert.equal(duel.fighters[1]!.health, 150);
});
test('a bolt costs 12 mana and is refused short of it', () => {
  const { duel } = throwAt(start(3), 'thrust', {}, 30);
  assert.ok(duel.fighters[0]!.mana! <= 88 + 3, `mana spent: ${duel.fighters[0]!.mana}`);
  const poor = start(3); poor.fighters[0]!.mana = 11;
  assert.equal(legal(poor.fighters[0] as never, 'thrust'), false);
});
