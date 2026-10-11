// scripts/lib/deploy-notes-only.sh: only a diff made wholly of docs/ paths skips the unit suite; any mixed or doubtful diff does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lib = join(process.cwd(), 'scripts', 'lib', 'deploy-notes-only.sh');
const sh = (cwd: string, cmd: string) => spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' });
const repo = mkdtempSync(join(tmpdir(), 'notes-only-'));
const commit = (files: Record<string, string>) => {
  for (const [f, c] of Object.entries(files)) { mkdirSync(join(repo, f, '..'), { recursive: true }); writeFileSync(join(repo, f), c); }
  sh(repo, 'git add -A && git -c user.name=t -c user.email=t@t commit -qm c');
  return sh(repo, 'git rev-parse HEAD').stdout.trim();
};
sh(repo, 'git init -q');
const base = commit({ 'src/a.ts': '1', 'docs/n.md': '1' });
const docs = commit({ 'docs/n.md': '2', 'docs/state/x.md': '1' });
const mixed = commit({ 'docs/n.md': '3', 'src/a.ts': '2' });
const ask = (live: string, rev: string) => sh(repo, `source '${lib}'; notes_only_release '${live}' '${rev}'`).stdout.trim();

test('docs-only diff skips', () => assert.equal(ask(base, docs), 'ok'));
test('mixed docs + code never skips', () => assert.equal(ask(docs, mixed), ''));
test('a code path alone, an empty diff, a bad or non-ancestor live never skip', () => {
  assert.equal(ask(base, mixed), '');
  assert.equal(ask(mixed, mixed), '');
  assert.equal(ask('', docs), '');
  assert.equal(ask(mixed, base), '');
});
test('deploy.sh sources the helper and keeps the notes-only branch after CI trust', () => {
  const d = sh(process.cwd(), 'cat scripts/deploy.sh').stdout;
  assert.match(d, /source scripts\/lib\/deploy-notes-only\.sh/);
  assert.ok(d.indexOf('notes-only release') > d.indexOf('CI quality + browser') && d.indexOf('notes-only release') < d.indexOf('unit suite trusted'));
});
