import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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
  for (const file of ['src/fight/index.ts', 'src/fight/server.ts', 'origins/preview/mobs.ts', 'scripts/origins-writer.mjs']) {
    assert.match(deploy(file), new RegExp(`\\b${index} origins-writer-boot-check\\b`), `${file} runs the boot check at deploy`);
  }
  for (const file of ['origins/preview/mobs.ts', 'scripts/origins-writer.mjs', script]) {
    assert.match(pr(file), new RegExp(`^${index} origins-writer-boot-check$`, 'm'), `${file} runs it on the PR`);
  }
  assert.doesNotMatch(deploy('src/fight/hud.ts'), /origins-writer-boot-check/, 'an unrelated page file does not');
});
