// The Zone 1 "Sign in" link is a thumb target of at least 44 x 44 px (Web 375 pass, 2026-10-09: it was 45 x 30).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
test('the Sign in link is at least 44 x 44 px', () => {
  const css = main.split('\n').find((l) => l.includes("a.textContent = 'Sign in'")) ?? '';
  assert.match(css, /min-height:44px/); assert.match(css, /min-width:44px/);
});
