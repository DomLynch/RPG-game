import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { classify } from '../scripts/npm-audit-soft.mjs';
import { steps } from './lib/npm-script.ts';

// The npm registry's audit service went down on 2026-10-22 (bulk 503, /audits/quick 400) and turned K6q17's quality (static) red after
// "# fail 0". The gate now tolerates exactly that outage; a real vulnerability still fails it.
const report = (total: number) => JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: total, critical: 0, total } } });
const outage = JSON.stringify({ error: { code: 'ENOAUDIT', summary: 'audit endpoint returned an error', detail: '' } });

test('classify: a clean report passes, a vulnerable one keeps npm\'s failing exit code', () => {
  assert.deepEqual(classify({ status: 0, stdout: report(0) }), { exit: 0, kind: 'clean', total: 0 });
  assert.deepEqual(classify({ status: 1, stdout: report(2) }), { exit: 1, kind: 'vulnerable', total: 2 });
});

test('classify: only ENOAUDIT (registry unreachable) is softened; other errors and unreadable output fail', () => {
  assert.deepEqual(classify({ status: 1, stdout: outage }), { exit: 0, kind: 'outage', detail: 'audit endpoint returned an error' });
  assert.equal(classify({ status: 1, stdout: JSON.stringify({ error: { code: 'ENOLOCK', summary: 'no lockfile' } }) }).exit, 1);
  assert.equal(classify({ status: 1, stdout: 'npm error something' }).exit, 1);
  assert.equal(classify({ status: 0, stdout: '{}' }).exit, 1, 'a report without vulnerability counts is not a pass');
  assert.equal(classify({ status: 0, stdout: '' }).exit, 1);
});

// End to end through the script with a stand-in npm, so the wiring (args, --json, exit code) is what runs, not just the function.
function runWithFakeNpm(stdout: string, status: number) {
  const dir = mkdtempSync(join(tmpdir(), 'frankendom-audit-'));
  try {
    const fake = join(dir, 'npm');
    writeFileSync(fake, `#!/usr/bin/env node\nconst a = process.argv.slice(2);\nif (a.includes('--json')) process.stdout.write(${JSON.stringify(stdout)});\nelse process.stdout.write('human report\\n');\nprocess.exit(${status});\n`);
    chmodSync(fake, 0o755);
    return spawnSync(process.execPath, ['scripts/npm-audit-soft.mjs', '--omit=dev'], { encoding: 'utf8', env: { ...process.env, NPM_AUDIT_SOFT_NPM: fake } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('npm-audit-soft: a registry outage exits 0 with a warning; a vulnerability exits 1', () => {
  const down = runWithFakeNpm(outage, 1);
  assert.equal(down.status, 0, down.stderr);
  assert.match(down.stderr, /npm audit SKIPPED: the registry's audit service is unreachable/);
  const bad = runWithFakeNpm(report(3), 1);
  assert.equal(bad.status, 1, bad.stderr);
  assert.match(bad.stdout, /human report/, 'a failing audit prints npm\'s own report');
  assert.equal(runWithFakeNpm(report(0), 0).status, 0);
});

test('the quality and deploy gates run the soft audit, never a bare npm audit', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
  for (const gate of ['quality:static', 'quality:deploy']) {
    const run = steps(scripts, gate);
    assert.ok(run.includes('node scripts/npm-audit-soft.mjs --omit=dev'), `${gate} runs the soft audit`);
    assert.ok(!run.some((s) => s.startsWith('npm audit')), `${gate} has no bare npm audit`);
  }
});
