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
// `chain`: the results of EVERY job upstream (needs of needs too): GitHub's success() is false when any of them was skipped or failed, so a job with no
// `if` under a skipped `static` is skipped even when its direct need ran through !cancelled() (unit-ci run 38293767009 on trunk 4337cfe9b: 8 green shards, receipt skipped).
const evalExpr = (expr: string, github: Ctx, needs: Record<string, { result: string; outputs: Record<string, string> }>, chain: readonly string[] = Object.values(needs).map(n => n.result)) => {
  const js = expr.replace(/needs\.([a-z][a-z0-9-]*)/g, (_, j) => `needs[${JSON.stringify(j)}]`).replace(/\.\*\./g, "['*'].");
  const fns = {
    contains: (h: unknown, n: string) => (Array.isArray(h) ? h.includes(n) : String(h).includes(n)),
    toJSON: (v: unknown) => JSON.stringify(v ?? null),
    startsWith: (s: unknown, p: string) => String(s ?? '').startsWith(p),
    format: (f: string, ...a: unknown[]) => f.replace(/\{(\d+)\}/g, (_, i) => String(a[Number(i)])),
    always: () => true,
    cancelled: () => false,
    success: () => chain.every(r => r === 'success'),
  };
  return new Function('github', 'needs', ...Object.keys(fns), `return (${js});`)(github, needs, ...Object.values(fns));
};

/** Which jobs run for this event (a job runs when its needs allow it and its `if` holds); `results` forces a job's conclusion (e.g. static red). */
const schedule = (file: string, github: Ctx, results: Record<string, string> = {}, outputs: Record<string, Record<string, string>> = {}) => {
  const done: Record<string, { result: string; outputs: Record<string, string> }> = {};
  const list = jobs(file), byName = new Map(list.map(j => [j.name, j]));
  const upstream = (name: string, seen = new Set<string>()): Set<string> => { for (const n of byName.get(name)!.needs) if (!seen.has(n)) { seen.add(n); upstream(n, seen); } return seen; };
  while (Object.keys(done).length < list.length) {
    for (const j of list) {
      if (done[j.name] || !j.needs.every(n => done[n])) continue;
      const needs = Object.fromEntries(j.needs.map(n => [n, done[n]]));
      const statusFn = j.cond && /\b(always|cancelled|success|failure)\(\)/.test(j.cond);
      const chain = [...upstream(j.name)].map(n => done[n]!.result);
      const ok = (statusFn || chain.every(r => r === 'success')) && (j.cond ? !!evalExpr(j.cond, github, needs, chain) : true);
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
  const ran = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), { static: 'failure' }, { plan: { game: 'true', browser: 'false' } });
  assert.ok(ran.has('static'));
  for (const j of ['quality-shard', ...BROWSER]) assert.ok(!ran.has(j), `${j} must not run after a red static`);   // a feature PR runs no browser job at all (Lead 2026-10-13)
  assert.ok(ran.has('quality'), 'the `quality` verdict still reports (red)');
  const unit = schedule(U, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), { static: 'failure' });
  assert.deepEqual([...unit].sort(), ['delta', 'receipt', 'static'], 'unit-ci (delta joined 2026-10-14, Strategy: merge-up rounds off the runners): no shard after a red static, but the receipt job RUNS and goes red (hardening item 3, the Auditor on #2476: a skipped verdict reads as passing to a ruleset); no receipt artifact is made');
});

test('runner queue (Strategy 2026-10-12 21:5x): a push to an UNLABELLED feature PR runs static + plan + base only; the shards, the verdict and unit-ci run when auditor:ready is added and on every push after it; no browser job ever runs on a feature PR (Lead 2026-10-13)', () => {
  const plain = schedule(Q, withLabelNames(pr('synchronize')), {}, { plan: { game: 'true', browser: 'false' } });
  assert.deepEqual([...plain].sort(), ['base', 'plan', 'static'], 'an unlabelled feature push: static (tsc + lint) and the cheap jobs only');
  assert.deepEqual([...schedule(U, withLabelNames(pr('synchronize')))], [], 'unit-ci: no job on an unlabelled feature push');
  const noBrowser = { plan: { game: 'true', browser: 'false' } };
  const pushed = schedule(Q, withLabelNames(pr('synchronize', ['auditor:ready'])), {}, noBrowser);
  for (const j of ['static', 'quality-shard', 'quality', 'base', 'plan']) assert.ok(pushed.has(j), `a push to an already-labelled feature PR re-runs ${j} (Lead on #2546: no relying on the label being toggled)`);
  for (const j of ['static', 'shard', 'receipt']) assert.ok(schedule(U, withLabelNames(pr('synchronize', ['auditor:ready']))).has(j), `unit-ci ${j} on a push to a labelled feature PR`);
  for (const j of BROWSER) assert.ok(!pushed.has(j), `${j}: still no browser job on a feature PR`);
  const ready = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), {}, noBrowser);
  for (const j of ['static', 'quality-shard', 'quality']) assert.ok(ready.has(j), `${j} runs when auditor:ready is added`);
  for (const j of ['base', ...BROWSER]) assert.ok(!ready.has(j), `${j} does not run on a feature PR`);
  const cand = { ...withLabelNames(pr('synchronize')), head_ref: 'release-DB' };
  for (const j of ['static', 'quality-shard', 'quality', 'base', ...BROWSER]) assert.ok(schedule(Q, cand, {}, game).has(j), `release-* without the label runs ${j} on every push`);
  for (const j of ['static', 'shard', 'receipt']) assert.ok(schedule(U, cand).has(j), `release-* unit-ci ${j}`);
  // adding auditor:ready starts unit-ci; any other label runs nothing and never shares (so never cancels) the real run's group
  const added = (l: string) => withLabelNames(pr('labeled', [l], { label: { name: l } }));
  for (const j of ['static', 'shard', 'receipt']) assert.ok(schedule(U, added('auditor:ready')).has(j), `adding auditor:ready: unit-ci ${j}`);
  assert.deepEqual([...schedule(U, withLabelNames(pr('labeled', ['auditor:ready', 'release:go'], { label: { name: 'release:go' } })))], [], 'release:go added to a ready PR: unit-ci runs nothing');
  const ug = /\nconcurrency:\n {2}group: ([^\n]+)\n {2}cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/.exec(readFileSync(U, 'utf8'))![1];
  const ugroup = (c: Ctx) => ug.replace(/\$\{\{(.*?)\}\}/g, (_, e) => String(evalExpr(e.trim(), { ...c, run_id: '99' }, {})));
  assert.equal(ugroup(pr('synchronize')), 'unit-ci-7');
  assert.equal(ugroup(pr('labeled', [], { label: { name: 'auditor:ready' } })), 'unit-ci-7', 'adding auditor:ready on a feature PR is the full run: it shares the PR group, so a newer push cancels it');
  assert.equal(ugroup({ ...pr('labeled', [], { label: { name: 'auditor:ready' } }), head_ref: 'release-DB' }), 'unit-ci-7-inert-99', 'on a release-* candidate auditor:ready stays inert (DI/DH)');
  assert.equal(ugroup(pr('labeled', [], { label: { name: 'release:go' } })), 'unit-ci-7-inert-99');
  assert.match(readFileSync(U, 'utf8'), /\n {4}types: \[opened, synchronize, reopened, labeled\]\n/);
  // the plan sets `browser=true` only off a pull request or for a release-* candidate: a feature PR never runs a browser job
  const plan = readFileSync(Q, 'utf8');
  assert.match(plan, /== release-\* \]\]; then echo "browser=true"/);
  assert.ok(!/grep -q ',auditor:ready,'/.test(plan), 'the label no longer turns the browser jobs on');
});

test('adding auditor:ready runs the shard and the verdict (after static), not base and no browser job; any other label or a title edit runs nothing', () => {
  const added = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), {}, { plan: { game: 'true', browser: 'false' } });
  for (const j of ['quality-shard', 'quality']) assert.ok(added.has(j), j);
  for (const j of BROWSER) assert.ok(!added.has(j), `${j}: a feature PR runs no browser job`);
  assert.ok(!added.has('base'), 'base already ran on this head');
  for (const ev of [pr('labeled', ['release:go'], { label: { name: 'release:go' } }), pr('labeled', ['ci:release-checks'], { label: { name: 'ci:release-checks' } }), pr('edited', [], { changes: { title: {} } })]) {
    assert.deepEqual([...schedule(Q, withLabelNames(ev), {}, game)], [], `${ev.event.action} ${JSON.stringify(ev.event.label ?? ev.event.changes)} runs nothing`);
  }
  const retarget = schedule(Q, withLabelNames(pr('edited', [], { changes: { base: {} } })), {}, { plan: { game: 'true', browser: 'false' } });
  assert.ok(retarget.has('base') && retarget.has('static'), 'a retarget still re-runs static and base');
  assert.ok(schedule(Q, withLabelNames(pr('edited', ['auditor:ready'], { changes: { base: {} } })), {}, game).has('quality-shard'), 'and the shard once auditor:ready is on');
});

test('the concurrency group: every label event but auditor:ready on a feature PR, and a title edit, get a group of their own, so none cancels the head\'s gate in flight', () => {
  const g = /\nconcurrency:\n(?: {2}#[^\n]*\n)* {2}group: ([^\n]+)\n/.exec(readFileSync(Q, 'utf8'))![1];
  const group = (c: Ctx) => g.replace(/\$\{\{(.*?)\}\}/g, (_, e) => String(evalExpr(e.trim(), { ...c, run_id: '99' }, {})));
  assert.equal(group(pr('synchronize')), 'quality-7');
  assert.equal(group(pr('labeled', [], { label: { name: 'auditor:ready' } })), 'quality-7', 'the full run on a feature PR shares the PR group (a newer push cancels it)');
  assert.equal(group({ ...pr('labeled', [], { label: { name: 'auditor:ready' } }), head_ref: 'release-DB' }), 'quality-7-inert-99', 'on a release-* candidate it stays inert (DI/DH)');
  assert.equal(group(pr('labeled', [], { label: { name: 'release:go' } })), 'quality-7-inert-99');
  assert.equal(group(pr('edited', [], { changes: { title: {} } })), 'quality-7-inert-99');
  assert.equal(group(pr('edited', [], { changes: { base: {} } })), 'quality-7');
  assert.match(readFileSync(Q, 'utf8'), /\n {4}types: \[opened, synchronize, reopened, edited, labeled\]\n/);
});

test('DI/DH sequence (Lead 2026-10-13): a push, then a label, then the push\'s run is NOT cancelled; a second push still cancels the first; ci:release-checks stays in the head group', () => {
  const grp = (file: string, c: Ctx) => /\nconcurrency:\n(?: {2}#[^\n]*\n)* {2}group: ([^\n]+)\n/.exec(readFileSync(file, 'utf8'))![1].replace('${{ inputs.ref }}', '').replace(/\$\{\{(.*?)\}\}/g, (_, e) => String(evalExpr(e.trim(), { ...c, run_id: String(c.run_id ?? '99') }, {})));   // inputs.ref is only set by a dispatch
  const cancels = (file: string) => /\n {2}cancel-in-progress: ([^\n]+)\n/.exec(readFileSync(file, 'utf8'))![1];
  const cand = (action: string, label?: string, run = '1') => ({ ...pr(action, [], label ? { label: { name: label } } : {}), head_ref: 'release-DI', run_id: run });
  for (const [file, labels] of [[U, ['auditor:ready', 'ci:release-checks', 'candidate:pass', 'release:go']], [Q, ['auditor:ready', 'ci:release-checks', 'candidate:pass', 'release:go']], [R, ['auditor:ready', 'candidate:pass', 'release:go']]] as const) {
    const head = grp(file, cand('synchronize'));
    for (const l of labels) assert.notEqual(grp(file, cand('labeled', l, '2')), head, `${file}: ${l} must not share the head's group (it would cancel the push's run)`);
    assert.equal(grp(file, cand('synchronize', undefined, '3')), head, `${file}: a second push shares the group, so it cancels the first`);
    assert.match(cancels(file), /true|pull_request/, `${file}: the group cancels the superseded run`);
  }
  assert.equal(grp(R, cand('labeled', 'ci:release-checks', '4')), grp(R, cand('synchronize')), 'the ci:release-checks label is the real row run: it stays in the head group');
});

test('a trunk push is unchanged: no static job, every shard and browser job runs', () => {
  const push: Ctx = { event_name: 'push', ref: 'refs/heads/codex/01a09a76/task-1', event: {} };
  const ran = schedule(Q, push, {}, game);
  assert.ok(!ran.has('static'));
  for (const j of ['quality-shard', 'quality', 'load-time', 'browser', 'net-engines', 'duel-two-page']) assert.ok(ran.has(j), j);
  const unit = schedule(U, push);
  assert.ok(unit.has('shard') && unit.has('receipt') && !unit.has('static'), 'a trunk push gets its unit receipt (deploy.sh trusts it for the same tree)');
  assert.ok(schedule(U, { event_name: 'workflow_dispatch', ref: 'refs/heads/x', event: {} }).has('receipt'), 'a dispatch (a retargeted PR) gets its receipt too');
  assert.ok(schedule(U, push, { shard: 'failure' }).has('receipt'), 'a red shard: the receipt JOB runs and its guard step goes red (fail closed, hardening item 3); no receipt artifact is made, so nothing vouches for the tree');
});

test('fail closed (the Auditor on #2476): a red static or a red plan still runs the verdict job, so a skip never stands in for a red', () => {
  const cand = { ...pr('synchronize', ['auditor:ready']), head_ref: 'release-DX' };
  const unit = schedule(U, withLabelNames(cand), { static: 'failure' });
  assert.ok(!unit.has('shard'), 'a red static skips the shards');
  assert.ok(unit.has('receipt'), 'but the receipt job RUNS (its first step fails it): a skipped receipt reads as passing to a ruleset');
  assert.ok(!schedule(U, withLabelNames(pr('synchronize')), {}).has('receipt'), 'nothing meant to run (a feature PR without auditor:ready): the receipt stays skipped');
  assert.ok(schedule(U, { event_name: 'push', ref: 'refs/heads/codex/01a09a76/task-1', event: {} }).has('receipt'), 'a trunk push still gets its receipt');
  const rc = schedule(R, withLabelNames({ ...pr('synchronize', ['ci:release-checks']), head_ref: 'release-DX' }), { plan: 'failure' }, {});
  assert.ok(rc.has('summary'), 'a failed plan runs the summary (it goes red); before, it was skipped');
  assert.ok(!schedule(R, withLabelNames({ ...pr('synchronize', ['ci:release-checks']), head_ref: 'release-DX' }), {}, { plan: { checks: '[]' } }).has('summary'), 'an empty matrix still skips it (docs-only diff)');
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

test('a release-* head always runs the browser jobs; a feature PR never does (the label no longer turns them on) and says so in the quality summary', () => {
  assert.deepEqual(planOut({ HEAD_REF: 'release-2026-10-12-b' }), { browser: 'true', game: 'true' }, 'release-* synchronize without the label');
  assert.deepEqual(planOut({}), { browser: 'false', game: 'true' }, 'feature synchronize without the label');
  assert.deepEqual(planOut({ PR_LABELS: 'release:go,auditor:ready' }), { browser: 'false', game: 'true' }, 'auditor:ready no longer turns the browser jobs on (Lead 2026-10-13: they run in the release candidate)');
  assert.match(readFileSync(Q, 'utf8'), /needs\.plan\.outputs\.browser == 'false'\n {8}run: echo "browser jobs NOT run on this head[^\n]*GITHUB_STEP_SUMMARY/, 'the quality summary says it');
});

test('browser-rows commit status: SUCCESS on a feature push (the browser rows run in the release candidate), pending while the browser jobs of a game push run; success/failure on the SAME sha; release-* gets none', () => {
  const H = 'h'.repeat(40);
  // (a) every push: the status step is in plan, which runs on opened/synchronize/reopened/retarget and on adding auditor:ready; it is not gated on the action
  const statusIf = /- name: browser-rows status\n {8}if: ([^\n]+)\n/.exec(readFileSync(Q, 'utf8'))![1];
  assert.equal(statusIf, "github.event_name == 'pull_request' && !startsWith(github.head_ref, 'release-')");
  for (const a of ['opened', 'synchronize', 'reopened']) assert.ok(schedule(Q, withLabelNames(pr(a)), {}, game).has('plan'), `plan (and its status) on ${a}`);
  // (a)/(c) a push without the label: pending, waiting; with it: pending, running; no game path: success
  assert.match(planStatus({ GAME: 'true', BROWSER: 'false' })!, new RegExp(`statuses/${H} -f state=success -f context=browser-rows -f description=browser rows run in the release candidate`));
  assert.match(planStatus({ GAME: 'true', BROWSER: 'false' })!, /state=success/);
  assert.match(planStatus({ GAME: 'true', BROWSER: 'true' })!, /state=pending .*description=browser jobs running/);
  assert.match(planStatus({ GAME: 'false', BROWSER: 'false' })!, /state=success .*no browser rows needed/);
  // (b) the browser-rows job writes the verdict on the head sha it ran for (github.event.pull_request.head.sha, the same the plan used)
  assert.match(reportStatus('static=success load-time=success browser=success net-engines=success asset-rows=success duel-two-page=success')!, new RegExp(`statuses/${H} -f state=success`));
  assert.match(reportStatus('static=success load-time=success browser=failure net-engines=success asset-rows=success duel-two-page=success')!, /state=failure .*browser=failure/);
  assert.match(reportStatus('static=failure load-time=skipped browser=skipped net-engines=skipped asset-rows=skipped duel-two-page=skipped')!, /state=failure/, 'a red static is not a pass');
  const yml = readFileSync(Q, 'utf8');
  assert.equal((yml.match(/SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/g) || []).length, 2, 'plan and the verdict write on the same head sha');
  const ran = schedule(Q, withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })), {}, { plan: { game: 'true', browser: 'false' } });
  assert.ok(!ran.has('browser-rows'), 'a feature PR runs no browser jobs, so there is no browser verdict job either');
  assert.ok(!schedule(Q, withLabelNames(pr('synchronize')), {}, { plan: { game: 'true', browser: 'false' } }).has('browser-rows'), 'no verdict while waiting: it stays pending');
  // release-*: no pending status (it always runs the browser jobs, and they report as jobs)
  const rel = { ...withLabelNames(pr('synchronize')), head_ref: 'release-2026-10-12-b' };
  assert.ok(!evalExpr(statusIf, rel, {}), 'no status step on release-*');
  assert.ok(!schedule(Q, rel, {}, game).has('browser-rows'));
  assert.ok(!schedule(Q, { event_name: 'push', ref: 'r', event: {} }, {}, game).has('browser-rows'), 'a push writes no status');
});

test('release-checks on a candidate: adding any label but ci:release-checks schedules 0 jobs (Lead on CW: candidate:pass and release:go queued runs that read as pending)', () => {
  const cand = (action: string, label?: string): Ctx => ({ ...withLabelNames(pr(action, ['ci:release-checks', ...(label ? [label] : [])], label ? { label: { name: label } } : {})), head_ref: 'release-CW' });
  const rows = { plan: { checks: '[{"index":1}]' } };
  for (const l of ['candidate:pass', 'release:go', 'auditor:ready']) assert.deepEqual([...schedule(R, cand('labeled', l), {}, rows)], [], `${l} added: 0 jobs`);
  for (const j of ['plan', 'check', 'summary']) assert.ok(schedule(R, cand('labeled', 'ci:release-checks'), {}, rows).has(j), `ci:release-checks added: ${j} runs`);
  for (const j of ['plan', 'check', 'summary']) assert.ok(schedule(R, cand('synchronize'), {}, rows).has(j), `a push to the candidate: ${j} runs`);
  assert.ok(schedule(R, { event_name: 'workflow_dispatch', event: {} }, {}, rows).has('check'), 'a dispatch is unchanged');
});

test('a label event on a release-* candidate schedules 0 jobs in quality and unit-ci; the push/open run is the full one (cut applies the labels in the same second: EH ran 3 quality + 3 unit-ci runs, 2026-10-13)', () => {
  const cand = (action: string, label?: string): Ctx => ({ ...withLabelNames(pr(action, ['ci:release-checks', 'auditor:ready', ...(label ? [label] : [])], label ? { label: { name: label } } : {})), head_ref: 'release-EH' });
  const plan = { plan: { game: 'true', browser: 'true' } };
  for (const file of [Q, U]) for (const l of ['auditor:ready', 'ci:release-checks', 'candidate:pass', 'release:go']) assert.deepEqual([...schedule(file, cand('labeled', l), {}, plan)], [], `${file}: ${l} added to a candidate: 0 jobs`);
  const rows = { plan: { checks: '[{"index":1}]' } };
  assert.deepEqual([...schedule(R, cand('opened'), {}, rows)], [], 'release-checks: a candidate `opened` runs nothing (the label event is the run)');
  assert.ok(schedule(R, cand('labeled', 'ci:release-checks'), {}, rows).has('plan'), 'release-checks: the ci:release-checks label event is the real run');
  assert.ok(schedule(Q, cand('opened'), {}, plan).has('plan'), 'quality: the candidate open/push still runs the plan');
  assert.ok(schedule(Q, cand('synchronize'), {}, plan).has('quality-shard'), 'quality: a push to the candidate runs the shards');
  assert.ok(schedule(U, cand('synchronize'), {}, plan).has('shard'), 'unit-ci: a push to the candidate runs the shards');
  assert.ok(schedule(Q, { ...withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })) }, {}, plan).has('plan'), 'a feature PR still runs the full set when auditor:ready is added');
  assert.ok(schedule(U, { ...withLabelNames(pr('labeled', ['auditor:ready'], { label: { name: 'auditor:ready' } })) }).has('shard'), 'unit-ci: same on a feature PR');
test('unit-ci delta (Strategy 2026-10-14): an unchanged delta on a labelled feature PR skips the shards + origins-db (static still runs) and the receipt still reports; a changed or unknown delta, a release candidate and a trunk push run in full', () => {
  const labelled = withLabelNames(pr('synchronize', ['auditor:ready']));
  assert.deepEqual([...schedule(U, labelled, {}, { delta: { unchanged: 'true', patch_id: 'abc' } })].sort(), ['delta', 'receipt', 'static'], 'a clean merge-up: delta, static (still catches a break against new trunk code) and the receipt; no shard');
  for (const unchanged of ['false', '']) assert.ok(['static', 'shard', 'origins-db', 'receipt'].every(j => schedule(U, labelled, {}, { delta: { unchanged, patch_id: 'abc' } }).has(j)), `unchanged="${unchanged}": everything runs`);
  assert.ok(['static', 'shard', 'origins-db', 'receipt'].every(j => schedule(U, labelled, { delta: 'failure' }).has(j)), 'a failing delta job fails open: everything runs');
  const cand = { ...withLabelNames(pr('synchronize')), head_ref: 'release-EX' };
  const ranCand = schedule(U, cand, {}, { delta: { unchanged: 'true' } });
  assert.ok(!ranCand.has('delta') && ['static', 'shard', 'origins-db', 'receipt'].every(j => ranCand.has(j)), 'a release-* candidate never runs delta and always runs in full');
  const trunk: Ctx = { event_name: 'push', ref: 'refs/heads/codex/01a09a76/task-1', event: {} };
  const ranTrunk = schedule(U, trunk);
  assert.ok(!ranTrunk.has('delta') && ranTrunk.has('shard') && ranTrunk.has('receipt'), 'a trunk push runs the shards and the receipt as before');
});
