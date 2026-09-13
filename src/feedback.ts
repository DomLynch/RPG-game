import type { Practice } from './combat.ts';

// Original synthesised Foley: short air, body and inharmonic steel layers, no downloads.
export function createFeedback() {
  let context: AudioContext | undefined, master: GainNode | undefined, noise: AudioBuffer | undefined, enabled = true;
  function unlock() {
    if (!enabled || typeof AudioContext === 'undefined') return;
    if (!context) {
      try { context = new AudioContext(); } catch { enabled = false; return; } master = context.createGain(); master.gain.value = .22; master.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * .3, context.sampleRate);
      const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
  }
  function play(kind: 'swing' | 'hit' | 'steel' | 'parry') {
    if (!enabled || !context || !master || !noise || context.state !== 'running') return;
    const time = context.currentTime, duration = kind === 'swing' ? .16 : .24;
    const air = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    air.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = kind === 'swing' ? 900 : 1800; filter.Q.value = .7;
    gain.gain.setValueAtTime(.001, time); gain.gain.exponentialRampToValueAtTime(kind === 'swing' ? .35 : .7, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    air.connect(filter).connect(gain).connect(master); air.start(time); air.stop(time + duration);
    air.onended = () => { air.disconnect(); filter.disconnect(); gain.disconnect(); };
    if (kind === 'swing') return;
    for (const frequency of kind === 'hit' ? [95, 173] : kind === 'parry' ? [940, 1491, 2273] : [620, 1037, 1613]) {
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
    update(before: Practice, after: Practice) {
      if (after.health < before.health || after.playerHealth < before.playerHealth) play('hit');
      else if (after.reaction > before.reaction && after.result === 'parried') play('parry');
      else if ((after.stamina < before.stamina && after.result === 'blocked') || after.enemyStamina < before.enemyStamina) play('steel');
      else if ((after.phase === 'attack' && after.age === 4) || (after.phase === 'draw' && after.age === 12) || (after.phase === 'roll' && after.age === 1)) play('swing');
    },
  };
}
