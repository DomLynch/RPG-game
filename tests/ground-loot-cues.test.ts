// Ground-loot cues (src/fight/sound/ground-loot.ts): a drop, a take and a lost race are three audio-rules rows on EXISTING sprite cues: no new loader, no new sprite bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback } from '../src/fight/sound/feedback.ts';
import { GROUND_LOOT_KINDS, groundLootCue, loadGroundLoot } from '../src/fight/sound/ground-loot.ts';
import { GROUND_LOOT_ROWS, loadAudioRules } from '../src/fight/sound/audio-rules.ts';
import { MANIFEST } from '../src/audio/manifest.ts';
import DEFS from '../src/fight/sound/audio-rules-defs.json' with { type: 'json' };

const row = (id: string, cue = 'draw', gain = 0.25, room = 0.08, rate = 1.6) => ({ id, cue, gain, room, rate });
const dur = (name: string) => Math.max(...(MANIFEST as unknown as Record<string, number[][]>)[name]!.map((v) => v[1]!));

test('the three cues are rows on existing sprite cues, pinned: a dry thud for the drop, a high lift for the take, the shortest quiet cue for a lost race', () => {
  assert.deepEqual([...GROUND_LOOT_KINDS], ['drop', 'pickup', 'refuse']);
  assert.deepEqual(GROUND_LOOT_ROWS.map((r) => [r.id, r.cue, r.gain, r.room, r.rate]), [['drop', 'bone_crack', 0.3, 0.12, 0.8], ['pickup', 'draw', 0.25, 0.08, 1.6], ['refuse', 'backstep', 0.12, 0.04, 0.85]]);
  assert.deepEqual(groundLootCue('drop'), { name: 'bone_crack', gain: 0.3, room: 0.12, rate: 0.8 });
  for (const k of GROUND_LOOT_KINDS) assert.ok(Object.hasOwn(MANIFEST, groundLootCue(k).name), `${k} plays a cue that is in the sprite`);
  const played = (k: 'drop' | 'pickup' | 'refuse') => dur(groundLootCue(k).name) / groundLootCue(k).rate;   // seconds on the bus
  assert.ok(groundLootCue('refuse').gain < groundLootCue('pickup').gain && groundLootCue('pickup').gain < groundLootCue('drop').gain, 'quiet refuse < pickup < drop');
  assert.ok(played('refuse') < played('pickup') && played('refuse') < played('drop') && played('refuse') < 0.25, `refuse is the shortest: ${played('refuse').toFixed(2)} s`);
});

test('defaults plus an override (the ModernUO shape): a <kind>:<class> row wins for that class, any other class or none gets the default, and a caller cannot change the row', () => {
  const rows = [row('drop', 'bone_crack', 0.3, 0.12, 0.8), row('pickup'), row('refuse', 'backstep', 0.12, 0.04, 0.85), row('pickup:coin', 'block', 0.2, 0.1, 2.2)];
  const lookup = loadGroundLoot(rows);
  assert.equal(groundLootCue('pickup', 'coin', lookup).name, 'block');
  assert.equal(groundLootCue('pickup', 'sword', lookup).name, 'draw'); assert.equal(groundLootCue('pickup', undefined, lookup).name, 'draw');
  assert.equal(groundLootCue('drop', 'coin', lookup).name, 'bone_crack', 'no override for a drop: the default');
  const c = groundLootCue('refuse'); c.gain = 1; assert.equal(groundLootCue('refuse').gain, 0.12);
});

test('the loader refuses a cue that is not in the sprite, a bad level, a bad id, a duplicate and a missing default', () => {
  const ok = [row('drop', 'bone_crack'), row('pickup'), row('refuse', 'backstep')];
  assert.doesNotThrow(() => loadGroundLoot(ok));
  assert.throws(() => loadGroundLoot(ok.map((r) => r.id === 'drop' ? { ...r, cue: 'coin_clink' } : r)), /"coin_clink" is not a cue in the sprite/);
  assert.throws(() => loadGroundLoot(ok.map((r) => r.id === 'drop' ? { ...r, gain: 0 } : r)), /gain is 0-1/);
  assert.throws(() => loadGroundLoot(ok.map((r) => r.id === 'drop' ? { ...r, rate: 9 } : r)), /rate 0\.25-4/);
  assert.throws(() => loadGroundLoot([...ok, row('hover')]), /the id is drop, pickup or refuse/);
  assert.throws(() => loadGroundLoot([...ok, row('pickup:')]), /the id is drop, pickup or refuse/);
  assert.throws(() => loadGroundLoot([...ok, row('pickup')]), /duplicate row/);
  assert.throws(() => loadGroundLoot(ok.filter((r) => r.id !== 'refuse')), /"refuse" default row is missing/);
});

test('the rows go through the audio-rules registry (a mistyped field or a duplicate id is refused there) and are not part of the named rules', () => {
  assert.equal(loadAudioRules(DEFS).groundLoot.length, 3);
  assert.throws(() => loadAudioRules({ ...DEFS, groundLoot: [{ id: 'drop', cue: 'bone_crack', gain: 'loud', room: 0.1, rate: 1 }] }), /gain/);
  assert.throws(() => loadAudioRules({ ...DEFS, groundLoot: [...DEFS.groundLoot, DEFS.groundLoot[0]!] }), /duplicate|twice|unique/i);
});

// A minimal Web Audio stand-in with a decoded sprite handed in by the host: enough to see a cue reach the graph, or not.
class FakeContext {
  state = 'running'; sampleRate = 48000; currentTime = 0; destination = {}; sources: { rate: number; start: unknown[] }[] = [];
  node() { const param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }); return { gain: param(), frequency: param(), Q: param(), playbackRate: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), type: '', curve: null, buffer: null, connect() { return this; }, disconnect() {}, start() {}, stop() {}, onended: null }; }
  createGain() { return this.node(); } createBiquadFilter() { return this.node(); } createOscillator() { return this.node(); } createWaveShaper() { return this.node(); } createDynamicsCompressor() { return this.node(); } createConvolver() { return this.node(); }
  createBuffer(_c: number, length: number) { return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const node = this.node(); const rec = { rate: 0, start: [] as unknown[] }; this.sources.push(rec); node.start = ((...a: unknown[]) => { rec.start = a; rec.rate = (node.playbackRate as { value: number }).value; }) as never; return node; }
  resume() { return Promise.resolve(); }
}
const make = (sprite: AudioBuffer | null) => { const ctx = new FakeContext(); const fb = createFeedback({ context: ctx as unknown as BaseAudioContext, now: () => ctx.currentTime, sprite }); fb.unlock(); return { ctx, fb }; };

test('feedback.groundLoot plays the row\'s sprite cue at its pitch (within the pitch spread), and is silent with no decoded sprite or after quiet()', () => {
  const sprite = { duration: 46.108 } as AudioBuffer;
  const { ctx, fb } = make(sprite);
  for (const k of GROUND_LOOT_KINDS) fb.groundLoot(k);
  assert.equal(ctx.sources.length, 3, 'one source per cue');
  const rates = ctx.sources.map((s) => s.rate), want = GROUND_LOOT_KINDS.map((k) => groundLootCue(k).rate);
  rates.forEach((r, i) => assert.ok(Math.abs(r / want[i]! - 1) <= 0.05 + 1e-9, `${GROUND_LOOT_KINDS[i]}: rate ${r} is ${want[i]} within the 5 % spread`));
  const [start, duration] = ctx.sources[0]!.start.slice(1) as number[];
  const cue = (MANIFEST as unknown as Record<string, number[][]>)['bone_crack']!;
  assert.ok(cue.some((v) => v[0] === start && v[1] === duration), 'the drop starts at a bone_crack region of the sprite');
  fb.groundLoot('pickup', 'coin'); assert.equal(ctx.sources.length, 4, 'an item class with no override uses the default');
  fb.quiet(); fb.groundLoot('drop'); assert.equal(ctx.sources.length, 4, 'quiet(): silent');
  const none = make(null); none.fb.groundLoot('drop'); assert.equal(none.ctx.sources.length, 0, 'no sprite decoded yet: silent, nothing thrown');
});
