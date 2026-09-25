import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, project, practiceHint, OPPONENTS, type Practice } from '../src/combat.ts';
import { aim, idleIntent, stepDuel, type Action, type Intent } from '../src/duel.ts';

// "Evaded!" is earned by the player's own evade: an opponent's swing at a player who stands still is air and prints nothing,
// while a roll or backstep out of the swing still reads "Evaded!".
const idle = (): Intent => ({ ...idleIntent(), lock: true });
function swingAt(gap: number, move: 'light' | 'heavy' | 'thrust', evade: Action | null = null, evadeTick = 0) {
  let s: Practice = initialPractice(731, OPPONENTS.pitborn);
  const d = structuredClone(s.duel), [p, o] = d.fighters;
  Object.assign(p, { phase: 'ready', age: 0 }); Object.assign(o, { phase: 'ready', age: 0 });
  p.body = { ...p.body, x: 0, z: 0 }; o.body = { ...o.body, x: 0, z: gap };
  p.body.heading = aim(p.body, o.body); o.body.heading = aim(o.body, p.body);
  s = project(d, s.ai, s);
  const lines: string[] = [];
  let resolved: string | null = null;
  for (let t = 1; t <= 120 && !resolved; t++) {
    const pi = idle(), oi = idle();
    if (t === 2) oi.action = move;
    if (evade && t === evadeTick) pi.action = evade;
    const next = stepDuel(s.duel, [pi, oi]);
    s = project(next, s.ai, s);
    lines.push(practiceHint(s));
    resolved = next.events.find(e => e.actor === 1 && (e.type === 'AttackMissed' || e.type === 'Hit' || e.type === 'Blocked'))?.type ?? null;
  }
  return { resolved, line: practiceHint(s), everEvaded: lines.includes('Evaded!') };
}

for (const gap of [3, 6]) for (const move of ['light', 'heavy', 'thrust'] as const) {
  test(`a ${move} at a still player ${gap} m away whiffs without "Evaded!"`, () => {
    const r = swingAt(gap, move);
    assert.equal(r.resolved, 'AttackMissed');
    assert.equal(r.everEvaded, false, r.line);
  });
}

test('a backstep out of a light still reads "Evaded!"', () => {
  const r = swingAt(1.8, 'light', 'backstep', 6);
  assert.equal(r.resolved, 'AttackMissed');
  assert.equal(r.line, 'Evaded!');
});

test('a roll out of a heavy still reads "Evaded!"', () => {
  const r = swingAt(1.6, 'heavy', 'dodge', 14);
  assert.ok(r.resolved === 'AttackMissed', `resolved ${r.resolved}`);
  assert.equal(r.line, 'Evaded!');
});
