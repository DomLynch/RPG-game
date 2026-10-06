// Ladder gate: the human-like bots (guard/parry only once the swing is 12 ticks old, wrong side 20 %) against every beta opponent at the Easy / Normal / Origin anchors
// (L6, L18, L46). The tick-0 `blocker` of ladder-sweep.mjs is superhuman and hid a flat Goblin; this is the yardstick that cannot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladderHuman } from '../scripts/ladder-human.mjs';

// Opponents allowed to be flat today. The gate also fails when one of them is NOT flat any more, so the entry is deleted the day the rung is fixed.
// (empty since the Goblin's stab, COMBAT-001 3/3: his L6 -> L46 win rate now falls ~40 pts.)
const KNOWN_FLAT = new Set<string>();
const N = 40;                       // one cell is ±8 pts at n=40, so the bars below are drawn wide
const NOISE = 10;

test(`ladder, human-like bots: every opponent gets harder from L6 to L18 to L46 and none goes flat [slow]`, () => {
  const table: Record<string, Record<string, number[]>> = ladderHuman({ n: N }) as Record<string, Record<string, number[]>>;
  assert.equal(Object.keys(table).length, 10, 'ten beta opponents');
  const text = Object.entries(table).map(([id, b]) => `${id.padEnd(13)} blocker ${b.blocker.join('/')}  skilled ${b.skilled.join('/')}`).join('\n  ');
  const flat: string[] = [];
  for (const [id, b] of Object.entries(table)) {
    const [l6, l18, l46] = [0, 1, 2].map(i => (b.blocker[i] + b.skilled[i]) / 2);
    assert.ok(l18 <= l6 + NOISE && l46 <= l18 + NOISE, `${id} gets easier up the ladder (mean win % L6 ${l6}, L18 ${l18}, L46 ${l46})\n  ${text}`);
    if (l6 - l46 < 15) flat.push(id);
  }
  assert.deepEqual(flat.sort(), [...KNOWN_FLAT].sort(), `flat rungs (L6 − L46 < 15 pts, mean of both bots) must be exactly the KNOWN_FLAT set\n  ${text}`);
  console.log(`ladder human n=${N}\n  ${text}`);
});
