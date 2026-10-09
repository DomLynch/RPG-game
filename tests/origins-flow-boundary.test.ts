// Rule 1 (Dom, 2026-10-09): the open world (origins/) runs the Pit's shared fight CORE (duel, ai, sim, moves, input, hud, characters, scene, gore ...) and never the Pit's FLOW: the arena, the ladder,
// the match / trial / scorecard / sparring scenes that start and end a Pit fight. A test (like sim-boundary.test.ts, for the same reason: no-restricted-imports cannot say "except these") fails when
// any non-test file under origins/ imports a flow module. Imports that exist today are pinned in KNOWN as debt: a NEW one fails, and a listed one that has been removed fails too, so the list only shrinks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FLOW = ['main', 'match', 'ladder', 'arena', 'arena-themes', 'arena-props', 'trial', 'scorecard', 'sparring', 'sparring-specials', 'sparring-special-runtime'] as const;
const KNOWN: readonly string[] = [
  // The Pit mount (pit-duel.ts / pit-adapter.ts) and the record reader: the debt the one-core slices S3-S7 pay down. Remove a line when its import goes.
  'origins/preview/pit-adapter.ts -> src/arena-themes.ts',
  'origins/preview/pit-adapter.ts -> src/arena.ts',
  'origins/preview/pit-duel.ts -> src/match.ts',
  'origins/preview/pit-duel.ts -> src/scorecard.ts',
  'origins/preview/pit-duel.ts -> src/trial.ts',
  'origins/preview/world-record.ts -> src/match.ts',
];

const IMPORT = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\()\s*['"]([^'"]+)['"]/gm;
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []);
const violations = (): string[] => files('origins').flatMap((file) => [...new Set([...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1]!)
  .filter((s) => /(^|\/)src\/[^/]+$/.test(s))
  .map((s) => s.replace(/\?.*$/, '').replace(/\.ts$/, '').split('/').pop()!)
  .filter((name) => (FLOW as readonly string[]).includes(name)))].map((name) => `${file} -> src/${name}.ts`)).sort();

test('origins/ imports no Pit flow module except the pinned debt, and the debt only shrinks', () => {
  const now = violations();
  assert.deepEqual(now.filter((v) => !KNOWN.includes(v)), [], 'a new import of Pit/arena flow code from origins/ (rule 1)');
  assert.deepEqual(KNOWN.filter((v) => !now.includes(v)), [], 'a listed import is gone: delete it from KNOWN so it cannot come back');
});

test('the flow check sees static, re-export and dynamic imports', () => {
  const src = "import { a } from '../../src/arena.ts';\nexport { b } from '../../src/match.ts';\nconst c = await import('../../src/ladder.ts');\nimport '../../src/trial.ts';\n";
  assert.deepEqual([...src.matchAll(IMPORT)].map((m) => m[1]), ['../../src/arena.ts', '../../src/match.ts', '../../src/ladder.ts', '../../src/trial.ts']);
});

// K2c (Lead + Strategy, 2026-10-09): Zone 1 and every browser client reach the fight through ONE door, src/fight/index.ts. A non-test file under origins/ may not import an engine module
// (duel, ai, sim, moves, combat, play-radius, record, gear-stats, gambit, stance, twist, replay) directly. The server and contract files below run in node without the renderer the index pulls in
// (three.js); they are named debt, owner Duels & Backend (origins/server, origins/contracts, origins/luck) plus the three modules those server files import (mobs/kits.ts, encounters/encounters.ts, shared/with-bar.ts: the kit tag is pinned by tests/kit-version.test.ts and must not move), and a listed import that goes away must be deleted from the list.
const ENGINE = ['duel', 'ai', 'sim', 'moves', 'combat', 'play-radius', 'record', 'gear-stats', 'gambit', 'stance', 'twist', 'replay'];
const ENGINE_DEBT: readonly string[] = [
  'origins/contracts/economy.ts -> src/gear-stats.ts',
  'origins/contracts/items.ts -> src/gear-stats.ts',
  'origins/encounters/encounters.ts -> src/moves.ts',
  'origins/encounters/encounters.ts -> src/twist.ts',
  'origins/luck/luck.ts -> src/gambit.ts',
  'origins/mobs/kits.ts -> src/duel.ts',
  'origins/mobs/kits.ts -> src/moves.ts',
  'origins/server/encounter-fixtures.ts -> src/combat.ts',
  'origins/server/encounter-fixtures.ts -> src/duel.ts',
  'origins/server/encounter-fixtures.ts -> src/moves.ts',
  'origins/server/encounter-fixtures.ts -> src/play-radius.ts',
  'origins/server/encounter-fixtures.ts -> src/record.ts',
  'origins/server/encounter-fixtures.ts -> src/replay.ts',
  'origins/server/encounter-pose.ts -> src/duel.ts',
  'origins/server/encounter-pose.ts -> src/play-radius.ts',
  'origins/server/encounter-pose.ts -> src/record.ts',
  'origins/server/encounter-verify.ts -> src/combat.ts',
  'origins/server/encounter-verify.ts -> src/duel.ts',
  'origins/server/encounter-verify.ts -> src/moves.ts',
  'origins/server/encounter-verify.ts -> src/record.ts',
  'origins/server/encounter-verify.ts -> src/replay.ts',
  'origins/server/encounter-verify.ts -> src/sim.ts',
  'origins/server/encounter-verify.ts -> src/twist.ts',
  'origins/server/encounter.ts -> src/duel.ts',
  'origins/server/encounter.ts -> src/record.ts',
  'origins/server/encounter.ts -> src/twist.ts',
  'origins/server/mob-rewards.ts -> src/twist.ts',
  'origins/server/world-spawns.ts -> src/gambit.ts',
  'origins/server/world-spawns.ts -> src/gear-stats.ts',
  'origins/server/world-spawns.ts -> src/moves.ts',
  'origins/shared/with-bar.ts -> src/combat.ts',
];
const direct = (): string[] => files('origins').flatMap((file) => [...new Set([...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1]!)
  .filter((s) => /(^|\/)src\/[^/]+$/.test(s)).map((s) => s.replace(/\?.*$/, '').replace(/\.ts$/, '').split('/').pop()!)
  .filter((name) => ENGINE.includes(name)))].map((name) => `${file} -> src/${name}.ts`)).sort();

test('origins/ reaches the fight engine only through src/fight/index.ts, except the named server debt', () => {
  const now = direct();
  assert.deepEqual(now.filter((v) => !ENGINE_DEBT.includes(v)), [], 'import the engine from src/fight/index.ts, not from its modules');
  assert.deepEqual(ENGINE_DEBT.filter((v) => !now.includes(v)), [], 'a listed import is gone: delete it from ENGINE_DEBT so it cannot come back');
});
