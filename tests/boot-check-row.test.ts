import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const gate = JSON.parse(readFileSync(new URL('../.quality-gate.json', import.meta.url), 'utf8')) as { release_commands: string[][] };
const script = 'scripts/origins-writer-boot-check.sh';
const index = gate.release_commands.findIndex((c) => c.includes(script)) + 1;

test('the writer boot check is a release row that runs the script on the release checkout (no rev argument)', () => {
  assert.ok(index > 0, 'a release row runs scripts/origins-writer-boot-check.sh');
  assert.deepEqual(gate.release_commands[index - 1], ['bash', script]);
});

test('the boot-check row is named by its script and picked for the writer\'s door files at deploy and on a PR', () => {
  const deploy = (file: string) => spawnSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip'], { input: file, encoding: 'utf8' }).stderr;
  const pr = (file: string) => spawnSync('node', ['scripts/release-rows-for.mjs', file], { encoding: 'utf8' }).stdout;
  // loot.ts and duel.ts are deep in the writer's runtime closure (Auditor on #2116): a page import added there would ship without the row if the table listed files by hand.
  for (const file of ['src/fight/index.ts', 'src/fight/server.ts', 'src/fight/loot.ts', 'src/fight/duel.ts', 'origins/preview/mobs.ts', 'scripts/origins-writer.mjs']) {
    assert.match(deploy(file), new RegExp(`\\b${index} origins-writer-boot-check\\b`), `${file} runs the boot check at deploy`);
  }
  for (const file of ['origins/preview/mobs.ts', 'src/fight/loot.ts', 'src/fight/duel.ts', 'scripts/origins-writer.mjs', script]) {
    assert.match(pr(file), new RegExp(`^${index} origins-writer-boot-check$`, 'm'), `${file} runs it on the PR`);
  }
  assert.doesNotMatch(deploy('src/fight/hud.ts'), /origins-writer-boot-check/, 'an unrelated page file does not');
});

test('when the writer closure cannot be computed the boot-check row still runs, at deploy and on a PR (fail closed), but not for docs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rows-failclosed-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    for (const f of ['scripts/release-rows-for.mjs', 'scripts/writer-closure.mjs', '.quality-gate.json']) copyFileSync(f, join(dir, f));
    const run = (args: string[], input?: string) => spawnSync('node', ['scripts/release-rows-for.mjs', ...args], { cwd: dir, input, encoding: 'utf8' });
    const want = new RegExp(`\\b${index} origins-writer-boot-check\\b`);
    assert.match(run(['--deploy-skip'], 'src/fight/hud.ts').stderr, want, 'deploy runs it when the walk fails');
    assert.match(run(['src/fight/hud.ts']).stdout, want, 'a PR runs it when the walk fails');
    assert.doesNotMatch(run(['--deploy-skip'], 'docs/state/backend.md').stderr, /origins-writer-boot-check/, 'docs alone do not at deploy');
    assert.doesNotMatch(run(['docs/state/backend.md']).stdout, /origins-writer-boot-check/, 'docs alone do not on a PR');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
