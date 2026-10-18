// Hit stop as rows (hit-stop-defs.json, Combat top-30 item 10): the numbers the game held before the rows existed, pinned literally so moving them into data changed nothing a player feels,
// and a guard that the SIM never reads them (a stop that moved a tick would move every window; RECORD_VERSION and the sim digest stay put).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { IMPACT, KICK, impactTier } from '../src/fight/hit-impact.ts';

test('the rows say what hit-impact.ts held before they were rows', () => {
  assert.deepEqual(IMPACT, { full: { frames: 5, knock: 0.04, push: 0 }, half: { frames: 3, knock: 0.02, push: 0 }, special: { frames: 0, knock: 0, push: 0 }, parry: { frames: 11, knock: 0, push: 0.07 }, block: { frames: 2, knock: 0.02, push: 0 } });
  assert.deepEqual(KICK, { stopMs: 2000 / 60, drop: 0.1 });
});

test('a landed melee special is a contact only when its row has frames (trunk row 0: nothing changes), a spell or a self-heal never is', () => {
  const landed = (extra: object = {}) => ({ tick: 1, type: 'SpecialLanded', actor: 0, target: 1, move: 'skill_cleave', damage: 10, ...extra }) as never;
  assert.equal(impactTier(landed()), null, 'trunk: the special row is 0 frames');
  assert.equal(impactTier(landed({ spell: 'gula' })), null);
  assert.equal(impactTier(landed({ target: 0 })), null);
});

test('guard: no sim file reads the hit-stop rows', () => {
  const dir = new URL('../src/fight/', import.meta.url);
  const sim = ['duel.ts', 'sim.ts', 'record.ts', 'combat.ts', 'moves.ts', 'ai.ts', 'replay.ts', 'match.ts'];
  for (const f of readdirSync(dir).filter((n) => sim.includes(n))) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /hit-stop-(rows|defs)/, `${f} is sim: it must not read the presentation rows`);
});
