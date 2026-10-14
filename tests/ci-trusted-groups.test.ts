// scripts/ci-trusted-checks.mjs with GROUPED release-checks jobs (Deploy, release speed 2026-10-13): a job named `checks 1,13,20 (...)` covers several rows,
// each row still needs its own receipt (an array in the group's receipt file), and the one-job-per-row shape keeps working.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const g = (repo: string, ...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

test('ci-trusted-checks: a grouped job vouches for its rows by their own receipts; a red or unfinished group, a missing receipt and a Mac-only row do not', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ci-trust-grp-repo-')), dir = mkdtempSync(join(tmpdir(), 'ci-trust-grp-'));
  try {
    g(repo, 'init', '-q', '-b', 'trunk'); g(repo, 'config', 'user.email', 't@t'); g(repo, 'config', 'user.name', 't');
    writeFileSync(join(repo, 'a.txt'), '1\n'); g(repo, 'add', '.'); g(repo, 'commit', '-qm', 'T0');
    const sha = g(repo, 'rev-parse', 'HEAD'), tree = g(repo, 'rev-parse', 'HEAD^{tree}');
    const rc = (index: number, status = 0) => ({ index, status, tree, sha });
    const files: Record<string, unknown> = {
      'release-check-g1-receipt/release-check-g1.json': [rc(1), rc(13), rc(20)],            // green group, all receipts 0
      'release-check-g2-receipt/release-check-g2.json': [rc(6), rc(12)],                    // group job is red: nothing in it is trusted
      'release-check-g3-receipt/release-check-g3.json': [rc(26), rc(33, 1)],                // green job but 33 carries a red receipt; 40 has none
      'release-check-g4-receipt/release-check-g4.json': [rc(3)],                            // unfinished group
      'release-check-7-receipt/release-check-7.json': rc(7),                                // legacy one-row job and receipt
      'release-check-g5-receipt/release-check-g5.json': [rc(4), rc(8)],                     // 4 is a WebKit row (Mac-only)
    };
    const jobs = [
      { name: 'checks 1,13,20 (a+b)', conclusion: 'success' }, { name: 'checks 6,12 (c+d)', conclusion: 'failure' },
      { name: 'checks 26,33,40 (e+f)', conclusion: 'success' }, { name: 'checks 3 (g)', conclusion: null },
      { name: 'check 7 (legacy)', conclusion: 'success' }, { name: 'checks 4,8 (h+i)', conclusion: 'success' },
    ];
    const fake = join(dir, 'gh');
    writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "run list") echo '[{"databaseId":5,"headSha":"${sha}","url":"https://x/runs/5","status":"completed"}]';;
  "run view") echo '${JSON.stringify(jobs)}';;
  "run download")
    for i in "$@"; do case "$prev" in --dir) dir="$i";; esac; prev="$i"; done
${Object.entries(files).map(([p, v]) => `    mkdir -p "$dir/${p.split('/')[0]}"; printf '%s' '${JSON.stringify(v)}' > "$dir/${p}"`).join('\n')};;
  *) exit 1;;
esac
`);
    execFileSync('chmod', ['+x', fake]);
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('RELEASE_CHECKS_') && !k.startsWith('DEPLOY_'))), CI_TRUST_GH: fake };
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'ci-trusted-checks.mjs'), sha], { cwd: repo, encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '1,7,8,13,20,26', 'rows of a green group with a receipt 0 of their own (1, 13, 20, 26, and 8 beside the Mac-only row 4), plus the legacy row 7: ' + r.stderr);
    assert.match(r.stderr, /6:failure/); assert.match(r.stderr, /12:failure/);                        // red group: every row, receipts or not
    assert.match(r.stderr, /33:receipt-status=1/); assert.match(r.stderr, /40:no-receipt/);          // a green job does not vouch for a row without a good receipt of its own
    assert.match(r.stderr, /3:unfinished/);                                                          // unfinished group: wait/run locally
    assert.match(r.stderr, /4:mac-only/);
  } finally { rmSync(repo, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); }
});
