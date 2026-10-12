// Runner budget (Lead + Strategy 2026-10-12, ~39/40 runners busy and 49 jobs queued at 18:30): (1) static first: a tsc + lint job runs first and every
// quality shard, browser job and unit-ci shard `needs:` it on a pull request, so a red tsc costs one job, not 30; (2) scope: release-checks rows run
// only for release-* candidates, never a feature PR (label or not); a feature PR's browser jobs run only once it carries auditor:ready.
// The workflows' own `needs:` / `if:` / concurrency expressions are evaluated here per event, so this tests what Actions would schedule.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

type Ctx = { event_name: string; event: Record<string, unknown>; head_ref?: string; ref?: string; run_id?: string };
type Job = { name: string; needs: string[]; cond: string | null; outputs: boolean };

const jobs = (file: string): Job[] => {
  const text = readFileSync(file, 'utf8');
  const body = text.slice(text.indexOf('\njobs:\n') + 7);
  return body.split(/\n(?= {2}[a-z][a-z0-9-]*:\n)/).filter(b => /^ {2}[a-z]/.test(b)).map(b => {
    const name = /^ {2}([a-z][a-z0-9-]*):/.exec(b)![1];
    const n = /\n {4}needs: (\[[^\]]*\]|[a-z][a-z0-9-]*)\n/.exec(b);
    const needs = !n ? [] : n[1].startsWith('[') ? n[1].slice(1, -1).split(',').map(s => s.trim()) : [n[1]];
    const c = /\n {4}if: ([^\n]+)\n/.exec(b);
    return { name, needs, cond: c ? c[1].replace(/^\$\{\{\s*|\s*\}\}$/g, '') : null, outputs: /\n {4}outputs:\n/.test(b) };
  });
};

// GitHub expression -> JS: same operators and quoting for what these files use; hyphenated job names become bracket lookups.
const evalExpr = (expr: string, github: Ctx, needs: Record<string, { result: string; outputs: Record<string, string> }>) => {
  const js = expr.replace(/needs\.([a-z][a-z0-9-]*)/g, (_, j) => `needs[${JSON.stringify(j)}]`);
  const all = Object.values(needs);
  const fns = {
    contains: (h: unknown, n: string) => (Array.isArray(h) ? h.includes(n) : String(h).includes(n)),
    toJSON: (v: unknown) => JSON.stringify(v ?? null),
    startsWith: (s: unknown, p: string) => String(s ?? '').startsWith(p),
    format: (f: string, ...a: unknown[]) => f.replace(/\{(\d+)\}/g, (_, i) => String(a[Number(i)])),
    always: () => true,
    cancelled: () => false,
    success: () => all.every(n => n.result === 'success'),
  };
  return new Function('github', 'needs', ...Object.keys(fns), `return (${js});`)(github, needs, ...Object.values(fns));
};

/** Which jobs run for this event (a job runs when its needs allow it and its `if` holds); `results` forces a job's conclusion (e.g. static red). */
const schedule = (file: string, github: Ctx, results: Record<string, string> = {}, outputs: Record<string, Record<string, string>> = {}) => {
  const done: Record<string, { result: string; outputs: Record<string, string> }> = {};
  const list = jobs(file);
  while (Object.keys(done).length < list.length) {
    for (const j of list) {
      if (done[j.name] || !j.needs.every(n => done[n])) continue;
      const needs = Object.fromEntries(j.needs.map(n => [n, done[n]]));
      const statusFn = j.cond && /\b(always|cancelled|success|failure)\(\)/.test(j.cond);
      const ok = (statusFn || j.needs.every(n => done[n].result === 'success')) && (j.cond ? !!evalExpr(j.cond, github, needs) : true);
      done[j.name] = { result: ok ? results[j.name] || 'success' : 'skipped', outputs: ok ? outputs[j.name] || {} : {} };
    }
  }
  return new Set(Object.entries(done).filter(([, v]) => v.result !== 'skipped').map(([k]) => k));
};

const pr = (action: string, labels: string[] = [], extra: Record<string, unknown> = {}): Ctx =>
  ({ event_name: 'pull_request', head_ref: 'deploy-b/x', event: { action, pull_request: { number: 7, draft: false, labels: labels.map(name => ({ name })) }, ...extra } });
const Q = '.github/workflows/quality.yml', U = '.github/workflows/unit-ci.yml', R = '.github/workflows/release-checks.yml';
const BROWSER = ['load-time', 'browser', 'net-engines', 'asset-rows', 'duel-two-page'];
const game = { plan: { game: 'true', browser: 'true' } };
// Actions resolves github.event.pull_request.labels.*.name; the files use it only inside contains(...)
const withLabelNames = (c: Ctx) => { const p = c.event.pull_request as { labels?: { name: string }[] } | undefined; if (p?.labels) Object.assign(p.labels, { '*': { name: p.labels.map(l => l.name) } }); return c; };

test('a red tsc on a pull request queues no quality shard, no browser job and no unit-ci shard: only the static job and the verdicts', () => {
  const ran = schedule(Q, withLabelNames(pr('synchronize', ['auditor:ready'])), { static: 'failure' }, game);
  assert.ok(ran.has('static'));
  for (const j of ['quality-shard', ...BROWSER]) assert.ok(!ran.has(j), `${j} must not run after a red static`);
  assert.ok(ran.has('quality'), 'the `quality` verdict still reports (red)');
  const unit = schedule(U, withLabelNames(pr('synchronize')), { static: 'failure' });
  assert.deepEqual([...unit].sort(), ['static'], 'unit-ci: no shard and no receipt after a red static');
});

test('green static: every shard runs; a feature PR\'s browser jobs only once it carries auditor:ready', () => {
  const plain = schedule(Q, withLabelNames(pr('synchronize')), {}, { plan: { game: 'true', browser: 'false' } });
  for (const j of ['static', 'quality-shard', 'quality', 'base', 'plan']) assert.ok(plain.has(j), j);
  for (const j of BROWSER) assert.ok(!plain.has(j), `${j} waits for auditor:ready`);
  const ready = schedule(Q, withLabelNames(pr('synchronize', ['auditor:ready'])), {}, game);
  for (const j of BROWSER) assert.ok(ready.has(j), `${j} runs once auditor:ready is on`);
  assert.ok(schedule(U, withLabelNames(pr('synchronize'))).has('shard'), 'unit shards run on every push');
  // the plan sets `browser` from the labels the event carries (the step reads them; a push always runs them)
  const plan = readFileSync(Q, 'utf8');
  assert.match(plan, /PR_LABELS: \$\{\{ join\(github\.event\.pull_request\.labels\.\*\.name, ','\) \}\}/);
  assert.match(plan, /browser=true[^\n]*\n[^\n]*auditor:ready|auditor:ready[^\n]*browser=true/);
});

test('adding auditor:ready runs the browser jobs (after static) and nothing else; any other label or a title edit runs nothing', () => {
  const added = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), {}, game);
  for (const j of BROWSER) assert.ok(added.has(j), j);
  for (const j of ['quality-shard', 'quality', 'base']) assert.ok(!added.has(j), `${j} already ran on this head`);
  for (const ev of [pr('labeled', ['release:go'], { label: { name: 'release:go' } }), pr('labeled', ['ci:release-checks'], { label: { name: 'ci:release-checks' } }), pr('edited', [], { changes: { title: {} } })]) {
    assert.deepEqual([...schedule(Q, withLabelNames(ev), {}, game)], [], `${ev.event.action} ${JSON.stringify(ev.event.label ?? ev.event.changes)} runs nothing`);
  }
  const retarget = schedule(Q, withLabelNames(pr('edited', [], { changes: { base: {} } })), {}, { plan: { game: 'true', browser: 'false' } });
  assert.ok(retarget.has('base') && retarget.has('quality-shard'), 'a retarget still re-runs the gate');
});

test('the concurrency group: auditor:ready gets its own group (never cancels the head\'s gate in flight); an inert label or edit never cancels anything', () => {
  const g = /\nconcurrency:\n(?: {2}#[^\n]*\n)* {2}group: ([^\n]+)\n/.exec(readFileSync(Q, 'utf8'))![1];
  const group = (c: Ctx) => g.replace(/\$\{\{(.*?)\}\}/g, (_, e) => String(evalExpr(e.trim(), { ...c, run_id: '99' }, {})));
  assert.equal(group(pr('synchronize')), 'quality-7');
  assert.equal(group(pr('labeled', [], { label: { name: 'auditor:ready' } })), 'quality-7-browser');
  assert.equal(group(pr('labeled', [], { label: { name: 'release:go' } })), 'quality-7-inert-99');
  assert.equal(group(pr('edited', [], { changes: { title: {} } })), 'quality-7-inert-99');
  assert.equal(group(pr('edited', [], { changes: { base: {} } })), 'quality-7');
  assert.match(readFileSync(Q, 'utf8'), /\n {4}types: \[opened, synchronize, reopened, edited, labeled\]\n/);
});

test('a trunk push is unchanged: no static job, every shard and browser job runs', () => {
  const push: Ctx = { event_name: 'push', ref: 'refs/heads/codex/01a09a76/task-1', event: {} };
  const ran = schedule(Q, push, {}, game);
  assert.ok(!ran.has('static'));
  for (const j of ['quality-shard', 'quality', 'load-time', 'browser', 'net-engines', 'duel-two-page']) assert.ok(ran.has(j), j);
  const unit = schedule(U, push);
  assert.ok(unit.has('shard') && unit.has('receipt') && !unit.has('static'));
});

test('the static job is tsc + lint only (fast), and the shards it guards keep their own full checks', () => {
  for (const f of [Q, U]) {
    const t = readFileSync(f, 'utf8'), at = t.indexOf('\n  static:\n');
    assert.ok(at >= 0, `${f} has a static job`);
    const block = t.slice(at + 1), end = block.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    const s = end < 0 ? block : block.slice(0, end + 1);
    for (const cmd of ['npx eslint src', 'npm run typecheck:tests', 'npm run typecheck:origins', 'npm run lint:origins']) assert.ok(s.includes(cmd), `${f} static runs ${cmd}`);
    assert.doesNotMatch(s, /npm run build|test:all|playwright/, `${f} static stays fast`);
  }
});

test('release-checks: rows only for a release-* candidate; a feature PR, labelled or not, schedules no job; a dispatch is unchanged', () => {
  const feature = (lbl: string) => ({ ...withLabelNames(pr('labeled', [lbl], { label: { name: lbl } })) });
  assert.deepEqual([...schedule(R, feature('ci:release-checks'), {}, { plan: { checks: '[{"index":1}]' } })], [], 'ci:release-checks on a feature PR queues 0 rows');
  assert.deepEqual([...schedule(R, withLabelNames(pr('synchronize', ['ci:release-checks'])), {}, { plan: { checks: '[{"index":1}]' } })], []);
  const cand = { ...withLabelNames(pr('synchronize', ['ci:release-checks'])), head_ref: 'release-2026-10-12-a' };
  const ran = schedule(R, { ...cand, event: { ...cand.event, pull_request: { ...(cand.event.pull_request as object), draft: true } } }, {}, { plan: { checks: '[{"index":1}]' } });
  for (const j of ['plan', 'check', 'summary']) assert.ok(ran.has(j), `release-* runs ${j}`);
  assert.ok(schedule(R, { event_name: 'workflow_dispatch', event: {} }, {}, { plan: { checks: '[{"index":1}]' } }).has('check'));
  assert.doesNotMatch(readFileSync(R, 'utf8'), /includes\("ci:release-checks"\) \|\|/, 'the label no longer makes a feature PR a candidate');
});

// A step's own bash, extracted from quality.yml and run with a stub gh that records its argv (one game file changed for the files listing).
const stepScript = (from: string, to: string) => {
  const yml = readFileSync(Q, 'utf8'), at = yml.indexOf(from), start = yml.indexOf('        run: |\n', at), end = yml.indexOf(to, start);
  assert.ok(at > 0 && start > at && end > start, `step ${from.trim()}`);
  return yml.slice(start, end).split('\n').slice(1).map(l => l.slice(10)).join('\n');
};
const runStep = (script: string, env: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'qstep-')), out = join(dir, 'out'), calls = join(dir, 'calls');
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${calls}\ncase "$*" in *pulls/*/files*) echo src/main.ts;; esac\n`); chmodSync(join(dir, 'gh'), 0o755);
  writeFileSync(out, ''); writeFileSync(calls, '');
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: out, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', PR_LABELS: '', HEAD_REF: 'deploy-b/x', ...env } });
  assert.equal(r.status, 0, r.stderr);
  const status = readFileSync(calls, 'utf8').split('\n').find(l => l.includes('/statuses/'));
  return { out: Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => l.split('='))), status };
};
const planOut = (env: Record<string, string>) => runStep(stepScript('      - id: diff\n', '\n      # The `browser-rows` commit status'), env).out;
const planStatus = (env: Record<string, string>) => runStep(stepScript('      - name: browser-rows status', '\n  static:\n'), { SHA: 'h'.repeat(40), RUN_URL: 'u', ...env }).status;
const reportStatus = (results: string) => runStep(stepScript('\n  browser-rows:\n', '\n  base:\n'), { SHA: 'h'.repeat(40), RUN_URL: 'u', RESULTS: results }).status;

test('the Auditor removes auditor:ready after its verdict: a release-* head always runs the browser jobs; a feature PR without it says so in the quality summary', () => {
  assert.deepEqual(planOut({ HEAD_REF: 'release-2026-10-12-b' }), { browser: 'true', game: 'true' }, 'release-* synchronize without the label');
  assert.deepEqual(planOut({}), { browser: 'false', game: 'true' }, 'feature synchronize without the label');
  assert.deepEqual(planOut({ PR_LABELS: 'release:go,auditor:ready' }), { browser: 'true', game: 'true' });
  assert.match(readFileSync(Q, 'utf8'), /needs\.plan\.outputs\.browser == 'false'\n {8}run: echo "browser jobs NOT run on this head[^\n]*GITHUB_STEP_SUMMARY/, 'the quality summary says it');
});

test('browser-rows commit status: PENDING on every feature push until the browser jobs pass on that head; success/failure on the SAME sha; release-* gets none', () => {
  const H = 'h'.repeat(40);
  // (a) every push: the status step is in plan, which runs on opened/synchronize/reopened/retarget and on adding auditor:ready; it is not gated on the action
  const statusIf = /- name: browser-rows status\n {8}if: ([^\n]+)\n/.exec(readFileSync(Q, 'utf8'))![1];
  assert.equal(statusIf, "github.event_name == 'pull_request' && !startsWith(github.head_ref, 'release-')");
  for (const a of ['opened', 'synchronize', 'reopened']) assert.ok(schedule(Q, withLabelNames(pr(a)), {}, game).has('plan'), `plan (and its status) on ${a}`);
  // (a)/(c) a push without the label: pending, waiting; with it: pending, running; no game path: success
  assert.match(planStatus({ GAME: 'true', BROWSER: 'false' })!, new RegExp(`statuses/${H} -f state=pending -f context=browser-rows -f description=waiting for auditor:ready`));
  assert.match(planStatus({ GAME: 'true', BROWSER: 'true' })!, /state=pending .*description=browser jobs running/);
  assert.match(planStatus({ GAME: 'false', BROWSER: 'false' })!, /state=success .*no browser rows needed/);
  // (b) the browser-rows job writes the verdict on the head sha it ran for (github.event.pull_request.head.sha, the same the plan used)
  assert.match(reportStatus('static=success load-time=success browser=success net-engines=success asset-rows=success duel-two-page=success')!, new RegExp(`statuses/${H} -f state=success`));
  assert.match(reportStatus('static=success load-time=success browser=failure net-engines=success asset-rows=success duel-two-page=success')!, /state=failure .*browser=failure/);
  assert.match(reportStatus('static=failure load-time=skipped browser=skipped net-engines=skipped asset-rows=skipped duel-two-page=skipped')!, /state=failure/, 'a red static is not a pass');
  const yml = readFileSync(Q, 'utf8');
  assert.equal((yml.match(/SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/g) || []).length, 2, 'plan and the verdict write on the same head sha');
  const ran = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), {}, game);
  assert.ok(ran.has('browser-rows'), 'adding auditor:ready writes the verdict');
  assert.ok(!schedule(Q, withLabelNames(pr('synchronize')), {}, { plan: { game: 'true', browser: 'false' } }).has('browser-rows'), 'no verdict while waiting: it stays pending');
  // release-*: no pending status (it always runs the browser jobs, and they report as jobs)
  const rel = { ...withLabelNames(pr('synchronize')), head_ref: 'release-2026-10-12-b' };
  assert.ok(!evalExpr(statusIf, rel, {}), 'no status step on release-*');
  assert.ok(!schedule(Q, rel, {}, game).has('browser-rows'));
  assert.ok(!schedule(Q, { event_name: 'push', ref: 'r', event: {} }, {}, game).has('browser-rows'), 'a push writes no status');
});
