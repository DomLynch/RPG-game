#!/usr/bin/env node
// `npm audit --omit=dev` for the quality and deploy gates, tolerant ONLY of the npm registry's audit service being unreachable.
// 2026-10-22 (K6q17 #3572): the bulk advisory endpoint answered 503 and npm 10's fallback /audits/quick answered 400 ("being retired"),
// so every quality (static) job went red after its tests passed, on a tree whose lockfile was byte-identical to live. Lead waived the
// step for that candidate; this script makes the next outage a warning instead of a stopped release.
// The rule: a parsed audit report keeps npm's own exit code (any vulnerability at the configured audit-level still fails), an
// ENOAUDIT "audit endpoint returned an error" is a loud warning and exit 0, and anything else (no JSON, another error code) fails.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Decide the gate's outcome from one `npm audit --json` run. Pure, so the unit test drives both cases without the network. */
export function classify({ status, stdout }) {
  let report;
  try { report = JSON.parse(stdout); } catch { return { exit: status || 1, kind: 'unparsed' }; }
  if (report && typeof report === 'object' && report.error) {
    const code = report.error.code;
    return code === 'ENOAUDIT' ? { exit: 0, kind: 'outage', detail: report.error.summary ?? code } : { exit: status || 1, kind: 'error', detail: code };
  }
  const total = report?.metadata?.vulnerabilities?.total;
  if (typeof total !== 'number') return { exit: status || 1, kind: 'unparsed' };
  return { exit: status, kind: total > 0 ? 'vulnerable' : 'clean', total };
}

function main(args) {
  const npm = process.env.NPM_AUDIT_SOFT_NPM || 'npm';
  const run = spawnSync(npm, ['audit', ...args, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.error) { console.error(`npm-audit-soft: could not run ${npm}: ${run.error.message}`); return 1; }
  const verdict = classify({ status: run.status ?? 1, stdout: run.stdout });
  if (verdict.kind === 'outage') {
    console.warn(`::warning::npm audit SKIPPED: the registry's audit service is unreachable (${verdict.detail}). Not a pass: re-run once npm recovers.`);
    console.warn(run.stderr.trim());
  } else if (verdict.kind === 'clean') {
    console.log('npm audit: found 0 vulnerabilities');
  } else {
    // Re-run in human form so the log shows what failed (or npm's own error text when the JSON was unreadable).
    spawnSync(npm, ['audit', ...args], { stdio: 'inherit' });
    if (verdict.kind !== 'vulnerable') console.error(`npm-audit-soft: npm audit failed (${verdict.kind}${verdict.detail ? `: ${verdict.detail}` : ''}).`);
  }
  return verdict.exit;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
