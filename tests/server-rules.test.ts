import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../origins/server/server-rules.json' with { type: 'json' };
import manifest from '../origins/server/server-rules.manifest.json' with { type: 'json' };
import { MARK_GAP, MIN_GAP, POSE_BYTES } from '../origins/server/encounter-pose.ts';
import { POSED_FIGHT_MAX, fightOfToken, tokenFor } from '../origins/server/encounter.ts';
import { POSE_AGE_MS, REACH_SLACK, SLACK } from '../origins/server/world-spawns.ts';
import gearRules from '../src/fight/gear-stats-rules.json' with { type: 'json' };
import { CAPS, fullSet, loadoutFor } from '../src/fight/gear-stats.ts';

test('server rules: the exports keep the numbers they had in code', () => {
  assert.deepEqual([MIN_GAP, MARK_GAP, POSE_BYTES, POSED_FIGHT_MAX, SLACK, REACH_SLACK, POSE_AGE_MS], [2, 6.5, 20, 50, 0.5, 4, 5000]);
  assert.deepEqual(rules.encounterPose.map((r) => r.edge), [0.01]);
  assert.deepEqual(rules.encounterToken.map((r) => r.randomBytes), [24]);
  assert.equal(rules.mobPayout[0]!.capReached, Number.MAX_SAFE_INTEGER, 'the caps a kill cannot read yet count as reached');
  const m = gearRules.multiplier[0]!;
  assert.deepEqual([m.scale, m.attackPerPoint, m.resPerPoint], [90000, 15, 20], 'the gear multipliers keep the literals they had');
  assert.deepEqual(loadoutFor({}), { attack: 1, res: 1 }, 'naked is the identity');
  assert.deepEqual(loadoutFor(fullSet('Origin', 'Longsword')), CAPS, 'a full Origin set lands exactly on the caps');
});

test('server rules: the file loads through the registry, one row per table', () => {
  const reg = loadRegistry(manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'server-rules.json')));
  assert.ok(reg);
  for (const [name, rows] of Object.entries(rules)) if (name !== 'wornPoke') assert.equal(rows.length, 1, name);
  assert.deepEqual(rules.wornPoke.map((r) => r.id), ['gear_equip', 'gear_unequip', 'gear_import'], 'wornPoke is one row per op that can change what a character wears');
});

test('server rules: a token still ends in 32 random characters (24 bytes), and still reads its fight back', () => {
  const t = tokenFor('goblin-1'), prefix = Buffer.from('goblin-1').toString('base64url');   // the random tail is base64url and may itself hold '_', so the split is by the known prefix, not by searching
  assert.ok(t.startsWith(`${prefix}_`));
  assert.equal(t.length, prefix.length + 1 + 32);
  assert.equal(fightOfToken(t), 'goblin-1');
});

test('server limits: the exports keep the numbers they had in code', async () => {
  const { MAX_OWNED } = await import('../origins/server/gear-import.ts'), { QUEUE_MAX } = await import('../origins/server/server.ts'), { PRESENCE_FRESH_MS } = await import('../origins/server/upgrade.ts');
  assert.deepEqual([MAX_OWNED, QUEUE_MAX, PRESENCE_FRESH_MS, rules.serverLimits[0]!.maxPending], [200, 16, 5000, 50]);
});

test('server rules: the token randomness row sits at or over its floor (an unguessable token), and the floor is 16 bytes', () => {
  const r = rules.encounterToken[0]!;
  assert.equal(r.minRandomBytes, 16);
  assert.ok(r.randomBytes >= r.minRandomBytes);
});
