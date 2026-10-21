// Re-pin helper for a change to Zone 1's creatures or places (origins/zone-rows/zone1.row.json): prints the four values the pin tests hold and, with --write, regenerates origins/preview/mobs.golden.json.
//   node scripts/repin-zone1.mjs            print: golden file state, the weighted-spawns zone 1 digest, the loader's Zone 1 pieces/solids pin, the progression sha, the loot-rows BUNDLE sha
//   node scripts/repin-zone1.mjs --write    also rewrite mobs.golden.json from the placed list (review the diff: only the rows you meant to change may move)
// Each value goes into its test with a reason line ("re-pinned <date> (<who>, <why>); the sha before it <old>"). Same arithmetic as the tests:
//   origins/preview/mobs.test.ts (golden), origins/preview/weighted-spawns.test.ts (digest), origins/zones/loader.test.ts (pieces/solids), origins/region1/progression.test.ts (TRUNK_SHA), tests/loot-rows.test.ts (BUNDLE).
// Run it on the VPS or the Mac; it only reads rows and hashes them (no browser, no build).
/* global process, console */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { mobSpecs } from '../origins/preview/mobs.ts';
import { listedZone } from '../origins/zones/listed.ts';
import { BOSS_LOOT, BOUNTIES, BUNDLE, ENCOUNTER_FLAGS, ENCOUNTERS, FOES, KILL_ROWS, LOCAL, RIFTS, TOWNSFOLK } from '../origins/region1/content.ts';

const GOLDEN = new URL('../origins/preview/mobs.golden.json', import.meta.url);
const sha = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x));
const canon = (x) => Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, canon(v)])) : x;

const F = frontierPlan(), B = frontierBuild(F), SPECS = mobSpecs(F, B);
const have = JSON.parse(readFileSync(GOLDEN, 'utf8')), same = JSON.stringify(have) === JSON.stringify(SPECS);
console.log(`mobs.golden.json: ${have.length} rows on disk, ${SPECS.length} placed now, ${same ? 'identical' : 'DIFFERENT'}${process.argv.includes('--write') ? '' : same ? '' : ' (run with --write to regenerate)'}`);
if (process.argv.includes('--write') && !same) { writeFileSync(GOLDEN, JSON.stringify(SPECS) + '\n'); console.log('  rewrote mobs.golden.json'); }

const f1 = frontierPlan(false, '1'), z1 = mobSpecs(f1, frontierBuild(f1), listedZone('1').spawns.rows);
console.log(`weighted-spawns digest, zone 1: ['1', ${z1.length}, '${sha(z1).digest('hex').slice(0, 16)}']`);

const h = (x) => sha(JSON.stringify(x.map((v) => JSON.stringify(v)).sort())).digest('hex').slice(0, 16), b1 = frontierBuild(frontierPlan(false, '1'));
console.log(`loader.test.ts Zone 1 pin: [${b1.pieces.length}, '${h(b1.pieces)}', ${b1.solids.length}, '${h(b1.solids)}']`);

console.log(`progression.test.ts TRUNK_SHA: '${sha(JSON.stringify(canon({ FOES, TOWNSFOLK, ENCOUNTERS, BOUNTIES, RIFTS, KILL_ROWS, BOSS_LOOT, ENCOUNTER_FLAGS, BUNDLE, LOCAL }))).digest('hex')}'`);
console.log(`loot-rows.test.ts BUNDLE sha: '${sha(JSON.stringify(BUNDLE)).digest('hex')}'`);
