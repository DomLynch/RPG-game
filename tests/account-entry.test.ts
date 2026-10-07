import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Incident 2026-10-07 10:05: an iPhone tab opened before a publish lazy-loaded the previous release's hashed account chunk (404) and showed a dead
// "Account unavailable" with Google greyed. A failed chunk import now says a new version is ready and its button reloads; a mount failure keeps the retry.
test('the account chunk failing to load offers a reload, not a dead retry; a mount failure still retries', () => {
  const src = readFileSync(new URL('../src/account-entry.ts', import.meta.url), 'utf8');
  const imp = src.match(/try \{ \(\{ mountAccount \} = await import\('\.\/account\.ts'\)\); \}\s*catch \{([^}]*)\}/);
  assert.ok(imp, 'the dynamic import has its own catch');
  assert.match(imp![1], /stale = true/); assert.match(imp![1], /tapped && !fightOn\(\) && autoReload\(/, 'only a tap, and never while a fight is in progress (frankendom.fight.v1), may reload by itself'); assert.match(imp![1], /A new version is ready\. Tap to reload/); assert.match(imp![1], /retry\.textContent = 'Reload'/); assert.match(imp![1], /getElementById\('account-login'\)!\.hidden = true/, 'no greyed Google button');
  assert.match(src, /frankendom\.fight\.v1/, 'the fight-in-progress key is main.ts AFK_KEY');
  assert.match(src, /retry\.addEventListener\('click', \(\) => \{ if \(stale\) location\.reload\(\); else if \(!started\) void start\(true\); \}\)/, 'stale: the button reloads');
  assert.match(src, /try \{ await mountAccount\(url, key\); \}\s*catch \{ started = false; status\.textContent = 'Account unavailable\./, 'a mount failure keeps the ordinary retry');
  assert.doesNotMatch(src, /location\.reload\(\);\s*\n\s*(const|let)/, 'never an automatic reload (it could land mid-fight)');
});

import { autoReload, installChunkRecovery, isChunkError } from '../src/chunk-recover.ts';

test('a failed lazy chunk is recognised in the three browsers\' words', () => {
  for (const m of ['Failed to fetch dynamically imported module: https://frankendom.com/assets/account-abc.js', 'error loading dynamically imported module', 'Importing a module script failed.', 'Unable to preload CSS for /assets/pit-1.css'])
    assert.equal(isChunkError(new TypeError(m)), true, m);
  assert.equal(isChunkError(new Error('network down')), false); assert.equal(isChunkError(undefined), false);
});

test('the reload happens once per five minutes and the stamp is written before it, so a still-dead chunk never loops', () => {
  const mem = new Map<string, string>(), store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  let reloads = 0; const reload = () => { reloads++; };
  assert.equal(autoReload(store, 1_000_000, reload), true); assert.equal(reloads, 1);
  assert.equal(autoReload(store, 1_000_000 + 60_000, reload), false, 'a minute later: the bar, not another reload'); assert.equal(reloads, 1);
  assert.equal(autoReload(store, 1_000_000 + 5 * 60_000 + 1, reload), true, 'a later publish in the same tab may reload again'); assert.equal(reloads, 2);
  assert.equal(autoReload(null, 9e9, reload), false, 'no storage: never risk a loop');
  const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} }; assert.equal(autoReload(blocked, 9e9, reload), false);
});

test('a chunk that 404s with nothing awaiting it shows the Tap-to-reload bar, never an automatic reload', () => {
  const listeners = new Map<string, (e: Event) => void>(), added: { id: string; text: string; click?: () => void }[] = []; let reloads = 0;
  const doc = { getElementById: (id: string) => added.find((a) => a.id === id) ?? null, createElement: () => { const el: { id?: string; textContent?: string; click?: () => void; style: object; addEventListener: (t: string, f: () => void) => void } = { style: {}, addEventListener: (_: string, f: () => void) => { el.click = f; } }; return el; }, body: { appendChild: (el: { id?: string; textContent?: string; click?: () => void }) => added.push({ id: el.id ?? '', text: el.textContent ?? '', click: el.click }) } };
  installChunkRecovery({ addEventListener: (t: string, f: (e: Event) => void) => { listeners.set(t, f); }, document: doc as unknown as Document, location: { reload: () => { reloads++; } } as unknown as Location });
  listeners.get('unhandledrejection')!({ reason: new Error('boring') } as unknown as Event); assert.equal(added.length, 0, 'an unrelated rejection is left alone');
  let prevented = false; listeners.get('vite:preloadError')!({ preventDefault: () => { prevented = true; } } as unknown as Event);
  assert.equal(added.length, 1); assert.match(added[0].text, /Tap to reload/); assert.equal(prevented, false, 'the real import error still reaches its caller'); assert.equal(reloads, 0, 'no automatic reload mid-fight');
  listeners.get('unhandledrejection')!({ reason: new TypeError('Failed to fetch dynamically imported module: /assets/pit-x.js') } as unknown as Event); assert.equal(added.length, 1, 'one bar, not a stack');
  added[0].click!(); assert.equal(reloads, 1, 'the tap reloads');
});
