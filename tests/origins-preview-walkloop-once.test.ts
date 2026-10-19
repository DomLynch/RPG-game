// A merge once left `ambience?.update(dt); goblinSmoke?.update(dt);` twice in the walk loop, so zone 90's smoke and ambience ran at double speed (Auditor, #3258). Each per-frame updater runs once.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the walk loop updates the ambience and the goblin smoke exactly once per frame', () => {
  const src = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
  for (const call of ['ambience?.update(dt)', 'goblinSmoke?.update(dt)']) assert.equal(src.split(call).length - 1, 1, `${call} appears once in main.ts`);
});
