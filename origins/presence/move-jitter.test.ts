// A legit walker must not be kicked by network jitter (Lead 2026-10-17, from Web's row work): packets that bunch (a late one lands just before the next) used to be measured against a 100 ms
// floor, and a snapped pose still moved the clock while the position stayed stale, so ONE hiccup made every following honest packet "too fast" until the walker was dropped with 4009. The
// reach is a time credit now (it accrues at the speed limit and is capped at one second plus the jitter row), so a bunch draws on what the walker earned; a speed hack still cannot out-run the credit.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SPAWN } from './zones.ts';
import { RULES, World, type MoveResult } from './interest.ts';

const A = '00000000-0000-4000-8000-0000000000a1';
// A walker sends one pose every `every` ms at `cmS`; `arrive(k, sentAt)` is when the server hears it. Returns the server's answer per packet.
function walk(cmS: number, every: number, count: number, arrive: (k: number, sentAt: number) => number): MoveResult[] {
  const w = new World(), p = w.join(A, 0)!, out: MoveResult[] = [];
  const packets = Array.from({ length: count }, (_, k) => ({ k, sentAt: (k + 1) * every })).map((q) => ({ ...q, at: arrive(q.k, q.sentAt) })).sort((a, b) => a.at - b.at || a.k - b.k);
  for (const q of packets) out.push(w.move(p, { x: SPAWN.x + Math.round((cmS * q.sentAt) / 1000), z: SPAWN.z, heading: 0, anim: 0, flags: 0 }, q.at));
  return out;
}

test('an honest sprinter whose packets bunch once is never struck, and one hiccup does not snowball into a drop', () => {
  // 700 cm/s (the sprint limit), a pose every 200 ms (a throttled timer: 140 cm a step), the 6th packet 180 ms late so it lands 20 ms before the 7th.
  const out = walk(700, 200, 40, (k, sentAt) => sentAt + (k === 5 ? 180 : 0));
  assert.deepEqual(out.filter((r) => r !== 'ok'), [], 'every honest packet is accepted');
});

test('repeated jitter on a slow link (a burst of 4 late packets every 2 s) never reaches the drop', () => {
  const out = walk(600, 100, 200, (k, sentAt) => sentAt + (k % 20 >= 16 ? 400 - (k % 20 - 16) * 100 : 0));
  assert.deepEqual(out.filter((r) => r !== 'ok'), [], 'a bursty honest link is not struck');
});

test('a speed hack still strikes and drops: 3000 cm/s sustained cannot out-run the credit', () => {
  const out = walk(3000, 100, 60, (_, sentAt) => sentAt);
  assert.ok(out.includes('snapped'), 'the hack is snapped');
  assert.ok(out.includes('drop'), 'and dropped');
});

test('a jump cannot be banked: a teleport of 50 m after a long quiet spell is still a strike', () => {
  const w = new World(), p = w.join(A, 0)!;
  assert.equal(w.move(p, { x: SPAWN.x + 5000, z: SPAWN.z, heading: 0, anim: 0, flags: 0 }, 60_000), 'snapped');
});

test('many packets in the same millisecond cannot spend more than the credit: 30 steps of 150 cm at one instant is a hack', () => {
  const w = new World(), p = w.join(A, 0)!, seen: MoveResult[] = [];
  for (let k = 1; k <= 30; k++) seen.push(w.move(p, { x: SPAWN.x + 150 * k, z: SPAWN.z, heading: 0, anim: 0, flags: 0 }, 1000));
  assert.ok(seen.includes('snapped'), `the burst is refused once the credit runs out (credit cap ${Math.round(RULES.maxSpeedCmS * RULES.speedSlack * ((1000 + RULES.jitterMs) / 1000))} cm)`);
});
