// Where a release row runs (Dom 2026-10-09, "the Mac is the exception"): placement is DATA here, not a switch. A row is on the Mac only
// when it is listed below with its reason; a row joins the list only with a reason and, for "slower on HF", a MEASURED number.
// Re-measure monthly. tests/row-placement.test.ts pins this list to what vps-receipts.mjs coverageGaps() computes, so it cannot drift.
export const MAC_MAX = 9;          // the most rows a release may run on the Mac: the 9 that are Mac-only by nature (row 54, the WebKit landscape Pit, Lead 2026-10-12) (Lead 2026-10-09: Mac = the Mac-only rows only)
export const MAC_ENFORCE = false;  // false: an over-limit release prints the refusal text and runs (Lead 2026-10-09: do not block the next release)
// Rows 2 and 44 were tried on the T4 again on 2026-10-10 (Strategy asked; job 6aca1214fee2c90070185fa6, release AD's tree a6d408cb4, t4-medium, width 1, 20 min cap):
// row 2 roster-browser-check was killed at the 600 s ceiling, row 44 sparring-browser-check exited 1 after 337 s and its retry was cut off by the job timeout.
// The same rows on the Mac at width 1 in that release: 53 s and 74 s. Strategy ruled they stay on the Mac. A VPS run is not a measurement (SwiftShader, no GPU,
// load 28-34 that day); do not re-measure without a new reason. Row 44 also failed its first attempt on the Mac in releases Y, Z and AA (Characters owns it, #2127).
export const MAC_ONLY = [
  { row: 2, why: 'roster-browser-check hit the 600 s ceiling on HF', hf_s: 600, mac_s: 73, date: '2026-10-09' },
  { row: 4, why: 'WebKit (Linux WebKit is not Mac Safari)' },
  { row: 22, why: 'WebKit' },
  { row: 44, why: 'sparring-browser-check exits 1 on HF', hf_s: null, mac_s: 145, date: '2026-10-09' },
  { row: 45, why: 'WebKit' },
  { row: 48, why: 'WebKit' },
  { row: 49, why: 'WebKit' },
  { row: 52, why: 'WebKit and clock.resume (real clock)' },
  { row: 54, why: 'WebKit (the landscape Pit, the journal tabs and the paper-doll in Safari\'s engine)' },
];
// Rows the CPU receipt rules keep off a CPU box (vps-receipts.mjs SLOW_ROWS; row 13's initdb refuses root) that the T4 job runs instead, as pwuser
// with #2044's GPU flags. Measured 2026-10-09 on tree ebee1959e, each row alone (width 1), seconds; the fastest box wins, and the T4 won every row
// (the old "slow on T4" trial, job 6ac7f57e, rendered in SwiftShader and is void). mac_s = the row's last Mac time in the deploy logs.
// t4: jobs 6ac93783/6ac93785/6ac93786 (row 13: 6ac93a4b, after job.sh installs postgresql); cpu: cpu-upgrade width 1, one job per row (row 13 cannot: initdb
// refuses root; rows 5 and 34 still running at 35 min, they hit the 1500 s ceiling before); vps: capture, 3-wide, as frankrows (600 = hit the 600 s row ceiling at load 41;
// row 9's 474 is the 4-wide run; the run was stopped once the T4 had won every row). null = not measured on that box.
export const T4_JOBS = 4;   // the T4 leg runs as this many parallel t4-medium jobs, 4-wide each (Dom 2026-10-09: "max out the GPU, it's cheap"; Lead: ~2-3 min instead of ~9)
export const ON_T4 = [
  { row: 5, t4_s: 90, cpu_s: null, vps_s: 600, mac_s: 167 }, { row: 7, t4_s: 23, cpu_s: 689, vps_s: 600, mac_s: 67 },
  { row: 9, t4_s: 21, cpu_s: 369, vps_s: 474, mac_s: 222 }, { row: 13, t4_s: 4, cpu_s: null, vps_s: null, mac_s: 16 },
  { row: 16, t4_s: 53, cpu_s: 814, vps_s: null, mac_s: 182 }, { row: 21, t4_s: 53, cpu_s: 784, vps_s: null, mac_s: 61 },
  { row: 28, t4_s: 55, cpu_s: 787, vps_s: null, mac_s: 66 }, { row: 34, t4_s: 86, cpu_s: null, vps_s: null, mac_s: 158 },
  { row: 36, t4_s: 34, cpu_s: 697, vps_s: null, mac_s: 52 },
];
// The T4 is for GPU-ONLY rows (Dom/Lead 2026-10-12, the 40-runner work): rows that cannot finish inside the 600 s row ceiling without a GPU, i.e. their
// measured CPU time above (cpu_s, SwiftShader, the same renderer a GitHub runner has) is over 600 s or never finished. Every other row goes to CI
// (release-checks.yml on every candidate) and the CPU waterfall. Row 13 is not here: its CPU gap is initdb refusing root, not the renderer (a runner is not root).
export const ROW_CEILING_S = 600;
export const GPU_ONLY = [5, 7, 16, 21, 28, 34, 36];
// Every MAC_ONLY row, the list deploy.sh's placement uses: CI never vouches for one (ci-trusted-checks.mjs) and never schedules one (release-checks.yml
// plan). The WebKit rows because the runner has no WebKit install (CK #2317, job 114771865725: row 52 died on "Executable doesn't exist ... webkit");
// rows 2 and 44 because they fail off the Mac (CK: row 2 failed after 15 min on CI, 63 s on the Mac).
export const MAC_ROWS = MAC_ONLY.map(entry => entry.row);
// POST-PUBLISH rows (Lead + Strategy 2026-10-13, Dom's "under 20 minutes"): slow rows that are not critical to the page opening run AFTER Published instead of
// before it. CI never schedules them on a candidate (release-checks.yml plan) and deploy.sh defers them (RELEASE_CHECKS_DEFERRED) and runs them on the Mac right after
// the Published line (scripts/lib/post-publish.sh); a failure is a RED line, exit 1 (the release train then STOPS and keeps deploy_hold), never a silent pass.
// ci_s = the row's seconds as a CI job in release-checks run 38348338622 (DM): the candidate's wall time is its longest row, and these two were the tail.
export const POST_PUBLISH = [
  { row: 9, why: 'polearm-browser-check: the longest CI row (854 s), a combat-feel check, not boot-critical', ci_s: 854, date: '2026-10-13' },
  { row: 46, why: 'desktop-intro-check: the second-longest CI row (458 s), the desktop intro, not boot-critical', ci_s: 458, date: '2026-10-13' },
];
export const POST_PUBLISH_ROWS = POST_PUBLISH.map(entry => entry.row);
// The first log line of a release: how every row is being handled. ci = trusted from CI, hf = trusted from an HF receipt, vps = trusted from the
// VPS, mac = rows running on the Mac. Over the limit the refusal text names the rows that are not on the Mac list.
export function placementLine({ total, ci, hf, vps = [], mac }) {
  const list = rows => rows.length ? ` (${rows.join(',')})` : '';
  const macOnly = new Set(MAC_ONLY.map(entry => entry.row));
  const over = mac.filter(row => !macOnly.has(row));
  const text = `Release rows: ${total} total: ${ci.length + hf.length + vps.length} trusted / ${hf.length} HF${list(hf)} / ${vps.length} VPS${list(vps)} / ${mac.length} Mac${list(mac)}; CI-trusted ${ci.length}${list(ci)}`;
  const refuse = mac.length > MAC_MAX;
  return { text, refuse, enforce: refuse && MAC_ENFORCE, warning: refuse ? `Mac rows ${mac.length} > MAC_MAX ${MAC_MAX}: rows not on the Mac-only list: ${over.join(',') || 'none'}${MAC_ENFORCE ? ' (REFUSED)' : ' (not enforced yet: MAC_ENFORCE=false)'}` : '' };
}
// deploy.sh, once the remote jobs are launched: node scripts/lib/row-placement.mjs line <ci-trusted> <out of scope> <T4 wall rows> <HF CPU rows> <VPS CPU rows> (comma lists; the VPS rows come from launch.mjs cpu's running marker, so the line already counts them before the receipt is merged).
// The Mac is every row left. Out-of-scope rows run nowhere (this release's changed files cannot reach them) and are named after the line.
export function planLine(total, [ci, outOfScope, wall, cpu, vpsRows, deferred = '']) {
  const list = text => [...new Set(String(text || '').split(',').map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= total))];
  const [c, o, w, h, v, d] = [ci, outOfScope, wall, cpu, vpsRows, deferred].map(list), hf = [...new Set([...w, ...h])].filter(n => !c.includes(n)).sort((a, b) => a - b);
  const mac = Array.from({ length: total }, (_, i) => i + 1).filter(n => !c.includes(n) && !o.includes(n) && !hf.includes(n) && !v.includes(n) && !d.includes(n));
  const line = placementLine({ total, ci: c, hf, vps: v.filter(n => !c.includes(n)), mac });
  return `${line.text}; out of scope ${o.length}${o.length ? ` (${o.join(',')})` : ''}; post-publish ${d.length}${d.length ? ` (${d.join(',')})` : ''}; T4 ${w.length}, HF CPU ${h.length}, VPS CPU ${v.length}${line.warning ? `\n${line.warning}` : ''}`;
}
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'line') {
  const { readFileSync } = await import('node:fs');
  console.log(planLine(JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands.length, process.argv.slice(3)));
}
