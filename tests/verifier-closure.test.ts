// The verifier install (deploy.sh "verifier" step) is the computed import closure of the two verifiers, JSON included, and a dry import on the
// box gates the flip. Regression: CI2 (96a71d70, 2026-10-12) shipped src/**/*.ts only, so src/fight/pool-defs.json (imported `with { type: 'json' }`)
// was missing and verify-daily / verify-loot died ERR_MODULE_NOT_FOUND from 14:05:24. Everything here runs in tmp dirs with this machine's node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { installList, VERIFIER_ENTRIES, writerClosure } from '../scripts/writer-closure.mjs';

const deploy = readFileSync('scripts/deploy.sh', 'utf8');
const read = (p: string) => readFileSync(p, 'utf8');
const list = () => spawnSync(process.execPath, ['scripts/writer-closure-list.mjs', '--paths', 'verifier'], { encoding: 'utf8' });

test('the verifier install list is the closure of both verifiers, pool-defs.json included', () => {
  const r = list();
  assert.equal(r.status, 0, r.stderr);
  const files = r.stdout.trim().split('\n');
  assert.ok(files.includes('src/fight/pool-defs.json'), 'the CI2 regression: the JSON the sim imports is installed');
  for (const entry of VERIFIER_ENTRIES) {
    assert.ok(files.includes(entry));
    for (const f of writerClosure(read, existsSync, entry).files) assert.ok(files.includes(f), `${entry} reaches ${f}: it must be installed`);
  }
  const old = files.filter(f => f.endsWith('.ts') || VERIFIER_ENTRIES.includes(f));   // what deploy.sh copied before (src/**/*.ts + the two scripts)
  assert.ok(files.some(f => !old.includes(f)), 'the old *.ts-only copy misses a reachable file');
});

// The exact dry-import line deploy.sh runs on the box before `current` flips, run here against a tmp install.
const dryImport = (install: string) => {
  const start = deploy.indexOf('(cd "$1" && find src'), end = deploy.indexOf('\necho "verifier: dry import ok');
  assert.ok(start > 0 && end > start, 'the dry import in deploy.sh');
  return spawnSync('bash', ['-c', `set -euo pipefail\n${deploy.slice(start, end)}`, '_', install], { encoding: 'utf8' });
};

test('the dry import passes on a full install and fails, naming the module, when a reachable JSON is missing', () => {
  const install = mkdtempSync(join(tmpdir(), 'verifier-install-'));
  for (const f of list().stdout.trim().split('\n')) { mkdirSync(join(install, dirname(f)), { recursive: true }); copyFileSync(f, join(install, f)); }
  const ok = dryImport(install);
  assert.equal(ok.status, 0, ok.stderr);
  // A closure module under scripts/ (not an entry) is imported too: one with an import that resolves nowhere fails the gate.
  mkdirSync(join(install, 'scripts', 'lib'), { recursive: true });
  writeFileSync(join(install, 'scripts', 'lib', 'helper.mjs'), "import './gone.mjs';\n");
  const helper = dryImport(install);
  assert.notEqual(helper.status, 0, 'scripts/** is dry-imported, not only src/');
  assert.match(helper.stderr, /gone\.mjs/);
  rmSync(join(install, 'scripts', 'lib'), { recursive: true });
  rmSync(join(install, 'src/fight/pool-defs.json'));
  const bad = dryImport(install);
  assert.notEqual(bad.status, 0, 'a missing file must fail the gate');
  assert.match(bad.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
  assert.match(bad.stderr, /pool-defs\.json/);
  assert.match(bad.stderr, /verifier: dry import failed in .* current left on/);
  rmSync(install, { recursive: true, force: true });
});

test('writerClosure reports an import that resolves to no file; installList and the CLI refuse a partial install', () => {
  const files: Record<string, string> = {
    'a.ts': "import defs from './defs.json' with { type: 'json' };\nimport { b } from './b.ts';\nexport const a = defs;\n",
    'b.ts': "export { c } from './gone.ts';\n",
  };
  const c = writerClosure((f: string) => files[f], (f: string) => f in files, 'a.ts');
  assert.deepEqual(c.missing, ['a.ts: ./defs.json', 'b.ts: ./gone.ts']);
  assert.throws(() => installList((f: string) => files[f], (f: string) => f in files, ['a.ts']), /refusing a partial install: a\.ts: \.\/defs\.json; b\.ts: \.\/gone\.ts/);
  files['defs.json'] = '{}'; files['gone.ts'] = 'export const c = 1;\n';
  assert.deepEqual(installList((f: string) => files[f], (f: string) => f in files, ['a.ts']), ['a.ts', 'b.ts', 'defs.json', 'gone.ts']);
  const dir = mkdtempSync(join(tmpdir(), 'closure-cli-'));
  mkdirSync(join(dir, 'scripts'));
  for (const f of ['writer-closure.mjs', 'writer-closure-list.mjs']) copyFileSync(join('scripts', f), join(dir, 'scripts', f));
  copyFileSync(join(dir, 'scripts', 'writer-closure.mjs'), join(dir, 'e.mjs'));
  const r = spawnSync(process.execPath, ['scripts/writer-closure-list.mjs', '--paths', 'e.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  writeFileSync(join(dir, 'x.mjs'), "import './nope.json' with { type: 'json' };\n");
  const bad = spawnSync(process.execPath, ['scripts/writer-closure-list.mjs', '--paths', 'x.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unresolved import\(s\), refusing a partial install: x\.mjs: \.\/nope\.json/);
});

test('deploy.sh installs the verifier from the closure and gates the flip on the dry import with the box\'s node', () => {
  assert.doesNotMatch(deploy, /--include='\*\.ts'/, 'the *.ts-only copy is gone');
  const at = (needle: string) => { const i = deploy.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };
  assert.ok(at('verifier_files=$(node scripts/writer-closure-list.mjs --paths verifier)') < at('rsync -az --files-from=- -e "$remote_shell" ./ "$host:$verifier/"'));
  assert.ok(at('(cd "$1" && find src') < at('ln -sfn "$1" /opt/frankendom-verifier/current'), 'the dry import runs before the flip');
  assert.doesNotMatch(deploy.slice(at('(cd "$1" && find src'), at('ln -sfn "$1" /opt/frankendom-verifier/current')), /NODE_PIN/, 'the box\'s own node');
});
