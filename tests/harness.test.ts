import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { DEBUG_HIDE_CSS, PHONE, phonePage, quietDebug, serveDist, waitForGame, writeReceipt } from '../scripts/lib/harness.mjs';

test('harness: QA_URL points a gate at a deployed site without starting a server, and close is still safe', async () => {
  const site = await serveDist({ QA_URL: 'https://example.invalid/' });
  assert.equal(site.url, 'https://example.invalid/');
  await site.close();
});

test('harness: the gates share one phone viewport', () => {
  assert.deepEqual(PHONE, { width: 393, height: 852 });
});

test('harness: writeReceipt creates the directory and pretty-prints the receipt', async () => {
  const dir = new URL('../artifacts/.harness-test/', import.meta.url), path = new URL('receipt.json', dir);
  rmSync(dir, { recursive: true, force: true });
  await writeReceipt(path.pathname, { passed: true, errors: [] });
  assert.ok(existsSync(path));
  assert.equal(readFileSync(path, 'utf8'), JSON.stringify({ passed: true, errors: [] }, null, 2));
  rmSync(dir, { recursive: true, force: true });
});

// Row 47 failed in 1 s on a2dd848c: the predicate ran before the body was parsed (goto waits for 'commit'), the null element threw,
// and the throw rejected waitForFunction instead of polling again. A missing element is "keep waiting", a present one is judged.
test('harness: waitForGame keeps polling while the attack button or art status is not in the DOM yet, and judges them once present', async () => {
  let predicate: ((art: boolean) => boolean) | undefined, passedArt: boolean | undefined, options: { timeout?: number } | undefined;
  const page = { waitForFunction: async (fn: (art: boolean) => boolean, art: boolean, opts: { timeout?: number }) => { predicate = fn; passedArt = art; options = opts; } };
  await waitForGame(page, { timeout: 5, art: true });
  assert.equal(passedArt, true); assert.deepEqual(options, { timeout: 5 });
  const elements = new Map<string, { getAttribute?: (name: string) => string | null; textContent?: string }>();
  const document = { querySelector: (selector: string) => elements.get(selector) ?? null };
  const had = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = document;
  try {
    assert.equal(predicate!(true), false, 'nothing parsed yet: keep waiting, not a throw');
    elements.set('#attack-button', { getAttribute: () => 'true' });
    assert.equal(predicate!(true), false, 'attack control present but disabled');
    elements.set('#attack-button', { getAttribute: () => 'false' });
    assert.equal(predicate!(true), false, 'enabled, but the art status line is not in the DOM yet: keep waiting');
    assert.equal(predicate!(false), true, 'without art the enabled control is enough');
    elements.set('#art-status', { textContent: 'Loading warriors…' });
    assert.equal(predicate!(true), false, 'art still loading');
    elements.set('#art-status', { textContent: '' });
    assert.equal(predicate!(true), true, 'both rigs loaded');
  } finally { if (had === undefined) delete (globalThis as { document?: unknown }).document; else (globalThis as { document?: unknown }).document = had; }
});

// Stills carry no debug overlay by default (Strategy 2026-10-12): the capture page injects a rule hiding #debug before the game paints; SHOW_DEBUG=1 opts in; the text stays readable.
test('harness: a capture page hides the debug overlay by default and SHOW_DEBUG=1 shows it', async () => {
  const run = async (env: Record<string, string>) => {
    const scripts: { fn: (css: string) => void; arg: string }[] = [];
    const page = { addInitScript: async (fn: (css: string) => void, arg: string) => { scripts.push({ fn, arg }); } };
    await quietDebug(page, env);
    return scripts;
  };
  const on = await run({});
  assert.equal(on.length, 1, 'default: one init script'); assert.equal(on[0]!.arg, DEBUG_HIDE_CSS); assert.match(DEBUG_HIDE_CSS, /#debug\s*\{\s*display:\s*none\s*!important/);
  const appended: string[] = [], had = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { head: { append: (el: { textContent: string }) => appended.push(el.textContent) }, createElement: () => ({ textContent: '' }) };
  try { on[0]!.fn(on[0]!.arg); } finally { (globalThis as { document?: unknown }).document = had; }
  assert.deepEqual(appended, [DEBUG_HIDE_CSS], 'the rule reaches the page head');
  assert.equal((await run({ SHOW_DEBUG: '1' })).length, 0, 'SHOW_DEBUG=1: the overlay is left alone');
  let used = 0; const browser = { newPage: async () => ({ setDefaultTimeout() {}, route: async () => {}, on() {}, addInitScript: async () => { used++; } }) };
  await phonePage(browser as never); assert.equal(used, 1, 'phonePage opts every gate page in');
});
