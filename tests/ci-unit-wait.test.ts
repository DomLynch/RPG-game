// scripts/ci-unit-trust.mjs waits for the unit-ci.yml run on the exact sha (Lead 2026-10-12: CK's deploy looked before its green run finished), bounded,
// and says unit-ci-down when it cannot vouch; deploy.sh then falls back to the HF/VPS receipt with that reason and logs which source it trusted.
// A stub gh (CI_UNIT_GH) and a throwaway git repo; nothing reaches GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NODE_PIN } from '../scripts/lib/vps-unit.mjs';
import { SHARDS } from '../scripts/lib/ci-unit.mjs';

const fixture = (polls: number, final: 'success' | 'failure') => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-unit-wait-')), repo = join(dir, 'repo');
  const g = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', repo]); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'c');
  const sha = g('rev-parse', 'HEAD'), tree = g('rev-parse', 'HEAD^{tree}');
  const receipt = { kind: 'ci-unit-suite', tree, sha, shards: SHARDS, node: NODE_PIN.version, exit: 0, fail: 0, pass: 3600, seconds: 200, run: '77', repo: 'o/r' };
  // The run is in_progress for the first `polls` views, then completed with `final`.
  const gh = join(dir, 'gh'), n = join(dir, 'n');
  writeFileSync(gh, `#!/bin/bash
run() { c=$(cat '${n}' 2>/dev/null || echo 0); if [ "$c" -lt ${polls} ]; then st=in_progress; co=; else st=completed; co=${final}; fi; echo $((c + 1)) > '${n}'; }
case "$1 $2" in
  "repo view") echo o/r;;
  "run list") run; echo "[{\\"databaseId\\":77,\\"status\\":\\"$st\\",\\"conclusion\\":\\"$co\\",\\"headSha\\":\\"${sha}\\",\\"path\\":\\".github/workflows/unit-ci.yml\\"}]";;
  "run view") run; echo "{\\"databaseId\\":77,\\"status\\":\\"$st\\",\\"conclusion\\":\\"$co\\",\\"headSha\\":\\"${sha}\\",\\"path\\":\\".github/workflows/unit-ci.yml\\"}";;
  "run download") for a in "$@"; do [ "$p" = --dir ] && d=$a; p=$a; done; printf '%s' '${JSON.stringify(receipt)}' > "$d/unit-receipt.json";;
  *) exit 1;;
esac
`); chmodSync(gh, 0o755);
  const run = (waitS: string) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/ci-unit-trust.mjs'), sha], { cwd: repo, encoding: 'utf8',
    env: { ...process.env, CI_UNIT_GH: gh, CI_UNIT_WAIT_S: waitS, CI_UNIT_POLL_S: '1' } });
  return { run, n };
};

test('a unit-ci run still in progress is waited for, and trusted once it goes green', () => {
  const { run, n } = fixture(3, 'success');
  const r = run('30');
  assert.equal(r.stdout, 'ok', r.stderr);
  assert.match(r.stderr, /waited \d+s for run 77 on [0-9a-f]{8}: completed\/success/);
  assert.match(r.stderr, /unit suite trusted: 3600 pass over 8 shards/);
  assert.ok(Number(readFileSync(n, 'utf8')) >= 4, 'it polled until the run completed');
});

test('a run that does not finish inside the bound is unit-ci-down, never trusted', () => {
  const r = fixture(1000, 'success').run('2');
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /unit-ci-down: run 77 still in_progress after 2s/);
});

test('a run that finishes red is unit-ci-down with its conclusion', () => {
  const r = fixture(1, 'failure').run('30');
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /unit-ci-down: run 77 failure/);
});

test('deploy.sh asks unit-ci first and logs the source; the HF/VPS receipts only with reason=unit-ci-down', () => {
  const s = readFileSync('scripts/deploy.sh', 'utf8');
  const at = (x: string) => { const i = s.indexOf(x); assert.ok(i >= 0, x); return i; };
  assert.ok(at('vps_unit=$(node scripts/ci-unit-trust.mjs "$revision" || true)') < at('vps_unit=$(vps_unit_receipt_ok)'), 'unit-ci before the HF/VPS receipt');
  assert.match(s, /echo "unit source: unit-ci\.yml for \$revision"/);
  assert.match(s, /echo "unit source: HF\/VPS receipt \(reason=unit-ci-down\)"/);
  assert.match(s, /unit source: none \(reason=unit-ci-down/);
  assert.equal((s.match(/ci-unit-trust\.mjs/g) || []).length, 2, 'asked once (plus the comment)');
});
