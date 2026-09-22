import type { CombatEvent } from './combat.ts';
import { cuesFor, nextVariant, PITCH_SPREAD, seeded, type Cue, type DeathPresentation } from './audio/cues.ts';
import { MANIFEST, type CueName } from './audio/manifest.ts';
import { loadSprite } from './audio/sprite.ts';
import { createArenaAudio, type ArenaFrame } from './audio/arena.ts';

// Offline rendering host (scripts/audio-preview.mjs): a supplied OfflineAudioContext and a scripted clock stand in for the
// page's AudioContext and its wall clock, so a fixed exchange renders to the same WAV every time. `sprite` null forces the
// synth fallback; a buffer skips loading. Absent in the game.
type FeedbackHost = { context: BaseAudioContext; now: () => number; seed?: number; sprite?: AudioBuffer | null; balance?: { combat: number; finish: number } };   // balance: evidence renders of the mix stage at other levels
export const VOICES = 8;   // simultaneous sample voices; the oldest-ending one is stolen past that
const BASE_SEED = 731;
// Owner phone mix (2026-09-19): half ordinary FX, +50 % for the fatal sequence. Owner 2026-09-20, phone at 20 % volume still loud:
// everything but the bell at 40 % (−8 dB): the first cut to 70 % was −3 dB, inaudible on the phone and swallowed by the output guard on the
// finishers (1.5 × .7 still clipped it); at .4 both combat and finish sit under the guard's linear region, so the whole cut is heard and the
// bell (arena.ts, exempt) leads by contrast.
const MIX = .4;
// Owner 2026-09-22, after the live set: "reduce all combat noise by 25 %, keep the crowd, opening bell and death all same — it's
// overpowering." Combat balance x.75; the finish balance (death sequence), the arena bank (crowd) and the bell are untouched.
export const COMBAT_LEVEL = .375 * MIX, FINISH_LEVEL = 1.5 * MIX;

// Combat Foley: the simulation's events pick cues from one decoded sprite (src/audio/manifest.ts, built by
// scripts/build-audio.mjs); seeded variant rotation and ±5 % pitch keep two hits from ever sounding identical. Voices feed a
// compressor and a −1 dBFS soft ceiling; a share of each voice goes to a short arena reverb. Until the sprite is decoded,
// the original synthesised layers stand in so no event is ever silent.
export function createFeedback(host?: FeedbackHost) {
  type Voice = { source: AudioBufferSourceNode | null; gain: GainNode; send: GainNode; until: number };
  let suspensions = 0;
  let pendingDraw: number | undefined;
  let arenaAudio: ReturnType<typeof createArenaAudio> | undefined, arenaOutput: AudioNode;
  let context: BaseAudioContext | undefined, master: GainNode | undefined, balance: GainNode | undefined, bus: DynamicsCompressorNode | undefined, noise: AudioBuffer | undefined;
  const level = host?.balance ?? { combat: COMBAT_LEVEL, finish: FINISH_LEVEL };
  let sprite: AudioBuffer | null | undefined, loading: Promise<boolean> | undefined, enabled = true, quieted = false, duel = 0, random = seeded(BASE_SEED);
  const sources = new Set<AudioScheduledSourceNode>();
  const voices: Voice[] = [], last: Partial<Record<CueName, number>> = {};
  const live = () => !!host || context?.state === 'running';
  const now = () => host ? host.now() : context!.currentTime;
  function unlock() {
    if (!enabled || (!host && typeof AudioContext === 'undefined')) return;
    if (!context) {
      if (host) context = host.context; else try { context = new AudioContext(); } catch { enabled = false; return; }
      // iOS mutes "ambient" web audio under the ringer switch; a playback session plays like a game does (Safari 17+).
      const session = host || typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) try { session.type = 'playback'; } catch { /* unsupported value on older WebKit */ }
      build(context);
      if (host && host.sprite !== undefined) sprite = host.sprite;
      else loading = loadSprite(context).then(buffer => { sprite = buffer; return !!buffer; }, () => { sprite = null; return false; });
    }
    quieted = false;
    // iOS also parks the context in 'interrupted' after calls, Siri or an app switch; resume from any non-running state.
    if (!host && (context.state !== 'running' || suspensions > 0)) void (context as AudioContext).resume().catch(() => {});
  }
  // Graph: voice gain → compressor → ceiling → balance → safety → master → out; voice send → room → compressor. Built once, no per-play nodes but the source.
  function build(context: BaseAudioContext) {
    master = context.createGain(); master.gain.value = 1; master.connect(context.destination);
    // Apply the requested levels AFTER compression, so it cannot squash away the volume change.
    const safety = context.createWaveShaper(); safety.curve = outputCeiling(); safety.oversample = '4x'; safety.connect(master); arenaOutput = safety;
    balance = context.createGain(); balance.gain.value = level.combat; balance.connect(safety);
    const ceiling = context.createWaveShaper(); ceiling.curve = softCeiling(); ceiling.connect(balance);
    // Glue and density: the compressor leans on stacked hits and the makeup pushes the mix into the ceiling, which is what makes impacts read as big on a small speaker.
    const makeup = context.createGain(); makeup.gain.value = 2.1; makeup.connect(ceiling);   // +6.4 dB: restores the 4 dB of codec headroom baked into the sprite, plus glue
    bus = context.createDynamicsCompressor(); bus.threshold.value = -20; bus.knee.value = 10; bus.ratio.value = 5; bus.attack.value = .002; bus.release.value = .15; bus.connect(makeup);
    const room = context.createConvolver(); room.buffer = arena(context); room.connect(bus);
    for (let i = 0; i < VOICES; i++) { const gain = context.createGain(), send = context.createGain(); gain.connect(bus); gain.connect(send); send.connect(room); send.gain.value = 0; voices.push({ source: null, gain, send, until: 0 }); }
    noise = context.createBuffer(1, context.sampleRate * .3, context.sampleRate);
    const data = noise.getChannelData(0), r = seeded(host?.seed ?? BASE_SEED); for (let i = 0; i < data.length; i++) data[i] = r() * 2 - 1;
  }
  function play(cue: Cue, at: number) {
    const variants = MANIFEST[cue.name], index = nextVariant(random, variants.length, last[cue.name] ?? -1); last[cue.name] = index;
    const [start, duration] = variants[index], rate = 1 + (random() * 2 - 1) * PITCH_SPREAD, t = at + (cue.delay ?? 0);
    let voice = voices.find(v => !v.source || v.until <= t);
    if (!voice) { voice = voices.reduce((a, b) => a.until <= b.until ? a : b); try { voice.source!.stop(t); } catch { /* already ended */ } }
    const source = context!.createBufferSource(); source.buffer = sprite!; source.playbackRate.value = rate;
    source.connect(voice.gain); voice.gain.gain.setValueAtTime(cue.gain, t); voice.send.gain.setValueAtTime(cue.room, t);
    sources.add(source); source.start(t, start, duration); voice.source = source; voice.until = t + duration / rate;
    source.onended = () => { sources.delete(source); source.disconnect(); if (voice.source === source) voice.source = null; };
  }
  // Fallback while the sprite is still decoding: the original synthesised air, body and inharmonic steel layers.
  function synth(kind: 'swing' | 'hit' | 'steel' | 'parry' | 'charged', time: number) {
    const duration = kind === 'swing' ? .16 : kind === 'charged' ? .3 : .24, level = .7;
    const air = context!.createBufferSource(), filter = context!.createBiquadFilter(), gain = context!.createGain();
    air.buffer = noise!; filter.type = 'bandpass'; filter.frequency.value = kind === 'swing' ? 900 : 1800; filter.Q.value = .7;
    gain.gain.setValueAtTime(.001, time); gain.gain.exponentialRampToValueAtTime((kind === 'swing' ? .35 : .7) * level, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    air.connect(filter).connect(gain).connect(bus!); sources.add(air); air.start(time); air.stop(time + duration);
    air.onended = () => { sources.delete(air); air.disconnect(); filter.disconnect(); gain.disconnect(); };
    if (kind === 'swing') return;
    for (const frequency of kind === 'hit' ? [95, 173] : kind === 'parry' ? [940, 1491, 2273] : kind === 'charged' ? [131, 196] : [620, 1037, 1613]) {
      const tone = context!.createOscillator(), envelope = context!.createGain();
      tone.frequency.value = frequency; envelope.gain.setValueAtTime(.18 * level, time); envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
      tone.connect(envelope).connect(bus!); sources.add(tone); tone.start(time); tone.stop(time + duration);
      tone.onended = () => { sources.delete(tone); tone.disconnect(); envelope.disconnect(); };
    }
  }
  function stopSources() {
    pendingDraw = undefined;
    if (!context) return;
    arenaAudio?.stop();
    for (const source of sources) { try { source.stop(now()); } catch { /* already ended */ } }
    sources.clear();
    balance!.gain.cancelScheduledValues(now()); balance!.gain.setValueAtTime(level.combat, now());
    for (const voice of voices) { voice.source = null; voice.until = 0; voice.gain.gain.cancelScheduledValues(now()); voice.send.gain.cancelScheduledValues(now()); }
  }
  return {
    unlock,
    toggle() { enabled = !enabled; if (master && context) master.gain.setValueAtTime(enabled ? 1 : 0, now()); if (enabled) unlock(); else stopSources(); return enabled; },
    quiet() { quieted = true; stopSources(); if (!host && context?.state === 'running') { suspensions++; void (context as AudioContext).suspend().catch(() => {}).finally(() => { suspensions--; }); } },
    // Resolves true once the sprite is decoded, false if loading failed and the fallback stays. The offline harness awaits it.
    async ready() { const decoded = await (loading ?? Promise.resolve(!!sprite)); await arenaAudio?.ready(); return decoded; },
    // Sound consumes the simulation's events. Sprite: every mapped cue this tick, impacts first. Fallback: one cue, strongest first.
    update(events: CombatEvent[], presentation?: DeathPresentation, frame?: ArenaFrame) {
      if (!frame?.drawing || frame.ended || frame.match !== pendingDraw) pendingDraw = undefined;
      if (!enabled || quieted) return;
      // Touchend may enable WebKit audio after Draw's simulation tick. Keep only this still-active draw, never a stale cue.
      if (frame && !frame.ended && events.some(e => e.type === 'ActionStarted' && e.action === 'draw' && e.actor === 0)) pendingDraw = frame.match;
      if (!context || !live()) return;
      if (events.some(e => e.type === 'ActionStarted' && e.action === 'draw' && e.actor === 0)) random = seeded((host?.seed ?? BASE_SEED) + duel++ * 1013);   // a fresh duel, a fresh but repeatable roll
      const time = now();
      if (frame) { arenaAudio ??= createArenaAudio(context, arenaOutput, now); arenaAudio.update(events, frame, pendingDraw === frame.match); pendingDraw = undefined; }
      // Death ends the duel: the impact, voice, delayed body and crowd share the finishing level.
      // Empty post-death ticks keep it; fresh combat or quiet/mute returns to the ordinary level.
      if (events.length) balance!.gain.setValueAtTime(events.some(e => e.type === 'Killed') ? level.finish : level.combat, time);
      if (sprite) { for (const cue of cuesFor(events, presentation, frame?.opponent)) play(cue, time); return; }
      if (events.some(e => e.type === 'Hit' || e.type === 'GuardBroken')) synth('hit', time);
      else if (events.some(e => e.type === 'Parried')) synth('parry', time);
      else if (events.some(e => e.type === 'Blocked')) synth('steel', time);
      else if (events.some(e => e.type === 'Charged')) synth('charged', time);
      else if (events.some(e => e.type === 'AttackStarted' || (e.type === 'ActionStarted' && (e.action === 'draw' || e.action === 'roll')))) synth('swing', time);
    },
  };
}

// −1 dBFS soft ceiling: unity through the middle, tanh above, never past 0.89.
function softCeiling(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(1025 * 4)), limit = 10 ** (-1 / 20);
  for (let i = 0; i < curve.length; i++) { const x = (i / 512) - 1; curve[i] = limit * Math.tanh(x / limit); }
  return curve;
}
// Linear below 0.55; oversampling and headroom catch boosted fatal peaks between output samples.
function outputCeiling(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(1025 * 4)), knee = .55, span = 10 ** (-3 / 20) - knee;
  for (let i = 0; i < curve.length; i++) {
    const x = i / 512 - 1, a = Math.abs(x);
    curve[i] = a <= knee ? x : Math.sign(x) * (knee + span * Math.tanh((a - knee) / span));
  }
  return curve;
}
// Arena: a stone-walled decay, darkening as it fades. Built once from seeded noise; ConvolverNode normalises it.
function arena(context: BaseAudioContext): AudioBuffer {
  const seconds = .8, buffer = context.createBuffer(1, Math.round(context.sampleRate * seconds), context.sampleRate), data = buffer.getChannelData(0), r = seeded(97);
  let low = 0;
  for (let i = 0; i < data.length; i++) { const t = i / data.length, k = .12 + .5 * t; low += (r() * 2 - 1 - low) * (1 - k); data[i] = low * Math.exp(-6.9 * t) * (i < 240 ? i / 240 : 1); }
  return buffer;
}
