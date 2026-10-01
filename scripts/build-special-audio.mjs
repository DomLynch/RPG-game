// Reproducible audio for the Centurion's rank 8-10 specials (docs/briefs/specials/centurion-l8-l10-2026-10-01.md): the hooves of THE CHARGE (rank 9),
// the sand thud of Ajax's SHIELD QUAKE (rank 8) and the crowd-roar swell of Mars's BLOOD TITHE (rank 10). Synthesised from noise and resonant modes:
// original work, no recordings, no licence to carry. Own small files (src/assets/special-audio/): the sprite and the arena bank have no headroom.
// The helpers below repeat build-gate-audio.mjs on purpose: that script's rebuild is pinned byte-identical, so it is not refactored to share them.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const RATE = 48000, S = s => Math.round(s * RATE), CEILING_DB = -4;
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const peakOf = x => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
const noise = (r, n) => Float32Array.from({ length: n }, () => r() * 2 - 1);
function biquad(x, type, f, Q = .707) {   // RBJ
  const w = 2 * Math.PI * f / RATE, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q), a0 = 1 + alpha;
  const [b0, b1, b2] = type === 'lowpass' ? [(1 - cw) / 2, 1 - cw, (1 - cw) / 2] : type === 'highpass' ? [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2] : [alpha, 0, -alpha];
  const y = new Float32Array(x.length), a1 = -2 * cw / a0, a2 = (1 - alpha) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2) / a0 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
const mode = (n, f, t60, amp = 1) => { const y = new Float32Array(n), k = 6.9078 / (t60 * RATE); for (let i = 0; i < n; i++) y[i] = amp * Math.exp(-k * i) * Math.sin(2 * Math.PI * f * i / RATE); return y; };
const decay = (n, t60, attack = .001) => { const a = Math.max(1, S(attack)), k = 6.9078 / (t60 * RATE); return Float32Array.from({ length: n }, (_, i) => Math.min(1, i / a) * Math.exp(-k * Math.max(0, i - a))); };
const add = (out, x, at, g = 1) => { const o = S(at); for (let i = 0; i < x.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += x[i] * g; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// One hoof on sand: a muffled mid clop (the part a phone plays) over a low body thump. `near` 0..1 is how close the rider is: far hooves are dull and soft.
const hoof = (r, near) => {
  const n = S(.14), y = new Float32Array(n), env = decay(n, .035 + .02 * near, .002);
  const clop = biquad(noise(r, n), 'bandpass', 600 + 1500 * near * (.8 + .4 * r()), .9);
  for (let i = 0; i < n; i++) y[i] = clop[i] * env[i] * 5;
  for (const [f, t60, a] of [[88 * (1 + (r() - .5) * .12), .1, .9], [260 * (1 + (r() - .5) * .1), .05, .35]]) mode(n, f, t60, a).forEach((v, i) => { y[i] += v; });
  return y;
};

// THE CHARGE: unseen cavalry building over ~0.9 s on sand. A handful of riders on a four-beat gallop that quickens; every hoof louder and brighter than the last,
// then the arrival: the last beat, a thud of weight and a rush of air. The cue ends at ARRIVE; the blow itself is the hit cue's.
const ARRIVE = .95;
function charge() {
  const r = rng(0x63686772), out = new Float32Array(S(1.2));   // "chgr"
  const riders = 6, phases = [0, .17, .34, .5];
  for (let h = 0; h < riders; h++) {
    const lag = r() * .16, bias = .85 + .3 * r(); let t = -lag, stride = .36;   // the stride shortens as they lean into the run
    while (t < ARRIVE - .02) {
      for (const p of phases) {
        const at = t + p * stride * (1 + (r() - .5) * .06);
        if (at < 0 || at > ARRIVE) continue;
        const near = Math.pow(at / ARRIVE, 1.5);
        add(out, hoof(r, near), at, (.06 + .94 * near) * bias * (.8 + .4 * r()));
      }
      t += stride; stride = Math.max(.24, stride * .9);
    }
  }
  const air = biquad(noise(r, S(.5)), 'bandpass', 1100, .6), shape = Float32Array.from({ length: air.length }, (_, i) => Math.pow(smooth(0, 1, i / air.length), 2.2) * (i / air.length > .95 ? 0 : 1));
  add(out, air.map((v, i) => v * shape[i] * 1.2), ARRIVE - .42);   // the rush of air and dust ahead of him
  const thud = new Float32Array(S(.4)), env = decay(thud.length, .22, .004);   // the weight arriving
  for (const [f, t60, a] of [[72, .3, 1], [125, .18, .6]]) mode(thud.length, f, t60, a).forEach((v, i) => { thud[i] += v; });
  add(out, thud.map((v, i) => v * env[i] * 1.6), ARRIVE - .01, .9);
  return out;
}

// SHIELD QUAKE: the rim goes into the sand, a thud from below, and sand grains run away along the ground as the ripple travels.
function quake() {
  const r = rng(0x71756b65), out = new Float32Array(S(.9));   // "quke"
  const n = S(.5), body = new Float32Array(n), env = decay(n, .28, .003);
  for (const [f, t60, a] of [[58, .38, 1], [96, .26, .8], [190, .12, .35]]) mode(n, f, t60, a).forEach((v, i) => { body[i] += v; });
  const crunch = biquad(noise(r, n), 'lowpass', 700).map((v, i) => v * env[i] * 2.2);   // sand packing under the rim
  add(out, body.map((v, i) => (v + crunch[i]) * env[i] * 1.5), .03);
  const m = S(.7), grains = biquad(noise(r, m), 'bandpass', 2600, .8), run = Float32Array.from({ length: m }, (_, i) => { const t = i / m; return Math.sin(Math.PI * Math.pow(t, .6)) * (.4 + .6 * r()); });
  add(out, grains.map((v, i) => v * run[i] * .55), .06);   // the ripple running off along the ground, grain by grain
  return out;
}

// BLOOD TITHE: a crowd's roar swelling to a peak as the red dust pours into the blade, then falling away. Dozens of detuned throats under a vowel-ish
// formant pair, each swaying slowly so no two moments sound alike, with a breath of noise for the rest of the stands.
function tithe() {
  const r = rng(0x74697468), LENGTH = 3, PEAK = 2.0, n = S(LENGTH), swell = t => t < PEAK ? Math.pow(t / PEAK, 1.7) : Math.exp(-(t - PEAK) / .17);
  const voices = new Float32Array(n);
  for (let v = 0; v < 28; v++) {
    const base = 95 + r() * 150, rate = 4 + r() * 3, depth = .012 + .02 * r(), start = r() * .6, ph = r() * 6.28; let p = 0;
    for (let i = 0; i < n; i++) { const t = i / RATE; if (t < start) continue; p = (p + base * (1 + depth * Math.sin(2 * Math.PI * rate * t + ph) + .3 * t / LENGTH * .05) / RATE) % 1; voices[i] += (2 * p - 1) * (.5 + .5 * Math.sin(2 * Math.PI * (.3 + r() * .01) * t + ph)); }
  }
  const body = biquad(voices, 'bandpass', 520, 1.1), upper = biquad(voices, 'bandpass', 1450, 1.4), breath = biquad(noise(r, n), 'bandpass', 900, .5);
  return Float32Array.from({ length: n }, (_, i) => (body[i] + .55 * upper[i] + .35 * breath[i]) * swell(i / RATE));
}


// The Nightborn bosses' rank 8-10 specials share one clock (src/special-timing.ts): the cast starts at SpecialStarted, the strike lands at LANDED = 119 ticks = 1.983 s,
// and the cast recovers over the next 0.75 s. Each cue below starts with the cast and its payoff sits on LANDED; the hit cue is the hit's own.
const LANDED = 1.983;
// Chamberlin state-variable filter with a moving cutoff (Hz as a function of time): the sweeps below need a filter that changes while it runs.
function sweep(x, type, fc, q = .7) {
  const y = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fc(i / RATE), 6000) / RATE), high = x[i] - low - q * band; band += f * high; low += f * band; y[i] = type === 'lowpass' ? low : type === 'bandpass' ? band : high; }
  return y;
}
const grains = (r, n, from, to, edge) => {   // sand grains skittering: random clicks whose rate climbs (or falls) from `from` to `to` per second, `edge(t)` their level
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE, rate = from + (to - from) * t / (n / RATE); if (r() < rate / RATE) { const g = edge(t) * (.3 + .7 * r()); for (let k = 0; k < 40 && i + k < n; k++) y[i + k] += g * (r() * 2 - 1) * Math.exp(-k / 8); } }
  return y;
};
const mix = (out, x, g = 1) => { for (let i = 0; i < out.length && i < x.length; i++) out[i] += x[i] * g; };

// RED WIND (Set, rank 8): wind and sand skittering low across the arena, then the ground bursts up in peeling sheets, then the scour and the grains falling.
function redwind() {
  const r = rng(0x72656477), n = S(2.8), out = new Float32Array(n);   // "redw"
  const wind = sweep(noise(r, n), 'bandpass', t => 250 + 950 * Math.min(1, t / LANDED), 1.1);
  mix(out, wind.map((v, i) => { const t = i / RATE; return t < LANDED ? v * Math.pow(t / LANDED, 2) * 1.3 : v * Math.exp(-(t - LANDED) / .35) * 1.3; }));
  mix(out, grains(r, n, 8, 140, t => t < LANDED ? .35 * Math.pow(t / LANDED, 1.5) : .35 * Math.exp(-(t - LANDED) / .3)), 1);
  const burst = sweep(noise(r, S(.7)), 'lowpass', t => 5200 * Math.exp(-t / .12) + 380, .9), benv = decay(burst.length, .4, .002);   // the ground goes up
  add(out, burst.map((v, i) => v * benv[i] * 3.2), LANDED);
  for (const [t, f, len] of [[.01, 1400, .16], [.1, 2000, .14], [.19, 1700, .18], [.32, 2600, .14], [.46, 1300, .2]]) {   // sheets of sand peeling off the burst
    const m = S(len), sh = biquad(noise(r, m), 'bandpass', f * (.9 + .2 * r()), .8); add(out, sh.map((v, i) => v * Math.sin(Math.PI * i / m) * 1.6), LANDED + t); }
  const thud = new Float32Array(S(.4)); for (const [f, t60, a] of [[62, .3, 1], [120, .15, .5]]) mode(thud.length, f, t60, a).forEach((v, i) => { thud[i] += v; });
  add(out, thud, LANDED, .9);
  return out;
}

// HADES' SHADOW (rank 9): a low dark murmur gathers over the whole wind-up, the cloud falls in the last 0.4 s on a sinking rush, lands soft and heavy, and hushes.
function hades() {
  const r = rng(0x68616465), n = S(2.9), out = new Float32Array(n), FALL = LANDED - .4;   // "hade"
  const rumble = sweep(noise(r, n), 'lowpass', () => 150, .9), murmur = sweep(noise(r, n), 'bandpass', t => 380 + 60 * Math.sin(t * 2.1), 1.6);
  for (let i = 0; i < n; i++) { const t = i / RATE, up = t < LANDED ? Math.pow(t / LANDED, 1.8) : Math.exp(-(t - LANDED) / .3), beat = .65 + .35 * Math.sin(2 * Math.PI * 1.3 * t);
    out[i] += (rumble[i] * 2.2 + murmur[i] * 1.5 * beat) * up + up * (.5 * Math.sin(2 * Math.PI * 92 * t) + .4 * Math.sin(2 * Math.PI * 97 * t) + .22 * Math.sin(2 * Math.PI * 184 * t)); }
  const m = S(.45), rush = sweep(noise(r, m), 'lowpass', t => 2600 * Math.exp(-t / .16) + 240, .8);   // the cloud dropping onto the head
  add(out, rush.map((v, i) => v * Math.pow(smooth(0, 1, i / m), 1.5) * (i / m > .9 ? 1 - (i / m - .9) / .1 : 1) * 2), FALL);
  const land = new Float32Array(S(.5)), env = decay(land.length, .3, .004);   // it lands soft and heavy: weight, not a crack
  for (const [f, t60, a] of [[52, .4, 1], [104, .22, .6]]) mode(land.length, f, t60, a).forEach((v, i) => { land[i] += v; });
  const cloth = biquad(noise(r, land.length), 'lowpass', 420);   // the cloud's body folding over the head
  add(out, land.map((v, i) => (v + cloth[i] * 1.6) * env[i] * 1.5), LANDED, 1);
  return out;
}

// NYX'S NIGHTFALL (rank 10): the light draining out: a sweep sinking from bright to dark with a falling tone, then the veil: one long rush that crosses the arena and thins.
function nyx() {
  const r = rng(0x6e79782e), n = S(3.3), out = new Float32Array(n);   // "nyx."
  const drain = sweep(noise(r, n), 'bandpass', t => 3400 * Math.exp(-Math.min(t, LANDED) / .62) + 260, 1.3);
  mix(out, drain.map((v, i) => { const t = i / RATE; return v * (t < LANDED ? Math.sin(Math.PI / 2 * smooth(0, .5, t)) * (1 - .6 * t / LANDED) : 0) * 1.6; }));
  let p = 0; for (let i = 0; i < S(LANDED + .15); i++) { const t = i / RATE, f = 700 * Math.exp(-t / 1.1) + 110; p += f / RATE; out[i] += Math.sin(2 * Math.PI * p) * .35 * smooth(0, .4, t) * (t > LANDED ? 1 - (t - LANDED) / .15 : 1); }
  const m = S(1.3), veil = sweep(noise(r, m), 'bandpass', t => 500 + 2100 * Math.sin(Math.PI * Math.min(1, t / 1.1)), 1.0);
  add(out, veil.map((v, i) => v * Math.pow(Math.sin(Math.PI * Math.min(1, i / m)), 1.6) * 2.4), LANDED - .05);   // the veil sweeping through
  const boom = new Float32Array(S(.6)), env = decay(boom.length, .45, .01); for (const [f, t60, a] of [[46, .5, 1], [92, .3, .5], [165, .22, .9], [330, .12, .4]]) mode(boom.length, f, t60, a).forEach((v, i) => { boom[i] += v * env[i]; });   // the upper modes are what a phone plays
  add(out, boom, LANDED, 1.2);
  return out;
}


// Goblin and Pitborn bosses (boss-specials-proposals-2026-10-01.md, the ★ picks): same cast clock, same shape as above (cast at 0, payoff on LANDED).
const foot = (r, f = 1) => { const n = S(.07), y = biquad(noise(r, n), 'bandpass', 1900 * f * (.85 + .3 * r()), 1.1), env = decay(n, .02, .001); const m = mode(n, 190 * f, .035, .5); return y.map((v, i) => (v * 4 + m[i]) * env[i]); };   // one light foot on sand
const run = (out, r, from, to, steps, g, f = 1) => { for (let k = 0; k < steps; k++) { const u = k / Math.max(1, steps - 1), t = from + (to - from) * Math.pow(u, .8); add(out, foot(r, f), t, g * (.6 + .4 * u) * (.8 + .4 * r())); } };   // footfalls quickening from `from` to `to`
const thump = (out, t, g = 1, f = 62, t60 = .3) => { const y = new Float32Array(S(t60 + .2)); for (const [m, d, a] of [[f, t60, 1], [f * 1.9, t60 * .5, .5]]) mode(y.length, m, d, a).forEach((v, i) => { y[i] += v; }); add(out, y, t, g); };

// DIRTY FISTFUL (Reynard, goblin rank 8): a crouch and a scoop of sand dragging, then it is flung in the face and the blow comes through it.
function fistful() {
  const r = rng(0x66697374), n = S(2.5), out = new Float32Array(n);   // "fist"
  mix(out, grains(r, n, 4, 70, t => t < 1.6 ? .5 * Math.pow(t / 1.6, 1.2) : 0), 1);   // the hand dragging through the sand
  mix(out, sweep(noise(r, n), 'bandpass', t => 500 + 500 * smooth(0, 1.6, t), 1.2).map((v, i) => { const t = i / RATE; return v * (t < 1.7 ? .5 * Math.pow(t / 1.7, 2) : 0); }));
  const fling = sweep(noise(r, S(.45)), 'highpass', t => 1200 + 3800 * Math.exp(-t / .1), .9), fenv = decay(fling.length, .22, .004);   // the handful thrown: a hard spray, then it thins out
  add(out, fling.map((v, i) => v * fenv[i] * 2.4), LANDED - .22);
  mix(out, add2(grains(r, S(.7), 220, 20, t => .8 * Math.exp(-t / .2)), LANDED - .2, n), 1);
  thump(out, LANDED, .8, 110, .12);   // the blow through it
  return out;
}
// Places a buffer's samples at `t` in a fresh array of length n (grains() builds from zero).
const add2 = (x, t, n) => { const y = new Float32Array(n); add(y, x, t); return y; };

// GONE (Hermes, rank 9): a held breath of grains, a dust puff where he stood, then fast footfalls that quicken round to behind the foe and land with the blow.
function gone() {
  const r = rng(0x676f6e65), n = S(2.4), out = new Float32Array(n), PUFF = 1.45;   // "gone"
  mix(out, grains(r, n, 3, 12, () => .12), 1);
  const puff = sweep(noise(r, S(.3)), 'lowpass', t => 3000 * Math.exp(-t / .07) + 300, .8), penv = decay(puff.length, .14, .003);
  add(out, puff.map((v, i) => v * penv[i] * 2.2), PUFF);
  run(out, r, PUFF + .06, LANDED - .03, 14, 1.1);   // fast footprints, closing from his old place to the foe's back
  thump(out, LANDED, .6, 130, .1);
  return out;
}

// THREE LIARS (Loki, rank 10): three runners come in, two lighter and airier that die away a beat before the end, one landing with the blow.
function liars() {
  const r = rng(0x6c696172), n = S(2.5), out = new Float32Array(n), IN = 1.3;   // "liar"
  mix(out, grains(r, n, 3, 14, () => .1), 1);
  run(out, r, IN, LANDED, 12, 1.0);                                   // the real one
  for (const [f, lag, kill] of [[1.25, .03, .35], [.8, -.04, .22]]) {   // the afterimages: other pitch, thinner, gone before the strike
    const part = new Float32Array(n); run(part, r, IN + lag, LANDED + lag, 12, .6, f);
    mix(out, part.map((v, i) => { const t = i / RATE; return v * (t < LANDED - kill ? 1 : Math.max(0, 1 - (t - (LANDED - kill)) / .12)); }));
  }
  mix(out, sweep(noise(r, n), 'bandpass', t => 1500 + 1200 * smooth(IN, LANDED, t), 1.0).map((v, i) => { const t = i / RATE; return t > IN && t < LANDED + .1 ? v * .5 * Math.sin(Math.PI * smooth(IN, LANDED + .1, t)) : 0; }));   // air through three bodies
  thump(out, LANDED, .8, 120, .12);
  return out;
}

// CRACKING GROUND (Antaeus, pitborn rank 8): a low strain gathering through his palms, ragged cracks running out and quickening, clods lifting, the heave of the bear-hug.
function cracking() {
  const r = rng(0x63726163), n = S(2.9), out = new Float32Array(n);   // "crac"
  mix(out, sweep(noise(r, n), 'lowpass', t => 120 + 200 * smooth(0, LANDED, t), .9).map((v, i) => { const t = i / RATE; return v * (t < LANDED ? 1.6 * Math.pow(t / LANDED, 1.6) : 1.6 * Math.exp(-(t - LANDED) / .4)); }));
  let t = .5; while (t < LANDED) { const len = S(.06 + .1 * r()), crack = biquad(noise(r, len), 'bandpass', 700 + 2300 * r(), 1.4), cenv = decay(len, .035, .001); add(out, crack.map((v, i) => v * cenv[i] * 4), t, .4 + .6 * t / LANDED); thump(out, t, .12 * t / LANDED, 90 + 40 * r(), .06); t += (.38 - .3 * t / LANDED) * (.6 + .8 * r()); }   // the cracks run out: further apart at first, then a rattle
  add(out, grains(r, S(.9), 90, 6, t => .6 * Math.exp(-t / .3)), LANDED, 1);   // clods lifting and falling
  thump(out, LANDED, 1.5, 48, .5);
  mix(out, sweep(noise(r, n), 'lowpass', () => 300, .8).map((v, i) => { const t = i / RATE; return t > LANDED ? v * 1.2 * Math.exp(-(t - LANDED) / .5) : 0; }));
  return out;
}

// ASH FALL (Surtr, rank 9): ash drifting down as a soft high hush with embers ticking, sand scorching with a thin hiss, then one slow heavy cleave and a hush.
function ashfall() {
  const r = rng(0x61736866), n = S(3), out = new Float32Array(n);   // "ashf"
  const hush = sweep(noise(r, n), 'bandpass', t => 3800 - 1600 * smooth(0, LANDED, t), .6);
  for (let i = 0; i < n; i++) { const t = i / RATE, up = t < LANDED ? Math.pow(t / LANDED, 1.4) : Math.exp(-(t - LANDED) / .5); out[i] += hush[i] * up * .7; }
  mix(out, grains(r, n, 3, 22, t => t < LANDED ? .22 : .2 * Math.exp(-(t - LANDED) / .5)), 1);   // embers ticking
  const hiss = sweep(noise(r, S(.9)), 'highpass', () => 4200, .8);   // where the sand scorches black
  add(out, hiss.map((v, i) => { const u = i / S(.9); return v * Math.sin(Math.PI * u) * .5; }), LANDED - .6);
  const swing = sweep(noise(r, S(.5)), 'lowpass', t => 260 + 900 * Math.sin(Math.PI * Math.min(1, t / .5)), .8);   // the slow cleave coming round
  add(out, swing.map((v, i) => v * Math.pow(Math.sin(Math.PI * i / S(.5) / 1.0), 1.2) * 2.4), LANDED - .46);
  thump(out, LANDED, 1.4, 55, .45);
  return out;
}

// WIND WALL (Typhon, rank 10): a gale building in gusts and flinging sand sideways, banners snapping, the lunge on the last gust.
function windwall() {
  const r = rng(0x77696e64), n = S(2.9), out = new Float32Array(n);   // "wind"
  const gale = sweep(noise(r, n), 'bandpass', t => 350 + 1100 * smooth(0, LANDED, t) + 200 * Math.sin(t * 5.3), .9);
  for (let i = 0; i < n; i++) { const t = i / RATE, gust = .6 + .4 * Math.sin(2 * Math.PI * (1.1 + .5 * t / LANDED) * t) * Math.sin(2 * Math.PI * .37 * t + 1), up = t < LANDED ? Math.pow(t / LANDED, 1.5) : Math.exp(-(t - LANDED) / .35); out[i] += gale[i] * gust * up * 1.7; }
  mix(out, grains(r, n, 10, 220, t => t < LANDED ? .4 * Math.pow(t / LANDED, 1.3) : .4 * Math.exp(-(t - LANDED) / .3)), 1);   // sand whipped sideways
  for (const t of [.78, 1.22, 1.62]) { const len = S(.12), snap = sweep(noise(r, len), 'highpass', () => 2200, .8), senv = decay(len, .05, .001); add(out, snap.map((v, i) => v * senv[i] * 3.2), t, .8 + .2 * r()); thump(out, t, .15, 150, .05); }   // banners cracking
  thump(out, LANDED, 1, 70, .25);
  return out;
}

// Level: the phone-band K-weighted momentary max the sprite and the gate are matched on, and the −4 dBFS soft-clip ceiling every sprite cue has.
function phoneMomentary(x) {
  const w = 2 * Math.PI * 300 / RATE, c = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + alpha;
  const hp = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0];
  const filter = (x, [b0, b1, b2, a1, a2]) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  const k = [hp, hp, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, .73248077421585], [1, -2, 1, -1.99004745483398, .99007225036621]].reduce(filter, x);
  const block = S(.4), hop = S(.1); let max = 0;
  for (let start = 0; start === 0 || start + block <= k.length; start += hop) { let sum = 0; for (let i = start; i < Math.min(k.length, start + block); i++) sum += k[i] * k[i]; max = Math.max(max, sum / block); }
  return -.691 + 10 * Math.log10(max);
}
// Targets sit under the gate's −19: the charge and the tithe are builds that the hit lands over, the quake is a short low thud the handset only half plays.
const CUES = { charge: { make: charge, lufs: -24 }, quake: { make: quake, lufs: -23 }, tithe: { make: tithe, lufs: -25 }, redwind: { make: redwind, lufs: -25, fade: .25 }, hades: { make: hades, lufs: -25, fade: .25 }, nyx: { make: nyx, lufs: -25, fade: .25 },
  fistful: { make: fistful, lufs: -25, fade: .25 }, gone: { make: gone, lufs: -25, fade: .25 }, liars: { make: liars, lufs: -25, fade: .25 }, cracking: { make: cracking, lufs: -25, fade: .25 }, ashfall: { make: ashfall, lufs: -25, fade: .25 }, windwall: { make: windwall, lufs: -25, fade: .25 } };
const dir = 'src/assets/special-audio', work = 'artifacts/audio/special'; await fs.mkdir(dir, { recursive: true }); await fs.mkdir(work, { recursive: true });
const report = {};
for (const [name, { make, lufs, fade = .04 }] of Object.entries(CUES)) {
  const out = make(), c = 10 ** (CEILING_DB / 20), clip = g => out.map(v => c * Math.tanh(v * g / c));
  for (let i = 0, n = S(fade); i < n; i++) out[out.length - 1 - i] *= i / n;   // ends on zero (the long-tail cues take a longer fade)
  let lo = 1e-3, hi = 1e3; for (let k = 0; k < 40; k++) { const g = Math.sqrt(lo * hi); if (phoneMomentary(clip(g)) < lufs) lo = g; else hi = g; }
  const shaped = clip(Math.sqrt(lo * hi)), seconds = shaped.length / RATE;
  const raw = `${work}/${name}.f32`; await fs.writeFile(raw, Buffer.from(shaped.buffer));
  report[name] = { seconds, phoneMomentaryLufs: phoneMomentary(shaped), peakDbfs: 20 * Math.log10(peakOf(shaped)), codecs: {} };
  for (const [file, codec] of [[`${name}.m4a`, ['-c:a', 'aac_at', '-b:a', '48k', '-movflags', '+faststart']], [`${name}.ogg`, ['-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio']]]) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', `${RATE}`, '-ac', '1', '-i', raw, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', ...codec, `${dir}/${file}`], { timeout: 60000 });
    const bytes = await fs.readFile(`${dir}/${file}`), decoded = execFileSync('ffmpeg', ['-v', 'error', '-i', `${dir}/${file}`, '-ac', '1', '-ar', `${RATE}`, '-f', 'f32le', '-'], { maxBuffer: 32e6, timeout: 60000 });
    const data = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.length / 4);
    if (data.length < S(seconds - .1)) throw Error(`${file}: decoded ${data.length / RATE} s, expected ~${seconds} s`);
    if (peakOf(data) >= 1) throw Error(`${file}: encoded clipping`);
    if (peakOf(data.subarray(data.length - S(.03))) > .01) throw Error(`${file}: does not end on silence`);
    report[name].codecs[file] = { bytes: bytes.length, gzip: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
await fs.writeFile(`${work}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
