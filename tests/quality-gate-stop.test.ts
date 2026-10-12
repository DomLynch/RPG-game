// .quality-gate.json completion_commands run in every lane's Stop hook, on a loaded VPS or the shared Mac. A browser row there trapped
// Deploy B in its Stop hook for ~2 h on 2026-10-12 (sparring-browser-check hit the 420 s limit again and again). Browser rows run on
// GitHub (release-checks) and in every release; the Stop gate keeps only fast, browser-free checks (Lead 2026-10-12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8')) as { completion_commands: string[][]; release_commands: string[][] };

test('no Stop-gate completion command is a browser check (by name or by a playwright import in the script it runs)', () => {
  for (const argv of gate.completion_commands) {
    const line = argv.join(' ');
    assert.doesNotMatch(line, /browser|playwright|webkit|chromium/i, `browser row in completion_commands: ${line}`);
    for (const file of argv.filter((a) => /\.(m?[jt]s)$/.test(a) && existsSync(a))) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /from ['"](@?playwright)|require\(['"]@?playwright/, `${file} launches playwright`);
    }
  }
});

test('the sparring browser check still runs at release', () => {
  assert.ok(gate.release_commands.some((argv) => argv.includes('scripts/sparring-browser-check.mjs')), 'release_commands keeps sparring-browser-check');
});
