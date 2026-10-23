// Which release rows does a change trigger on a pull request's later pushes? The table is `release_triggers` in
// .quality-gate.json (Lead's ruling 2026-09-22 after #435): rules in order, the first whose `paths` glob matches a file wins
// for that file, and the rows of every matched file are unioned. A row is named by its check script's stem; `name:first`
// means only the first row with that name. A file no rule matches triggers nothing (it runs at deploy as always). This is a
// curated, cheap subset — not a dependency map: 30 of the 33 rows boot the whole app, so no map predicts which of them a
// src change breaks; the boot-path rows here are the ones that catch the common shapes (#435: roster + a finisher preview).
//   node scripts/release-rows-for.mjs [--json] <changed file>...   → the rows (index + name), or the workflow's matrix JSON
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, matchesGlob } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { existsSync } from 'node:fs';
import { SERVER_ENTRIES, writerClosure } from './writer-closure.mjs';
import process from 'node:process';
import console from 'node:console';

// The files the box's node services load at runtime, read from the checkout this runs in (the release sha at deploy). A changed file in it
// can break the writer's boot, so it triggers the boot-check row; unreadable means unknown, which counts as in.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const serverFiles = () => { try { const set = new Set(); for (const e of SERVER_ENTRIES) writerClosure(f => readFileSync(join(ROOT, f), 'utf8'), f => existsSync(join(ROOT, f)), e).files.forEach(f => set.add(f)); return set; } catch { return null; } };
const BOOT_ROW = 'origins-writer-boot-check';

const gate = JSON.parse(readFileSync(new URL('../.quality-gate.json', import.meta.url), 'utf8'));
export const rowName = command => (command.find(a => a.endsWith('.mjs') || a.endsWith('.sh')) || command[0]).replace(/^(scripts|artifacts)\//, '').replace(/\.(mjs|sh)$/, '').replace(/[^\w.-]+/g, '_').slice(0, 40);
export const rows = gate.release_commands.map((command, i) => ({ index: i + 1, name: rowName(command), argv: JSON.stringify(command) }));

export function rowsFor(files) {
  const wanted = new Set();
  for (const file of files) {
    const rule = gate.release_triggers.find(r => r.paths.some(glob => matchesGlob(file, glob)));
    for (const spec of rule?.rows ?? []) {
      const [name, mode] = spec.split(':');
      const hits = rows.filter(r => r.name === name);
      if (!hits.length) throw new Error(`release_triggers names row "${name}", which is not in release_commands`);
      for (const r of mode === 'first' ? hits.slice(0, 1) : hits) wanted.add(r.index);
    }
  }
  const server = serverFiles();
  if (files.some(file => !isDoc(file) && (!server || server.has(file)))) rows.filter(r => r.name === BOOT_ROW).forEach(r => wanted.add(r.index));
  return rows.filter(r => wanted.has(r.index));
}

// Deploy-time scope (Dom 2026-10-05: "get the 50 checks down to 5"). A release runs CORE for any change outside docs, plus the
// rows of the AREAS its files touch, plus any row whose own check script changed; everything else is out of scope for that run.
// The full 50 still run once a day: deploy.sh goes full when the last full run is over 24 h old (--full-age), so a closed laptop
// only delays it to the next release. Not a dependency map: the daily full run is what catches a break outside these rows.
// The tables are a data row, scripts/release-scope.json (Lead 2026-10-22: the path->row map is data); a candidate's CI plan reads the same scope.
const SCOPE = JSON.parse(readFileSync(new URL('./release-scope.json', import.meta.url), 'utf8'));
const { core: CORE, areas: AREAS, full: FULL, lib_no_rows: LIB_NO_ROWS, public_scoped: PUBLIC_SCOPED } = SCOPE;
// The build (`full`): a change there can break any row (Auditor B1 on #1381); deploy.sh and the two release scripts are not in it. The gate's own row list is
// handled below: only the rows it adds or changes run. public/ outside `public_scoped` (GLBs and looks many rows load) still runs every row.
const isFull = file => (FULL.some(glob => matchesGlob(file, glob)) && !LIB_NO_ROWS.some(glob => matchesGlob(file, glob)) && !AREAS.some(a => a.paths.includes(file)))
  || (matchesGlob(file, 'public/**') && !PUBLIC_SCOPED.some(glob => matchesGlob(file, glob)));
const GATE = '.quality-gate.json';
const named = spec => { const [name, mode] = spec.split(':'); const hits = rows.filter(r => r.name === name);
  if (!hits.length) throw new Error(`deploy scope names row "${name}", which is not in release_commands`);
  return mode === 'first' ? hits.slice(0, 1) : mode === 'last' ? hits.slice(-1) : hits; };
const isDoc = file => matchesGlob(file, 'docs/**') || file.endsWith('.md');
// `previousCommands`: the live revision's release_commands (deploy.sh --base). When the gate file changed, only the rows whose argv
// is not in that list (added or edited) run, plus the scope of the other files; with no previous list to compare, every row runs.
export function deployRowsFor(files, previousCommands) {
  if (files.some(isFull)) return rows;
  if (files.includes(GATE) && !Array.isArray(previousCommands)) return rows;
  const wanted = new Set();
  const add = spec => named(spec).forEach(r => wanted.add(r.index));
  if (files.some(file => !isDoc(file))) CORE.forEach(add);
  if (files.includes(GATE)) {
    const before = new Set(previousCommands.map(command => JSON.stringify(command)));
    rows.filter(r => !before.has(r.argv)).forEach(r => wanted.add(r.index));
  }
  for (const file of files) {
    for (const area of AREAS) if (area.paths.some(glob => matchesGlob(file, glob))) area.rows.forEach(add);
    rows.filter(r => `scripts/${r.name}.mjs` === file).forEach(r => wanted.add(r.index));
  }
  const server = serverFiles();
  if (files.some(file => !isDoc(file) && (!server || server.has(file)))) add(BOOT_ROW);
  return rows.filter(r => wanted.has(r.index));
}
// Seconds since the last release run that ran every row (artifacts/last-full-release.json, written by release-checks.mjs;
// before that file existed, a receipt with no trusted row counts by its mtime), or -1 when none is known.
export function fullAge(root) {
  const read = name => { try { return { json: JSON.parse(readFileSync(join(root, 'artifacts', name), 'utf8')), mtime: statSync(join(root, 'artifacts', name)).mtimeMs }; } catch { return null; } };
  const stamp = read('last-full-release.json');
  if (stamp) { const at = Date.parse(stamp.json.at); return Number.isFinite(at) ? Math.floor((Date.now() - at) / 1000) : -1; }
  const receipt = read('release-checks.json');
  if (receipt?.json.passed && receipt.json.checks_detail?.length === receipt.json.checks && !receipt.json.checks_detail.some(c => c.trusted || c.out_of_scope))
    return Math.floor((Date.now() - receipt.mtime) / 1000);
  return -1;
}

// The nightly full run on GitHub (Lead 2026-10-22, CI runners first): release-checks' scheduled run on trunk counts as a full run when every row job
// (`checks <rows> ...`) in it succeeded, so the Mac keeps only its WebKit/iPhone rows. Its matrix leaves out GPU_ONLY and MAC_ROWS (the plan's
// CI_SKIP_ROWS): those run at deploy when a diff scopes them. Seconds since that run started, or -1 (no such run, a red row, or any gh error).
export function ciFullAge({ gh = process.env.FULL_AGE_GH || 'gh', now = Date.now() } = {}) {
  const api = (path, jq) => JSON.parse(execFileSync(gh, ['api', path, '--jq', jq], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 }));
  try {
    for (const run of api('repos/DomLynch/RPG-game/actions/workflows/release-checks.yml/runs?event=schedule&status=completed&per_page=3', '[.workflow_runs[]|{id, started: .run_started_at}]')) {
      const rows = api(`repos/DomLynch/RPG-game/actions/runs/${run.id}/jobs?per_page=100`, '[.jobs[]|select(.name|startswith("checks "))|.conclusion]');
      const at = Date.parse(run.started);
      if (rows.length && rows.every(c => c === 'success') && Number.isFinite(at)) return Math.floor((now - at) / 1000);
    }
  } catch { /* no CI answer: the local receipt alone decides */ }
  return -1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--full-age')) {
  // --ci (deploy.sh): the younger of the local full run and the nightly CI full run; -1 when neither is known.
  const ages = [fullAge(process.argv.slice(2).find(a => !a.startsWith('--')) || '.'), ...(process.argv.includes('--ci') ? [ciFullAge()] : [])].filter(a => a >= 0);
  console.log(ages.length ? Math.min(...ages) : -1);
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--deploy-skip')) {
  // Changed files on stdin, one per line; prints the comma list of row indices OUT of scope, and the picked rows on stderr.
  // --base <rev>: the live revision, whose .quality-gate.json row list the changed gate is compared with (unreadable = every row).
  const files = readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  const base = process.argv[process.argv.indexOf('--base') + 1];
  let previous;
  if (process.argv.includes('--base') && base) {
    try { previous = JSON.parse(execFileSync('git', ['show', `${base}:${GATE}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 })).release_commands; } catch { previous = undefined; }
  }
  const picked = deployRowsFor(files, previous), keep = new Set(picked.map(r => r.index));
  console.error(`release scope: ${picked.length} of ${rows.length} rows for ${files.length} changed file(s): ${picked.map(r => `${r.index} ${r.name}`).join(', ') || 'none'}`);
  console.log(rows.filter(r => !keep.has(r.index)).map(r => r.index).join(','));
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const json = process.argv.includes('--json'), files = process.argv.slice(2).filter(a => a !== '--json');
  const picked = rowsFor(files);
  if (json) console.log(JSON.stringify(picked));
  else console.log(picked.length ? picked.map(r => `${r.index} ${r.name}`).join('\n') : 'no release rows for these files (they run at deploy)');
}
