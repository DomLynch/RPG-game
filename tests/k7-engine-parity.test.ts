// K7 EXIT TEST (Strategy 2026-10-09, written by World): a zone reaches the fight engine ONLY through src/fight/index.ts, for every row of the 22-row parity checklist that is a code path
// (rows 1-16 and 20; 17 and 22 are by design, 18 and 19 are server tick, post K). It FAILS on any non-test file under origins/ that imports a combat-owned src/ module directly, and on a
// zone-own copy of engine code. What fails today is pinned below, each entry with the slice that removes it; the lists only shrink (a new violation fails, and a listed one that is gone
// fails until you delete the line). Zone 2 (and any zone N >= 2) must be data: no src/ import, only `import type`, under 300 lines. Classified by module NAME, so moving a module (src/audio/creature.ts
// -> src/fight/sound/creature.ts) does not change its row. An import of a src/ module that is neither a row nor ALLOWED fails: classify it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Own = 'K2' | 'P1/P2' | 'K11' | 'K12' | 'server';   // K2: rows 1-7 land with Release K; P1/P2: Combat's fx extraction + Zone 1 per-pair fx; K11: creature dressing; K12: catalogue as runtime source; server: node-run server code that cannot take the renderer-bearing index (Duels & Backend)
// module name -> [parity row, owner of the slice that moves the zone's use behind src/fight/index.ts]
export const ROWS: Record<string, readonly [number, Own]> = {
  duel: [1, 'K2'], detmath: [1, 'K2'], sim: [1, 'K2'], record: [1, 'K2'], replay: [1, 'K2'], 'play-radius': [1, 'K2'], 'stab-rule': [1, 'K2'], combat: [1, 'K2'],
  ai: [2, 'K2'],
  moves: [3, 'K2'], 'gear-stats': [3, 'K2'], gambit: [3, 'K2'], stance: [3, 'K2'], twist: [3, 'K2'],
  speeds: [4, 'K2'],
  input: [5, 'K2'],
  characters: [6, 'K2'],
  mobkit: [7, 'K11'], 'beast-scale': [7, 'K11'],
  gore: [8, 'P1/P2'], 'blood-style': [8, 'P1/P2'], 'blood-edge': [8, 'P1/P2'], 'finisher-blood': [8, 'P1/P2'],
  finishers: [9, 'P1/P2'], execution: [9, 'P1/P2'], hamstrung: [9, 'P1/P2'], 'severed-head': [9, 'P1/P2'], 'dropped-weapon': [9, 'P1/P2'],
  'hit-impact': [10, 'P1/P2'], armfeel: [10, 'P1/P2'], 'armfeel-fx': [10, 'P1/P2'], 'clash-sparks': [10, 'P1/P2'], 'foot-dust': [10, 'P1/P2'], scene: [10, 'P1/P2'],
  'camera-kick': [11, 'P1/P2'], camera: [11, 'P1/P2'],
  feedback: [12, 'P1/P2'], cues: [12, 'P1/P2'], creature: [12, 'P1/P2'], breath: [12, 'P1/P2'], special: [12, 'P1/P2'], 'power-word': [12, 'P1/P2'], 'armfeel-sound': [12, 'P1/P2'],
  signature: [13, 'P1/P2'], 'skill-impact': [13, 'P1/P2'],
  hud: [14, 'P1/P2'], 'stance-panel': [14, 'P1/P2'], fatigue: [14, 'P1/P2'],
  'rank-look': [15, 'K11'],
  quality: [16, 'P1/P2'], 'colour-grade': [16, 'P1/P2'], 'warm-gate': [16, 'P1/P2'],
  roster: [20, 'K12'], legends: [20, 'K12'],
  warrior: [6, 'K2'], goblin: [7, 'K11'], knight: [7, 'K11'], pitborn: [7, 'K11'], witch: [7, 'K11'],   // body files (src/assets/*.glb) imported by name: the actor loads them, the zone must not
};
// ACCOUNT / ITEM-LEDGER UI (not combat), by EXACT path (Lead 2026-10-09, #2016 HOLD): the gear screen and the writer call talk to the account and the item ledger, not to the fight. Each line is one file -> one module,
// never a folder or a module wildcard; the post-K7 ledger unification revisits them. Combat stays strict: nothing from a combat module outside src/fight.
const LEDGER_UI: readonly string[] = [
  'origins/preview/gear-mount.ts -> gear-server',
  'origins/preview/gear-mount.ts -> gear-sheet',
  'origins/preview/gear-stage.ts -> gear-room',
  'origins/preview/encounter-net.ts -> writer-call',
  'origins/preview/save.ts -> writer-call',
  'origins/preview/main.ts -> open',   // src/fight/open.ts: the one door to the writer's `open` (the account's first character), #2023
  'origins/preview/save.ts -> open',
];
// Not engine rows: the Pit's FLOW (pinned by origins-flow-boundary.test.ts), identity/economy data, and page chrome.
const ALLOWED = new Set(['arena', 'arena-themes', 'match', 'scorecard', 'trial', 'career', 'grades', 'loot', 'profile', 'backoff', 'zoom-guard', 'style', 'roll', 'index']);
// Server-run code (node, no three.js): it verifies and rewards fights from the same sim, so it cannot take the renderer-bearing index. Named debt of Duels & Backend, one door for node is a later slice.
const SERVER_DIRS = ['origins/server/', 'origins/contracts/', 'origins/luck/', 'origins/encounters/', 'origins/inventory/', 'origins/progression/', 'origins/feuds/', 'origins/world/', 'origins/region1/', 'origins/mobs/', 'origins/shared/', 'origins/zones/loader.ts'];

// Today's failures, "row | owner | file -> module". Remove a line when its import goes.
const KNOWN: readonly string[] = [
  "1 | server | origins/mobs/kits.ts -> duel",
  "1 | server | origins/server/encounter-fixtures.ts -> combat",
  "1 | server | origins/server/encounter-fixtures.ts -> duel",
  "1 | server | origins/server/encounter-fixtures.ts -> play-radius",
  "1 | server | origins/server/encounter-fixtures.ts -> record",
  "1 | server | origins/server/encounter-fixtures.ts -> replay",
  "1 | server | origins/server/encounter-fixtures.ts -> stab-rule",
  "1 | server | origins/server/encounter-pose.ts -> duel",
  "1 | server | origins/server/encounter-pose.ts -> play-radius",
  "1 | server | origins/server/encounter-pose.ts -> record",
  "1 | server | origins/server/encounter-verify.ts -> combat",
  "1 | server | origins/server/encounter-verify.ts -> detmath",
  "1 | server | origins/server/encounter-verify.ts -> duel",
  "1 | server | origins/server/encounter-verify.ts -> record",
  "1 | server | origins/server/encounter-verify.ts -> replay",
  "1 | server | origins/server/encounter-verify.ts -> sim",
  "1 | server | origins/server/encounter.ts -> duel",
  "1 | server | origins/server/encounter.ts -> record",
  "1 | server | origins/shared/with-bar.ts -> combat",
  "3 | server | origins/contracts/economy.ts -> gear-stats",
  "3 | server | origins/contracts/items.ts -> gear-stats",
  "3 | server | origins/encounters/encounters.ts -> moves",
  "3 | server | origins/encounters/encounters.ts -> twist",
  "3 | server | origins/luck/luck.ts -> gambit",
  "3 | server | origins/mobs/kits.ts -> moves",
  "3 | server | origins/server/encounter-fixtures.ts -> moves",
  "3 | server | origins/server/encounter-verify.ts -> moves",
  "3 | server | origins/server/encounter-verify.ts -> twist",
  "3 | server | origins/server/encounter.ts -> twist",
  "3 | server | origins/server/mob-rewards.ts -> twist",
  "3 | server | origins/server/world-spawns.ts -> gambit",
  "3 | server | origins/server/world-spawns.ts -> gear-stats",
  "3 | server | origins/server/world-spawns.ts -> moves",
  "4 | K2 | origins/preview/main.ts -> speeds",
  "4 | K2 | origins/preview/mobs.ts -> speeds",
  "5 | K2 | origins/preview/pit-duel.ts -> input",
  "5 | K2 | origins/preview/sticks.ts -> input",
  "6 | K2 | origins/preview/play.ts -> warrior",
  "7 | K11 | origins/preview/mobs-view.ts -> goblin",
  "7 | K11 | origins/preview/mobs-view.ts -> knight",
  "7 | K11 | origins/preview/mobs-view.ts -> pitborn",
  "7 | K11 | origins/preview/mobs-view.ts -> witch",
  "7 | server | origins/mobs/kit-version.ts -> mobkit",
  "7 | server | origins/mobs/kits.ts -> mobkit",
  "10 | P1/P2 | origins/preview/pit-duel.ts -> scene",
  "12 | P1/P2 | origins/preview/creature-voice.ts -> creature",
  "12 | P1/P2 | origins/preview/creature-voice.ts -> feedback",
  "12 | P1/P2 | origins/preview/main.ts -> creature",
  "12 | P1/P2 | origins/preview/pit-duel.ts -> creature",
  "12 | P1/P2 | origins/preview/pit-duel.ts -> feedback",
  "14 | P1/P2 | origins/preview/pit-duel.ts -> hud",
  "16 | P1/P2 | origins/preview/main.ts -> quality",
  "16 | P1/P2 | origins/preview/main.ts -> warm-gate",
  "16 | P1/P2 | origins/preview/mobs-view.ts -> quality",
  "16 | P1/P2 | origins/preview/mobs-view.ts -> warm-gate",
  "20 | K12 | origins/preview/main.ts -> legends",
  "20 | K12 | origins/preview/pit-duel.ts -> legends",
  "20 | K12 | origins/preview/pit-duel.ts -> roster",
  "20 | server | origins/contracts/ids.ts -> legends",
  "20 | server | origins/contracts/ids.ts -> roster",
  "20 | server | origins/contracts/items.ts -> legends",
  "20 | server | origins/contracts/world.ts -> roster",
  "20 | server | origins/encounters/encounters.ts -> roster",
  "20 | server | origins/inventory/loot-catalogue.ts -> roster",
  "20 | server | origins/mobs/styles.ts -> roster",
  "20 | server | origins/zones/loader.ts -> roster",
];
const KNOWN_COPIES: readonly string[] = [
  "14 | P1/P2 | origins/preview/main.ts defines updateBars",
  "14 | P1/P2 | origins/preview/main.ts defines wcBars",
  "14 | P1/P2 | origins/preview/main.ts defines wcFlash",
  "7 | P1/P2 | origins/preview/mobs-view.ts (the zone's own creature lunge / hit pulse / fall)",
];

const IMPORT = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\()\s*['"]([^'"]+)['"]/gm;
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|mjs)$/.test(e.name) && !/\.test\.(ts|mjs)$/.test(e.name) ? [join(dir, e.name)] : []);
const moduleOf = (spec: string): string | null => /(^|\/)src\//.test(spec) ? spec.replace(/\?.*$/, '').replace(/\.[a-z]+$/, '').split('/').pop()! : null;
const fromFightIndex = (spec: string): boolean => /(^|\/)src\/fight\/index\.ts$/.test(spec);

export function violations(read: (f: string) => string = (f) => readFileSync(f, 'utf8'), list: readonly string[] = files('origins')): { bad: string[]; unclassified: string[] } {
  const bad: string[] = [], unclassified: string[] = [];
  for (const file of list) for (const spec of new Set([...read(file).matchAll(IMPORT)].map((m) => m[1]!))) {
    const mod = moduleOf(spec); if (!mod || fromFightIndex(spec) || /\.(png|webp|ogg|css)(\?.*)?$/.test(spec)) continue;
    const row = ROWS[mod]; if (row) bad.push(`${row[0]} | ${SERVER_DIRS.some((d) => file.startsWith(d)) ? 'server' : row[1]} | ${file} -> ${mod}`);
    else if (!ALLOWED.has(mod) && !LEDGER_UI.includes(`${file} -> ${mod}`)) unclassified.push(`${file} -> ${mod}`);
  }
  return { bad: bad.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), unclassified: unclassified.sort() };
}

test('a zone reaches the engine only through src/fight/index.ts; today\'s failures are pinned and only shrink', () => {
  const { bad, unclassified } = violations();
  assert.deepEqual(unclassified, [], 'a src/ module that is neither a parity row (ROWS) nor ALLOWED: classify it');
  assert.deepEqual(bad.filter((v) => !KNOWN.includes(v)), [], 'a new direct import of an engine module from origins/: go through src/fight/index.ts');
  assert.deepEqual(KNOWN.filter((v) => !bad.includes(v)), [], 'a listed import is gone: delete its line so it cannot come back');
});

test('no zone-own copy of engine code exists (the lists only shrink)', () => {
  const GONE = ['origins/preview/world-combat.ts', 'origins/preview/mob-clips.ts', 'origins/preview/speeds.ts', 'origins/combat/zone1.ts', 'origins/combat/open-fight.ts'];   // moved into src/fight (K2d, K3)
  assert.deepEqual(GONE.filter((f) => existsSync(f)), [], 'an engine file came back under origins/');
  const main = readFileSync('origins/preview/main.ts', 'utf8');
  const copies = [
    ...['wcBars', 'updateBars', 'wcFlash'].filter((id) => new RegExp(`\\b${id}\\b`).test(main)).map((id) => `14 | P1/P2 | origins/preview/main.ts defines ${id}`),
    ...(existsSync('origins/preview/mobs-view.ts') ? ['7 | P1/P2 | origins/preview/mobs-view.ts (the zone\'s own creature lunge / hit pulse / fall)'] : []),
  ].sort();
  assert.deepEqual(copies.filter((c) => !KNOWN_COPIES.includes(c)), [], 'a new zone-own copy of engine behaviour');
  assert.deepEqual(KNOWN_COPIES.filter((c) => !copies.includes(c)), [], 'a listed copy is gone: delete its line');
});

test('Zone 2 and later zones are data: no src/ import, only `import type`, under 300 lines', () => {
  const zones = readdirSync('origins/zones', { withFileTypes: true }).filter((e) => e.isDirectory() && /^zone(\d+)$/.test(e.name) && Number(e.name.slice(4)) >= 2).map((e) => join('origins/zones', e.name));
  assert.ok(zones.length >= 1, 'zone2 exists');
  for (const dir of zones) {
    const fs = files(dir), text = fs.map((f) => readFileSync(f, 'utf8'));
    assert.deepEqual(fs.filter((_, i) => [...text[i]!.matchAll(IMPORT)].some((m) => /(^|\/)src\//.test(m[1]!))), [], `${dir}: a zone imports nothing from src/`);
    assert.deepEqual(fs.filter((_, i) => /^\s*import\s+(?!type\b)[^'"]*from\s/m.test(text[i]!) && !/^\s*import\s+(?!type\b)[^'"]*from\s+'\.\.\/\.\.\/(mobs|preview)\/[a-z-]+\.ts'/m.test(text[i]!)), [], `${dir}: a zone's runtime imports are data helpers only`);
    assert.ok(text.join('\n').split('\n').length < 300, `${dir}: under 300 lines`);
  }
});

test('the checker sees static, re-export and dynamic imports, and passes the door', () => {
  const src: Record<string, string> = { 'origins/a.ts': "import { x } from '../src/duel.ts';\nexport { y } from '../src/fight/index.ts';\nconst z = await import('../src/audio/creature.ts');\nimport '../src/mystery.ts';\n" };
  const v = violations((f) => src[f]!, ['origins/a.ts']);
  assert.deepEqual(v.bad, ['1 | K2 | origins/a.ts -> duel', '12 | P1/P2 | origins/a.ts -> creature']);
  assert.deepEqual(v.unclassified, ['origins/a.ts -> mystery']);
});

// The goal itself. It FAILS today (reported as TODO so CI stays green) and turns green when the last pinned line is gone; then delete `todo` so it can never fail again unseen.
test('K7 EXIT: nothing is pinned, every parity row reaches the engine through src/fight only', { todo: 'K7: shrink KNOWN and KNOWN_COPIES to empty (rows 1-16 and 20)' }, () => {
  assert.deepEqual(KNOWN, [], `${KNOWN.length} direct engine imports left`);
  assert.deepEqual(KNOWN_COPIES, [], `${KNOWN_COPIES.length} zone-own copies left`);
});
