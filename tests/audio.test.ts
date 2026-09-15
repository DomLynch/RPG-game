import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUE_PROBES, EXCHANGE_BEATS, scriptExchange } from '../src/audio/exchange.ts';
import { createFeedback } from '../src/feedback.ts';

// The scripted exchange is the fixed ruler every audio iteration is measured with: same beats, same order, same ticks.
test('the scripted exchange lands every beat in order and is reproducible', () => {
  const exchange = scriptExchange();
  assert.deepEqual(exchange.beats.map(b => b.name), [...EXCHANGE_BEATS]);
  assert.ok(exchange.beats.every((b, i) => i === 0 || b.tick > exchange.beats[i - 1].tick), 'beats advance in time');
  assert.ok(exchange.length < 60 * 20, `exchange stays under 20 s (${exchange.length} ticks)`);
  const has = (beat: string, event: string) => assert.ok(exchange.beats.find(b => b.name === beat)!.events.some(e => e.startsWith(event)), `${beat} carries ${event}`);
  has('draw', 'ActionStarted(draw)'); has('light', 'Hit(light_right)'); has('heavy', 'Hit(heavy_overhead)'); has('guard', 'ActionStarted(guard)');
  has('block', 'Blocked(light_right)'); has('parry', 'Parried('); has('riposte', 'Hit(riposte)'); has('hit taken', 'Hit(light_right)'); has('kick', 'Hit(kick)'); has('death', 'Killed(heavy_overhead)');
  assert.ok(!exchange.beats.find(b => b.name === 'block')!.events.some(e => e.includes('perfect')), 'the block is an ordinary one');
  assert.ok(exchange.ticks.some(t => t.events.some(e => e.type === 'Charged')), 'the death blow is a charged heavy');
  assert.equal(exchange.ticks.filter(t => t.events.some(e => e.type === 'Hit' && e.actor === 1)).length, 1, 'the player takes exactly one hit');
  assert.deepEqual(JSON.parse(JSON.stringify(scriptExchange())), JSON.parse(JSON.stringify(exchange)), 'two runs are identical');
});

test('every event type the exchange emits has a cue probe, and probe names are unique', () => {
  const emitted = new Set(scriptExchange().ticks.flatMap(t => t.events.map(e => e.type)));
  const probed = new Set(CUE_PROBES.flatMap(p => p.events.map(e => e.type)));
  for (const type of emitted) assert.ok(probed.has(type), `probe exists for ${type}`);
  assert.equal(new Set(CUE_PROBES.map(p => p.name)).size, CUE_PROBES.length);
});

// A hosted feedback (offline render) schedules on the host clock, never on the context clock, and never touches the
// host's lifecycle: the harness owns rendering.
class Recorder {
  starts: number[] = []; state = 'suspended'; sampleRate = 48000; currentTime = 99; destination = {}; suspended = 0; resumed = 0; buffers: Float32Array[] = [];
  node() { const starts = this.starts; return { buffer: null, frequency: { value: 0 }, type: '', Q: { value: 0 }, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; }, disconnect() {}, start(t: number) { starts.push(t); }, stop() {}, onended: null }; }
  createGain() { return this.node(); } createBufferSource() { return this.node(); } createBiquadFilter() { return this.node(); } createOscillator() { return this.node(); }
  createBuffer(_c: number, length: number) { const data = new Float32Array(length); this.buffers.push(data); return { getChannelData: () => data }; }
  resume() { this.resumed++; return Promise.resolve(); } suspend() { this.suspended++; return Promise.resolve(); }
}
const hosted = (seed?: number) => { const context = new Recorder(); let now = 0; const feedback = createFeedback({ context: context as unknown as BaseAudioContext, now: () => now, seed }); return { context, feedback, at: (t: number) => { now = t; } }; };

test('a hosted feedback schedules cues at the scripted time and ignores the offline context state', () => {
  const { context, feedback, at } = hosted();
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]);
  assert.equal(context.starts.length, 0, 'silent before unlock');
  feedback.unlock();
  assert.equal(context.resumed, 0, 'the harness, not the module, drives an offline context');
  at(2.5); feedback.update([{ tick: 150, type: 'Hit', actor: 0 } as never]);
  assert.ok(context.starts.length > 0, 'a hit plays although the offline context reports suspended');
  assert.ok(context.starts.every(t => t === 2.5), `every layer starts on the host clock, not currentTime (${context.starts})`);
  feedback.quiet(); assert.equal(context.suspended, 0, 'quiet never suspends a hosted context');
  at(3); feedback.update([{ tick: 180, type: 'Parried', actor: 0 } as never]);
  assert.ok(context.starts.some(t => t === 3), 'still audible after quiet in hosted mode');
});

test('the noise bed is seeded: the same seed fills the same buffer, another seed does not', () => {
  const a = hosted(7), b = hosted(7), c = hosted(8);
  a.feedback.unlock(); b.feedback.unlock(); c.feedback.unlock();
  assert.deepEqual(a.context.buffers[0], b.context.buffers[0]);
  assert.notDeepEqual(a.context.buffers[0], c.context.buffers[0]);
  assert.ok(a.context.buffers[0].every(v => v >= -1 && v <= 1) && a.context.buffers[0].some(v => v !== 0));
});
