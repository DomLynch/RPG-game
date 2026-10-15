// The ground-loot pickup prompt (slice 3, Backend's #2775 plan): the rows load and a bad one is refused; the prompt is for the nearest visible, available item inside the row's own radius; the tap is one
// ground_take for the character and nothing else; and the three outcomes each do their one thing: a take (hide, pack read again, pickup cue), a lost race (refuse cue and a line) and the switch off (a quiet "not now").
import test from 'node:test';
import assert from 'node:assert/strict';
import RULES from '../origins/preview/ground-pickup.json' with { type: 'json' };
import { createGroundPickup, loadPickupRules, PICKUP, staticRows, type GroundDeps } from '../origins/preview/ground-pickup.ts';
import { readGround, stateOf, takeGround, type GroundRow } from '../origins/preview/ground-net.ts';
import { groundPointOf } from '../origins/world/ground-point.ts';
import { GROUND_ITEMS } from '../origins/world/ground-items.ts';

const ID = 'ground:zone1.rusty-sword-1', ITEM = 'item:starter.rusty-sword';
const row = (edit: Partial<GroundRow> = {}): GroundRow => ({ ...staticRows()[0]!, ...edit });
const at = groundPointOf(GROUND_ITEMS[ID]!)!;
const edited = (edit: (f: Record<string, any>) => void) => { const r = JSON.parse(JSON.stringify(RULES)); edit(r.groundPickup[0].fields); return r; };

function rig(over: Partial<GroundDeps> = {}) {
  const log = { shown: [] as string[], hidden: [] as string[], cues: [] as string[], said: [] as string[], taken: [] as string[], packReads: 0, reads: 0 };
  let rows: GroundRow[] = [row()];
  const deps: GroundDeps = {
    view: { show: (id) => log.shown.push(id), hide: (id) => log.hidden.push(id) }, signedIn: () => true, nameOf: () => 'Rusty Sword',
    read: async () => { log.reads++; return { items: rows }; },
    take: async (i) => { log.taken.push(i); return { instance: i, item: ITEM, qty: 1 }; },
    refreshPack: async () => { log.packReads++; }, cue: (k) => log.cues.push(k), say: (l) => log.said.push(l), ...over,
  };
  return { log, deps, g: createGroundPickup(deps), set: (r: GroundRow[]) => { rows = r; } };
}

test('the shipped row loads: a poll period, labels that name the item, and a line for every refusal the writer sends', () => {
  assert.ok(PICKUP.pollSec >= 1);
  for (const l of Object.values(PICKUP.labels)) assert.ok(l.includes('{item}'));
  for (const code of ['taken', 'off', 'have-it', 'full', 'away', 'unchecked', 'stale', 'offline']) assert.ok(PICKUP.outcomes[code]!.line.length > 0, code);
  assert.equal(PICKUP.outcomes.taken!.cue, 'refuse'); assert.equal(PICKUP.outcomes.off!.cue, null);
});
test('the loader refuses a poll period below 1, a label without the {item}, an unknown cue and a missing fallback', () => {
  assert.throws(() => loadPickupRules(edited((f) => { f.pollSec = 0; })), /pollSec/);
  assert.throws(() => loadPickupRules(edited((f) => { f.labels.take = 'Take it'; })), /labels\.take/);
  assert.throws(() => loadPickupRules(edited((f) => { f.outcomes.taken.cue = 'boom'; })), /cue/);
  assert.throws(() => loadPickupRules(edited((f) => { delete f.outcomes.offline; })), /offline/);
  assert.throws(() => loadPickupRules(edited((f) => { f.outcomes.full.line = ' '; })), /line of text/);
});

test('the prompt is the nearest visible, available item inside its own radius, and says its name', async () => {
  const { g, set } = rig(); await g.refresh();
  const r = row().radiusM;
  assert.deepEqual(g.nearest(at.x, at.z), { instance: ID, label: 'Take the Rusty Sword' });
  assert.equal(g.nearest(at.x + r - 0.01, at.z)?.instance, ID, 'inside the radius');
  assert.equal(g.nearest(at.x + r + 0.01, at.z), null, 'outside the row\'s radius: no prompt');
  set([row({ available: false })]); await g.refresh(); assert.equal(g.nearest(at.x, at.z), null, 'taken, inside its respawn window: no prompt');
  set([row({ radiusM: 0.5 })]); await g.refresh(); assert.equal(g.nearest(at.x + 0.6, at.z), null, 'the server\'s per-row radius, not a client number');
});
test('the poll reads nothing while the page is hidden or the hero is far from every item, and reads again when near', async () => {
  const { g, log } = rig();
  await g.poll(at.x, at.z, false); assert.equal(log.reads, 1, 'nothing known yet: the first read');
  await g.poll(at.x, at.z, true); assert.equal(log.reads, 1, 'hidden page');
  await g.poll(at.x + PICKUP.pollRangeM + 1, at.z, false); assert.equal(log.reads, 1, 'farther than pollRangeM from every item');
  await g.poll(at.x + PICKUP.pollRangeM - 1, at.z, false); assert.equal(log.reads, 2, 'within range');
  assert.throws(() => loadPickupRules(edited((f) => { f.pollRangeM = 0; })), /pollRangeM/);
});
test('what is drawn follows the state: visible rows shown, a row that goes invisible hidden, a failed read changes nothing', async () => {
  const { g, set, log, deps } = rig(); await g.refresh(); assert.deepEqual(log.shown, [ID]);
  set([row({ visible: false, available: false })]); await g.refresh(); assert.deepEqual(log.hidden, [ID]);
  const down = createGroundPickup({ ...deps, read: async () => ({ offline: 'timeout' }) }); await down.refresh(); assert.equal(log.hidden.length, 1);
});
test('signed out: the static rows draw, the prompt says to sign in, and a tap says so without calling the writer', async () => {
  const { g, log } = rig({ signedIn: () => false }); await g.refresh();
  assert.deepEqual(log.shown, [ID]); assert.equal(log.reads, 0);
  assert.deepEqual(g.nearest(at.x, at.z), { instance: ID, label: 'Sign in to take the Rusty Sword' });
  assert.equal(await g.tap(ID), 'signed-out'); assert.deepEqual(log.said, ['Sign in to take the Rusty Sword']); assert.deepEqual(log.taken, []);
});

test('a take: hides the item, plays the pickup cue, says what was taken and reads the pack again', async () => {
  const { g, log } = rig(); await g.refresh();
  assert.equal(await g.tap(ID), 'taken');
  assert.deepEqual(log.taken, [ID]); assert.deepEqual(log.hidden, [ID]); assert.deepEqual(log.cues, ['pickup']); assert.equal(log.packReads, 1);
  assert.deepEqual(log.said, ['You take the Rusty Sword']); assert.equal(g.nearest(at.x, at.z), null, 'it is not prompted again while it is gone');
});
test('a lost race: the refuse cue and the short line; the state is read again, which hides it', async () => {
  const { g, log, set } = rig({ take: async () => ({ offline: 'http-409', code: 'taken' }) }); await g.refresh(); set([row({ visible: false, available: false })]);
  assert.equal(await g.tap(ID), 'refused');
  assert.deepEqual(log.cues, ['refuse']); assert.deepEqual(log.said, ['Someone got there first.']); assert.equal(log.packReads, 0);
  await new Promise((r) => setImmediate(r)); assert.deepEqual(log.hidden, [ID]);
});
test('ORIGINS_GROUND off: a quiet "not now", no cue, nothing hidden; any other refusal is its own line, and the cue stays for the race only', async () => {
  for (const [answer, line] of [[{ offline: 'http-503', code: 'off' }, 'Not now.'], [{ offline: 'http-409', code: 'have-it' }, 'You already hold one.'], [{ offline: 'http-409', code: 'full' }, 'Your pack is full.'], [{ offline: 'http-422', code: 'away' }, 'Too far from it.'], [{ offline: 'network' }, 'Not now.']] as const) {
    const { g, log } = rig({ take: async () => answer }); await g.refresh();
    assert.equal(await g.tap(ID), 'refused'); assert.deepEqual(log.said, [line], JSON.stringify(answer)); assert.deepEqual(log.cues, []); assert.deepEqual(log.hidden, []); assert.equal(log.packReads, 0);
  }
});
test('one take at a time: a second tap while the first is in flight does nothing', async () => {
  let release: (v: { instance: string; item: string; qty: number }) => void = () => {};
  const asked: string[] = [];
  const { g, log } = rig({ take: (i) => new Promise((r) => { release = r; asked.push(i); }) }); await g.refresh();
  const first = g.tap(ID); assert.equal(await g.tap(ID), 'busy'); release({ instance: ID, item: ITEM, qty: 1 }); assert.equal(await first, 'taken');
  assert.deepEqual(asked, [ID]); assert.deepEqual(log.cues, ['pickup']);
});

test('the net half: ids only in the body, the writer\'s refusal code comes back, and a malformed state is no state', async () => {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const answer = (status: number, body: unknown) => (async (url: string, init: RequestInit) => { sent.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify(body), { status }); }) as unknown as typeof fetch;
  assert.deepEqual(await takeGround('tok', 'pc:1', ID, { fetch: answer(200, { ok: true, result: { result: 'taken', instance: ID, item: ITEM, qty: 1, availableAt: 'x' } }), base: '/origins' }), { instance: ID, item: ITEM, qty: 1 });
  assert.deepEqual(sent, [{ url: '/origins/ground_take', body: { character: 'pc:1', instance: ID } }]);
  assert.deepEqual(await takeGround('tok', 'pc:1', ID, { fetch: answer(409, { ok: false, error: 'x', code: 'taken' }) }), { offline: 'http-409', code: 'taken' });
  assert.deepEqual(await takeGround(null, 'pc:1', ID), { offline: 'no-session' });
  const good = { instance: ID, item: ITEM, zone: 'zone1', place: 'cinder-fields', radiusM: 1.5, available: true, visible: true };
  assert.deepEqual(stateOf({ items: [good] }), { items: [good] });
  assert.equal(stateOf({ items: [{ ...good, radiusM: 0 }] }), null); assert.equal(stateOf({ items: [{ ...good, offsetX: 2 }] }), null); assert.equal(stateOf({}), null);
  assert.deepEqual(await readGround('tok', { fetch: answer(200, { ok: true, result: { now: 'x', items: [good] } }) }), { items: [good] });
});

test('the prompt sits above the live fight kit: its tap must not land on #actions (the stills probe: at 375 the kit covered the prompt\'s middle)', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../origins/preview/index.html', import.meta.url), 'utf8');
  const z = Number(/#prompt \{[^}]*?z-index:\s*(\d+)/.exec(html)?.[1]);
  assert.ok(Number.isInteger(z) && z >= 6, `#prompt z-index is ${z}: it must sit above the fight kit (z-index 5 in src/style.css)`);
});
