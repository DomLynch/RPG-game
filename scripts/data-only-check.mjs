// The data-only gate (scripts/lib/data-only.mjs is the path list and the pure-data proof). Run by .github/workflows/data-only.yml on every PR push:
//   node scripts/data-only-check.mjs <base sha>     the files changed since the merge base with <base>, then the verdict
// Prints one JSON line { dataOnly, problems } and exits 0 = data-only (the label goes on), 1 = not data-only (a normal PR: the Auditor reviews it),
// 2 = every file is on the data path but the data is wrong (CI red: unknown field, a bad level, a stale registry, a failing loot or catalogue test).
// The schema checks are the repo's own: gen-zones (the registry must be exactly what the folders generate), loadZone + zoneProblems on EVERY zone,
// the zone-place tests when a zone's place.ts changed, and the loot tests when the loot table changed.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { duplicateKeys, describeDuplicates } from './lib/json-dup-keys.mjs';
import { catalogueCitations, citationClashes, classify, legendCitations, legendProblems, moduleValue, onDataPath, spawnRowsOf } from './lib/data-only.mjs';

const REGISTRY = 'origins/zones/registry.ts';
const sh = (cmd, args, timeoutMs = 300_000) => spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL' });   // bounded (tests/child-process-bounds.test.ts)

export function changedFiles(base) {
  const r = sh('git', ['diff', '--name-status', '--no-renames', `${base}...HEAD`], 60_000);
  if (r.status !== 0) throw new Error(`git diff ${base}...HEAD failed: ${r.stderr.trim()}`);
  return r.stdout.trim().split('\n').filter(Boolean).map(line => { const [s, file] = line.split('\t'); return { file, status: s === 'D' ? 'removed' : s === 'A' ? 'added' : 'modified' }; });
}

// The generated registry is data when it is exactly what gen-zones writes from the zone rows; anything else is a hand edit (code).
function registryProblems() {
  const before = readFileSync(REGISTRY, 'utf8'), gen = sh(process.execPath, ['scripts/gen-zones.mjs'], 60_000);
  if (gen.status !== 0) return [`gen-zones failed: ${(gen.stderr || gen.stdout).trim().slice(0, 300)}`];
  const after = readFileSync(REGISTRY, 'utf8');
  return before === after ? [] : [`${REGISTRY} is not what gen-zones writes from the zone rows (run npm run zones)`];
}

// Every zone through loadZone + zoneProblems, and every biome row through resolveSpec, not only the biomes a zone names: a bad field in an unused preset must not ride in as data.
export const ZONE_CHECK = `import { readFileSync, existsSync } from 'node:fs';
import { allZoneIds, loadZone, zoneProblems } from './origins/zones/loader.ts';
import { FOES } from './origins/region1/content.ts';
import { BIOMES } from './origins/zones/biomes.ts';
import { resolveSpec } from './origins/zones/resolve.ts';
const known = new Set([...FOES.map((f) => f.id), ...allZoneIds().flatMap((id) => loadZone(id, true).spawns.rows.map((r) => r.id))]);   // a character id is a string some spawn row or region foe names; a look for any other id is an error
const bad = allZoneIds().flatMap((id) => { try { return zoneProblems(loadZone(id, true), known, existsSync('origins/zone-rows/zone' + id + '.row.json') ? readFileSync('origins/zone-rows/zone' + id + '.row.json', 'utf8') : undefined).map((p) => 'zone ' + id + ': ' + p); } catch (e) { return ['zone ' + id + ': ' + e.message]; } });
for (const b of Object.keys(BIOMES)) { try { bad.push(...resolveSpec({ biome: b }).problems.map((p) => p.startsWith('biome ' + b + ':') ? p : 'biome ' + b + ': ' + p)); } catch (e) { bad.push('biome ' + b + ': ' + e.message); } }
console.log(JSON.stringify(bad));`;

// Every legend citation in the zone spawns files at `base` (trunk): git show, so the working tree (the PR) is not read.
export function baseCitations(base) {
  const ls = sh('git', ['ls-tree', '-r', '--name-only', base, 'origins/zones', 'origins/zone-rows'], 60_000);
  const files = ls.stdout.split('\n').filter(f => /^origins\/zones\/zone\d+\/spawns\.ts$/.test(f) || /^origins\/zone-rows\/zone[1-9][0-9]*\.row\.json$/.test(f));
  return Object.assign({}, ...files.map(f => { const t = sh('git', ['show', `${base}:${f}`], 60_000); try { return legendCitations(spawnRowsOf(f, t.stdout)); } catch { return {}; } }));
}

// Every catalogue citation in src/fight/catalogue-data.ts at `base` (an empty map when the file is not there yet: every legend then counts as new).
const CATALOGUE_DATA = 'src/fight/catalogue-data.ts';
export function baseCatalogueCitations(base) {
  const t = sh('git', ['show', `${base}:${CATALOGUE_DATA}`], 60_000);
  try { return t.status === 0 ? catalogueCitations(moduleValue(CATALOGUE_DATA, t.stdout)) : {}; } catch { return {}; }
}

export function verdict(changed, readText = f => readFileSync(f, 'utf8'), base = null) {
  const data = changed.filter(c => c.file !== REGISTRY);
  // A repeated key in a data JSON file: JSON.parse keeps the last one silently, so no check on the parsed value can see it. Scanned raw, over EVERY changed .json file on the data path (CI red, code 2).
  const dups = data.filter(c => c.status !== 'removed' && c.file.endsWith('.json') && onDataPath(c.file)).flatMap(c => describeDuplicates(c.file, duplicateKeys(readText(c.file))));
  if (dups.length) return { dataOnly: false, code: 2, problems: dups };
  const first = classify(data, readText);
  if (!first.dataOnly) return { dataOnly: false, code: first.problems.some(p => p.includes('not on the data-only path list')) || !data.length ? 1 : 2, problems: first.problems };
  // A new legend (or a changed citation) is a normal PR for the Auditor, not a red one: code 1.
  const spawns = data.filter(c => c.status !== 'removed' && (c.file.endsWith('/spawns.ts') || c.file.endsWith('.row.json')));
  if (spawns.length && base) {
    const known = baseCitations(base), legends = spawns.flatMap(c => { const rows = spawnRowsOf(c.file, readText(c.file)); return [...citationClashes(rows, 'spawns'), ...legendProblems(legendCitations(rows), known)]; });
    if (legends.length) return { dataOnly: false, code: 1, problems: legends };
  }
  const catalogue = data.filter(c => c.status !== 'removed' && c.file === CATALOGUE_DATA);
  if (catalogue.length && base) {
    const rows = moduleValue(CATALOGUE_DATA, readText(CATALOGUE_DATA)), legends = [...citationClashes(rows, 'catalogue'), ...legendProblems(catalogueCitations(rows), baseCatalogueCitations(base))];
    if (legends.length) return { dataOnly: false, code: 1, problems: legends };
  }
  const problems = [];
  if (data.some(c => c.file.startsWith('origins/zones/') || c.file.startsWith('origins/zone-rows/')) || changed.some(c => c.file === REGISTRY)) {
    problems.push(...registryProblems());
    const z = sh(process.execPath, ['--input-type=module', '-e', ZONE_CHECK]);
    try { problems.push(...JSON.parse(z.stdout.trim().split('\n').pop())); } catch { problems.push(`the zone check did not run: ${(z.stderr || z.stdout).trim().slice(0, 300)}`); }
  }
  if (data.some(c => c.file.endsWith('/place.ts') || c.file.endsWith('.row.json'))) {   // where a zone stands on the map: zoneProblems does not read it, the zone-place tests do (a join to a missing zone throws)
    const t = sh(process.execPath, ['--test', 'tests/zone-place.test.ts']);
    if (t.status !== 0) problems.push(`the zone place tests fail: ${(t.stdout.match(/^not ok .*$/gm) || []).join('; ').slice(0, 300) || 'exit ' + t.status}`);
  }
  if (data.some(c => c.file.startsWith('src/assets/source/loot/'))) {
    const t = sh(process.execPath, ['--test', 'tests/loot.test.ts', 'tests/loot-unscale-tables.test.ts']);
    if (t.status !== 0) problems.push(`the loot tests fail: ${(t.stdout.match(/^not ok .*$/gm) || []).join('; ').slice(0, 300) || 'exit ' + t.status}`);
  }
  if (data.some(c => c.file.startsWith('origins/region1/loot-tables.'))) {   // a malformed table row turns CI red (exit 2) instead of getting the label
    const t = sh(process.execPath, ['--test', 'tests/loot-rows.test.ts', 'origins/region1/region1.test.ts']);
    if (t.status !== 0) problems.push(`the loot-table row tests fail: ${(t.stdout.match(/^not ok .*$/gm) || []).join('; ').slice(0, 300) || 'exit ' + t.status}`);
  }
  if (data.some(c => c.file.startsWith('origins/region1/towns.') || c.file.startsWith('origins/region1/loot-tables.'))) {
    const g = sh(process.execPath, ['scripts/registry-check.mjs']);
    if (g.status !== 0) problems.push(`the registry gate fails: ${g.stderr.trim().split('\n').slice(0, 3).join(' | ').slice(0, 300)}`);
  }
  if (data.some(c => c.file === 'origins/region1/towns.json')) {
    const t = sh(process.execPath, ['--test', 'tests/town-rows.test.ts', 'origins/region1/region1.test.ts', 'origins/world/town-defs.test.ts']);
    if (t.status !== 0) problems.push(`the town tests fail: ${(t.stdout.match(/^not ok .*$/gm) || []).join('; ').slice(0, 300) || 'exit ' + t.status}`);
  }
  if (data.some(c => c.file === CATALOGUE_DATA)) {   // a malformed row turns CI red (exit 2) instead of getting the label
    const t = sh(process.execPath, ['--test', 'tests/catalogue.test.ts', 'tests/catalogue-data.test.ts', 'tests/catalogue-wounds.test.ts', 'tests/catalogue-look.test.ts', 'tests/wounds.test.ts', 'tests/world-bodies.test.ts']);
    if (t.status !== 0) problems.push(`the catalogue tests fail: ${(t.stdout.match(/^not ok .*$/gm) || []).join('; ').slice(0, 300) || 'exit ' + t.status}`);
  }
  return { dataOnly: problems.length === 0, code: problems.length ? 2 : 0, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const base = process.argv[2];
    if (!/^[0-9a-f]{7,40}$/.test(base || '')) throw new Error('usage: node scripts/data-only-check.mjs <base sha>');
    const changed = changedFiles(base), v = verdict(changed, undefined, base);
    console.log(JSON.stringify({ dataOnly: v.dataOnly, files: changed.map(c => c.file), onPath: changed.every(c => c.file === REGISTRY || onDataPath(c.file)), problems: v.problems }));
    process.exit(v.code);
  } catch (e) { console.error(`data-only: ${e.message}`); process.exit(2); }
}
