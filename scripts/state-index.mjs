// PROJECT_STATE.md's table, generated from docs/state/ (Dom's repo audit 2026-10-21: the hand-kept index listed 16 of 36 files and
// its "latest entry" dates were a month old). It lists each file and its title only: the lanes write their live state on their own
// state branches and in memory, so a date column on trunk is stale by construction. A file whose name carries a date is a one-off
// report and goes in its own list. `node scripts/state-index.mjs` rewrites the file; tests/state-index.test.ts fails when it is stale.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STATE = 'docs/state';
const HEAD = `# Project state

Current beta/launch scope: \`docs/SCOPE.md\` (dated, wins over older lines in any state file).

One file per lane under \`docs/state/\`. Each lane appends its own entries at the top of its own file, with evidence and the remaining validation (AGENTS.md). A lane's newest entry often lives on its own state branch and in its memory before it reaches trunk, so read the lane's file (and branch) rather than trusting a date here. GAME_SPEC.md stays the canonical design. The pre-lane history (2026-09-13) lives in the archive file.

This index is generated: \`node scripts/state-index.mjs\` after adding or renaming a file in \`docs/state/\` (tests/state-index.test.ts checks it).
`;
const DATED = /\d{4}-\d{2}-\d{2}/;

/** The title a state file gives itself (its first `# ` line, minus the "— project state" tail), else its name. */
export function titleOf(text, file) {
  const line = text.split('\n').find((l) => l.startsWith('# '));
  if (!line) return file.replace(/\.md$/, '');
  return line.slice(2).replace(/\s*[—-]+\s*(project|lane)?\s*state\s*$/i, '').trim();
}

/** The whole PROJECT_STATE.md for the files in `dir` (a name -> text map keeps the test off the disk). */
export function render(files) {
  const names = Object.keys(files).sort();
  const row = (f) => `| ${titleOf(files[f], f).replace(/\|/g, '/')} | [${STATE}/${f}](${STATE}/${f}) |`;
  const lanes = names.filter((f) => !DATED.test(f)), reports = names.filter((f) => DATED.test(f));
  return `${HEAD}
## Lanes

| Lane | File |
|---|---|
${lanes.map(row).join('\n')}

## Dated reports and handovers

| Report | File |
|---|---|
${reports.map(row).join('\n')}
`;
}

export function readState(root = '.') {
  const dir = `${root}/${STATE}`;
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f, readFileSync(`${dir}/${f}`, 'utf8')]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync('PROJECT_STATE.md', render(readState()));
  console.log(`PROJECT_STATE.md: ${Object.keys(readState()).length} files`);
}
