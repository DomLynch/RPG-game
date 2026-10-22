import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { classify, classifySpawn } from '../scripts/npm-audit-soft.mjs';
import { steps } from './lib/npm-script.ts';

// The npm registry's audit service went down on 2026-10-22 (bulk 503, /audits/quick 400) and turned K6q17's quality (static) red after
// "# fail 0". The gate now tolerates exactly that outage; a real vulnerability still fails it.
const report = (total: number) => JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: total, critical: 0, total } } });
// ENOAUDIT as npm 10.9.8 and 11.11.0 really print it (measured against a registry answering 503 bulk / 400 quick): the HTTP error on
// stdout under --json, and npm's one error line on stderr.
const httpError = (statusCode: number, path: string) => JSON.stringify({ message: `${statusCode} - POST https://registry.npmjs.org${path}`, method: 'POST', uri: `https://registry.npmjs.org${path}`, headers: {}, statusCode, body: { error: 'x' }, error: { summary: '', detail: '' } });
const outage = httpError(400, '/-/npm/v1/security/audits/quick');
const ENOAUDIT = 'npm warn audit 400 Bad Request - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick\nnpm error audit endpoint returned an error\nnpm error A complete log of this run can be found in: /x.log\n';

test('classify: a clean report passes, a vulnerable one keeps npm\'s failing exit code', () => {
  assert.deepEqual(classify({ status: 0, stdout: report(0) }), { exit: 0, kind: 'clean', total: 0 });
  assert.deepEqual(classify({ status: 1, stdout: report(2) }), { exit: 1, kind: 'vulnerable', total: 2 });
  assert.equal(classify({ status: 1, stdout: report(2), stderr: ENOAUDIT }).exit, 1, 'a real report is never softened, whatever stderr says');
});

test('classify: only ENOAUDIT (the audit endpoint answering an HTTP error) is softened; everything else fails', () => {
  assert.deepEqual(classify({ status: 1, stdout: outage, stderr: ENOAUDIT }), { exit: 0, kind: 'outage', detail: '400 /-/npm/v1/security/audits/quick' });
  assert.equal(classify({ status: 1, stdout: httpError(503, '/-/npm/v1/security/advisories/bulk'), stderr: ENOAUDIT }).exit, 0, 'npm 11 bulk 503');
  assert.equal(classify({ status: 1, stdout: outage, stderr: 'npm error code ENOLOCK\n' }).exit, 1, 'the HTTP shape without npm\'s ENOAUDIT line fails');
  assert.equal(classify({ status: 1, stdout: httpError(400, '/some/other/endpoint'), stderr: ENOAUDIT }).exit, 1, 'only the audit endpoints count');
  assert.equal(classify({ status: 1, stdout: JSON.stringify({ error: { code: 'ENOLOCK', summary: 'no lockfile' } }), stderr: 'npm error code ENOLOCK\n' }).exit, 1);
  assert.equal(classify({ status: 1, stdout: 'npm error something' }).exit, 1);
  assert.equal(classify({ status: 0, stdout: '{}' }).exit, 1, 'a report without vulnerability counts is not a pass');
  assert.equal(classify({ status: 0, stdout: '' }).exit, 1);
});

// End to end through the script with a stand-in npm, so the wiring (args, --json, exit code) is what runs, not just the function.
function runWithFakeNpm(stdout: string, status: number, stderr = '') {
  const dir = mkdtempSync(join(tmpdir(), 'frankendom-audit-'));
  try {
    const fake = join(dir, 'npm');
    writeFileSync(fake, `#!/usr/bin/env node\nconst a = process.argv.slice(2);\nprocess.stderr.write(${JSON.stringify(stderr)});\nif (a.includes('--json')) process.stdout.write(${JSON.stringify(stdout)});\nelse process.stdout.write('human report\\n');\nprocess.exit(${status});\n`);
    chmodSync(fake, 0o755);
    return spawnSync(process.execPath, ['scripts/npm-audit-soft.mjs', '--omit=dev'], { encoding: 'utf8', env: { ...process.env, NPM_AUDIT_SOFT_NPM: fake } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('npm-audit-soft: a registry outage exits 0 with a warning; a vulnerability exits 1', () => {
  const down = runWithFakeNpm(outage, 1, ENOAUDIT);
  assert.equal(down.status, 0, down.stderr);
  assert.match(down.stderr, /npm audit SKIPPED: the registry's audit service is unreachable/);
  const bad = runWithFakeNpm(report(3), 1);
  assert.equal(bad.status, 1, bad.stderr);
  assert.match(bad.stdout, /human report/, 'a failing audit prints npm\'s own report');
  assert.equal(runWithFakeNpm(report(0), 0).status, 0);
});

// 2026-10-22, K6q23 #3609 and #3595: npm hung on the registry until spawnSync's timeout killed it ("could not run npm: spawnSync npm
// ETIMEDOUT"), the same outage in another shape. Only the timeout is softened; a runner with no usable npm still fails.
test('classifySpawn: a spawn timeout is the outage; any other spawn error fails', () => {
  assert.deepEqual(classifySpawn(Object.assign(new Error('spawnSync npm ETIMEDOUT'), { code: 'ETIMEDOUT' })), { exit: 0, kind: 'outage', detail: 'npm audit timed out (the registry did not answer)' });
  assert.deepEqual(classifySpawn(Object.assign(new Error('spawnSync npm ENOENT'), { code: 'ENOENT' })), { exit: 1, kind: 'spawn', detail: 'ENOENT' });
  assert.equal(classifySpawn(Object.assign(new Error('spawnSync npm EACCES'), { code: 'EACCES' })).exit, 1);
  assert.equal(classifySpawn(new Error('no code')).exit, 1);
});

test('npm-audit-soft: an npm that hangs past the timeout exits 0 with a warning; a missing npm exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frankendom-audit-'));
  try {
    const hang = join(dir, 'npm');
    writeFileSync(hang, '#!/usr/bin/env node\nsetTimeout(() => {}, 60000);\n');
    chmodSync(hang, 0o755);
    const run = (npm: string) => spawnSync(process.execPath, ['scripts/npm-audit-soft.mjs', '--omit=dev'], { encoding: 'utf8', env: { ...process.env, NPM_AUDIT_SOFT_NPM: npm, NPM_AUDIT_SOFT_TIMEOUT_MS: '500' } });
    const hung = run(hang);
    assert.equal(hung.status, 0, hung.stderr);
    assert.match(hung.stderr, /npm audit SKIPPED: npm audit timed out/);
    const missing = run(join(dir, 'no-such-npm'));
    assert.equal(missing.status, 1, missing.stderr);
    assert.match(missing.stderr, /could not run .*ENOENT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the quality and deploy gates run the soft audit, never a bare npm audit', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
  for (const gate of ['quality:static', 'quality:deploy']) {
    const run = steps(scripts, gate);
    assert.ok(run.includes('node scripts/npm-audit-soft.mjs --omit=dev'), `${gate} runs the soft audit`);
    assert.ok(!run.some((s) => s.startsWith('npm audit')), `${gate} has no bare npm audit`);
  }
});
