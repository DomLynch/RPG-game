// Free-space guard (Lead 2026-10-13, the Mac disk hit 100%): the cut and the release train refuse to start a candidate under 20 GiB free.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guard = (min: string, kib: string) => spawnSync('bash', ['scripts/lib/free-space.sh', min], { encoding: 'utf8', env: { ...process.env, FREE_SPACE_KIB: kib } });
const GIB = 1048576;

test('free-space.sh: passes at or above the minimum and prints the df line', () => {
  const ok = guard('20', String(25 * GIB));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^free space on \/System\/Volumes\/Data: /);
  assert.equal(guard('20', String(20 * GIB)).status, 0);
});

test('free-space.sh: refuses under the minimum and says how much is free', () => {
  const low = guard('20', String(19 * GIB));
  assert.equal(low.status, 1);
  assert.match(low.stderr, /19 GiB free is under the 20 GiB minimum/);
});

test('the cut and the release train both run the guard, the train before it takes the hold and without stopping when the helper is absent', () => {
  const cut = readFileSync('scripts/cut-release.mjs', 'utf8'), train = readFileSync('scripts/release-train-publish.sh', 'utf8');
  assert.match(cut, /scripts\/lib\/free-space\.sh/);
  assert.ok(cut.indexOf('free-space.sh') < cut.indexOf("git(['fetch', '-q', 'origin'])"), 'the cut checks before it fetches');
  assert.match(train, /\[ -r scripts\/lib\/free-space\.sh \] && ! space=/);
  assert.ok(train.indexOf('free-space.sh') < train.indexOf('echo "$$" > "$hold"'), 'the train checks before it takes the hold');
  assert.match(train, /not publishing: \$space"; exit 0/, 'a low disk makes the tick wait, it does not stop the train');
});
