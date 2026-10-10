// The box's five node services (systemd ExecStart) run under plain node with no `three` installed. Release AA crash-looped it because origins/preview/mobs.ts
// (loaded by origins/server/world-spawns.ts) took SPEEDS from the page door src/fight/index.ts, which re-exports characters.ts -> 'three'. The K7 test only guards
// src/fight/server.ts's own closure; this walks the WRITER's RUNTIME imports (type-only imports are erased by node, so they do not load anything).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { SERVER_ENTRIES as ENTRIES, writerClosure } from '../scripts/writer-closure.mjs';

const BANNED_FILES = ['src/fight/index.ts'];
const BANNED_PACKAGES = /^three(\/|$)/;

const disk = (f: string): string => readFileSync(f, 'utf8');

test('no server entry\'s runtime closure reaches the page door src/fight/index.ts or the three package', () => {
  for (const entry of ENTRIES) {
    const { files, packages } = writerClosure(disk, existsSync, entry);
    assert.ok(files.includes(entry), `${entry}: the walk did not start at the entry`);
    assert.deepEqual(files.filter((f) => BANNED_FILES.includes(f)), [], `${entry} loads src/fight/index.ts: take src/fight/server.ts (re-exports only, no renderer)`);
    assert.deepEqual(packages.filter((p) => BANNED_PACKAGES.test(p)), [], `${entry} loads three, which is not installed on the box`);
  }
});

test('the writer walk reaches the files the AA crash came through', () => {
  const { files } = writerClosure(disk, existsSync);
  for (const must of ['origins/server/world-spawns.ts', 'origins/preview/mobs.ts', 'src/fight/server.ts', 'src/fight/speeds.ts']) assert.ok(files.includes(must), `the walk no longer reaches ${must}: the entry or the import pattern broke`);
});

test('the walk goes red on the AA mistake (mobs.ts taking the page door) and ignores type-only imports', () => {
  const real = (f: string): string => disk(f);
  const bad = (f: string): string => f === 'origins/preview/mobs.ts' ? real(f).replace('src/fight/server.ts', 'src/fight/index.ts') : real(f);
  assert.ok(writerClosure(bad, existsSync).files.includes('src/fight/index.ts'), 'the AA import must pull the page door into the closure');
  const typeOnly = (f: string): string => f === 'origins/preview/mobs.ts' ? `import type { X } from '../../src/fight/index.ts';\n${real(f)}` : real(f);
  assert.ok(!writerClosure(typeOnly, existsSync).files.includes('src/fight/index.ts'), 'a type-only import loads nothing and must not count');
});
