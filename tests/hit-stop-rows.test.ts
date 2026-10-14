// Hit stop as rows (hit-stop-defs.json, Combat top-30 item 10): the numbers the game held before the rows existed, pinned literally so moving them into data changed nothing a player feels,
// and a guard that the SIM never reads them (a stop that moved a tick would move every window; RECORD_VERSION and the sim digest stay put).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { IMPACT, KICK } from '../src/fight/hit-impact.ts';
import { CONTACTS, holdMs } from '../src/fight/hit-stop-rows.ts';

test('the rows say what main.ts and hit-impact.ts held before they were rows', () => {
  const ms = (id: keyof typeof CONTACTS) => CONTACTS[id].ms;
  assert.deepEqual([ms('hitLight'), ms('hitHeavy'), ms('blockLight'), ms('blockHeavy'), ms('parry'), ms('guardBreak'), ms('special'), ms('postureBreak'), ms('kill')], [50, 90, 30, 50, 70, 90, 50, 150, 220]);
  assert.deepEqual(IMPACT, { full: { frames: 5, knock: 0.04, push: 0 }, half: { frames: 3, knock: 0.02, push: 0 }, parry: { frames: 11, knock: 0, push: 0.07 }, block: { frames: 2, knock: 0.02, push: 0 } });
  assert.deepEqual(KICK, { stopMs: 2000 / 60, drop: 0.1 });
  assert.equal(holdMs(CONTACTS.parry), 70 + (11 * 1000) / 60, 'a parry is still the longest beat: 70 ms + 11 frames');
  assert.ok(holdMs(CONTACTS.parry) > holdMs(CONTACTS.hitHeavy), 'longer than a heavy hit (90 ms + 5 frames)');
});

test('guard: no sim file reads the hit-stop rows', () => {
  const dir = new URL('../src/fight/', import.meta.url);
  const sim = ['duel.ts', 'sim.ts', 'record.ts', 'combat.ts', 'moves.ts', 'ai.ts', 'replay.ts', 'match.ts'];
  for (const f of readdirSync(dir).filter((n) => sim.includes(n))) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /hit-stop-(rows|defs)/, `${f} is sim: it must not read the presentation rows`);
});
