import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, project, practiceHint, OPPONENTS, type Practice } from '../src/combat.ts';
import { aim, legal, movesOf, stepDuel, type Intent } from '../src/duel.ts';
import { RADIUS } from '../src/sim.ts';
import { ENCOUNTERS } from '../src/roster.ts';

// A straight-back roll (no stick) escapes a fully charged heavy on every live opponent, in the open and with the wall 1.0 behind,
// whether it is pressed on the seen swing start or on the hold-time read, and the player's line says "Evaded!". The player stands
// after the roll until the swing resolves: walking back in while the charge is still parked is a separate choice, not the roll.
const DELAY = 11;   // the player perceives a swing start this many ticks late (the limited player bot's reaction time)
const still = { x: 0, z: 0, yaw: 0, run: false };
const idle = (): Intent => ({ move: still, action: null, guard: false, held: false, lock: true, cancel: false });

function rollOut(id: string, start: 'centre' | 'wall', when: 'seen' | 'hold-time') {
  const opponent = OPPONENTS[id as keyof typeof OPPONENTS];
  let s: Practice = initialPractice(731, opponent);
  const d = structuredClone(s.duel), [p, o] = d.fighters;
  const z = start === 'centre' ? -0.8 : -(RADIUS - 1.0);
  Object.assign(p, { phase: 'ready', age: 0 });
  p.body = { ...p.body, x: 0, z }; o.body = { ...o.body, x: 0, z: z + 1.6 };
  p.body.heading = aim(p.body, o.body); o.body.heading = aim(o.body, p.body);
  s = project(d, s.ai, s);
  let foeStart: number | null = null, rolled = false, charged = false, hurt = 0, line = '';
  const chamber = movesOf(o).heavy_overhead.chamber!;
  for (let t = 1; t <= 200; t++) {
    const pi = idle(), oi = idle();
    if (t === 6) oi.action = 'heavy';
    if (t >= 6) oi.held = true;
    const trigger = foeStart === null ? null : foeStart + DELAY + (when === 'seen' ? 0 : chamber + 8);
    if (!rolled && trigger !== null && s.duel.tick + 1 >= trigger && legal(s.duel.fighters[0], 'dodge')) { pi.action = 'dodge'; rolled = true; }
    const next = stepDuel(s.duel, [pi, oi]);
    s = project(next, s.ai, s);
    for (const e of next.events) {
      if (e.actor === 1 && e.type === 'AttackStarted') foeStart ??= e.tick;
      if (e.actor === 1 && e.type === 'Charged') charged = true;
      if (e.actor === 1 && e.type === 'Hit') hurt += e.damage ?? 0;
      if (e.actor === 1 && (e.type === 'AttackMissed' || e.type === 'Hit' || e.type === 'Blocked')) line = practiceHint(s);
    }
    if (line) break;
  }
  return { rolled, charged, hurt, line };
}

for (const start of ['centre', 'wall'] as const) for (const when of ['seen', 'hold-time'] as const) {
  test(`a straight-back roll escapes a charged heavy (${start}, ${when}) on every live opponent and reads Evaded!`, () => {
    for (const { id } of ENCOUNTERS.filter(e => !e.hold)) {
      const r = rollOut(id, start, when);
      assert.equal(r.charged, true, `${id}: the heavy was charged`);
      assert.equal(r.rolled, true, `${id}: rolled`);
      assert.equal(r.hurt, 0, `${id}: the charged heavy landed after a straight-back roll`);
      assert.equal(r.line, 'Evaded!', `${id}: the player's line`);
    }
  });
}

