// The gate's light across the reload after a win (src/gate-light.ts, public/gate-light.js; Dom's phone test 2026-09-30, Lead's conditions):
// it shows ONLY on the flag, the flag is read once, a store that throws changes nothing, and the light always comes down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GATE_LIGHT_KEY, armGateLight, clearGateLight, nextRungFiles, prefetchFiles } from '../src/gate-light.ts';

const classes = () => { const set = new Set<string>(); return { set, classList: { toggle: (n: string, on: boolean) => { if (on) set.add(n); else set.delete(n); }, contains: (n: string) => set.has(n) } }; };
const store = (initial: Record<string, string> = {}) => { const data = { ...initial }; return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, removeItem: (k: string) => { delete data[k]; } }; };
const throwing = () => { throw new Error('SecurityError: storage is blocked'); };
// The new document's first script, run as the browser runs it: a classic file with `document`, `sessionStorage` and `setTimeout` in scope.
function boot(sessionStorage: unknown) {
  const root = classes(), timers: [() => void, number][] = [];
  const context: Record<string, unknown> = { document: { documentElement: root }, setTimeout: (run: () => void, ms: number) => { timers.push([run, ms]); } };
  if (sessionStorage === 'blocked') Object.defineProperty(context, 'sessionStorage', { get: throwing });
  else context.sessionStorage = sessionStorage;
  vm.runInNewContext(fs.readFileSync(new URL('../public/gate-light.js', import.meta.url), 'utf8'), context);
  return { root, timers };
}

test('the new document: no flag, no light (a first visit, a kill link, a returning player, a plain reload stay as they are)', () => {
  for (const s of [store(), store({ 'frankendom.fighter.v1': '{}' }), store({ [GATE_LIGHT_KEY]: '0' })]) {
    const { root, timers } = boot(s);
    assert.deepEqual([...root.set], []);
    assert.equal(timers.length, 0, 'and no timer is left behind');
  }
});

test('the new document: the flag puts the light up before anything paints, and is read once', () => {
  const s = store({ [GATE_LIGHT_KEY]: '1' });
  const first = boot(s);
  assert.deepEqual([...first.root.set], ['gate-light']);
  assert.equal(s.data[GATE_LIGHT_KEY], undefined, 'cleared on read');
  assert.deepEqual([...boot(s).root.set], [], 'the next load of the same tab has no light');
});

test('the new document: storage that throws is today\'s behaviour, never a light', () => {
  for (const s of ['blocked', { getItem: throwing, removeItem: throwing }, { getItem: () => '1', removeItem: throwing }]) {
    const { root, timers } = boot(s);
    assert.deepEqual([...root.set], [], 'no light when the flag cannot be read and cleared');
    assert.equal(timers.length, 0);
  }
});

test('the light always comes down: on the arena\'s first frame, or after 8 s if the game never draws', () => {
  // A boot that fails: only the script's own timer is left, and it takes the light down with its fade.
  const failed = boot(store({ [GATE_LIGHT_KEY]: '1' }));
  assert.deepEqual(failed.timers.map(([, ms]) => ms), [8000]);
  failed.timers[0]![0]();
  assert.deepEqual([...failed.root.set], ['gate-light-out']);
  // A boot that draws: main.ts clears it on the first frame; the script's timer then finds nothing to do, and the fade class goes too.
  const drawn = boot(store({ [GATE_LIGHT_KEY]: '1' })), later: [() => void, number][] = [];
  clearGateLight(drawn.root, () => store(), (run, ms) => later.push([run, ms]));
  assert.deepEqual([...drawn.root.set], ['gate-light-out']);
  later[0]![0]();
  assert.deepEqual([...drawn.root.set], []);
  drawn.timers[0]![0]();
  assert.deepEqual([...drawn.root.set], [], 'the 8 s timer after a normal clear puts nothing back');
});

test('the page he leaves: the light goes up with the flag; a store that refuses it means no light at all', () => {
  const root = classes(), s = store();
  assert.equal(armGateLight(root, () => s), true);
  assert.deepEqual([[...root.set], s.data[GATE_LIGHT_KEY]], [['gate-light'], '1']);
  const dark = classes();
  assert.equal(armGateLight(dark, throwing), false);
  assert.equal(armGateLight(dark, () => ({ setItem: throwing })), false);
  assert.deepEqual([...dark.set], [], 'no light the next document could not know about');
  // A reload that never came: clearing drops the flag too, so a later plain reload has no light.
  clearGateLight(root, () => s, () => undefined);
  assert.equal(s.data[GATE_LIGHT_KEY], undefined);
  assert.doesNotThrow(() => clearGateLight(classes(), throwing));
});

test('the next rung\'s files: the rig, and the rank look off the phone tier; fetched as bytes at low priority, a failure is nothing', async () => {
  assert.deepEqual(nextRungFiles('/assets/goblin-abc.glb', '/looks/goblin-L3.glb', false), ['/assets/goblin-abc.glb', '/looks/goblin-L3.glb']);
  assert.deepEqual(nextRungFiles('/assets/goblin-abc.glb', '/looks/goblin-L3.phone.glb', true), ['/assets/goblin-abc.glb'], 'the phone tier takes the rig alone');
  assert.deepEqual(nextRungFiles(undefined, undefined, false), []);
  const asked: [string, unknown][] = []; let read = 0;
  await prefetchFiles(['/a.glb', '/gone.glb'], async (url, init) => { asked.push([url, (init as { priority?: string }).priority]); if (url === '/gone.glb') throw new TypeError('Load failed'); return { arrayBuffer: async () => { read++; } }; });
  assert.deepEqual(asked, [['/a.glb', 'low'], ['/gone.glb', 'low']]);
  assert.equal(read, 1, 'the body is read to the end so the cache keeps it');
});
