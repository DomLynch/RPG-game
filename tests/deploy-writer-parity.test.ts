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

test('deploy.sh: the writer installs inside the publish window just before the site switch, and parity is checked after the switch and before Published', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  const lock = deploy.indexOf('deploy_step "publish lock"'), install = deploy.indexOf('deploy_step "writer install"');
  const sw = deploy.indexOf('mv -Tf next current'), gate = deploy.indexOf('writer_parity_gaps /opt/frankendom-origins/current'), published = deploy.indexOf("printf '\\nPublished");
  assert.ok(lock > 0 && lock < install && install < sw, 'install after the publish lock, before the switch');
  assert.ok(sw < gate && gate < published, 'parity after the switch, before Published');
  assert.match(deploy, /source scripts\/lib\/writer-parity\.sh/);
  assert.match(deploy.slice(install, sw), /install-origins-writer\.sh --if-changed '\$revision'/);
  assert.match(deploy.slice(install, sw), /\|\| \{[^}]*the site has not moved[^}]*exit 1/);
  assert.match(deploy.slice(gate, published), /\[\[ -z "\$writer_gaps" \]\] \|\| \{[^}]*RED: site moved, writer differs[^}]*exit 1/);
});

test('deploy.sh: a site switch that fails after the writer install puts the outgoing writer back (never leaves the writer ahead of the site)', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  const prev = deploy.indexOf('writer_prev=$(ssh'), install = deploy.indexOf('writer_install=$(ssh'), back = deploy.indexOf('writer_back() {');
  assert.ok(prev > 0 && prev < back && back < install, 'the outgoing writer is read before the install; writer_back is defined before it is needed');
  const body = deploy.slice(back, install);
  assert.match(body, /writer_back_cmd "\$writer_prev" "\$release"/);   // the command itself is tested in deploy-writer-back.test.ts
  assert.match(deploy, /<<'REMOTE' \|\| \{ writer_back; presence_back; exit 1; \}\nset -euo pipefail\ntest -s "\$1\/index\.html"/, 'the switch heredoc rolls the writer back on failure');
});

test('deploy.sh: presence flips with the site like the writer: read before the install, installed inside the window before the switch, rolled back on a failed switch, parity before Published', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  const prev = deploy.indexOf('presence_prev=$(ssh'), install = deploy.indexOf('presence_install=$(ssh'), sw = deploy.indexOf('mv -Tf next current');
  const gate = deploy.indexOf('writer_parity_gaps /opt/frankendom-presence/current'), published = deploy.indexOf("printf '\\nPublished");
  assert.ok(prev > 0 && prev < install && install < sw && sw < gate && gate < published, 'order: read < install < switch < parity < Published');
  assert.match(deploy.slice(install, sw), /install-presence\.sh --if-changed '\$revision'/);
  assert.match(deploy.slice(install, sw), /the site has not moved[^}]*writer_back; presence_back; exit 1/, 'a failed presence install puts both back');
  assert.match(deploy, /<<'REMOTE' \|\| \{ writer_back; presence_back; exit 1; \}/, 'a failed switch puts both back');
  assert.match(deploy.slice(install - 400, install), /if \[\[ -n "\$presence_prev" \]\]/, 'only when presence is installed on the box');
  assert.match(deploy.slice(gate, published), /RED: site moved, presence differs/);
  assert.match(deploy, /frankendom-presence presence nginx\)/, 'the presence rollback adds nginx -t and a reload');
  const line = deploy.indexOf('Published presence:');
  assert.ok(published < line, 'the Published block carries presence state');
  assert.match(deploy.slice(line - 700, line + 300), /is-active frankendom-presence[\s\S]*NRestarts[\s\S]*origins\/presence\/health[\s\S]*release\.json=/, 'active, restarts, the health curl and release.json');
});
