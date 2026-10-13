// Hardening item 4, measurement only (Dom's priority via Strategy, 2026-10-13): where does a release-checks run spend its time, row by row?
//   node scripts/ci-row-times.mjs <release-checks run id> [owner/repo]   -> a markdown table on stdout (reads the run's jobs with `gh api`)
// A CI row job is: checkout, setup-node, npm ci, playwright install (chromium + webkit), JPEG tool + ffmpeg, `npm run build`, then the row itself ("Release check N").
// Everything before the row is SETUP; `queue` is created_at -> started_at (the runner cap), not work. Nothing here changes a workflow.
import { spawnSync } from 'node:child_process';

const sec = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000)) || 0;
const PHASES = [['checkout', /^Run actions\/checkout/], ['node', /^Run actions\/setup-node/], ['npm ci', /^Run npm ci/], ['playwright', /^Run npx playwright install/], ['ffmpeg', /^(Lossless JPEG|Drop the Microsoft)/], ['build', /^Run npm run build/], ['row', /^Release check \d+/]];

/** jobs: [{ name, created_at, started_at, completed_at, conclusion, steps: [{ name, started_at, completed_at }] }] -> one record per "check N (name)" job, slowest first. */
export function rowTimes(jobs) {
  const rows = [];
  for (const j of jobs) {
    const m = /^check (\d+) \((.*)\)$/.exec(j.name);
    if (!m || !j.started_at || !j.completed_at) continue;
    const phase = Object.fromEntries(PHASES.map(([k]) => [k, 0]));
    for (const s of j.steps || []) { const p = PHASES.find(([, re]) => re.test(s.name)); if (p && s.started_at && s.completed_at) phase[p[0]] += sec(s.started_at, s.completed_at); }
    const total = sec(j.started_at, j.completed_at);
    const setup = phase.checkout + phase.node + phase['npm ci'] + phase.playwright + phase.ffmpeg + phase.build;
    rows.push({ index: Number(m[1]), name: m[2], queue: sec(j.created_at, j.started_at), total, setup, ...phase, conclusion: j.conclusion });
  }
  return rows.sort((a, b) => b.total - a.total || a.index - b.index);
}

/** The run in numbers: job-seconds, the setup share, the build share, the longest row, the longest queue wait. */
export function summarize(rows) {
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const total = sum('total');
  return { rows: rows.length, jobSeconds: total, setupSeconds: sum('setup'), buildSeconds: sum('build'), setupShare: total ? sum('setup') / total : 0, longest: rows[0]?.total ?? 0, longestQueue: Math.max(0, ...rows.map(r => r.queue)), median: rows.length ? [...rows].sort((a, b) => a.total - b.total)[Math.floor(rows.length / 2)].total : 0 };
}

export function markdown(rows, s = summarize(rows)) {
  const pct = x => `${Math.round(x * 100)}%`;
  return [
    `${s.rows} CI rows, ${s.jobSeconds} job-seconds; setup (checkout, node, npm ci, playwright, ffmpeg, build) ${s.setupSeconds} s = ${pct(s.setupShare)}, of which \`npm run build\` ${s.buildSeconds} s; longest row ${s.longest} s, median ${s.median} s, longest queue wait ${s.longestQueue} s.`,
    '', '| # | row | queue s | checkout | npm ci | playwright | ffmpeg | build | row s | total s |', '|--:|---|--:|--:|--:|--:|--:|--:|--:|--:|',
    ...rows.map(r => `| ${r.index} | ${r.name} | ${r.queue} | ${r.checkout} | ${r['npm ci']} | ${r.playwright} | ${r.ffmpeg} | ${r.build} | ${r.row} | ${r.total} |`),
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [run, repo = 'DomLynch/RPG-game'] = process.argv.slice(2);
  if (!/^\d+$/.test(run || '')) { console.error('usage: node scripts/ci-row-times.mjs <run id> [owner/repo]'); process.exit(2); }
  const r = spawnSync('gh', ['api', `repos/${repo}/actions/runs/${run}/jobs?per_page=100`, '--paginate', '--jq', '.jobs[]'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error(`gh api failed: ${String(r.stderr).slice(0, 300)}`); process.exit(1); }
  const jobs = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  console.log(markdown(rowTimes(jobs)));
}
