// A zone's ambient bed (zone sandbox, 2026-10-15; the audit's B38: zone data names "wind" and nothing played it): synthesized with Web Audio, no sound files. Wind = looped noise through a band-pass whose centre
// drifts and whose level swells slowly; fire crackle = short filtered noise bursts at a rate that rises as the walker nears a fire. Every number is the zone's ambience row (props-defs.json ambience). The browser
// plays nothing before a gesture, so unlock() is called from the page's first one (like zone-sound.ts); `?sound=0` turns it off. `windAt` and `fireGain` are pure and tested; the audio graph is browser-only.
import type { Ambience } from '../world/props-rules.ts';

const TAU = Math.PI * 2;
/** The wind at clock t (s): the band-pass centre (Hz) and the level, both drifting on the row's sweep rate. Pure. */
export const windAt = (t: number, a: Ambience) => ({ freq: a.windFreq + Math.sin(t * TAU * a.windSweepHz) * a.windSweepDepth, gain: a.windGain * (0.75 + 0.25 * Math.sin(t * TAU * a.windSweepHz * 0.37 + 1.3)) });
/** The crackle level at `dist` metres from the nearest fire: full at the fire, 0 at fireRange, falling off squared. Pure. */
export const fireGain = (dist: number, a: Ambience): number => a.crackleGain * Math.max(0, 1 - dist / a.fireRange) ** 2;

export function createAmbience(row: Ambience, fires: readonly { x: number; z: number }[], hero: () => { x: number; z: number }, on = true) {
  let ctx: AudioContext | null = null, band: BiquadFilterNode | null = null, wind: GainNode | null = null, noise: AudioBuffer | null = null, t = 0, burstDebt = 0;
  const start = (): void => {
    if (ctx || !on || typeof AudioContext === 'undefined') return;
    ctx = new AudioContext(); const n = ctx.sampleRate * 2; noise = ctx.createBuffer(1, n, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = row.windQ; wind = ctx.createGain(); wind.gain.value = 0;
    src.connect(band); band.connect(wind); wind.connect(ctx.destination); src.start();
    document.addEventListener('visibilitychange', onVisible);
  };
  const onVisible = (): void => { if (!ctx) return; void (document.hidden ? ctx.suspend() : ctx.resume()); };
  const burst = (gain: number): void => {   // one crackle: a short, band-passed noise tick at a random pitch around the row's centre
    if (!ctx || !noise) return; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), len = row.crackleMs / 1000, at = ctx.currentTime;
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = row.crackleFreq * (0.6 + Math.random() * 0.8); f.Q.value = 1.2; g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(at, Math.random() * 1.5, len);
  };
  return {
    /** Call from a user gesture: browsers start audio only inside one. */
    unlock(): void { start(); if (ctx?.state === 'suspended') void ctx.resume(); },
    update(dt: number): void {
      if (!ctx || !band || !wind || ctx.state !== 'running') return;
      t += dt; const w = windAt(t, row); band.frequency.value = w.freq; wind.gain.value = w.gain;
      const h = hero(), dist = fires.length ? Math.min(...fires.map((f) => Math.hypot(f.x - h.x, f.z - h.z))) : Infinity, level = fireGain(dist, row);
      if (level > 0) { burstDebt += dt * row.crackleRate * (level / row.crackleGain); while (burstDebt >= 1) { burstDebt -= 1; burst(level * (0.4 + Math.random() * 0.6)); } } else burstDebt = 0;
    },
    dispose(): void { document.removeEventListener('visibilitychange', onVisible); void ctx?.close(); ctx = null; },
  };
}
