// The lane Stop gate, TARGETED (Strategy ruled yes via Lead, 2026-09-23 evening): the box sat at load 200–340 because every lane's
// Stop ran `npm run quality:stop` = eslint + typecheck:tests + the FULL node suite. This keeps eslint src, typecheck:tests,
// tests/record-version-guard.test.ts and the tests the changed files touch; the full suite still runs in CI (quality.yml) and at
// deploy (deploy.sh), and `npm run quality:stop` is untouched for anyone who wants it by hand.
//
// RESTORE (Lead's morning table): point .quality-gate.json `commands` back at `npm run quality:stop` at 23:30 on 2026-09-23 or after
// the last Phase R / Phase L run, whichever is later.
//
// Changed files = git diff against the branch's base (origin/phase-r when this branch is built on it, else trunk) plus the working
// tree. Mapping: src/X.ts → tests/X*.test.ts plus every test that imports ../src/X.ts; tests/*.test.ts → itself; scripts/X.mjs →
// tests/X*.test.ts plus tests importing it. A changed src file that maps to no test, or no changes at all, runs the loot* / grades* /
// characters / roster / ladder set. The run mirrors `npm test`: node --test, [slow] skipped.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const TRUNK = 'origin/codex/01a09a76/task-1', PHASE = 'origin/phase-r', ALWAYS = ['tests/record-version-guard.test.ts'];
const FALLBACK = /^tests\/(loot|grades|characters|roster|ladder)[^/]*\.test\.ts$/;
const git = (...args) => { try { return execFileSync('git', args, { encoding: 'utf8', timeout: 20000 }).trim(); } catch { return ''; } };
const onPhase = spawnSync('git', ['merge-base', '--is-ancestor', PHASE, 'HEAD'], { timeout: 20000 }).status === 0;   // built on phase-r (its tip is an ancestor of HEAD)
const base = onPhase ? PHASE : TRUNK;
const changed = new Set([
  ...git('diff', '--name-only', `${base}...HEAD`).split('\n'),
  ...git('diff', '--name-only', 'HEAD').split('\n'),
  ...git('status', '--porcelain', '--untracked-files=all').split('\n').map(l => l.slice(3)),
].filter(Boolean));
const tests = readdirSync('tests').filter(f => f.endsWith('.test.ts')).map(f => `tests/${f}`);
const importsOf = new Map(tests.map(t => [t, readFileSync(t, 'utf8')]));
const importing = (path) => tests.filter(t => importsOf.get(t).includes(`'../${path}'`) || importsOf.get(t).includes(`"../${path}"`));
const picked = new Set(ALWAYS);
let unmapped = false;
for (const file of changed) {
  if (/^tests\/[^/]+\.test\.ts$/.test(file)) { if (tests.includes(file)) picked.add(file); continue; }
  const m = file.match(/^(src|scripts)\/([^/]+)\.(ts|mjs)$/);
  if (!m) continue;
  const stem = m[2].replace(/\.test$/, '');
  const hits = [...tests.filter(t => basename(t).startsWith(`${stem}.`) || basename(t).startsWith(`${stem}-`)), ...importing(file)];
  if (!hits.length) unmapped = true;
  for (const t of hits) picked.add(t);
}
if (unmapped || changed.size === 0) for (const t of tests) if (FALLBACK.test(t)) picked.add(t);
const files = [...picked].filter(t => tests.includes(t)).sort();
console.log(`quality-stop-targeted: base ${base}; ${changed.size} changed file(s); ${files.length} test file(s)${unmapped ? ' (fallback set added: a changed file mapped to no test)' : ''}`);
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', timeout: 15 * 60_000 }); if (r.status !== 0) { console.error(`quality-stop-targeted: ${cmd} ${args.join(' ')} failed (${r.status})`); process.exit(r.status ?? 1); } };
run('npx', ['eslint', 'src']);
run('npm', ['run', 'typecheck:tests']);
run('node', ['--test', '--test-skip-pattern=\\[slow\\]', ...files]);
