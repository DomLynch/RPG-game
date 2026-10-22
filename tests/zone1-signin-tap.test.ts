// The Zone 1 "Sign in" link is a thumb target of at least 44 x 44 px (Web 375 pass, 2026-10-09: it was 45 x 30).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8'), html = readFileSync(new URL('../origins/preview/index.html', import.meta.url), 'utf8');
// The 44 px target is the link's CSS hit area (#hud .hud-link::before, a 44 x 44 px box centred on the text), so the header's lines stay tight (Dom 2026-10-22, town first impression).
test('the Sign in link is at least 44 x 44 px', () => {
  const line = main.split('\n').find((l) => l.includes("a.textContent = 'Sign in'")) ?? '';
  assert.match(line, /a\.className = 'hud-link'/, 'the Sign in link takes the hit-area class');
  const rule = html.split('\n').find((l) => l.includes('#hud .hud-link::before')) ?? '';
  assert.match(rule, /min-width: 44px/); assert.match(rule, /min-height: 44px/);
  assert.match(rule, /position: absolute/); assert.match(rule, /translate\(-50%, -50%\)/, 'centred on the link text');
  assert.match(html, /#hud \.hud-link \{[^}]*position: relative/, 'the link is the hit area\'s positioning parent');
});
