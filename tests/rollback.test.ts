// scripts/rollback.sh against a fake release tree: `ssh` runs the remote half locally, `curl` serves the fake `current`, so nothing
// touches the VPS. A rollback swaps current <-> previous and passes the live check; --dry-run changes nothing; a named release goes
// live; a deploy in flight or a bundle without the Supabase host fails loudly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readlinkSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'rollback.sh');
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const exe = (path: string, body: string) => { writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`); chmodSync(path, 0o755); };

const fixture = (opts: { supabase?: boolean } = {}) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rollback-'))),  // macOS: /var is /private/var and readlink -f resolves it
    root = join(dir, 'www'), bin = join(dir, 'bin');
  mkdirSync(bin);
  for (const rev of [A, B, C]) {
    const release = join(root, 'releases', rev);
    mkdirSync(join(release, 'assets'), { recursive: true });
    writeFileSync(join(release, 'release.json'), `{"revision":"${rev}","phase":"0B-swordplay"}\n`);
    writeFileSync(join(release, 'index.html'), `<script src="/assets/index-${rev.slice(0, 6)}.js"></script>`);
    writeFileSync(join(release, 'assets', `index-${rev.slice(0, 6)}.js`), opts.supabase === false && rev === A ? 'no host' : 'x rxbewmzmovelckzoosss.supabase.co x');
  }
  symlinkSync(join(root, 'releases', B), join(root, 'current'));
  symlinkSync(join(root, 'releases', A), join(root, 'previous'));
  // ssh: evaluate the remote command string here (so a quoting bug that real ssh would expose fails here too). curl: serve the path under the fake current. mv -Tf: macOS has no -T.
  exe(join(bin, 'fake-ssh'), 'for a; do c=$a; done; eval "$c"');  // like real ssh: the last argument is one shell string
  exe(join(bin, 'fake-curl'), `for a; do u=$a; done; p=\${u#https://site.test}; p=\${p#/}; cat "${root}/current/\${p:-index.html}"`);
  exe(join(bin, 'mv'), 'if [[ $1 == -Tf ]]; then exec python3 -c "import os,sys; os.replace(sys.argv[1], sys.argv[2])" "$2" "$3"; fi; exec /bin/mv "$@"');
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ROLLBACK_SSH: join(bin, 'fake-ssh'), ROLLBACK_CURL: join(bin, 'fake-curl'),
      ROLLBACK_HOST: 'fake', ROLLBACK_SITE: 'https://site.test', ROLLBACK_ROOT: root, ROLLBACK_VERIFIER: join(dir, 'verifier'),
      DEPLOY_LOCK: join(dir, 'no-lock'), ...env },
  });
  const link = (name: string) => readlinkSync(join(root, name));
  return { dir, root, run, link };
};

test('a rollback swaps current and previous, then the live check passes on the old release', () => {
  const f = fixture();
  const r = f.run([]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(f.link('current'), join(f.root, 'releases', A));
  assert.equal(f.link('previous'), join(f.root, 'releases', B));
  assert.match(r.stdout, new RegExp(`Rolled back: live is ${A}`));
  const again = f.run([]);  // a second rollback is a roll-forward: previous is always the release that was live
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(f.link('current'), join(f.root, 'releases', B));
});

test('--dry-run changes nothing and checks the release that is live now', () => {
  const f = fixture();
  const r = f.run(['--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(f.link('current'), join(f.root, 'releases', B));
  assert.equal(f.link('previous'), join(f.root, 'releases', A));
  assert.match(r.stdout, new RegExp(`Dry run: live is ${B} and checks out; a rollback would make ${A} live`));
});

test('a named revision goes live and the release that was live becomes previous', () => {
  const f = fixture();
  const r = f.run([C]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(f.link('current'), join(f.root, 'releases', C));
  assert.equal(f.link('previous'), join(f.root, 'releases', B));
});

test('refuses while deploy.sh holds the lock, and refuses a short or unknown revision', () => {
  const f = fixture();
  const lock = join(f.dir, 'lock');
  writeFileSync(lock, `{"revision":"x","pid":${process.pid}}\n`);
  const held = f.run([], { DEPLOY_LOCK: lock });
  assert.equal(held.status, 1); assert.match(held.stderr, /Refusing: deploy\.sh \(pid \d+\) holds/);
  assert.equal(f.link('current'), join(f.root, 'releases', B), 'nothing moved');
  assert.equal(f.run(['abc123']).status, 2);
  const missing = f.run(['d'.repeat(40)]);
  assert.equal(missing.status, 1); assert.match(missing.stderr, /no usable rollback target/);
});

test('the live check fails loudly when the rolled-back bundle lacks the Supabase host', () => {
  const f = fixture({ supabase: false });
  const r = f.run([]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /LIVE CHECK FAILED: assets\/index-aaaaaa\.js lacks the Supabase host/);
});
