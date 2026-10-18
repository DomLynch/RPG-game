// Hit stop as rows (hit-stop-defs.json, Combat top-30 item 10): the numbers the game held before the rows existed, pinned literally so moving them into data changed nothing a player feels,
// and a guard that the SIM never reads them (a stop that moved a tick would move every window; RECORD_VERSION and the sim digest stay put).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { IMPACT, KICK } from '../src/fight/hit-impact.ts';

test('the rows say what hit-impact.ts held before they were rows', () => {
  assert.deepEqual(IMPACT, { special: { frames: 8, knock: 0.05, push: 0 }, full: { frames: 5, knock: 0.04, push: 0 }, half: { frames: 3, knock: 0.02, push: 0 }, parry: { frames: 11, knock: 0, push: 0.07 }, block: { frames: 2, knock: 0.02, push: 0 } });
  assert.deepEqual(KICK, { stopMs: 2000 / 60, drop: 0.1 });
});

test('Strategy\'s bound: a special\'s camera jolt moves the 375-wide frame by at most 6 px, and the special holds longer than a heavy', () => {
  // MEASURED (Mac GPU, Metal, 375x812, one skill landing replayed on a build of each row, each aligned to its own landing frame): at the landing frame a 4 cm knock moves the picture 4.0 to 4.2 px, a 2.5 cm knock 2.6 to 3.0 px
  // and a 5 cm knock 4.9 (horizon) to 5.6 px (ground), so up to about 1.12 px per cm (hit-impact.ts's own "4 cm is ~2.5 % of the frame" comment overstates it by about 2.3x). 1.15 keeps a margin. The bound is Strategy's (#3134): change the row, never the bound.
  const PX_PER_CM = 1.15, px = (knockM: number) => knockM * 100 * PX_PER_CM;
  assert.ok(px(IMPACT.special.knock) <= 6, `${px(IMPACT.special.knock).toFixed(2)} px at 375`);
  assert.ok(IMPACT.special.frames > IMPACT.full.frames && IMPACT.special.knock > IMPACT.full.knock, 'a special out-weighs a heavy in the hold and in the jolt');
});

test('guard: no sim file reads the hit-stop rows', () => {
  const dir = new URL('../src/fight/', import.meta.url);
  const sim = ['duel.ts', 'sim.ts', 'record.ts', 'combat.ts', 'moves.ts', 'ai.ts', 'replay.ts', 'match.ts'];
  for (const f of readdirSync(dir).filter((n) => sim.includes(n))) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /hit-stop-(rows|defs)/, `${f} is sim: it must not read the presentation rows`);
});
