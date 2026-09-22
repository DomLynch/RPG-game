import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { ARENA_MANIFEST } from '../src/audio/arena-manifest.ts';
import { createArenaAudio, loadArena } from '../src/audio/arena.ts';
import { BELL_SECONDS, bellSamples } from '../src/audio/bell.ts';

test('optional arena assets stay within their own 450KB budget and expose non-overlapping regions', () => {
  assert.equal(ARENA_MANIFEST.bell[0][1], BELL_SECONDS, 'encoded bell and local fallback share duration');
  assert.equal(bellSamples(48000).length, Math.round(BELL_SECONDS * 48000));
  const sizes = ['arena.m4a', 'arena.ogg'].map(file => gzipSync(readFileSync(new URL(`../src/assets/arena-audio/${file}`, import.meta.url))).length);
  assert.ok(sizes.reduce((a, b) => a + b) <= 450000);
  const regions = Object.values(ARENA_MANIFEST).flat().sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < regions.length; i++) {
    assert.ok(regions[i][1] > 0 && regions[i][0] >= 0);
    if (i) assert.ok(regions[i][0] > regions[i - 1][0] + regions[i - 1][1], 'codec padding between regions');
  }
});

test('optional arena network/decoder failure tries both codecs then returns silent fallback', async () => {
  const requests: string[] = [];
  const context = { decodeAudioData: async () => { throw Error('unsupported codec'); } } as unknown as BaseAudioContext;
  const result = await loadArena(context, ['opus', 'aac'], async url => {
    requests.push(String(url)); return { ok: requests.length > 1, arrayBuffer: async () => new ArrayBuffer(8) } as Response;
  });
  assert.equal(result, null); assert.equal(requests.length, 2);
  assert.ok(requests[0].endsWith('.ogg') && requests[1].endsWith('.m4a'));
});


test('arena hit grunts follow the struck body across Skeleton fights and rematches', async () => {
  const originalFetch = globalThis.fetch;
  const starts: number[] = [];
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {} };
  const context = {
    decodeAudioData: async () => ({}),
    createGain: () => ({ gain: param, connect() {}, disconnect() {} }),
    createBufferSource: () => ({ playbackRate: { value: 1 }, connect() {}, disconnect() {}, stop() {}, start(_when: number, offset: number) { starts.push(offset); } }),
  } as unknown as BaseAudioContext;
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
  try {
    let now = 0;
    const audio = createArenaAudio(context, {} as AudioNode, () => now);
    await audio.ready();
    const grunts = () => starts.filter(offset => ARENA_MANIFEST.grunt.some(([start]) => start === offset)).length;
    const bells = () => starts.filter(offset => offset === ARENA_MANIFEST.bell[0][0]).length;
    audio.update([{ type: 'Hit', tick: 0, actor: 0, target: 1 }], { match: 1, tick: 0, ended: false, opponent: 'skeleton' }, false);
    assert.equal(grunts(), 0, 'exposed bone has no human pain grunt');
    assert.equal(bells(), 0, 'no bell before the draw');
    now = 1;
    audio.update([{ type: 'Hit', tick: 60, actor: 1, target: 0 }], { match: 1, tick: 60, ended: false, opponent: 'skeleton' }, true);
    assert.equal(grunts(), 1, 'the player still reacts when struck');
    assert.equal(bells(), 1, 'the draw rings the bell once');
    now = 2;
    audio.update([{ type: 'Hit', tick: 0, actor: 0, target: 1 }], { match: 2, tick: 0, ended: false, opponent: 'werewolf' }, false);
    assert.equal(grunts(), 2, 'changing opponent restores flesh feedback');
    audio.stop();
  } finally { globalThis.fetch = originalFetch; }
});

test('the crowd turns on a wall-hugger: the jeer bed starts with the loiter level, rotates variants, drops the moment it returns to 0', async () => {
  const originalFetch = globalThis.fetch;
  const starts: number[] = [], stops: number[] = [], ramps: number[] = [];
  const param = { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime(value: number) { ramps.push(value); } };
  const context = {
    decodeAudioData: async () => ({}),
    createGain: () => ({ gain: { ...param }, connect() {}, disconnect() {} }),
    createBufferSource: () => ({ playbackRate: { value: 1 }, connect() {}, disconnect() {}, stop(when: number) { stops.push(when); }, start(_when: number, offset: number) { starts.push(offset); } }),
  } as unknown as BaseAudioContext;
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
  try {
    let now = 0;
    const audio = createArenaAudio(context, {} as AudioNode, () => now);
    await audio.ready();
    const wall = () => starts.filter(offset => ARENA_MANIFEST.jeer_wall.some(([start]) => start === offset));
    audio.update([], { match: 1, tick: 0, ended: false, loiter: 0 }, true);
    assert.equal(wall().length, 0, 'no jeer while nobody hugs the wall');
    now = 1; audio.update([], { match: 1, tick: 60, ended: false, loiter: .2 }, false);
    assert.equal(wall().length, 1, 'the bed starts as the loiter clock starts');
    const stopsBefore = stops.length;
    now = 2; audio.update([], { match: 1, tick: 120, ended: false, loiter: .6 }, false);
    assert.equal(wall().length, 1, 'the same bed keeps swelling while he stays');
    assert.ok(ramps.at(-1)! > ramps.at(-2)!, 'the level rises with the clock');
    now = 2.5; audio.update([], { match: 1, tick: 150, ended: false, loiter: 0 }, false);
    assert.equal(stops.length, stopsBefore + 1, 'leaving the band (or swinging) drops the bed');
    assert.equal(ramps.at(-1), 0, 'with a release to silence');
    const seen = new Set<number>();
    for (let i = 0; i < 12; i++) {   // re-enter the band repeatedly: every variant is reached and never the same one twice in a row
      now += 1; audio.update([], { match: 1, tick: 200 + i * 60, ended: false, loiter: .5 }, false);
      seen.add(wall().at(-1)!);
      now += .5; audio.update([], { match: 1, tick: 230 + i * 60, ended: false, loiter: 0 }, false);
    }
    assert.equal(seen.size, ARENA_MANIFEST.jeer_wall.length, 'all three beds rotate');
    const beds = wall();
    for (let i = 1; i < beds.length; i++) assert.notEqual(beds[i], beds[i - 1], 'never the same bed twice in a row');
    audio.stop();
  } finally { globalThis.fetch = originalFetch; }
});
