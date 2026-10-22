// A merge once left `ambience?.update(dt); goblinSmoke?.update(dt);` twice in the walk loop, so zone 90's smoke and ambience ran at double speed (Auditor, #3258). Each per-frame updater runs once.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the walk loop updates the ambience and the goblin smoke exactly once per frame', () => {
  const src = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
  // Re-pinned (web/lights-ab, 2026-10-22): the smoke update now takes the walker (`state`) so ?torchlights=N can keep the N nearest fires lit; the pin is the same: one call per frame.
  for (const call of ['ambience?.update(dt)', 'goblinSmoke?.update(dt, state)']) assert.equal(src.split(call).length - 1, 1, `${call} appears once in main.ts`);
});
