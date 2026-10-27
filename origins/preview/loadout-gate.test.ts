import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadoutGate } from './loadout-gate.ts';

const WAIT = 15_000, RETRY = 10_000;
function rig(over: { signedIn?: boolean } = {}) {
  const s = { t: 1_000_000, signedIn: over.signedIn ?? true, build: false, inflight: false, gear: false, asks: 0, mounted: true };
  const gate = createLoadoutGate({ now: () => s.t, signedIn: () => s.signedIn, buildHeld: () => s.build, buildInflight: () => s.inflight, gearReady: () => s.gear, askGear: () => { if (!s.mounted) return false; s.asks++; return true; }, wait: WAIT, retry: RETRY });
  return { s, gate, at: (ms: number) => { s.t += ms; } };
}

test('a guest is ready at once and never asks the gear view', () => {
  const { s, gate } = rig({ signedIn: false });
  assert.equal(gate(), true); assert.equal(s.asks, 0);
});

test('a signed-in character is not ready until BOTH the build and the gear view have answered; the gear view is asked at the first look', () => {
  const { s, gate, at } = rig();
  assert.equal(gate(), false); assert.equal(s.asks, 1, 'asked at load');
  s.build = true; at(1000); assert.equal(gate(), false, 'the build alone is not enough');
  s.gear = true; at(1000); assert.equal(gate(), true, 'both answered');
});

test('the gear view is re-asked every retry window until it answers, and a build_get still in flight holds the fallback', () => {
  const { s, gate, at } = rig();
  s.inflight = true;   // the first build_get is on its way the whole time
  gate(); at(RETRY + 1); gate(); at(RETRY + 1); assert.equal(gate(), false, 'past the wait, but no bare fight while a build_get is on its way');
  assert.equal(s.asks, 3, 'asked again each window');
  s.inflight = false; at(1); assert.equal(gate(), true, 'then the writer is judged unanswered');
});

test('the 15 s fallback latches with the writer down, and a LATER gear answer is still asked for: a short blip does not leave him ungeared for the session', () => {
  const { s, gate, at } = rig();
  gate(); at(WAIT + 1); assert.equal(gate(), true, 'fallback latched, he fights bare');
  const asked = s.asks;
  at(RETRY + 1); gate(); at(RETRY + 1); gate();
  assert.ok(s.asks >= asked + 2, 'still asking after the latch');
  s.gear = true; at(RETRY + 1); assert.equal(gate(), true); const done = s.asks;
  at(RETRY * 5); gate(); gate();
  assert.equal(s.asks, done, 'and it stops asking once the view has answered');
});

test('the gear screen mounts LATE (main.ts: after the pit-duel chunk): the gate looked from frame 1 with nothing to ask, still asks the moment it exists, and opens only on its answer', () => {
  const { s, gate, at } = rig();
  s.mounted = false; s.build = true;   // the build has answered, the gear screen is not there yet and reports unanswered
  for (let i = 0; i < 5; i++) { assert.equal(gate(), false, 'not ready: nothing has answered the gear question'); at(100); }
  assert.equal(s.asks, 0, 'nothing could be asked yet, and that is not an answer');
  s.mounted = true; at(100); assert.equal(gate(), false, 'asked at the very next look, not a retry window later'); assert.equal(s.asks, 1);
  s.gear = true; at(100); assert.equal(gate(), true, 'ready on the answer, well inside the 15 s fallback');
});
