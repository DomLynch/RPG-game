// Which release rows does a change trigger on a pull request's later pushes? The table is `release_triggers` in
// .quality-gate.json (Lead's ruling 2026-09-22 after #435): rules in order, the first whose `paths` glob matches a file wins
// for that file, and the rows of every matched file are unioned. A row is named by its check script's stem; `name:first`
// means only the first row with that name. A file no rule matches triggers nothing (it runs at deploy as always). This is a
// curated, cheap subset — not a dependency map: 30 of the 33 rows boot the whole app, so no map predicts which of them a
// src change breaks; the boot-path rows here are the ones that catch the common shapes (#435: roster + a finisher preview).
//   node scripts/release-rows-for.mjs [--json] <changed file>...   → the rows (index + name), or the workflow's matrix JSON
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const json = process.argv.includes('--json'), files = process.argv.slice(2).filter(a => a !== '--json');
  const picked = rowsFor(files);
  if (json) console.log(JSON.stringify(picked));
  else console.log(picked.length ? picked.map(r => `${r.index} ${r.name}`).join('\n') : 'no release rows for these files (they run at deploy)');
}
