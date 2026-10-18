// sandbox-mech: ward. A `ward` row makes a creature's raised guard throw the first blow back (the attacker takes `reflect` per-mille, never to death, and staggers), then the ward is down for `down` ticks.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { ward: { opponent: string; down: number; reflect: number }[] };
const shipped = d.ward.length;
d.ward.push({ opponent: 'witch', down: 240, reflect: 800 });
const { createFighter, opponentFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { OPPONENTS } = await import('../src/fight/moves.ts');
const idle = () => ({ ...idleIntent(), lock: false });

function fight(opponent: keyof typeof OPPONENTS, swings: number[]) {
  const foe = opponentFighter(OPPONENTS[opponent], { x: 0, z: 0, heading: 0, distance: 0 }, 'ready');
  let duel = { tick: 0, fighters: [createFighter({ x: 0, z: 1.4, heading: Math.PI, distance: 0 }, 'ready', 'longsword'), foe], finish: null, events: [] } as never as { tick: number; fighters: { health: number }[]; events: { type: string; actor: number; target?: number; damage?: number }[] };
  const start = [duel.fighters[0]!.health, duel.fighters[1]!.health], log: { tick: number; mine: number; theirs: number }[] = [];
  for (let i = 0; i < 400; i++) {
    duel = stepDuel(duel as never, [{ ...idle(), action: swings.includes(i) ? 'light' : null }, { ...idle(), guard: true, guardDirection: 'left' }]) as never;
    if (swings.includes(i + 30)) log.push({ tick: i, mine: duel.fighters[0]!.health, theirs: duel.fighters[1]!.health });
  }
  return { start, end: [duel.fighters[0]!.health, duel.fighters[1]!.health], duel };
}

test('trunk ships no ward', () => assert.equal(shipped, 0));
test('the first blow into the Witch\'s guard is thrown back: she takes nothing, the attacker is hurt', () => {
  const r = fight('witch', [0]);
  assert.equal(r.end[1], r.start[1], 'the Witch is unhurt');
  assert.ok(r.end[0]! < r.start[0]!, `the attacker lost health: ${r.start[0]} -> ${r.end[0]}`);
});
test('while the ward is down a blow meets an ordinary guard (no second reflect)', () => {
  const once = fight('witch', [0]), twice = fight('witch', [0, 120]);
  assert.equal(twice.end[0], once.end[0], 'the second blow inside the 240-tick down time costs the attacker nothing more');
});
test('a creature with no ward row is an ordinary guard', () => {
  const r = fight('veteran', [0]);
  assert.equal(r.end[0], r.start[0], 'no reflect from a Veteran guard');
});
