// The release train under launchd (Lead 2026-10-12, first tick 15:49:18Z): "fatal: not a git repository: …/Desktop/…/.git/worktrees/frankendom-train".
// macOS TCC keeps a launchd job out of ~/Desktop (and ~/Documents, ~/Downloads), and the train's checkout was a worktree whose gitdir lives there.
// Ruling: no Full Disk Access; everything the job touches is a standalone clone (or a worktree of it) outside those folders. These tests pin the
// refusal (scripts/lib/train-layout.sh), the setup (scripts/release-train-setup.sh) and the publisher's dry run.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const layout = (home: string, script: string) => spawnSync('bash', ['-c', `source scripts/lib/train-layout.sh; ${script}`], { encoding: 'utf8', env: { ...process.env, HOME: home } });

test('train_checkout_ok refuses a worktree whose gitdir is under ~/Desktop (or ~/Documents, ~/Downloads); a standalone clone or a worktree of one outside them passes', () => {
  const home = mkdtempSync(join(tmpdir(), 'tcc-home-'));
  try {
    const wt = (name: string, gitdir: string) => { const d = join(home, 'Developer', name); mkdirSync(d, { recursive: true }); writeFileSync(join(d, '.git'), `gitdir: ${gitdir}\n`); return d; };
    for (const prot of ['Desktop', 'Documents', 'Downloads']) {
      const d = wt(`wt-${prot}`, join(home, prot, 'Business/frankendom/.git/worktrees/frankendom-train'));
      const r = layout(home, `train_checkout_ok ${JSON.stringify(d)}`);
      assert.equal(r.status, 1, `${prot}: refused`);
      assert.match(r.stdout, new RegExp(`${d}: a worktree of a repo under ~/${prot} .*launchd cannot read.*release-train-setup\\.sh`));
    }
    assert.equal(layout(home, `train_checkout_ok ${JSON.stringify(wt('wt-rel', '../frankendom-train/.git/worktrees/x'))}`).status, 0, 'a relative gitdir outside the protected folders is fine');
    assert.equal(layout(home, `train_checkout_ok ${JSON.stringify(wt('wt-dev', join(home, 'Developer/frankendom-train/.git/worktrees/slot')))}`).status, 0, 'a worktree of the standalone clone');
    const clone = join(home, 'Developer', 'clone'); mkdirSync(join(clone, '.git'), { recursive: true });
    assert.equal(layout(home, `train_checkout_ok ${JSON.stringify(clone)}`).status, 0, 'a standalone clone (.git is a directory)');
    const inDesk = join(home, 'Desktop', 'clone'); mkdirSync(join(inDesk, '.git'), { recursive: true });
    assert.equal(layout(home, `train_checkout_ok ${JSON.stringify(inDesk)}`).status, 1, 'a clone that itself sits under ~/Desktop');
    assert.equal(layout(home, `train_checkout_ok ${JSON.stringify(join(home, 'Developer', 'absent'))}`).status, 0, 'an absent slot is fine (created from the clone)');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// Twice: HOME as a real path, and HOME through a symlink, as on the Mac, where tmpdir() is /var/folders/... -> /private/var/folders/... and git writes a
// worktree's gitdir resolved, so a plain "$HOME/Desktop/" prefix never matched it and the Desktop worktree passed (the Mac-only red, Lead 2026-10-13).
for (const linked of [false, true]) test(`release-train-setup.sh${linked ? ' (HOME through a symlink, as on the Mac)' : ''}: no checkout -> a standalone clone of origin, detached on trunk, with the .env*.local files; a Desktop worktree is refused and left untouched`, () => {
  const real = mkdtempSync(join(tmpdir(), 'tcc-setup-')), home = linked ? join(real, 'alias') : real;
  if (linked) { mkdirSync(join(real, 'home')); symlinkSync(join(real, 'home'), home); }
  try {
    const g = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim();
    const origin = join(home, 'origin.git'), src = join(home, 'Desktop', 'Business', 'frankendom');
    g('init', '-q', '--bare', '-b', 'codex/01a09a76/task-1', origin);
    g('clone', '-q', origin, src); g('-C', src, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'c'); g('-C', src, 'push', '-q', 'origin', 'HEAD:codex/01a09a76/task-1');
    writeFileSync(join(src, '.env.production.local'), 'VITE_SENTRY_DSN=x\n');
    const setup = () => spawnSync('bash', [join(process.cwd(), 'scripts/release-train-setup.sh')], { cwd: src, encoding: 'utf8', env: { ...process.env, HOME: home } });
    const train = join(home, 'Developer', 'frankendom-train');
    const r = setup();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(existsSync(join(train, '.git')) && spawnSync('test', ['-d', join(train, '.git')]).status === 0, 'a standalone clone: .git is a directory');
    assert.equal(g('-C', train, 'rev-parse', 'HEAD'), g('-C', src, 'rev-parse', 'HEAD'), 'detached on origin trunk');
    assert.equal(g('-C', train, 'remote', 'get-url', 'origin'), origin, 'cloned from origin, not from the Desktop checkout');
    assert.equal(readFileSync(join(train, '.env.production.local'), 'utf8'), 'VITE_SENTRY_DSN=x\n', 'the build env file is copied');
    assert.match(r.stdout, /layout OK/);
    // the train's env file: a reference to ~/.zshenv's HF_TOKEN, mode 600, never a token-shaped string
    const envFile = join(home, '.claude', 'state', 'release-train.env');
    assert.match(readFileSync(envFile, 'utf8'), /grep '\^export HF_TOKEN=' "\$HOME\/\.zshenv"/);
    assert.doesNotMatch(readFileSync(envFile, 'utf8'), /hf_[A-Za-z0-9]{8,}/, 'no token value is ever written');
    assert.equal(statSync(envFile).mode & 0o777, 0o600);
    assert.equal(setup().status, 0, 'idempotent');
    assert.equal(readFileSync(envFile, 'utf8').split('\n').filter(l => l.startsWith('eval ')).length, 1, 'a second run does not duplicate the line');
    // the old layout: the train checkout is a worktree of the Desktop repo -> refused, nothing removed
    rmSync(train, { recursive: true, force: true }); g('-C', src, 'worktree', 'add', '-q', '--detach', train);
    const bad = setup();
    assert.equal(bad.status, 1);
    assert.match(bad.stdout + bad.stderr, /frankendom-train: a worktree of a repo under ~\/Desktop/);
    assert.ok(existsSync(join(train, '.git')), 'left in place for a person to move');
    // a release slot left over as a Desktop worktree is refused too
    rmSync(train, { recursive: true, force: true }); g('-C', src, 'worktree', 'prune');
    const slot = join(home, 'Developer', 'frankendom-train-deploy'); g('-C', src, 'worktree', 'add', '-q', '--detach', slot);
    const badSlot = setup();
    assert.equal(badSlot.status, 1); assert.match(badSlot.stdout + badSlot.stderr, /frankendom-train-deploy: a worktree of a repo under ~\/Desktop/);
  } finally { rmSync(real, { recursive: true, force: true }); }
});
