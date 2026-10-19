import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dynamicRespawnS } from '../origins/server/dynamic-respawn.ts';
import { defaultZoneSpawns } from '../origins/server/world-spawns.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';

// scripts/origins-layers-smoke.mjs is a TOOL (a disposable-Postgres end-to-end run, about a minute, NOT run by CI: it needs initdb as a non-root user). This test keeps its fixture honest in the unit suite:
// the numbers its assertions rely on still hold on trunk's rows, and the script still drives the three flags and the era-off bot. Run the tool itself per release (the Auditor's post-live read):
//   runuser -u frankrows -- env PG_BIN=/usr/lib/postgresql/16/bin node --experimental-strip-types scripts/origins-layers-smoke.mjs
const SCRIPT = readFileSync(new URL('../scripts/origins-layers-smoke.mjs', import.meta.url), 'utf8');

test('layers smoke fixture: the Zone 1 wolf the scripted hero kills has a row respawn the 40-player layer shortens, not below the floor, and the 2-player layer keeps', () => {
  const loaded = loadEncounterContent(); assert.ok(loaded.ok, 'content');
  const wolf = [...defaultZoneSpawns(loaded.ok ? loaded.value : (undefined as never)).values()].find((s) => s.spec.character === 'character:ash-wolf');
  assert.ok(wolf, 'the ash wolf exists in Zone 1');
  const crowded = dynamicRespawnS(wolf.respawnS, 40), quiet = dynamicRespawnS(wolf.respawnS, 2);
  assert.ok(crowded < wolf.respawnS, `40 players shorten the row respawn (${crowded} < ${wolf.respawnS})`);
  assert.ok(crowded >= 15 || crowded === wolf.respawnS, 'never below the 15 s floor');
  assert.equal(quiet, wolf.respawnS, 'a 2-player layer keeps the row respawn');
  assert.ok(wolf.respawnS > crowded + 2 + 8, 'the hop has room: the row window is still open after the shortened respawn plus the wait and the kill-time floor');
});

test('layers smoke script: legacy-rules bot first, all three flags on, the hop refused at the database pre-check, and it labels itself not prod', () => {
  assert.match(SCRIPT, /^\/\/ NOT PROD\./, 'the header says NOT PROD');
  assert.ok(SCRIPT.indexOf("import '../tests/lib/era-off.ts'") < SCRIPT.indexOf("from 'node:child_process'"), 'era-off is the first import');
  for (const flag of ['spawnLayers: true', 'damageShare: true', 'dynamicRespawn: true']) assert.ok(SCRIPT.includes(flag), `the ops are built with ${flag}`);
  assert.ok(SCRIPT.includes('cooldown'), 'the hop is asserted to be refused (cooldown)');
  assert.ok(!/frankendom\.com|supabase\.co|DATABASE_URL/.test(SCRIPT.replace(/\/\/.*$/gm, '')), 'no prod host or connection string in the script (disposable cluster only)');
});
