// sandbox-mech: flank + shield wall. A side blow (outside the guard arc, not from behind) on a RAISED guard deals flankDamage per-mille; a braced creature cannot step while its guard is up.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value?: number }[]; brace: { opponent: string }[] };
const shipped = [d.rules.find((r) => r.id === 'flankDamage')!.value, d.brace.length];
d.rules.find((r) => r.id === 'flankDamage')!.value = 1200; d.rules.find((r) => r.id === 'flankPosture')!.value = 1400;
d.brace.push({ opponent: 'shieldmaiden' });
const { createFighter, opponentFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { OPPONENTS } = await import('../src/fight/moves.ts');
const { braced } = await import('../src/fight/sandbox-rules.ts');
const idle = () => ({ ...idleIntent(), lock: false });

// the attacker stands to the foe's SIDE (x = 1.4); the foe either holds a guard or stands ready
function sideHit(guard: boolean) {
  const foe = opponentFighter(OPPONENTS.veteran, { x: 0, z: 0, heading: 0, distance: 0 }, guard ? 'guard' : 'ready');
  let duel = { tick: 0, fighters: [createFighter({ x: 1.4, z: 0, heading: -Math.PI / 2, distance: 0 }, 'ready', 'longsword'), foe], finish: null, events: [] } as never as { fighters: { health: number }[]; events: { type: string; actor: number; damage?: number }[] };
  for (let i = 0; i < 80; i++) {
    duel = stepDuel(duel as never, [{ ...idle(), action: i === 0 ? 'light' : null }, { ...idle(), guard }]) as never;
    const hit = duel.events.find((e) => e.type === 'Hit' && e.actor === 0);
    if (hit) return hit.damage!;
  }
  return undefined;
}

test('trunk ships flank and brace off', () => assert.deepEqual(shipped, [0, 0]));
test('a side blow on a raised guard is 120% of the same blow on a fighter who is not guarding', () => {
  const guarded = sideHit(true), open = sideHit(false);
  assert.ok(guarded && open, 'both land');
  assert.ok(guarded > open, `guarded-side ${guarded} > open ${open}`);
  assert.ok(Math.abs(guarded / open - 1.2) < 0.1, `ratio ${guarded / open}`);
});
test('only a named creature is braced', () => {
  assert.equal(braced('shieldmaiden'), true);
  assert.equal(braced('knight'), false);
  assert.equal(braced(undefined), false);
});
test('a braced creature does not move while its guard is up', () => {
  const maiden = opponentFighter(OPPONENTS.shieldmaiden, { x: 0, z: 0, heading: 0, distance: 0 }, 'guard');
  let duel = { tick: 0, fighters: [createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready'), maiden], finish: null, events: [] } as never as { fighters: { body: { x: number; z: number } }[] };
  for (let i = 0; i < 30; i++) duel = stepDuel(duel as never, [idle(), { ...idle(), guard: true, move: { x: 0, z: 1, yaw: 0, run: false } }]) as never;
  assert.ok(Math.hypot(duel.fighters[1]!.body.x, duel.fighters[1]!.body.z) < 0.01, 'rooted');
});
