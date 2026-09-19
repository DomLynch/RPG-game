import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { CUE_PROBES, EXCHANGE_BEATS, scriptExchange } from '../src/audio/exchange.ts';
import { cuesFor, nextVariant, seeded, type DeathPresentation } from '../src/audio/cues.ts';
import { MANIFEST, SPRITE_SECONDS } from '../src/audio/manifest.ts';
import { spriteFormats } from '../src/audio/sprite.ts';
import { createFeedback, VOICES } from '../src/feedback.ts';
import type { CombatEvent } from '../src/combat.ts';

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
  starts: { when: number; offset?: number; duration?: number }[] = []; stops: number[] = []; state = 'suspended'; sampleRate = 48000; currentTime = 99; destination = {}; suspended = 0; resumed = 0; buffers: Float32Array[] = [];
  node() { const { starts, stops } = this, param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {} }); return { buffer: null, type: '', curve: null, frequency: param(), Q: param(), gain: param(), playbackRate: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() { return this; }, disconnect() {}, start(when: number, offset?: number, duration?: number) { starts.push({ when, offset, duration }); }, stop(when: number) { stops.push(when); }, onended: null }; }
  createGain() { return this.node(); } createBufferSource() { return this.node(); } createBiquadFilter() { return this.node(); } createOscillator() { return this.node(); } createWaveShaper() { return this.node(); } createDynamicsCompressor() { return this.node(); } createConvolver() { return this.node(); }
  createBuffer(_c: number, length: number) { const data = new Float32Array(length); this.buffers.push(data); return { getChannelData: () => data }; }
  resume() { this.resumed++; return Promise.resolve(); } suspend() { this.suspended++; return Promise.resolve(); }
}
const SPRITE = { duration: SPRITE_SECONDS } as AudioBuffer;   // a decoded sprite stand-in: only regions are read from it
const hosted = (seed?: number, sprite: AudioBuffer | null = null) => { const context = new Recorder(); let now = 0; const feedback = createFeedback({ context: context as unknown as BaseAudioContext, now: () => now, seed, sprite }); return { context, feedback, at: (t: number) => { now = t; } }; };
const ev = (type: CombatEvent['type'], extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, actor: 0, ...extra, type });

test('a hosted feedback schedules cues at the scripted time and ignores the offline context state', () => {
  const { context, feedback, at } = hosted();
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]);
  assert.equal(context.starts.length, 0, 'silent before unlock');
  feedback.unlock();
  assert.equal(context.resumed, 0, 'the harness, not the module, drives an offline context');
  at(2.5); feedback.update([{ tick: 150, type: 'Hit', actor: 0 } as never]);
  assert.ok(context.starts.length > 0, 'a hit plays although the offline context reports suspended');
  assert.ok(context.starts.every(s => s.when === 2.5), `every layer starts on the host clock, not currentTime (${JSON.stringify(context.starts)})`);
  feedback.quiet(); assert.equal(context.suspended, 0, 'quiet never suspends a hosted context');
  at(3); feedback.update([{ tick: 180, type: 'Parried', actor: 0 } as never]);
  assert.ok(!context.starts.some(s => s.when === 3), 'quiet blocks scheduling in the harness too');
  feedback.unlock(); feedback.update([ev('Parried')]);
  assert.ok(context.starts.some(s => s.when === 3), 'unlock restores scheduling');
});

test('the noise bed is seeded: the same seed fills the same buffer, another seed does not', () => {
  const a = hosted(7), b = hosted(7), c = hosted(8);
  a.feedback.unlock(); b.feedback.unlock(); c.feedback.unlock();
  const noise = (r: { context: Recorder }) => r.context.buffers.at(-1)!;   // the room impulse comes first and is fixed; the synth bed follows the seed
  assert.deepEqual(noise(a), noise(b));
  assert.notDeepEqual(noise(a), noise(c));
  assert.deepEqual(a.context.buffers[0], c.context.buffers[0], 'the arena impulse does not depend on the duel seed');
  assert.ok(noise(a).every(v => v >= -1 && v <= 1) && noise(a).some(v => v !== 0));
});

// --- Sprite era ---------------------------------------------------------------------------------------------------------
test('events map to material cues, impacts before air, at most four per tick, and unmapped events stay silent', () => {
  const names = (events: CombatEvent[]) => cuesFor(events).map(c => c.name);
  assert.deepEqual(names([ev('Hit', { move: 'light_right' })]), ['hit_flesh']);
  assert.deepEqual(names([ev('Hit', { move: 'heavy_overhead' })]), ['hit_heavy']);
  assert.deepEqual(names([ev('Hit', { move: 'riposte' })]), ['hit_heavy']);
  assert.deepEqual(names([ev('Hit', { move: 'slash_riposte' })]), ['hit_heavy']);
  assert.deepEqual(names([ev('AttackStarted', { move: 'slash_riposte' })]), ['whoosh_heavy']);
  assert.deepEqual(names([ev('Hit', { move: 'light_left', charged: true })]), ['hit_heavy']);
  assert.deepEqual(names([ev('Hit', { move: 'kick' })]), ['hit_kick']);
  assert.deepEqual(names([ev('Blocked', { perfect: false })]), ['block']);
  assert.deepEqual(names([ev('Blocked', { perfect: true })]), ['block_perfect']);
  assert.deepEqual(names([ev('Parried')]), ['parry']);
  assert.deepEqual(names([ev('GuardBroken')]), ['guard_break', 'hit_flesh']);
  assert.deepEqual(names([ev('AttackStarted', { move: 'light_right' })]), ['whoosh_light']);
  assert.deepEqual(names([ev('AttackStarted', { move: 'heavy_riposte' })]), ['whoosh_heavy']);
  assert.deepEqual(names([ev('Charged')]), ['charge']);
  assert.deepEqual(names([ev('ActionStarted', { action: 'draw' })]), ['draw']);
  // The killing tick: the hit lands first, the fall is layered slightly after it.
  const kill = cuesFor([ev('AttackActive'), ev('Killed', { move: 'heavy_overhead' }), ev('Hit', { move: 'heavy_overhead', charged: true }), ev('Staggered', { actor: 1 })]);
  assert.deepEqual(kill.map(c => c.name), ['flesh_cut', 'hit_heavy', 'death_voice', 'crowd_cheer', 'kill']);
  assert.ok(kill.find(c => c.name === 'hit_heavy')!.delay === undefined);
  assert.ok(kill.find(c => c.name === 'crowd_cheer')!.delay! >= .35);
  // Air never precedes an impact in the same tick.
  assert.deepEqual(names([ev('AttackStarted', { move: 'light_right', actor: 1 }), ev('Hit', { move: 'light_right' })]), ['hit_flesh', 'whoosh_light']);
  assert.equal(cuesFor([ev('Hit'), ev('GuardBroken'), ev('Parried'), ev('AttackStarted'), ev('Charged')]).length, 4);
  for (const type of ['Staggered', 'Dodged', 'AttackMissed', 'StaminaExhausted', 'Charging', 'AttackActive'] as const) assert.deepEqual(names([ev(type)]), [], `${type} is not mapped yet (body pass)`);
  assert.deepEqual(names([ev('ActionStarted', { action: 'guard' }), ev('ActionStarted', { action: 'parry' }), ev('ActionStarted', { action: 'feint' })]), []);
  for (const c of cuesFor([ev('Hit'), ev('AttackStarted')])) assert.ok(c.gain > 0 && c.gain <= 1 && c.room >= 0 && c.room <= 1);
});

test('variant rotation is seeded, never repeats the last variant, and reaches every variant', () => {
  const a = seeded(5), b = seeded(5), c = seeded(6);
  const run = (r: () => number) => { let last = -1; return Array.from({ length: 40 }, () => (last = nextVariant(r, 5, last))); };
  const seqA = run(a), seqB = run(b);
  assert.deepEqual(seqA, seqB, 'same seed, same rotation'); assert.notDeepEqual(seqA, run(c), 'another seed rotates differently');
  assert.ok(seqA.every((v, i) => i === 0 || v !== seqA[i - 1]), 'no immediate repeat');
  assert.deepEqual([...new Set(seqA)].sort(), [0, 1, 2, 3, 4], 'every variant is used');
  assert.equal(nextVariant(a, 1, 0), 0, 'a single variant just plays');
  assert.ok(seqA.every(v => v >= 0 && v < 5));
});

test('the sprite manifest is well-formed and the shipped audio stays inside the lane budget', () => {
  const regions = Object.values(MANIFEST).flat().map(([start, duration]) => [start, start + duration]).sort((p, q) => p[0] - q[0]);
  for (let i = 0; i < regions.length; i++) {
    assert.ok(regions[i][0] >= 0 && regions[i][1] <= SPRITE_SECONDS, `region ${i} inside the sprite`);
    if (i) assert.ok(regions[i][0] >= regions[i - 1][1], `region ${i} does not overlap its predecessor`);
  }
  for (const [name, variants] of Object.entries(MANIFEST)) assert.ok(variants.length >= 2, `${name} has variants (${variants.length})`);
  const used = new Set(CUE_PROBES.flatMap(p => cuesFor(p.events, p.presentation).map(c => c.name)));
  for (const name of used) assert.ok(name in MANIFEST, `cue ${name} exists in the sprite`);
  const dir = new URL('../src/assets/audio/', import.meta.url);
  let gzip = 0; for (const file of ['sprite.m4a', 'sprite.ogg']) { const bytes = fs.readFileSync(new URL(file, dir)); assert.ok(bytes.length > 1000, `${file} is present`); gzip += gzipSync(bytes).length; }
  assert.ok(gzip <= 1_000_000, `audio assets ${gzip} B gzip within 1.0 MB`);
  assert.deepEqual(spriteFormats(t => t.includes('opus') ? 'probably' : 'maybe'), ['opus', 'aac'], 'Chrome: Opus first');
  assert.deepEqual(spriteFormats(t => t.includes('mp4') ? 'maybe' : ''), ['aac', 'opus'], 'Safari: AAC first');
  assert.deepEqual(spriteFormats(() => ''), ['aac', 'opus'], 'no answer: AAC first');
});

test('with a decoded sprite, cues play sprite regions on pooled voices; past the cap the soonest-ending voice is stolen', () => {
  const { context, feedback, at } = hosted(3, SPRITE);
  feedback.unlock();
  at(1); feedback.update([ev('Hit', { move: 'light_right' })]);
  assert.equal(context.starts.length, 1, 'one source per cue, no synth layers');
  const [start] = context.starts, region = MANIFEST.hit_flesh.find(([s]) => s === start.offset);
  assert.ok(region && start.duration === region[1] && start.when === 1, `plays a manifest region at the cue time (${JSON.stringify(start)})`);
  for (let i = 0; i < VOICES + 3; i++) feedback.update([ev('Parried')]);   // twelve parries on one tick
  assert.equal(context.starts.length, 1 + VOICES + 3);
  assert.equal(context.stops.length, 4, `the hit holds one voice, so four of the twelve cues steal at the cap of ${VOICES}`);
  assert.ok(context.stops.every(t => t === 1), 'the stolen voice stops at the new cue time, not later');
  at(5); feedback.update([ev('Blocked')]);   // everything has ended: a free voice, nothing stolen
  assert.equal(context.stops.length, 4);
});

test('a duel reseeds on its draw, so the same fight rolls the same variants and pitches', () => {
  const fight = () => { const { context, feedback, at } = hosted(11, SPRITE); feedback.unlock(); at(0); feedback.update([ev('ActionStarted', { action: 'draw' })]); for (let i = 1; i < 12; i++) { at(i); feedback.update([ev('Hit', { move: 'light_right' })]); } return context.starts.map(s => s.offset); };
  assert.deepEqual(fight(), fight());
  const offsets = fight(); assert.ok(offsets.every((o, i) => i === 0 || o !== offsets[i - 1]), 'consecutive hits never reuse a variant');
});

test('movement starts have distinct cloth/sand cues, without synthetic landing events', () => {
  for (const action of ['roll', 'backstep'] as const) assert.deepEqual(cuesFor([ev('ActionStarted', { action })]).map(c => c.name), [action]);
});

test('the first variant can select every region, including zero', () => {
  for (let i = 0; i < 5; i++) assert.equal(nextVariant(() => (i + .5) / 5, 5, -1), i);
});

test('quiet and mute stop every scheduled layer before resume, including fallback tones', () => {
  for (const sprite of [null, SPRITE]) {
    const { context, feedback, at } = hosted(731, sprite);
    feedback.unlock(); feedback.update([ev('Hit')]);
    const playing = context.starts.length;
    at(.05); feedback.quiet();
    assert.equal(context.stops.filter(t => t === .05).length, playing);
    feedback.update([ev('Hit')]); assert.equal(context.starts.length, playing);
    feedback.unlock(); feedback.update([ev('Hit')]);
    const resumed = context.starts.length - playing;
    at(.1); feedback.toggle();
    assert.equal(context.stops.filter(t => t === .1).length, resumed);
  }
});


const deathPresentation = (override: DeathPresentation['override'] = 'plainDeath', gore = true): DeathPresentation => ({
  finish: { victim: 1, location: 'head', move: 'heavy_overhead', heading: 0 }, weapons: ['longsword', 'trident'], override, gore,
});
const deathEvents = [ev('Hit', { move: 'heavy_overhead', target: 1 }), ev('Killed', { move: 'heavy_overhead', target: 1 })];
test('fatal cues follow the visible finish and blood setting, preserving the immediate impact', () => {
  for (const override of ['plainDeath', 'splitCrown', 'decapitation', 'runThrough', 'opened'] as const) for (const gore of [true, false]) {
    const cues = cuesFor(deathEvents, deathPresentation(override, gore)), names = cues.map(c => c.name);
    assert.equal(cues[0].name, 'hit_heavy'); assert.equal(cues[0].delay, undefined);
    assert.equal(names.includes('flesh_tear'), gore && override === 'decapitation');
    assert.equal(names.includes('bone_crack'), gore && override === 'splitCrown');
    assert.equal(names.includes('flesh_stab'), gore && override === 'runThrough');
    assert.equal(names.includes('kill'), override !== 'runThrough', 'kneeling impalement has no floor crash');
    assert.equal(names.filter(n => n === 'crowd_cheer').length, 1);
    assert.ok(cues.length <= VOICES);
    assert.ok(cues.find(c => c.name === 'death_voice')!.delay! < cues.find(c => c.name === 'crowd_cheer')!.delay!);
    if (!gore) assert.ok(!names.some(n => n.startsWith('flesh_') || n === 'bone_crack'));
  }
});
test('either winner gets the crowd, kicks have no flesh layer, and a double death gets one gasp', () => {
  for (const actor of [0, 1] as const) {
    const events = [ev('Killed', { actor, target: actor === 0 ? 1 : 0, move: 'thrust', weapon: 'trident' })];
    const cues = cuesFor(events), names = cues.map(c => c.name);
    assert.ok(names.includes('flesh_stab')); assert.ok(names.includes('crowd_cheer')); assert.ok(names.includes('death_voice'));
  }
  assert.ok(cuesFor([ev('Killed', { move: 'light_right', weapon: 'estoc' })]).some(c => c.name === 'flesh_stab'));
  const kick = cuesFor([ev('Killed', { move: 'kick' })]);
  assert.ok(!kick.some(c => c.name.startsWith('flesh_') || c.name === 'bone_crack'));
  assert.ok(kick.some(c => c.name === 'crowd_cheer'));
  const double = cuesFor([ev('Killed', { target: 1 }), ev('Killed', { actor: 1, target: 0 })]);
  assert.equal(double.filter(c => c.name === 'crowd_gasp').length, 1); assert.ok(!double.some(c => c.name === 'crowd_cheer'));
  const playerDeath = deathPresentation('decapitation'); playerDeath.finish.victim = 0;
  assert.ok(!cuesFor([ev('Killed', { actor: 1, target: 0 })], playerDeath).some(c => c.name === 'flesh_tear'), 'an override cannot invent a finisher on player death');
});
test('quiet and mute cancel the entire fatal sequence, including crowd and body scheduled in the future', () => {
  for (const method of ['quiet', 'toggle'] as const) {
    const { feedback, context, at } = hosted(731, SPRITE); feedback.unlock();
    feedback.update(deathEvents, deathPresentation('decapitation'));
    assert.ok(context.starts.some(s => s.when >= 1.4), 'collapse is scheduled ahead');
    assert.ok(context.starts.some(s => MANIFEST.crowd_cheer.some(([offset]) => s.offset === offset)));
    at(.1); feedback[method]();
    assert.equal(context.stops.filter(t => t === .1).length, context.starts.length, 'every scheduled source is stopped');
    const count = context.starts.length; at(1); feedback.update(deathEvents); assert.equal(context.starts.length, count);
    if (method === 'toggle') feedback.toggle(); else feedback.unlock();
    assert.equal(context.starts.length, count, 'unlock does not replay the old sequence');
  }
});
