// Lead 2026-10-10: a PR runs only the heavy CI jobs its diff needs; trunk pushes run everything (deploy.sh reads `quality` + `browser (combat)` from them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
