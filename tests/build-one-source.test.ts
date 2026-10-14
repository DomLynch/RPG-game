import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FREE_RESPREAD_LEVEL, RANK_LEVELS } from '../src/core/build-model.ts';

test('re-spread numbers: the client model holds them (10 and 10) and the server file keeps no second copy', () => {
  assert.deepEqual([FREE_RESPREAD_LEVEL, RANK_LEVELS], [10, 10]);
  const server = readFileSync(new URL('../origins/server/build.ts', import.meta.url), 'utf8');
  assert.match(server, /import \{ FREE_RESPREAD_LEVEL, RANK_LEVELS \} from '..\/..\/src\/core\/build-model\.ts'/);
  assert.doesNotMatch(server, /(FREE_RESPREAD_LEVEL|RANK_LEVELS)\s*=\s*\d/);
});
