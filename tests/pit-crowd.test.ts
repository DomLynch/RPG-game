// The crowd through the Pit's walls (Dom 2026-10-01, Strategy): ten seconds after he arrives, then every thirty, one of the arena's crowd
// cues rotates in (cheers, boos, the chant), never the same twice in a row, muffled and quiet; it stops when he leaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { enter, disposeRoom, CROWD_EVERY_S, CROWD_FIRST_S, CROWD_ROTATION } from '../src/pit/pit.ts';
import { CROWD_CUES, CROWD_CUTOFF_HZ, CROWD_DB, createArenaAudio } from '../src/audio/arena.ts';
import { ARENA_MANIFEST } from '../src/audio/arena-manifest.ts';
import type { Stage } from '../src/pit/stage.ts';

const element = () => ({ hidden: false, textContent: '', childElementCount: 0, setAttribute() {}, append() {}, replaceChildren() {}, addEventListener() {}, remove() {} });
const stage = (): Stage => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 0.46, 0.1, 50), renderer: undefined as unknown as THREE.WebGLRenderer,
  setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }),
});

test('the rotation is the arena bank\'s own crowd cues, and every cue has regions in the bank', () => {
  assert.deepEqual([...CROWD_ROTATION], [...CROWD_CUES]);
  assert.ok(new Set(CROWD_ROTATION).size === CROWD_ROTATION.length && CROWD_ROTATION.length >= 3);
  for (const cue of CROWD_CUES) assert.ok(ARENA_MANIFEST[cue].length > 0, cue);
  assert.equal(CROWD_FIRST_S, 10); assert.equal(CROWD_EVERY_S, 30);
});

test('the Pit plays the first cue at 10 s, then every 30 s, never the same cue twice running, and stops it on leaving', async () => {
  (globalThis as { document?: unknown }).document = { createElement: element, body: element() };
  try {
    const log: string[] = [];
    const s = Object.assign(stage(), {
      readMove: () => ({ x: 0, z: 0 }), rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Next', go() {} }),
      crowdSound: (cue: string) => { log.push(cue); return { stop() { log.push(`stop ${cue}`); } }; },
    });
    const pit = enter(s, 'win');
    await pit.ready;
    const run = (seconds: number) => { for (let i = 0; i < seconds * 10; i++) pit.frame(0.1); };
    run(9.5); assert.deepEqual(log, [], 'quiet before 10 s');
    run(1); assert.deepEqual(log, ['reaction'], 'the first cue at 10 s');
    run(29); assert.equal(log.length, 1, 'nothing for the next 30 s');
    run(2); assert.deepEqual(log, ['reaction', 'jeer']);
    run(30); run(30);
    const plays = log.filter((l: string) => !l.startsWith('stop'));
    assert.deepEqual(plays, ['reaction', 'jeer', 'chant', 'reaction'], 'rotating through every cue');
    for (let i = 1; i < plays.length; i++) assert.notEqual(plays[i], plays[i - 1], 'never the same twice in a row');
    pit.leave();
    assert.equal(log.at(-1), 'stop reaction', 'leaving stops the cue that is playing');
    const before = log.length;
    run(60); assert.equal(log.length, before, 'and nothing plays after he has left');
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('a Stage with no crowd sound (the look stills, a muted page) plays nothing and does not throw', async () => {
  (globalThis as { document?: unknown }).document = { createElement: element, body: element() };
  try {
    const s = Object.assign(stage(), { readMove: () => ({ x: 0, z: 0 }), rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Next', go() {} }) });
    const pit = enter(s, 'win'); await pit.ready;
    for (let i = 0; i < 700; i++) pit.frame(0.1);
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

// The muffle: a lowpass at 800 Hz and 12 dB under the arena's own level, into the arena output.
test('through(): one cue, lowpassed at 800 Hz, 12 dB under its arena level, silent until the bank has decoded, stop() idempotent', async () => {
  const graph: string[] = [];
  const param = (name: string) => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(v: number) { graph.push(`${name} set ${v.toPrecision(4)}`); }, linearRampToValueAtTime(v: number) { graph.push(`${name} ramp ${v.toPrecision(4)}`); } });
  const node = (kind: string) => ({ connect(to: unknown) { graph.push(`${kind} -> ${(to as { kind?: string }).kind ?? 'out'}`); }, disconnect() {}, kind });
  const ctx = {
    currentTime: 5, decodeAudioData: async () => ({ duration: 44 } as AudioBuffer),
    createBufferSource: () => Object.assign(node('source'), { buffer: null, playbackRate: { value: 1 }, start: (t: number, o: number, d: number) => graph.push(`start ${t} ${o} ${d}`), stop: () => graph.push('stop'), onended: null }),
    createBiquadFilter: () => Object.assign(node('filter'), { type: '', frequency: { set value(v: number) { graph.push(`cutoff ${v}`); } } }),
    createGain: () => Object.assign(node('gain'), { gain: param('gain') }),
  } as unknown as BaseAudioContext;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
  try {
    const audio = createArenaAudio(ctx, { kind: 'arena' } as unknown as AudioNode, () => ctx.currentTime);
    assert.equal(audio.through('jeer'), undefined, 'silent before the bank has decoded');
    await audio.ready();
    const handle = audio.through('jeer')!;
    assert.ok(handle, 'plays once decoded');
    assert.ok(graph.includes(`cutoff ${CROWD_CUTOFF_HZ}`), 'lowpassed at 800 Hz');
    assert.ok(graph.some((g) => g.startsWith('source -> filter')) && graph.some((g) => g.startsWith('filter -> gain')) && graph.some((g) => g.startsWith('gain -> arena')), 'source → lowpass → gain → the arena output');
    const peak = Number(/gain ramp ([\d.e-]+)/.exec(graph.find((g) => /gain ramp 0\.0/.test(g)) ?? '')?.[1]);
    const arenaLevel = .13 * .4;
    assert.ok(Math.abs(20 * Math.log10(peak / arenaLevel) - CROWD_DB) < 0.1, `${(20 * Math.log10(peak / arenaLevel)).toFixed(2)} dB under the arena level`);
    handle.stop(); handle.stop();
    assert.equal(graph.filter((g) => g === 'stop').length, 1, 'stop() once, idempotent');
  } finally { globalThis.fetch = realFetch; }
});

// Dom 2026-10-01: the header's ☰ menu in the Pit room. Only on a live visit (data-pit='on'): the look stills stay the scene alone.
test('style.css keeps the header\'s ☰ and the journal in the Pit (on), nothing but the scene in the look stills', async () => {
  const css = (await import('node:fs')).readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /body\[data-pit='on'\] > :not\(#world\):not\(#pit-ui\):not\(#joystick\):not\(header\):not\(#journal\),/, 'the live Pit hides the fight HUD but not the header or the journal');
  assert.match(css, /body\[data-pit='on'\] > header > :not\(#journal-button\) \{ display: none !important; \}/, 'the brand and the sound chip step aside: the menu alone');
  assert.match(css, /body\[data-pit='look'\] > :not\(#world\):not\(#pit-ui\),/, 'the look stills are the scene alone');
});
