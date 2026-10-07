import test from 'node:test';
import assert from 'node:assert/strict';
import { idleIntent, initialDuel, stepDuel } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { STANDOFF_MS, standoffClock, standoffFlag, standoffPose } from '../src/standoff.ts';

test('the standoff is on by default; ?standoff=0 or off turns it off', () => {
  assert.equal(standoffFlag(''), true);
  assert.equal(standoffFlag('?debug'), true);
  assert.equal(standoffFlag('?standoff=1'), true);
  assert.equal(standoffFlag('?standoff=0'), false);
  assert.equal(standoffFlag('?x=1&standoff=off'), false);
});

test('both rigs run the draw clip over the window, then a sheathed fighter stands armed', () => {
  const sheathed = { pose: 'sheathed', progress: 0, tag: 'keep' };
  assert.deepEqual(standoffPose(sheathed, STANDOFF_MS / 2), { pose: 'draw', progress: 0.5, tag: 'keep' });
  assert.deepEqual(standoffPose(sheathed, STANDOFF_MS), { pose: 'ready', progress: 1, tag: 'keep' });
  const attack = { pose: 'attack', progress: 0.3 };
  assert.deepEqual(standoffPose({ pose: 'draw', progress: 0.4 }, STANDOFF_MS + 1), { pose: 'ready', progress: 1 });   // the sim's own draw is not shown twice
  assert.equal(standoffPose(attack, STANDOFF_MS + 1), attack);   // the sim's own pose wins once the window is over
});

test('the hidden cost: from a sheathed start the first swing begins RULES.draw ticks after the first press', () => {
  let d = initialDuel(), swing = -1;
  for (let i = 0; i < 120 && swing < 0; i++) {
    d = stepDuel(d, [{ ...idleIntent(), action: 'light' }, idleIntent()]);   // the press is held down: the attack queues in the draw's tail
    if (d.events.some((e) => e.type === 'AttackStarted' && e.actor === 0)) swing = d.tick;
  }
  const ms = Math.round(swing * 1000 / 60);
  console.log(`first swing after ${swing} ticks = ${ms} ms (RULES.draw ${RULES.draw})`);
  assert.equal(swing, RULES.draw + 2);   // 44 ticks = 733 ms at 60 Hz (measured 2026-10-07)
});

test('a second start replays the draw-in from 0: a rematch is not a once-per-page window', () => {
  const clock = standoffClock(), sheathed = { pose: 'sheathed', progress: 0 };
  assert.equal(clock.age, -1);
  clock.advance(100); assert.equal(clock.age, -1, 'the clock does not run before the first start');
  clock.start(); clock.advance(STANDOFF_MS + 50);
  assert.deepEqual(standoffPose(sheathed, clock.age), { pose: 'ready', progress: 1 }, 'the first fight: armed once the window is over');
  clock.start();
  assert.equal(clock.age, 0);
  assert.deepEqual(standoffPose(sheathed, clock.age), { pose: 'draw', progress: 0 }, 'the second fight: the first frame is the draw, not the armed pose');
});
