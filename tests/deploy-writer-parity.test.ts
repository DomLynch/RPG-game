// The writer-parity gate (2026-10-13 DN published with the writer still on DM): writer_parity_gaps against a scratch "installed writer", and deploy.sh's wiring:
// the check runs before the publish lock and a non-empty answer exits 1.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const h = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const gaps = (root: string, list: string) => spawnSync('bash', ['-c', `source scripts/lib/writer-parity.sh; writer_parity_gaps ${JSON.stringify(root)}`], { encoding: 'utf8', input: list }).stdout.trim();

test('writer_parity_gaps: identical -> nothing; a differing file and a missing file are named; no install at all is reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'writer-parity-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'a.ts'), 'one');
    writeFileSync(join(root, 'src', 'b.ts'), 'two');
    assert.equal(gaps(root, `${h('one')} src/a.ts\n${h('two')} src/b.ts\n`), '');
    assert.equal(gaps(root, `${h('one')} src/a.ts\n${h('TWO')} src/b.ts\n${h('x')} src/stance-era.ts\n`), 'src/b.ts\nsrc/stance-era.ts');
    assert.match(gaps(join(root, 'absent'), `${h('one')} src/a.ts\n`), /no writer installed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deploy.sh: the parity check sits before the publish lock and refuses to publish on any gap', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  const at = deploy.indexOf('deploy_step "writer parity"');
  assert.ok(at > 0 && at < deploy.indexOf('deploy_step "publish lock"'));
  assert.match(deploy, /source scripts\/lib\/writer-parity\.sh/);
  assert.match(deploy.slice(at, at + 1500), /\[\[ -z "\$writer_gaps" \]\] \|\| \{[^}]*exit 1/);
});
