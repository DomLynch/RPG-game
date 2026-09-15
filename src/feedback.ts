import type { CombatEvent } from './combat.ts';

// Original synthesised Foley: short air, body and inharmonic steel layers, no downloads.
export function createFeedback() {
  let context: AudioContext | undefined, master: GainNode | undefined, noise: AudioBuffer | undefined, enabled = true;
  function unlock() {
    if (!enabled || typeof AudioContext === 'undefined') return;
    if (!context) {
      try { context = new AudioContext(); } catch { enabled = false; return; } master = context.createGain(); master.gain.value = .22; master.connect(context.destination);
      // iOS mutes "ambient" web audio under the ringer switch; a playback session plays like a game does (Safari 17+).
      const session = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) try { session.type = 'playback'; } catch { /* unsupported value on older WebKit */ }
      noise = context.createBuffer(1, context.sampleRate * .3, context.sampleRate);
      const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    // iOS also parks the context in 'interrupted' after calls, Siri or an app switch; resume from any non-running state.
    if (context.state !== 'running') void context.resume().catch(() => {});
  }
  function play(kind: 'swing' | 'hit' | 'steel' | 'parry' | 'charged') {
    if (!enabled || !context || !master || !noise || context.state !== 'running') return;
    const time = context.currentTime, duration = kind === 'swing' ? .16 : kind === 'charged' ? .3 : .24;
    const air = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    air.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = kind === 'swing' ? 900 : 1800; filter.Q.value = .7;
    gain.gain.setValueAtTime(.001, time); gain.gain.exponentialRampToValueAtTime(kind === 'swing' ? .35 : .7, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    air.connect(filter).connect(gain).connect(master); air.start(time); air.stop(time + duration);
    air.onended = () => { air.disconnect(); filter.disconnect(); gain.disconnect(); };
    if (kind === 'swing') return;
    for (const frequency of kind === 'hit' ? [95, 173] : kind === 'parry' ? [940, 1491, 2273] : kind === 'charged' ? [131, 196] : [620, 1037, 1613]) {
      const tone = context.createOscillator(), envelope = context.createGain();
      tone.frequency.value = frequency; envelope.gain.setValueAtTime(.18, time); envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
      tone.connect(envelope).connect(master); tone.start(time); tone.stop(time + duration);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
    }
  }
  return {
    unlock,
    toggle() { enabled = !enabled; if (master && context) master.gain.setValueAtTime(enabled ? .22 : 0, context.currentTime); if (enabled) unlock(); return enabled; },
    quiet() { if (context?.state === 'running') void context.suspend().catch(() => {}); },
    // Sound consumes the simulation's events; one cue per tick, strongest first.
    update(events: CombatEvent[]) {
      if (events.some(e => e.type === 'Hit' || e.type === 'GuardBroken')) play('hit');
      else if (events.some(e => e.type === 'Parried')) play('parry');
      else if (events.some(e => e.type === 'Blocked')) play('steel');
      else if (events.some(e => e.type === 'Charged')) play('charged');   // the hold has become the guard-breaking swing
      else if (events.some(e => e.type === 'AttackStarted' || (e.type === 'ActionStarted' && (e.action === 'draw' || e.action === 'roll')))) play('swing');
    },
  };
}
