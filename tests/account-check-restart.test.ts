// scripts/account-browser-check.mjs: the sign-in merge restarts the page (src/account.ts refresh(merge) ends in location.replace), so the
// check must not read the page between the code-return goto and the restart's own load. J4a run 1 (row 14, load 30) read it in between:
// "Execution context was destroyed ... navigation". Pin the order: load counter attached, goto, wait for the second load, then anything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../scripts/account-browser-check.mjs', import.meta.url), 'utf8');
const merge = readFileSync(new URL('../src/account.ts', import.meta.url), 'utf8');

test('the sign-in merge still ends in a full restart (otherwise this wait is wrong, not merely slow)', () => {
  assert.match(merge, /else if \(merge\) \{[\s\S]*?location\.replace\(target\.href\); return;/);
});

test('the account check reads nothing between the merge sign-in and the restart\'s own load', () => {
  const go = script.indexOf("await page.goto(`${origin}/?account=return&code=qa-code`)");
  assert.ok(go > 0, 'the merge sign-in goto');
  assert.equal(script.indexOf('account=return&code=', go + 1), -1, 'one merge sign-in; a second one needs the same wait');
  const counter = script.lastIndexOf("page.on('load'", go);
  assert.ok(counter > 0 && counter < go, 'the load counter is attached before the goto, so the first load is counted');
  const wait = script.indexOf('loads < 2', go);
  const nextRead = Math.min(...['page.evaluate(', 'page.waitForFunction(', 'ready(page)', 'page.locator('].map((s) => script.indexOf(s, go)).filter((i) => i > 0));
  assert.ok(wait > go && wait < nextRead, 'the wait for the second load comes before the first read of the page after the goto');
});
