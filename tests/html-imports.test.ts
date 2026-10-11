// A page outside the typecheck can import a module that moved and nothing notices until a browser row loads it: character-preview.html kept
// `from '/src/camera.ts'` after #2126 moved the file to src/fight/camera.ts, so rows 18 and 29 timed out for a day (release AY, 2026-10-11).
// Every root .html page: each absolute /src/... import must exist on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const PAGES = readdirSync('.').filter(f => f.endsWith('.html'));
const IMPORT = /(?:from\s*|import\s*\(\s*|import\s+)['"](\/src\/[^'"?]+)['"]/g;

test('the root pages are found', () => {
  assert.ok(PAGES.includes('character-preview.html') && PAGES.includes('index.html'), `pages: ${PAGES.join(', ')}`);
});
test('every absolute /src/ import in a root .html page points at a file that exists', () => {
  const missing: string[] = [];
  for (const page of PAGES) for (const [, path] of readFileSync(page, 'utf8').matchAll(IMPORT)) if (!existsSync(`.${path}`)) missing.push(`${page} imports ${path}`);
  assert.deepEqual(missing, [], 'a moved module left a page importing a path that is gone');
});
test('the guard catches a stale import (the pattern, not the files)', () => {
  const stale = `import { cameraPose } from '/src/camera.ts';`;
  assert.deepEqual([...stale.matchAll(IMPORT)].map(m => m[1]), ['/src/camera.ts']);
  assert.equal(existsSync('./src/camera.ts'), false, 'src/camera.ts is gone, so this exact import is the failure the guard exists for');
});
