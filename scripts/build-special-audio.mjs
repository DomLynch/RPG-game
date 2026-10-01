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

// The other eighteen bosses' ★ specials (Executioner, Dwarf, Shieldmaiden, Witch, Plague Doctor, Knight): same clock again, cast at 0, payoff on LANDED.
const up = (t, p = 1.5, tail = .4) => t < LANDED ? Math.pow(t / LANDED, p) : Math.exp(-(t - LANDED) / tail);   // a build to the strike, then a fall
const bed = (r, n, type, fc, q, g, p = 1.5, tail = .4) => sweep(noise(r, n), type, fc, q).map((v, i) => v * up(i / RATE, p, tail) * g);   // noise bed that builds to LANDED
const blow = (out, t, g = 1, f = 58, t60 = .35) => { thump(out, t, g, f, t60); const m = S(.09), c = biquad(noise(rng(0x626c6f77), m), 'bandpass', 1500, 1), e = decay(m, .03, .001); add(out, c.map((v, i) => v * e[i] * 3), t, g * .6); };   // a body blow: weight and a dry crack
const ring = (out, t, freqs, g = 1, t60 = .5) => { for (const [f, a] of freqs) add(out, mode(S(t60 + .1), f, t60 * (1 / (1 + f / 3000)), a), t, g); };   // struck metal: a few inharmonic modes
const howl = (out, t, len, f0, g) => { const m = S(len), y = new Float32Array(m); let p = 0; for (let i = 0; i < m; i++) { const u = i / m, f = f0 * (1 + .22 * Math.sin(Math.PI * u) * (1 + .1 * Math.sin(2 * Math.PI * 5.5 * u * len))); p += f / RATE; y[i] = (Math.sin(2 * Math.PI * p) + .5 * Math.sin(4 * Math.PI * p) + .3 * Math.sin(6 * Math.PI * p)) * Math.sin(Math.PI * u); } add(out, y, t, g); };
const buzz = (r, n, count, f0, g) => { const y = new Float32Array(n); for (let k = 0; k < count; k++) { const f = f0 * (.8 + .5 * r()), rate = 3 + 9 * r(), ph = r() * 6.28, dep = .03 + .05 * r(); let p = 0; for (let i = 0; i < n; i++) { p += f * (1 + dep * Math.sin(2 * Math.PI * rate * i / RATE + ph)) / RATE; y[i] += Math.tanh(2.5 * Math.sin(2 * Math.PI * p)) * g / count; } } return y; };

// BAYING CIRCLE (Arawn, executioner rank 8): dust trails running in low from the rim, hounds baying one after another, the circle closing on the foe at the strike.
function baying() {
  const r = rng(0x62617969), n = S(3), out = new Float32Array(n);   // "bayi"
  mix(out, bed(r, n, 'bandpass', t => 280 + 500 * smooth(0, LANDED, t), 1.1, 1.3, 1.7, .3));
  mix(out, grains(r, n, 6, 90, t => t < LANDED ? .3 * Math.pow(t / LANDED, 1.4) : 0), 1);
  [[.2, 1.0, 430], [.55, .95, 520], [.95, 1.0, 380], [1.3, .9, 470]].forEach(([t, len, f], k) => howl(out, t, len, f, .16 + .05 * k));
  blow(out, LANDED, .9, 70, .3);
  return out;
}

// LONG SHADOW (Thanatos, rank 9): the light dims, a dark drone swells while a shadow reaches out along the sand, one slow heavy blow.
function longshadow() {
  const r = rng(0x6c6f6e67), n = S(3.1), out = new Float32Array(n);   // "long"
  for (let i = 0; i < n; i++) { const t = i / RATE, u = up(t, 1.8, .55); out[i] += u * (.45 * Math.sin(2 * Math.PI * 98 * t) + .4 * Math.sin(2 * Math.PI * 101.5 * t) + .25 * Math.sin(2 * Math.PI * 196 * t)); }
  mix(out, sweep(noise(r, n), 'bandpass', t => 2600 * Math.exp(-Math.min(t, LANDED) / .7) + 240, 1.0).map((v, i) => v * Math.sin(Math.PI / 2 * smooth(0, .4, i / RATE)) * (i / RATE < LANDED ? 1 - .7 * i / RATE / LANDED : 0) * 1.5));   // the light going
  const m = S(1.1), reach = sweep(noise(r, m), 'lowpass', t => 220 + 700 * smooth(0, 1.0, t), .9);   // the shadow reaching along the sand
  add(out, reach.map((v, i) => v * Math.pow(i / m, 1.6) * 1.9), LANDED - 1.05);
  blow(out, LANDED, 1.5, 46, .55);
  return out;
}

// HARVEST SWEEP (The Reaper, rank 10): one huge scythe crescent, a swath of sand cut, the crowd leaning like wheat, the cut on the strike.
function harvest() {
  const r = rng(0x68617276), n = S(3), out = new Float32Array(n);   // "harv"
  const m = S(1.0), sw = sweep(noise(r, m), 'bandpass', t => 300 + 3200 * Math.pow(t / 1.0, 1.7), 1.0);   // the blade coming round
  add(out, sw.map((v, i) => v * Math.pow(Math.sin(Math.PI / 2 * i / m), 2.2) * 3), LANDED - 1.0);
  mix(out, sweep(noise(r, n), 'highpass', () => 4200, .6).map((v, i) => { const t = i / RATE, lean = .5 + .5 * Math.sin(2 * Math.PI * 2.2 * t); return v * lean * (t < LANDED ? .22 * Math.pow(t / LANDED, 1.2) : .22 * Math.exp(-(t - LANDED) / .6)); }));   // wheat leaning
  ring(out, LANDED - .02, [[2300, .4], [3600, .3], [5100, .15]], .5, .25);
  add(out, grains(r, S(.8), 300, 25, t => .9 * Math.exp(-t / .25)), LANDED, 1);   // the swath of sand cut
  blow(out, LANDED, 1.1, 66, .3);
  return out;
}

// THE WORD (Ptah, dwarf rank 8): a roar that cuts to silence, a few grains left hanging, then one hammer stroke and the pressure ring.
function theword() {
  const r = rng(0x776f7264), n = S(3), out = new Float32Array(n), CUT = 1.25;   // "word"
  const voice = sweep(noise(r, S(CUT)), 'bandpass', t => 520 + 300 * Math.sin(t * 6), 2.2), vo = sweep(noise(r, S(CUT)), 'bandpass', () => 1500, 1.8);
  add(out, voice.map((v, i) => v * 2.1 * smooth(0, .5, i / RATE) * (i / RATE > CUT - .03 ? Math.max(0, 1 - (i / RATE - (CUT - .03)) / .03) : 1) + vo[i] * .8 * smooth(0, .5, i / RATE)), 0);
  mix(out, grains(r, n, 2, 14, () => .09).map((v, i) => i / RATE > CUT && i / RATE < LANDED ? v : 0), 1);   // the hand-width of hanging sand
  blow(out, LANDED, 1.4, 52, .45);
  ring(out, LANDED, [[440, .5], [905, .35], [1830, .15]], .5, .5);
  const pr = sweep(noise(r, S(.7)), 'lowpass', t => 1800 * Math.exp(-t / .25) + 160, .8);   // the ring of pressure going out
  add(out, pr.map((v, i) => v * Math.exp(-i / RATE / .22) * 1.6), LANDED);
  return out;
}

// THREE BLOWS (Goibniu, rank 9): three rhythmic hammer strikes on the sand, iron grit spattering, the third landing on the foe.
function threeblows() {
  const r = rng(0x33626c6f), n = S(2.9), out = new Float32Array(n);   // "3blo"
  [[LANDED - 1.0, .5], [LANDED - .5, .7], [LANDED, 1.3]].forEach(([t, g]) => {
    blow(out, t, g, 70, .22); ring(out, t, [[520, .35], [1180, .3], [2330, .18]], g * .45, .18);
    add(out, grains(r, S(.45), 180, 15, e => .6 * Math.exp(-e / .1)), t, g);
  });
  mix(out, bed(r, n, 'bandpass', () => 800, .8, .25, 1.2, .3));
  thump(out, LANDED, 1, 42, .5);
  return out;
}

// RIM SHAKE (Hephaestus, rank 10): stamps that shake grit and dust down off the arena walls in sheets, the last one the strike.
function rimshake() {
  const r = rng(0x72696d73), n = S(3.1), out = new Float32Array(n);   // "rims"
  [[.3, .4], [.95, .6], [1.5, .8], [LANDED, 1.4]].forEach(([t, g]) => {
    thump(out, t, g, 56, .3);
    const m = S(.8), sheet = sweep(noise(r, m), 'highpass', u => 1800 + 2600 * Math.exp(-u / .3), .8);   // grit pouring down the wall
    add(out, sheet.map((v, i) => v * Math.exp(-i / RATE / .3) * 1.5 * g), t + .05);
    add(out, grains(r, S(.7), 140, 12, e => .5 * g * Math.exp(-e / .25)), t + .02);
  });
  mix(out, bed(r, n, 'lowpass', () => 220, .8, .8, 1.3, .5));
  return out;
}

// BARED FACE (Penthesilea, shieldmaiden rank 8): the arena goes still, dust hangs, the shield is lowered, one fast cut.
function baredface() {
  const r = rng(0x62617265), n = S(2.7), out = new Float32Array(n);   // "bare"
  mix(out, sweep(noise(r, n), 'bandpass', () => 420, .9).map((v, i) => { const t = i / RATE; return v * 1.1 * Math.max(0, 1 - t / 1.1); }));   // the crowd murmur falling away
  mix(out, grains(r, n, 2, 8, () => .07).map((v, i) => i / RATE > 1.0 && i / RATE < LANDED - .2 ? v : 0), 1);
  ring(out, 1.2, [[640, .3], [1410, .25]], .5, .22);   // the shield dropping to her side
  add(out, sweep(noise(r, S(.3)), 'bandpass', t => 1200 - 500 * t / .3, 1.2).map((v, i) => v * Math.sin(Math.PI * i / S(.3)) * .9), 1.1);
  const cut = sweep(noise(r, S(.22)), 'highpass', t => 1500 + 3500 * t / .22, .8);   // the fast cut
  add(out, cut.map((v, i) => v * Math.sin(Math.PI * i / S(.22)) * 2.6), LANDED - .2);
  ring(out, LANDED, [[1900, .3], [3200, .2]], .5, .2);
  blow(out, LANDED, .8, 90, .15);
  return out;
}

// THE RING (Brynhildr, rank 9): a dust wall lifting in a circle, its hiss turning faster and the crowd shut out as it closes, one strike.
function thering() {
  const r = rng(0x72696e67), n = S(2.9), out = new Float32Array(n);   // "ring"
  const wall = sweep(noise(r, n), 'bandpass', t => 900 + 700 * Math.sin(2 * Math.PI * (1.5 * t + .7 * t * t / LANDED)), 1.3);   // circling: the turn speeds up
  mix(out, wall.map((v, i) => v * up(i / RATE, 1.6, .3) * 2.2 * (.6 + .4 * Math.sin(2 * Math.PI * (2 * i / RATE + .9 * Math.pow(i / RATE, 2) / LANDED)))));
  mix(out, grains(r, n, 8, 160, t => t < LANDED ? .35 * Math.pow(t / LANDED, 1.3) : 0), 1);
  mix(out, sweep(noise(r, n), 'lowpass', t => 3000 * Math.exp(-t / .9) + 200, .9).map((v, i) => i / RATE < LANDED ? v * .4 * (1 - i / RATE / LANDED) : 0));   // the stands falling away
  blow(out, LANDED, 1.1, 64, .3);
  return out;
}

// AEGIS SWEEP (Athena, rank 10): the shield snaps forward, sand is thrown across the ground like a shaken cloth, the strike through it.
function aegis() {
  const r = rng(0x61656769), n = S(3), out = new Float32Array(n), SNAP = 1.35;   // "aegi"
  mix(out, bed(r, n, 'bandpass', t => 300 + 400 * smooth(0, SNAP, t), 1.0, .6, 1.4, .3).map((v, i) => i / RATE < SNAP ? v : 0));
  ring(out, SNAP, [[1250, .45], [2900, .3], [4400, .15]], .8, .3);   // the aegis snapping to
  thump(out, SNAP, .5, 120, .12);
  const m = S(.95), fan = sweep(noise(r, m), 'bandpass', t => 2400 - 1500 * t / .95, .7);   // the fan of sand: a cloth shaken out, flapping as it goes
  add(out, fan.map((v, i) => v * Math.exp(-i / RATE / .4) * (.55 + .45 * Math.sin(2 * Math.PI * 24 * i / RATE)) * 2.4), SNAP + .12);
  add(out, grains(r, S(.9), 200, 20, t => .55 * Math.exp(-t / .3)), SNAP + .1);
  blow(out, LANDED, 1.2, 60, .3);
  return out;
}

// AVALON MIST (Morgan le Fay, witch rank 8): a pale mist rolling in and closing round the legs like a hand, then a soft strike.
function avalon() {
  const r = rng(0x6176616c), n = S(3), out = new Float32Array(n);   // "aval"
  mix(out, sweep(noise(r, n), 'bandpass', t => 2400 - 1900 * smooth(.5, LANDED, t), .5).map((v, i) => v * up(i / RATE, 1.3, .6) * 1.8));
  for (let i = 0; i < n; i++) { const t = i / RATE, u = up(t, 1.6, .6); out[i] += u * (.16 * Math.sin(2 * Math.PI * 523 * t) * (.6 + .4 * Math.sin(2 * Math.PI * 3.1 * t)) + .12 * Math.sin(2 * Math.PI * 784 * t) * (.6 + .4 * Math.sin(2 * Math.PI * 2.3 * t + 1))); }   // a pale shimmer inside it
  const m = S(.7), close = sweep(noise(r, m), 'lowpass', t => 2200 * Math.exp(-t / .22) + 200, .8);   // it closing on the legs
  add(out, close.map((v, i) => v * Math.pow(smooth(0, 1, i / m), 1.2) * (1 - smooth(.7, 1, i / m)) * 1.5), LANDED - .6);
  thump(out, LANDED, .7, 70, .3);
  return out;
}

// FORETOLD STEP (Merlin, rank 9): a faint glassy ghost-note where the foe will step, a held breath, then her footfalls rushing to the spot as he arrives into it.
function foretold() {
  const r = rng(0x666f7265), n = S(2.7), out = new Float32Array(n);   // "fore"
  const m = S(.7); for (let i = 0; i < m; i++) { const t = i / RATE; add(out, Float32Array.of(Math.sin(2 * Math.PI * (1480 + 30 * Math.sin(t * 20)) * t) * smooth(0, .35, t) * (1 - smooth(.45, .7, t)) * .22), .35 + t); }   // the ghost: rises, then is gone
  ring(out, .35, [[1480, .15], [2220, .1]], .4, .6);
  mix(out, grains(r, n, 2, 7, () => .06).map((v, i) => i / RATE > .9 && i / RATE < 1.35 ? v : 0), 1);   // held air
  run(out, r, 1.4, LANDED - .03, 11, 1.1);   // her steps to the spot
  mix(out, bed(r, n, 'bandpass', t => 900 + 900 * smooth(1.4, LANDED, t), 1.0, .4, 1, .3).map((v, i) => i / RATE > 1.35 ? v : 0));
  blow(out, LANDED, .7, 90, .18);
  return out;
}

// THE PRICE (Odin, rank 10): the roar drops to silence, the whole arena drains to a dull low note, one strike, a hush.
function theprice() {
  const r = rng(0x70726963), n = S(3.2), out = new Float32Array(n), CUT = 1.0;   // "pric"
  const roar = sweep(noise(r, S(CUT)), 'bandpass', t => 450 + 200 * Math.sin(t * 7), 1.6);
  add(out, roar.map((v, i) => { const t = i / RATE; return v * 2.4 * smooth(0, .35, t) * (t > CUT - .04 ? Math.max(0, 1 - (t - (CUT - .04)) / .04) : 1); }), 0);
  let p = 0; for (let i = S(CUT + .05); i < S(LANDED + .1); i++) { const t = i / RATE, f = 210 * Math.exp(-(t - CUT) / .7) + 62; p += f / RATE; out[i] += (Math.sin(2 * Math.PI * p) + .4 * Math.sin(4 * Math.PI * p)) * .4 * smooth(CUT, CUT + .4, t) * (t > LANDED ? 1 - (t - LANDED) / .1 : 1); }   // the colour draining out of it
  blow(out, LANDED, 1.5, 44, .6);
  mix(out, sweep(noise(r, n), 'lowpass', () => 260, .8).map((v, i) => i / RATE > LANDED ? v * 1.2 * Math.exp(-(i / RATE - LANDED) / .5) : 0));
  return out;
}

// PLAGUE FLIES (Apollo, plague doctor rank 8): specks lifting off the sand and a dark swarm gathering, its drone rising as it streams at the foe, the scatter.
function plagueflies() {
  const r = rng(0x666c6965), n = S(2.9), out = new Float32Array(n);   // "flie"
  mix(out, buzz(r, n, 14, 190, 1).map((v, i) => { const t = i / RATE, f = t < LANDED ? Math.pow(smooth(.2, LANDED, t), 1.4) : Math.exp(-(t - LANDED) / .3); return v * f * 1.6; }));
  mix(out, grains(r, n, 4, 80, t => t < LANDED ? .35 * Math.pow(t / LANDED, 1.2) : 0), 1);   // specks lifting
  mix(out, bed(r, n, 'bandpass', t => 1500 + 1200 * smooth(0, LANDED, t), 1.2, .5, 1.5, .3));
  add(out, grains(r, S(.7), 220, 20, t => .7 * Math.exp(-t / .2)), LANDED, 1);
  thump(out, LANDED, .6, 100, .12);
  return out;
}

// POISON STAIN (Hecate, rank 9): a wet blotch spreading, slow bubbling that quickens, the legs giving, a dull strike and a drip.
function poisonstain() {
  const r = rng(0x706f6973), n = S(3), out = new Float32Array(n);   // "pois"
  mix(out, sweep(noise(r, n), 'lowpass', t => 350 + 250 * Math.sin(2 * Math.PI * 6 * t), 1.0).map((v, i) => { const t = i / RATE; return v * up(t, 1.3, .5) * (.6 + .4 * Math.sin(2 * Math.PI * 7 * t)) * 2.4; }));   // the ooze
  let t = .3; while (t < LANDED + .3) { const len = S(.05 + .03 * r()), f0 = 280 + 300 * r(); add(out, Float32Array.from({ length: len }, (_, i) => Math.sin(2 * Math.PI * (f0 + 600 * i / len) * i / RATE) * Math.exp(-i / len * 4) * .35), t, up(t, 1, .3)); t += (.28 - .22 * Math.min(1, t / LANDED)) * (.6 + .8 * r()); }   // bubbles
  mix(out, sweep(noise(r, n), 'lowpass', () => 180, .9).map((v, i) => { const t = i / RATE; return t > LANDED - .5 && t < LANDED + .4 ? v * 1.8 * Math.sin(Math.PI * (t - LANDED + .5) / .9) : 0; }));   // the legs giving
  blow(out, LANDED, 1, 60, .35);
  add(out, Float32Array.from({ length: S(.12) }, (_, i) => Math.sin(2 * Math.PI * (900 - 2500 * i / S(.12)) * i / RATE) * Math.exp(-i / S(.12) * 5) * .3), LANDED + .75);   // a last drip
  return out;
}

// LAST BREATH (Resheph, rank 10): a long drawn breath pulling the wisp into the beak, a sagging tone, the strike, a thin rasp out.
function lastbreath() {
  const r = rng(0x6c617374), n = S(3), out = new Float32Array(n);   // "last"
  mix(out, sweep(noise(r, n), 'bandpass', t => 500 + 2600 * smooth(.3, LANDED, t), 2.2).map((v, i) => { const t = i / RATE; return t < LANDED ? v * 2.2 * smooth(.3, 1.2, t) * (1 - .5 * smooth(1.2, LANDED, t)) : 0; }));   // the intake
  let p = 0; for (let i = 0; i < S(LANDED + .1); i++) { const t = i / RATE, f = 260 * Math.exp(-t / 1.2) + 70; p += f / RATE; out[i] += Math.sin(2 * Math.PI * p) * .3 * smooth(.5, 1.3, t) * (t > LANDED ? 1 - (t - LANDED) / .1 : 1); }   // him sagging
  blow(out, LANDED, 1.1, 56, .4);
  mix(out, sweep(noise(r, n), 'bandpass', () => 2200, 1.8).map((v, i) => { const t = i / RATE; return t > LANDED + .1 ? v * 1.3 * Math.exp(-(t - LANDED - .1) / .35) : 0; }));   // the rasp
  return out;
}

// THE SLING (Hector, knight rank 8): the maul whirled flat, each pass of the head a whoosh that comes faster, dust spinning up, a step out into the blow.
function thesling() {
  const r = rng(0x736c696e), n = S(2.8), out = new Float32Array(n);   // "slin"
  let ph = 0; const whoosh = sweep(noise(r, n), 'bandpass', t => 380 + 500 * smooth(0, LANDED, t), 1.2);
  for (let i = 0; i < n; i++) { const t = i / RATE, rate = 1.6 + 5.5 * smooth(0, LANDED, t); ph += rate / RATE; const lobe = Math.pow(Math.max(0, Math.sin(2 * Math.PI * ph)), 3); out[i] += whoosh[i] * lobe * 2.6 * up(t, 1, .25); }
  mix(out, bed(r, n, 'highpass', () => 3600, .7, .45, 1.6, .35));   // dust spinning round him
  mix(out, grains(r, n, 6, 140, t => t < LANDED ? .3 * Math.pow(t / LANDED, 1.3) : 0), 1);
  thump(out, LANDED - .16, .5, 95, .1);   // the step out
  blow(out, LANDED, 1.3, 58, .35);
  return out;
}

// WRATH (Achilles, rank 9): the air shaking like heat, its shimmer tightening and the tension rising, a held silence, a single blow.
function wrath() {
  const r = rng(0x77726174), n = S(2.8), out = new Float32Array(n);   // "wrat"
  mix(out, sweep(noise(r, n), 'bandpass', () => 950, 1.6).map((v, i) => { const t = i / RATE, wob = .55 + .45 * Math.sin(2 * Math.PI * (8 + 10 * t / LANDED) * t); return v * wob * up(t, 1.4, .2) * 2; }));   // the shimmer, tightening
  let p = 0; for (let i = 0; i < S(LANDED - .06); i++) { const t = i / RATE; p += (110 + 330 * Math.pow(t / LANDED, 2)) / RATE; out[i] += (Math.sin(2 * Math.PI * p) + .5 * Math.sin(2 * Math.PI * p * 1.5)) * .32 * Math.pow(t / LANDED, 1.5); }   // tension climbing
  for (let i = 0; i < n; i++) { const t = i / RATE; if (t > LANDED - .06 && t < LANDED) out[i] *= .1; }   // the held breath before the blow
  blow(out, LANDED, 1.5, 54, .45);
  mix(out, sweep(noise(r, n), 'lowpass', () => 350, .8).map((v, i) => i / RATE > LANDED ? v * 1.2 * Math.exp(-(i / RATE - LANDED) / .4) : 0));
  return out;
}

// STORM FOLLOWS HIM (Thor, rank 10): slanted rain sweeping in on a rising wind, thunder gathering low, the crack landing with the blow.
function storm() {
  const r = rng(0x73746f72), n = S(3.2), out = new Float32Array(n);   // "stor"
  mix(out, sweep(noise(r, n), 'highpass', t => 3000 + 1500 * Math.sin(t * 3), .6).map((v, i) => v * up(i / RATE, 1.1, .8) * .55));   // rain
  mix(out, bed(r, n, 'bandpass', t => 300 + 700 * smooth(0, LANDED, t) + 150 * Math.sin(t * 4.1), .9, 1.4, 1.5, .4));   // the wind driving it
  mix(out, sweep(noise(r, n), 'lowpass', t => 110 + 60 * Math.sin(t * 2.7), .9).map((v, i) => v * up(i / RATE, 1.5, 1.1) * 2.6));   // thunder underneath
  const m = S(.5), crack = sweep(noise(r, m), 'highpass', t => 1200 + 4000 * Math.exp(-t / .06), .8);   // the crack
  add(out, crack.map((v, i) => v * Math.exp(-i / RATE / .12) * 3.6), LANDED - .01);
  blow(out, LANDED, 1.4, 50, .7);
  return out;
}


// Class specials (ranks 1-7; Dom's picks: docs/briefs/specials/class-specials-witch-pd-knight-2026-10-01.md and the Nightborn's Seven Cuts): smaller than the boss cues, all
// dark, damp sand and the carried weapon, nothing bright. Same clock: cast at 0, payoff on LANDED.
// SEVEN CUTS (Nightborn, ranks 4-7): a held low breath, then six strokes and the thrust one every 4 ticks, the seventh on the strike (special-timing.ts cutAt).
function cuts() {
  const r = rng(0x63757473), n = S(2.7), out = new Float32Array(n);   // "cuts"
  mix(out, bed(r, n, 'bandpass', t => 260 + 140 * smooth(0, LANDED, t), 1.0, .9, 1.8, .3));
  for (let i = 0; i < 7; i++) {
    const t = LANDED - (6 - i) * 4 / 60, last = i === 6, m = S(.09), sw = sweep(noise(r, m), 'bandpass', u => 900 + 2600 * u / .09, 1.1);
    add(out, sw.map((v, k) => v * Math.sin(Math.PI * k / m) * 2.6 * (.7 + .05 * i)), t - .07);
    if (!last) ring(out, t, [[1800 + 90 * i, .22], [3100, .12]], .5, .09);
  }
  blow(out, LANDED, .9, 80, .18);
  return out;
}

// STONE WAKE (Witch, ranks 1-3): the staff foot dragged through damp sand toward the foe: a wet furrow opening and running, the blow where it ends.
function wake() {
  const r = rng(0x77616b65), n = S(2.7), out = new Float32Array(n);   // "wake"
  mix(out, bed(r, n, 'lowpass', t => 380 + 500 * smooth(.2, LANDED, t), 1.0, 2.2, 1.3, .3).map((v, i) => v * (.7 + .3 * Math.sin(2 * Math.PI * 9 * i / RATE))));   // the scrape
  mix(out, grains(r, n, 5, 60, t => t < LANDED ? .3 * Math.pow(t / LANDED, 1.2) : 0), 1);   // wet clods turning over
  blow(out, LANDED, .9, 74, .25);
  return out;
}

// STIRRING (Witch, ranks 4-7): the staff head circling low over the sand, each turn a slow soft whoosh that tightens, then up and down.
function stirring() {
  const r = rng(0x73746972), n = S(2.7), out = new Float32Array(n);   // "stir"
  let ph = 0; const w = sweep(noise(r, n), 'bandpass', t => 300 + 300 * smooth(0, LANDED, t), 1.0);
  for (let i = 0; i < n; i++) { const t = i / RATE; ph += (1.4 + 2.2 * smooth(0, LANDED, t)) / RATE; out[i] += w[i] * Math.pow(Math.max(0, Math.sin(2 * Math.PI * ph)), 2) * 2.4 * up(t, 1.2, .25); }
  mix(out, bed(r, n, 'lowpass', () => 240, .8, .7, 1.4, .3));
  blow(out, LANDED, .9, 70, .22);
  return out;
}

// DOCTOR'S TEMPO (Plague Doctor, ranks 1-3): three measured steps, each a dull print in the sand, the thrust on the third.
function tempo() {
  const r = rng(0x74656d70), n = S(2.6), out = new Float32Array(n);   // "temp"
  mix(out, bed(r, n, 'bandpass', () => 700, 1.2, .35, 1.2, .25));
  [LANDED - 1.5, LANDED - .75].forEach((t, k) => { thump(out, t, .5 + .15 * k, 100, .1); add(out, grains(r, S(.2), 150, 20, e => .35 * Math.exp(-e / .06)), t); });
  const m = S(.16), th = sweep(noise(r, m), 'highpass', t => 2400 + 2200 * t / .16, .9);   // the point going out level
  add(out, th.map((v, i) => v * Math.sin(Math.PI * i / m) * 1.6), LANDED - .15);
  blow(out, LANDED, .85, 95, .15);
  return out;
}

// TAKING THE PULSE (Plague Doctor, ranks 4-7): a hand reaching, dust drawing in tight, two slow heartbeats, the thrust on the second.
function pulse() {
  const r = rng(0x70756c73), n = S(2.7), out = new Float32Array(n);   // "puls"
  mix(out, sweep(noise(r, n), 'bandpass', t => 1500 - 900 * smooth(0, LANDED, t), 1.4).map((v, i) => v * up(i / RATE, 1.5, .25) * 1.5));   // the dust tightening
  [[LANDED - 1.5, 1], [LANDED - 1.32, .6]].forEach(([t, g]) => thump(out, t, g * .8, 70, .14));
  [[LANDED - .62, 1], [LANDED - .44, .6]].forEach(([t, g]) => thump(out, t, g * .9, 66, .14));   // lub-dub, lub-dub
  blow(out, LANDED, 1, 78, .2);
  return out;
}

// GROUND DRAG (Knight, ranks 1-3): the maul head hauled through the sand: a rutted heavy drag, clods lifting, swung up into the blow.
function drag() {
  const r = rng(0x64726167), n = S(2.8), out = new Float32Array(n);   // "drag"
  mix(out, bed(r, n, 'lowpass', t => 220 + 260 * smooth(0, LANDED, t), 1.0, 2.6, 1.2, .35).map((v, i) => v * (.65 + .35 * Math.sin(2 * Math.PI * 5 * i / RATE))));
  mix(out, grains(r, n, 4, 45, t => t < LANDED - .25 ? .4 * Math.pow(t / LANDED, 1.1) : 0), 1);
  let t = .5; while (t < LANDED - .3) { thump(out, t, .22, 60 + 25 * r(), .1); t += .22 + .25 * r(); }   // clods dropping back
  const m = S(.4), sw = sweep(noise(r, m), 'lowpass', u => 250 + 900 * Math.sin(Math.PI * Math.min(1, u / .4)), .8);   // up into the blow
  add(out, sw.map((v, i) => v * Math.sin(Math.PI * i / m) * 2.2), LANDED - .4);
  blow(out, LANDED, 1.3, 52, .4);
  return out;
}

// HELD SWING (Knight, ranks 4-7): the maul wound back and held, the arena going still, the sand shivering, one wide flat swing.
function swing() {
  const r = rng(0x73776e67), n = S(2.8), out = new Float32Array(n);   // "swng"
  mix(out, sweep(noise(r, n), 'bandpass', () => 380, .9).map((v, i) => v * Math.max(0, 1 - i / RATE / 1.0) * .9));   // the arena going still
  mix(out, sweep(noise(r, n), 'highpass', () => 3800, .7).map((v, i) => { const t = i / RATE; return t > .9 && t < LANDED - .45 ? v * (.1 + .12 * (t - .9)) * (.5 + .5 * Math.sin(2 * Math.PI * 17 * t)) : 0; }));   // the sand shivering
  add(out, Float32Array.from({ length: S(.35) }, (_, i) => Math.sin(2 * Math.PI * (130 + 60 * i / S(.35)) * i / RATE) * Math.sin(Math.PI * i / S(.35)) * .2), .35);   // the haft taking the weight
  const m = S(.45), sw = sweep(noise(r, m), 'bandpass', u => 250 + 1000 * Math.pow(u / .45, 1.3), 1.0);   // the flat swing
  add(out, sw.map((v, i) => v * Math.pow(Math.sin(Math.PI / 2 * i / m), 2) * 3.2), LANDED - .45);
  blow(out, LANDED, 1.4, 54, .4);
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
  fistful: { make: fistful, lufs: -25, fade: .25 }, gone: { make: gone, lufs: -25, fade: .25 }, liars: { make: liars, lufs: -25, fade: .25 }, cracking: { make: cracking, lufs: -25, fade: .25 }, ashfall: { make: ashfall, lufs: -25, fade: .25 }, windwall: { make: windwall, lufs: -25, fade: .25 },
  baying: { make: baying, lufs: -25, fade: .25 }, longshadow: { make: longshadow, lufs: -25, fade: .25 }, harvest: { make: harvest, lufs: -25, fade: .25 }, theword: { make: theword, lufs: -25, fade: .25 }, threeblows: { make: threeblows, lufs: -25, fade: .25 }, rimshake: { make: rimshake, lufs: -25, fade: .25 }, baredface: { make: baredface, lufs: -25, fade: .25 }, thering: { make: thering, lufs: -25, fade: .25 }, aegis: { make: aegis, lufs: -25, fade: .25 }, avalon: { make: avalon, lufs: -25, fade: .25 }, foretold: { make: foretold, lufs: -25, fade: .25 }, theprice: { make: theprice, lufs: -25, fade: .25 }, plagueflies: { make: plagueflies, lufs: -25, fade: .25 }, poisonstain: { make: poisonstain, lufs: -25, fade: .25 }, lastbreath: { make: lastbreath, lufs: -25, fade: .25 }, thesling: { make: thesling, lufs: -25, fade: .25 }, wrath: { make: wrath, lufs: -25, fade: .25 }, storm: { make: storm, lufs: -25, fade: .25 },
  cuts: { make: cuts, lufs: -25, fade: .25 }, wake: { make: wake, lufs: -25, fade: .25 }, stirring: { make: stirring, lufs: -25, fade: .25 }, tempo: { make: tempo, lufs: -25, fade: .25 }, pulse: { make: pulse, lufs: -25, fade: .25 }, drag: { make: drag, lufs: -25, fade: .25 }, swing: { make: swing, lufs: -25, fade: .25 } };
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
