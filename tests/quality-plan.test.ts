// Lead 2026-10-10: a PR runs only the heavy CI jobs its diff needs; trunk pushes run everything (deploy.sh reads `quality` + `browser (combat)` from them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const text = readFileSync('.github/workflows/quality.yml', 'utf8');
const jobBlock = (name: string) => { const i = text.indexOf(`\n  ${name}:\n`); assert.ok(i >= 0, `quality.yml has no job ${name}`); const rest = text.slice(i + 1); const next = rest.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/); return next < 0 ? rest : rest.slice(0, next + 1); };
const gameRe = (() => { const m = /GAME_RE='([^']+)'/.exec(jobBlock('plan')); assert.ok(m, 'plan job defines GAME_RE'); return new RegExp(m[1]); })();

test('the heavy jobs wait for the plan and run on a PR only when it says the diff touches game paths; push always runs them', () => {
  for (const job of ['load-time', 'browser', 'net-engines', 'asset-rows', 'duel-two-page']) {
    const block = jobBlock(job);
    assert.match(block, /\n    needs: plan\n/, `${job} needs plan`);
    assert.match(block, /github\.event_name != 'pull_request' \|\| needs\.plan\.outputs\.game == 'true'/, `${job} is gated on the plan, and a push is not`);
  }
  const quality = jobBlock('quality');
  assert.doesNotMatch(quality, /needs: plan/, '`quality` (lint, tsc, every test, build) runs on every PR');
  assert.match(jobBlock('plan'), /GITHUB_EVENT_NAME" != pull_request[^\n]*game=true/, 'a trunk push runs everything');
});

test('GAME_RE: game, asset, gate and net paths run the heavy jobs; docs, tests, deploy scripts and data-only diffs do not', () => {
  for (const f of ['src/fight/sim.ts', 'public/img/x.webp', 'origins/zones/a.ts', 'index.html', 'package.json', 'vite.config.ts', 'scripts/browser-check.mjs', 'scripts/lib/harness.mjs', 'scripts/check-budget.mjs', 'tests/fixtures/a.json', 'models/goblin.glb', '.github/workflows/quality.yml']) assert.match(f, gameRe, `${f} runs the heavy jobs`);
  for (const f of ['docs/state/deploy.md', 'README.md', 'tests/vps-receipts.test.ts', 'scripts/deploy.sh', 'scripts/lib/deploy-vps.sh', 'scripts/vps-shadow/launch.mjs', '.quality-gate.json', 'data/legends.json', 'deploy/frankendom.com.conf', '.github/workflows/release-checks.yml']) assert.doesNotMatch(f, gameRe, `${f} skips them`);
});

test('every script a gated job runs, plus everything it imports with a relative path, matches GAME_RE (a change to it must not skip the gate)', () => {
  const roots = new Set<string>();
  for (const job of ['load-time', 'browser', 'net-engines', 'asset-rows', 'duel-two-page']) {
    for (const m of jobBlock(job).matchAll(/(scripts\/[\w./-]+\.(?:mjs|sh))/g)) roots.add(m[1]);
  }
  for (const f of readdirSync('scripts')) if (/-polish-check\.mjs$/.test(f)) roots.add(`scripts/${f}`);   // asset-rows runs `scripts/*-polish-check.mjs`
  assert.ok(roots.size >= 8, `found the gated scripts: ${[...roots].join(' ')}`);
  const seen = new Set<string>(), queue = [...roots];
  while (queue.length) {
    const f = queue.pop() as string;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const p = normalize(join(dirname(f), m[1]));
      const hit = [p, `${p}.mjs`, `${p}.js`, `${p}.ts`].find((c) => existsSync(c));
      if (hit) queue.push(hit);
    }
  }
  for (const f of [...seen].sort()) assert.match(f, gameRe, `${f} is run or imported by a gated job but GAME_RE would skip the job when only it changes`);
});

test('the plan lists a renamed file under its old path too', () => {
  assert.match(jobBlock('plan'), /\.filename, \(\.previous_filename \/\/ empty\)/);
});

test('a trunk push never cancels the run in progress; a pull request still cancels its superseded run (a batch head\'s run must finish)', () => {
  assert.match(text, /\nconcurrency:\n(?:  #[^\n]*\n)*  group: [^\n]*\n(?:  #[^\n]*\n)*  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/);
  assert.doesNotMatch(text, /cancel-in-progress: true/);
});
