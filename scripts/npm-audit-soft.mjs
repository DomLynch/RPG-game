#!/usr/bin/env node
// `npm audit --omit=dev` for the quality and deploy gates, tolerant ONLY of the npm registry's audit service being unreachable.
// 2026-10-22 (K6q17 #3572): the bulk advisory endpoint answered 503 and npm 10's fallback /audits/quick answered 400 ("being retired"),
// so every quality (static) job went red after its tests passed, on a tree whose lockfile was byte-identical to live. Lead waived the
// step for that candidate; this script makes the next outage a warning instead of a stopped release.
// The rule: a parsed audit report keeps npm's own exit code (any vulnerability at the configured audit-level still fails), npm's
// ENOAUDIT "audit endpoint returned an error" is a loud warning and exit 0, and anything else (no JSON, another error) fails.
// What ENOAUDIT looks like (measured on npm 10.9.8 and 11.11.0 against a registry answering 503 bulk / 400 quick): stderr carries
// "npm error audit endpoint returned an error", and --json prints the HTTP error itself ({ statusCode, uri, ... }), no report.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENOAUDIT_LINE = /^npm error audit endpoint returned an error$/m;
const AUDIT_ENDPOINT = /\/-\/npm\/v1\/security\/(advisories\/bulk|audits(\/quick)?)\b/;

/** Decide the gate's outcome from one `npm audit --json` run. Pure, so the unit test drives every case without the network. */
export function classify({ status, stdout, stderr = '' }) {
  let report;
  try { report = JSON.parse(stdout); } catch { return { exit: status || 1, kind: 'unparsed' }; }
  if (report && typeof report === 'object' && !report.metadata) {
    const httpFail = typeof report.statusCode === 'number' && report.statusCode >= 400 && AUDIT_ENDPOINT.test(String(report.uri ?? ''));
    if (httpFail && ENOAUDIT_LINE.test(stderr)) return { exit: 0, kind: 'outage', detail: `${report.statusCode} ${String(report.uri).replace(/^https?:\/\/[^/]+/, '')}` };
    return { exit: status || 1, kind: 'error', detail: report.error?.code ?? report.code ?? report.statusCode };
  }
  const total = report?.metadata?.vulnerabilities?.total;
  if (typeof total !== 'number') return { exit: status || 1, kind: 'unparsed' };
  return { exit: status, kind: total > 0 ? 'vulnerable' : 'clean', total };
}

const TIMEOUT_MS = 180_000;   // a hung registry call is killed and fails the gate (run.error below), never hangs the job

function main(args) {
  const npm = process.env.NPM_AUDIT_SOFT_NPM || 'npm';
  const run = spawnSync(npm, ['audit', ...args, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TIMEOUT_MS });
  if (run.error) { console.error(`npm-audit-soft: could not run ${npm}: ${run.error.message}`); return 1; }
  const verdict = classify({ status: run.status ?? 1, stdout: run.stdout, stderr: run.stderr });
  if (verdict.kind === 'outage') {
    console.warn(`::warning::npm audit SKIPPED: the registry's audit service is unreachable (${verdict.detail}). Not a pass: re-run once npm recovers.`);
    console.warn(run.stderr.trim());
  } else if (verdict.kind === 'clean') {
    console.log('npm audit: found 0 vulnerabilities');
  } else {
    // Re-run in human form so the log shows what failed (or npm's own error text when the JSON was unreadable).
    spawnSync(npm, ['audit', ...args], { stdio: 'inherit', timeout: TIMEOUT_MS });
    if (verdict.kind !== 'vulnerable') console.error(`npm-audit-soft: npm audit failed (${verdict.kind}${verdict.detail ? `: ${verdict.detail}` : ''}).`);
  }
  return verdict.exit;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
