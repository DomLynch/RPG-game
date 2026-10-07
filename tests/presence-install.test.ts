// The presence install (ops/install-presence.sh, ops/frankendom-presence.service, ops/presence.env.example, ops/presence-files.mjs): the file list the box gets, and the installer run
// against a throwaway root with stub systemctl/nginx/curl/openssl, so nothing here touches a real server. The installer is for the Linux VPS (GNU install -D), so the script tests skip elsewhere.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { presenceFiles } from '../ops/presence-files.mjs';

const repo = resolve(import.meta.dirname, '..');

test('presence-files: the closure holds the service and its world data, every file exists, and nothing from tests, scripts or node_modules', () => {
  const files: string[] = presenceFiles(repo);
  for (const f of ['origins/presence/main.ts', 'origins/presence/server.ts', 'origins/presence/zones.ts', 'origins/world/concord.ts', 'origins/server/auth.ts']) assert.ok(files.includes(f), `${f} is installed`);
  assert.ok(files.every(f => existsSync(join(repo, f))), 'every listed file exists');
  assert.ok(files.every(f => /^(origins|src)\//.test(f) && !f.includes('node_modules') && !f.includes('.test.')), 'only origins/ and src/ sources, never a test');
  assert.deepEqual(files, [...files].sort(), 'sorted, so the list is stable');
});

test('presence-files: an npm import, a missing file and an import inside a comment are told apart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'presence-files-'));
  try {
    mkdirSync(join(dir, 'a'));
    writeFileSync(join(dir, 'a/main.ts'), "// import x from 'not-a-package' in a comment is nothing\nimport { b } from './b.ts';\nimport { readFileSync } from 'node:fs';\nexport const m = b;\n");
    writeFileSync(join(dir, 'a/b.ts'), 'export const b = 1;\n');
    assert.deepEqual(presenceFiles(dir, 'a/main.ts'), ['a/b.ts', 'a/main.ts']);
    writeFileSync(join(dir, 'a/b.ts'), "import pg from 'pg';\nexport const b = pg;\n");
    assert.throws(() => presenceFiles(dir, 'a/main.ts'), /imports the package "pg".*dependency-free/);
    writeFileSync(join(dir, 'a/b.ts'), "import { c } from './missing.ts';\nexport const b = c;\n");
    assert.throws(() => presenceFiles(dir, 'a/main.ts'), /does not exist/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const linux = process.platform === 'linux';
const SITE = 'server {\n    listen 80;\n    server_name frankendom.com www.frankendom.com;\n}\nserver {\n    listen 443 ssl;\n    server_name frankendom.com;\n}\n';
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'presence-install-')), bin = join(dir, 'bin'), log = join(dir, 'calls.log');
  mkdirSync(bin); mkdirSync(join(dir, 'root/etc/nginx/sites-enabled'), { recursive: true });
  writeFileSync(join(dir, 'root/etc/nginx/sites-enabled/frankendom.com'), SITE);
  const stub = (name: string, body: string) => { writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  stub('systemctl', `echo "systemctl $*" >> "${log}"`);
  stub('nginx', `echo "nginx $*" >> "${log}"; [ -n "$STUB_NGINX_FAIL" ] && exit 1; exit 0`);
  stub('openssl', 'printf "%064d\\n" 7');
  stub('curl', `url=""; hdr=no; for a in "$@"; do case "$a" in http*) url="$a";; -H) hdr=yes;; esac; done
echo "curl $url hdr=$hdr" >> "${log}"
case "$url" in
  https://frankendom.com/origins/presence/health) printf "%s" "\${STUB_PUBLIC_HEALTH:-404}";;
  *internal/where*) if [ "$hdr" = yes ]; then printf 200; else printf 401; fi;;
  *origins/presence/health) printf 200;;
  *) printf 000;;
esac`);
  const run = (args: string[], extra: Record<string, string> = {}) => spawnSync('bash', [join(repo, 'ops/install-presence.sh'), ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PRESENCE_ROOT: join(dir, 'root'), ...extra } });
  const root = join(dir, 'root'), read = (p: string) => readFileSync(join(root, p), 'utf8'), calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');
  return { dir, run, root, read, calls, clean: () => rmSync(dir, { recursive: true, force: true }) };
}
const PUBLIC = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-public-key' };

test('install: the first install needs the public Supabase values, writes a 0600 env with the flag OFF and a generated key, installs files, unit and snippet, adds ONE include, and starts nothing', { skip: !linux }, () => {
  const s = sandbox();
  try {
    const noEnv = s.run(['rev1']);
    assert.notEqual(noEnv.status, 0, 'without SUPABASE_URL the first install refuses');
    assert.match(noEnv.stderr, /SUPABASE_URL is required/);
    const r = s.run(['rev1'], PUBLIC);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(s.root, 'opt/frankendom-presence/rev1/origins/presence/main.ts')), 'the code is under the revision');
    assert.ok(existsSync(join(s.root, 'opt/frankendom-presence/rev1/src/loot.ts')), 'with the src files it imports');
    assert.equal(readlinkSync(join(s.root, 'opt/frankendom-presence/current')), join(s.root, 'opt/frankendom-presence/rev1'), 'current points at it');
    assert.equal((statSync(join(s.root, 'etc/frankendom/presence.env')).mode & 0o777), 0o600, 'the env file is root-only');
    const env = s.read('etc/frankendom/presence.env');
    assert.match(env, /^ORIGINS_PRESENCE=0$/m, 'the flag is OFF');
    assert.match(env, /^PRESENCE_INTERNAL_KEY=0{63}7$/m, 'the key was generated on the box');
    assert.match(env, /^PRESENCE_HOST=127\.0\.0\.1$/m);
    assert.doesNotMatch(r.stdout + r.stderr, /0{63}7|anon-public-key/, 'neither the key nor the anon key is printed');
    assert.equal(s.read('etc/systemd/system/frankendom-presence.service'), readFileSync(join(repo, 'ops/frankendom-presence.service'), 'utf8'));
    assert.equal(s.read('etc/nginx/snippets/frankendom-presence.conf'), readFileSync(join(repo, 'ops/nginx/frankendom-presence.conf'), 'utf8'));
    const site = s.read('etc/nginx/sites-enabled/frankendom.com');
    assert.equal(site.split('frankendom-presence.conf').length - 1, 1, 'exactly one include');
    assert.ok(site.indexOf('include') > site.lastIndexOf('listen 443'), 'in the :443 block, not the :80 one');
    assert.equal(s.read('etc/nginx/backups/frankendom.com.before-presence'), SITE, 'the prior site file is kept, exactly as it was');
    assert.deepEqual(readdirSync(join(s.root, 'etc/nginx/sites-enabled')), ['frankendom.com'], 'and OUTSIDE sites-enabled: nginx loads every file there, a backup would be a duplicate frankendom.com server block');
    const calls = s.calls();
    assert.match(calls, /systemctl enable frankendom-presence.service/);
    assert.doesNotMatch(calls, /systemctl restart/, 'OFF: nothing is started');
    assert.match(calls, /nginx -t/); assert.match(calls, /systemctl reload nginx/);
    assert.doesNotMatch(calls, /curl/, 'and no health check runs while it is off');
    assert.match(r.stdout, /presence is OFF/);
    const again = s.run(['rev1']);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(s.read('etc/nginx/sites-enabled/frankendom.com').split('frankendom-presence.conf').length - 1, 1, 'idempotent: still ONE include');
    assert.match(s.read('etc/frankendom/presence.env'), /^PRESENCE_INTERNAL_KEY=0{63}7$/m, 'and the key is not regenerated');
  } finally { s.clean(); }
});

test('install: with the flag ON it restarts and checks local health, /internal/where with and without the key, and that the public health path is not proxied', { skip: !linux }, () => {
  const s = sandbox();
  try {
    assert.equal(s.run(['rev1'], PUBLIC).status, 0);
    writeFileSync(join(s.root, 'etc/frankendom/presence.env'), s.read('etc/frankendom/presence.env').replace('ORIGINS_PRESENCE=0', 'ORIGINS_PRESENCE=1'));
    const r = s.run(['rev1']);
    assert.equal(r.status, 0, r.stderr);
    const calls = s.calls();
    assert.match(calls, /systemctl restart frankendom-presence.service/);
    assert.match(calls, /curl http:\/\/127\.0\.0\.1:8793\/origins\/presence\/health hdr=no/);
    assert.match(calls, /curl http:\/\/127\.0\.0\.1:8793\/internal\/where\?account=0{8}-0{4}-4000-8000-0{12} hdr=yes/, 'where is called with the key header');
    assert.match(calls, /curl http:\/\/127\.0\.0\.1:8793\/internal\/where\?account=0{8}-0{4}-4000-8000-0{12} hdr=no/, 'and without it');
    assert.match(calls, /curl https:\/\/frankendom\.com\/origins\/presence\/health/, 'and the public path is checked');
    assert.doesNotMatch(r.stdout + r.stderr + calls, /0{63}7/, 'the key never appears in output or in a command line');
    assert.match(r.stdout, /live/);
  } finally { s.clean(); }
});

test('install: a reachable public health path takes the include back out and fails the install', { skip: !linux }, () => {
  const s = sandbox();
  try {
    assert.equal(s.run(['rev1'], PUBLIC).status, 0);
    writeFileSync(join(s.root, 'etc/frankendom/presence.env'), s.read('etc/frankendom/presence.env').replace('ORIGINS_PRESENCE=0', 'ORIGINS_PRESENCE=1'));
    const r = s.run(['rev1'], { STUB_PUBLIC_HEALTH: '200' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /public health path is reachable/);
    assert.equal(s.read('etc/nginx/sites-enabled/frankendom.com').includes('frankendom-presence.conf'), false, 'the include is gone');
  } finally { s.clean(); }
});

test('install: a failing nginx -t takes the include out and reloads nothing', { skip: !linux }, () => {
  const s = sandbox();
  try {
    const r = s.run(['rev1'], { ...PUBLIC, STUB_NGINX_FAIL: '1' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /nginx -t failed; include removed/);
    assert.equal(s.read('etc/nginx/sites-enabled/frankendom.com').includes('frankendom-presence.conf'), false);
    assert.doesNotMatch(s.calls(), /systemctl reload nginx/);
  } finally { s.clean(); }
});

test('rollback and --link-writer: rollback removes the include, snippet and unit and keeps the env; link-writer appends the key to the writer\'s env once and never prints it', { skip: !linux }, () => {
  const s = sandbox();
  try {
    assert.equal(s.run(['rev1'], PUBLIC).status, 0);
    assert.notEqual(s.run(['--link-writer']).status, 0, 'no writer env: nothing to link');
    writeFileSync(join(s.root, 'etc/frankendom/origins-writer.env'), 'DATABASE_URL=postgres://x\n');
    const linked = s.run(['--link-writer']);
    assert.equal(linked.status, 0, linked.stderr);
    assert.match(s.read('etc/frankendom/origins-writer.env'), /^PRESENCE_INTERNAL_KEY=0{63}7$/m);
    assert.doesNotMatch(linked.stdout + linked.stderr, /0{63}7/, 'the key is not printed');
    const wenv = s.read('etc/frankendom/origins-writer.env'), presencePort = /^PRESENCE_PORT=(\d+)$/m.exec(s.read('etc/frankendom/presence.env'))?.[1];
    const writerPort = /PORT = '(\d+)'/.exec(readFileSync(join(repo, 'scripts/origins-writer.mjs'), 'utf8'))?.[1];
    assert.ok(presencePort && writerPort, 'both default ports are readable');
    assert.notEqual(presencePort, writerPort, 'presence and the writer must not share a port on one box');
    assert.match(wenv, new RegExp(`^PRESENCE_URL=http://127\\.0\\.0\\.1:${presencePort}$`, 'm'), 'the writer is told where presence listens');
    s.run(['--link-writer']);
    assert.equal(s.read('etc/frankendom/origins-writer.env').split('PRESENCE_INTERNAL_KEY').length - 1, 1, 'appended once');
    const unlinked = s.run(['--unlink-writer']);
    assert.equal(unlinked.status, 0, unlinked.stderr);
    assert.equal(s.read('etc/frankendom/origins-writer.env'), 'DATABASE_URL=postgres://x\n', '--unlink-writer leaves the writer\'s env exactly as it was');
    assert.doesNotMatch(unlinked.stdout + unlinked.stderr, /0{63}7/);
    assert.equal(s.run(['--link-writer']).status, 0, 'and it can be linked again');
    const back = s.run(['--rollback']);
    assert.equal(back.status, 0, back.stderr);
    assert.equal(s.read('etc/nginx/sites-enabled/frankendom.com'), SITE, 'the site file is exactly what it was');
    assert.equal(existsSync(join(s.root, 'etc/nginx/snippets/frankendom-presence.conf')), false);
    assert.equal(existsSync(join(s.root, 'etc/systemd/system/frankendom-presence.service')), false);
    assert.ok(existsSync(join(s.root, 'etc/frankendom/presence.env')), 'the env file is kept for a re-install');
    assert.match(s.read('etc/frankendom/origins-writer.env'), /^PRESENCE_INTERNAL_KEY=/m, 'a presence rollback does not touch the writer\'s env: --unlink-writer is the explicit undo');
    assert.match(s.calls(), /systemctl disable --now frankendom-presence.service/);
  } finally { s.clean(); }
});

test('the unit and the env template: no secrets, loopback only, off by default, a read-only sandbox', () => {
  const unit = readFileSync(join(repo, 'ops/frankendom-presence.service'), 'utf8'), envTemplate = readFileSync(join(repo, 'ops/presence.env.example'), 'utf8');
  assert.match(unit, /^EnvironmentFile=\/etc\/frankendom\/presence\.env$/m);
  assert.match(unit, /^ExecStart=\/usr\/bin\/env node origins\/presence\/main\.ts$/m);
  for (const hardening of ['DynamicUser=yes', 'NoNewPrivileges=yes', 'ProtectSystem=strict', 'PrivateTmp=yes', 'CapabilityBoundingSet=']) assert.ok(unit.includes(`\n${hardening}`), `${hardening}`);
  assert.doesNotMatch(unit, /PRESENCE_INTERNAL_KEY=|SUPABASE_ANON_KEY=/, 'no secret in the unit');
  assert.match(envTemplate, /^ORIGINS_PRESENCE=0\b/m, 'the template is OFF');
  assert.match(envTemplate, /^PRESENCE_HOST=127\.0\.0\.1\b/m);
  assert.doesNotMatch(envTemplate, /[0-9a-f]{32}/, 'no key-looking value in the template');
});
