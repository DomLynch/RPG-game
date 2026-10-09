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
import process from 'node:process';
import console from 'node:console';

const gate = JSON.parse(readFileSync(new URL('../.quality-gate.json', import.meta.url), 'utf8'));
export const rowName = command => (command.find(a => a.endsWith('.mjs')) || command[0]).replace(/^(scripts|artifacts)\//, '').replace(/\.mjs$/, '').replace(/[^\w.-]+/g, '_').slice(0, 40);
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
  return rows.filter(r => wanted.has(r.index));
}

// Deploy-time scope (Dom 2026-10-05: "get the 50 checks down to 5"). A release runs CORE for any change outside docs, plus the
// rows of the AREAS its files touch, plus any row whose own check script changed; everything else is out of scope for that run.
// The full 50 still run once a day: deploy.sh goes full when the last full run is over 24 h old (--full-age), so a closed laptop
// only delays it to the next release. Not a dependency map: the daily full run is what catches a break outside these rows.
const CORE = ['roster-browser-check', 'record-replay-check', 'finisher-preview:first', 'account-browser-check', 'viewport-check'];
const AREAS = [
  { paths: ['supabase/**', 'src/cloud-profile.ts', 'src/account*.ts'], rows: ['account-database-check'] },
  { paths: ['src/ai.ts', 'src/moves.ts', 'src/sim.ts', 'src/record.ts', 'src/replay.ts', 'tests/fixtures/**'], rows: ['browser-replay-check:first', 'kill-link-check'] },
  { paths: ['src/loot*.ts', 'src/profile.ts'], rows: ['loot-smoke-check'] },
  { paths: ['src/net/**', 'src/duel*.ts'], rows: ['double-tap-browser-check'] },
  { paths: ['src/arena*.ts', 'src/scene.ts', 'src/colour-grade.ts', 'src/souls-look.ts', 'public/arena/**'], rows: ['arena-preview'] },
  // Row 44, the Stage picker (every arena ship re-pins its list in scripts/sparring-browser-check.mjs): the arena files, the sparring
  // files and main.ts, which builds #arena-select (Lead 2026-10-06: 17ab81e9 needed it and the picker had no mapping for it).
  { paths: ['src/arena*.ts', 'src/sparring*.ts', 'src/stage-hide.ts', 'src/main.ts', 'public/arena/**'], rows: ['sparring-browser-check'] },
  { paths: ['src/audio/**', 'src/assets/audio/**'], rows: ['audio-preview', 'arena-audio-check'] },
  { paths: ['src/blade*.ts', 'src/characters.ts', 'src/shields.ts', 'src/gear-*.ts'], rows: ['polearm-browser-check:first', 'equip-fallback-check'] },
  { paths: ['src/finishers.ts', 'src/gore.ts', 'src/finisher-blood.ts', 'src/opened.ts', 'src/severed-head.ts', 'src/blood-edge.ts'], rows: ['quiet-one-browser-check:first', 'finisher-preview:last'] },
  { paths: ['src/hud.ts', 'src/fight/hud.ts', 'src/style.css', 'src/scorecard.ts', 'index.html'], rows: ['endgame-hud-check', 'desktop-layout-check:first'] },
  { paths: ['src/lessons*.ts', 'src/first-loss*.ts', 'src/main.ts'], rows: ['first-loss-browser-check'] },   // a fresh visitor's first minute (Lead 2026-10-06): no other row boots with an empty profile
  // The fight boot (the first-frame warm-up, run from scene.ts): the two rows that boot to a fight. #1420 fixed row 51 in these
  // files and the picker left 50 and 51 out (release a2cf3529, 2026-10-06).
  { paths: ['src/main.ts', 'index.html', 'src/style.css'], rows: ['next-fight-black-check'] },   // the page the Next-fight reload loads (the deleted Pit guard covered these; Auditor 2026-10-08)
  { paths: ['src/first-frame.ts', 'src/scene.ts'], rows: ['first-loss-browser-check', 'next-fight-black-check'] },   // the second: the reload's black time (Dom's 2 s report 2026-09-30) rides the first frame
];
// The build: a change here can break any row, so it runs all of them (Auditor B1 on #1381). deploy.sh and the two release
// scripts are not here: they build no part of the game and their unit tests cover them. The gate's own row list is handled
// below: only the rows it adds or changes run. public/ assets: the folders with a row of their own are in AREAS (an arena or
// versus .webp used to run all 51 rows, 15-21 min; Lead 2026-10-06); any other public/ folder (GLBs and looks many rows load)
// still runs every row.
const FULL = ['package.json', 'package-lock.json', 'vite.config.*', 'tsconfig*.json', 'scripts/lib/**'];
const PUBLIC_SCOPED = ['public/arena/**', 'public/versus/**', 'public/licenses/**'];
const isFull = file => FULL.some(glob => matchesGlob(file, glob)) || (matchesGlob(file, 'public/**') && !PUBLIC_SCOPED.some(glob => matchesGlob(file, glob)));
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--full-age')) {
  console.log(fullAge(process.argv.slice(2).find(a => !a.startsWith('--')) || '.'));
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
