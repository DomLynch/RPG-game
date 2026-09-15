// Combat audio sprite build. Every shipped sound is original procedural Foley rendered here — deterministic Node DSP
// (seeded noise, modal iron resonators, pitch-dropping body thumps, swept-filter air) — so the sprite is reproducible from
// this file alone: no downloads, no licences. Output: src/assets/audio/sprite.m4a (AAC, Safari) + sprite.ogg (Opus,
// Chrome/Android) + the generated src/audio/manifest.ts (cue → variants → [start, duration]). Usage: node scripts/build-audio.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const RATE = 48000, GAP = .04, LEAD = .02;
const S = seconds => Math.round(seconds * RATE);
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// --- DSP primitives -------------------------------------------------------------------------------------------------
const noise = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);
const silence = n => new Float32Array(n);
// RBJ biquad; type in lowpass | highpass | bandpass | peaking | lowshelf | highshelf. Returns a new array.
function biquad(x, type, f, Q = .707, gainDb = 0) {
  const w = 2 * Math.PI * f / RATE, cw = Math.cos(w), sw = Math.sin(w), A = 10 ** (gainDb / 40), alpha = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else if (type === 'peaking') { b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; }
  else { const s = type === 'lowshelf' ? 1 : -1, r = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) - s * (A - 1) * cw + r); b1 = s * 2 * A * ((A - 1) - s * (A + 1) * cw); b2 = A * ((A + 1) - s * (A - 1) * cw - r); a0 = (A + 1) + s * (A - 1) * cw + r; a1 = s * -2 * ((A - 1) + s * (A + 1) * cw); a2 = (A + 1) + s * (A - 1) * cw - r; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
// Time-varying state-variable filter: cutoff follows fc(t in 0..1). Band-pass output for the whoosh's Doppler-like sweep,
// low-pass output for an impact body that darkens as it decays.
function sweep(x, fc, Q, output = 'band') {
  const y = new Float32Array(x.length); let low = 0, band = 0; const q = 1 / Q;
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fc(i / x.length), 12000) / RATE); low += f * band; const high = x[i] - low - q * band; band += f * high; y[i] = output === 'band' ? band : low; }
  return y;
}
const sweepBandpass = (x, fc, Q) => sweep(x, fc, Q, 'band');
// Exponentially decaying sinusoid: one resonant mode. t60 = seconds to −60 dB; slide = optional multiplier on f at t = 0 decaying with tau.
function mode(n, f, t60, amp = 1, { slide = 1, tau = .03, phase = 0 } = {}) {
  const y = new Float32Array(n), k = 6.9078 / (t60 * RATE); let ph = phase;
  for (let i = 0; i < n; i++) { const t = i / RATE, freq = f * (1 + (slide - 1) * Math.exp(-t / tau)); ph += 2 * Math.PI * freq / RATE; y[i] = amp * Math.exp(-k * i) * Math.sin(ph); }
  return y;
}
// Inharmonic modal bank: iron rings with partials that are not multiples of the fundamental; decay shortens up the series.
function modal(n, f0, ratios, t60, amp, r, { spread = .012, roll = .72 } = {}) {
  const y = new Float32Array(n);
  ratios.forEach((ratio, k) => add(y, mode(n, f0 * ratio * (1 + (r() - .5) * spread), t60 * roll ** k, amp * (.9 ** k), { phase: r() * Math.PI * 2 })));
  return y;
}
// Envelopes: linear-segment (times in s, levels) and the classic percussive attack/decay.
function envelope(n, points) {
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE; let k = 0; while (k < points.length - 2 && points[k + 2][0] <= t) k += 2; const [t0, v0] = points[k], [t1, v1] = points[k + 1] ?? points[k]; y[i] = t >= t1 ? v1 : v0 + (v1 - v0) * (t - t0) / Math.max(1e-6, t1 - t0); }
  return y;
}
const decay = (n, t60, attack = .001) => { const y = new Float32Array(n), k = 6.9078 / (t60 * RATE), a = Math.max(1, S(attack)); for (let i = 0; i < n; i++) y[i] = Math.min(1, i / a) * Math.exp(-k * Math.max(0, i - a)); return y; };
const mul = (x, e) => { const y = new Float32Array(x.length); for (let i = 0; i < y.length; i++) y[i] = x[i] * (e[i] ?? 0); return y; };
const gain = (x, g) => x.map(v => v * g);
function add(target, x, at = 0, g = 1) { const o = S(at); for (let i = 0; i < x.length && o + i < target.length; i++) target[o + i] += x[i] * g; return target; }
const mix = (n, ...layers) => { const y = new Float32Array(n); for (const [x, at = 0, g = 1] of layers) add(y, x, at, g); return y; };
const sub = (x, from, seconds) => x.subarray(S(from), S(from) + S(seconds));
function normalize(x, peakDb) { let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v)); const g = peak ? 10 ** (peakDb / 20) / peak : 0; return x.map(v => v * g); }
const fadeOut = (x, seconds) => { const n = S(seconds); for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i] *= i / n; return x; };
const dbfs = db => 10 ** (db / 20);

// --- Recipes ---------------------------------------------------------------------------------------------------------
// Voiced for a phone speaker (little below ~300 Hz) and against "tin": layers are broadband (gentle slopes, never a resonant
// band), every impact's body is held dense near full scale for its first ~150 ms (saturation + upward envelope compression),
// decays and low-mid rumble are long enough to read as mass, and steel is a dense gritty inharmonic cluster, not clean sines.
// Every impact = transient (crack) + body (punch / thump) + tail (ring / rumble). `v` seeds the variant.
const vary = (r, base, spread = .06) => base * (1 + (r() - .5) * 2 * spread);
const saturate = (x, drive) => x.map(v => Math.tanh(v * drive) / Math.tanh(drive));
// Broadband noise between lo and hi with Q .5 slopes: a wash, not a whistle.
const broad = (n, r, lo, hi) => biquad(biquad(noise(n, r), 'highpass', lo, .5), 'lowpass', hi, .5);
// Density: saturate, then lift the decaying body towards full scale (1 ms attack / `hold` release envelope, upward compression
// by `ratio`, at most `lift` ×), so the sound sustains instead of being a click and a whisper.
function densify(x, drive, { ratio = 2.6, lift = 6, hold = .08 } = {}) {
  const y = saturate(x, drive), out = new Float32Array(y.length), release = Math.exp(-1 / (hold * RATE)); let env = 0;
  for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); env = a > env ? a : env * release; out[i] = y[i] * Math.min(lift, Math.max(env, 1e-4) ** (1 / ratio - 1)); }
  return normalize(out, 0);
}
// Punch: a broadband burst around f plus a pitch-dropping tone — the body a small speaker can actually play.
const punch = (n, f, r, { t60 = .08, tone = .9, burst = 1 } = {}) => normalize(mix(n,
  [mul(broad(n, r, f * .6, f * 3), decay(n, t60, .002)), 0, burst],
  [mode(n, f * .72, t60 * 1.7, 1, { slide: 1.9, tau: t60 * .6 }), .002, tone]), 0);
// Thud: the body of a real impact — broadband noise whose low-pass sweeps from `from` down to `to` over `fall` seconds while it
// decays, so it is bright at the strike and dark in the tail, broadband throughout.
const thud = (n, r, { from = 6000, to = 320, fall = .12, t60 = .2, Q = .6 } = {}) => normalize(mul(sweep(noise(n, r), t => to + (from - to) * Math.exp(-t * n / RATE / (fall / 3)), Q, 'low'), decay(n, t60, .002)), 0);
// Rumble: a broad low-mid tail (150–800 Hz) that lingers after the strike.
const rumble = (n, t60, r, f = 900) => mul(biquad(biquad(noise(n, r), 'lowpass', f, .5), 'highpass', 260, .5), decay(n, t60, .01));
// Dense steel: `count` inharmonic partials from f0 up to ~f0 × top with jittered decays, amplitude-roughened by slow noise.
function dense(n, f0, count, t60, r, { top = 4.6, roll = .86, grit = .35, spread = .03 } = {}) {
  const y = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    const ratio = 1 + (top - 1) * (k / (count - 1)) ** 1.45 * (1 + (r() - .5) * spread * 2), amp = (1 / (1 + .45 * k)) * (.7 + .6 * r());
    add(y, mode(n, f0 * ratio, Math.max(.03, t60 * roll ** k * (.8 + .4 * r())), amp, { phase: r() * Math.PI * 2 }));
  }
  const rough = biquad(noise(n, r), 'lowpass', 90);
  for (let i = 0; i < n; i++) y[i] *= 1 + grit * rough[i] * 3;
  return normalize(y, 0);
}
const RECIPES = {
  // Air: a wide, breathy wash whose centre sweeps low (220 → 900 Hz), never a whistle.
  whoosh_light(r) {
    const n = S(vary(r, .18, .1)), f = vary(r, 1, .08);
    const sweep = sweepBandpass(noise(n, r), t => f * (220 + 680 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.6), .8);
    const breath = broad(n, r, 150 * f, 1800 * f), air = broad(n, r, 2000, 6000);
    const hump = envelope(n, [[0, 0], [n / RATE * .42, 1], [n / RATE * .62, .7], [n / RATE, 0]]);
    return densify(mix(n, [mul(sweep, hump), 0, 1], [mul(breath, hump), 0, .9], [mul(air, hump), 0, dbfs(-20)]), 1.6, { lift: 2 });
  },
  whoosh_heavy(r) {
    const n = S(vary(r, .28, .1)), f = vary(r, 1, .08);
    const sweep = sweepBandpass(noise(n, r), t => f * (130 + 430 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 1.5), .7);
    const breath = broad(n, r, 90 * f, 1200 * f);
    const hump = envelope(n, [[0, 0], [n / RATE * .48, 1], [n / RATE * .66, .6], [n / RATE, 0]]);
    return densify(mix(n, [mul(sweep, hump), 0, 1], [mul(breath, hump), 0, 1]), 1.8, { lift: 2 });
  },
  // Draw: steel leaving leather — a wide rising slide, a leather rasp, the blade's short ring as it clears the mouth.
  draw(r) {
    const n = S(.30), f = vary(r, 1, .05);
    const slide = mul(broad(n, r, 900 * f, 3500 * f), envelope(n, [[0, 0], [.19, 1], [.23, .2], [.30, 0]]));
    const leather = mul(broad(n, r, 250 * f, 1500 * f), envelope(n, [[0, .2], [.12, 1], [.22, .3], [.30, 0]]));
    const ring = dense(S(.16), 1200 * f, 8, .12, r, { top: 3.2, grit: .2 });
    return densify(mix(n, [slide], [leather, 0, .9], [ring, .2, dbfs(-16)]), 1.5, { lift: 2 });
  },
  // Flesh: a broadband crack, a wet splash, the mid punch and the dropping thump, a long low-mid rumble behind.
  hit_flesh(r) {
    const n = S(.34), f = vary(r, 1, .08);
    const crack = mul(broad(n, r, 300, 9000), decay(n, .005));
    const splash = mul(broad(n, r, 350 * f, 3000 * f), decay(n, .045, .002));
    const body = thud(n, r, { from: 5000 * f, to: 420 * f, fall: .1, t60: .18 });
    const tone = punch(n, 380 * f, r, { t60: .08, tone: .5, burst: .3 });
    const thump = mode(n, 150 * f, .28, 1, { slide: 2.2, tau: .035 });
    const tail = rumble(n, .32, r);
    return densify(mix(n, [crack, 0, .5], [splash, .002, .6], [body, .002, 1.2], [tone, .002, .5], [thump, .004, .12], [tail, .02, dbfs(-4)]), 3);
  },
  hit_heavy(r) {
    const n = S(.46), f = vary(r, 1, .08);
    const crack = mul(broad(n, r, 200, 9000), decay(n, .007));
    const edge = mul(broad(n, r, 800 * f, 4000 * f), decay(n, .03, .001));
    const splash = mul(broad(n, r, 250 * f, 2500 * f), decay(n, .08, .002));
    const body = thud(n, r, { from: 4500 * f, to: 320 * f, fall: .14, t60: .26 });
    const tone = punch(n, 300 * f, r, { t60: .12, tone: .5, burst: .3 });
    const second = thud(S(.24), r, { from: 2500 * f, to: 220 * f, fall: .08, t60: .12 });
    const thump = mode(n, 100 * f, .35, 1, { slide: 2.6, tau: .045 });
    const sub = mode(n, 50 * f, .4, 1, { slide: 1.6, tau: .06 });
    const tail = rumble(n, .42, r);
    return densify(mix(n, [crack, 0, .5], [edge, .001, .4], [splash, .003, .6], [body, .003, 1.3], [tone, .003, .5], [second, .028, .55], [thump, .004, .14], [sub, .012, .08], [tail, .03, dbfs(-3)]), 3.5);
  },
  // Kick: a cloth slap and a dull mid thud, no edge, no ring.
  hit_kick(r) {
    const n = S(.28), f = vary(r, 1, .08);
    const slap = mul(broad(n, r, 300 * f, 2500 * f), decay(n, .025, .002));
    const body = thud(n, r, { from: 3000 * f, to: 360 * f, fall: .08, t60: .14 });
    const tone = punch(n, 340 * f, r, { t60: .07, tone: .4, burst: .3 });
    const thump = mode(n, 120 * f, .14, 1, { slide: 1.9, tau: .03 });
    const tail = rumble(n, .2, r);
    return densify(mix(n, [slap, 0, .55], [body, .003, 1.2], [tone, .003, .4], [thump, .004, .08], [tail, .02, dbfs(-6)]), 2.6);
  },
  // Block: iron on iron into a braced guard — a hard broadband click, a dense clang the arms damp, the guard's own body.
  block(r) {
    const n = S(.38), f = vary(r, 1, .07);
    const click = mul(broad(n, r, 1500, 10000), decay(n, .004));
    const clang = dense(n, 640 * f, 14, vary(r, .2, .12), r, { top: 3.6, roll: .84 });
    const muffle = mul(broad(n, r, 250, 1600), decay(n, .04, .001));
    const body = thud(n, r, { from: 4000 * f, to: 320 * f, fall: .07, t60: .14 });
    const tone = punch(n, 330 * f, r, { t60: .08, tone: .6, burst: .3 });
    const tail = rumble(n, .24, r);
    return densify(mix(n, [click, 0, .45], [clang, .001, .85], [muffle, .001, .5], [body, .002, 1], [tone, .002, .4], [tail, .02, dbfs(-8)]), 2.6);
  },
  // Perfect block: the same steel caught clean — brighter and tighter, a smaller body, a touch of edge.
  block_perfect(r) {
    const n = S(.30), f = vary(r, 1, .06);
    const click = mul(broad(n, r, 2000, 10000), decay(n, .004));
    const clang = dense(n, 980 * f, 12, vary(r, .16, .1), r, { top: 3.4, roll: .8, grit: .25 });
    const sparkle = mul(broad(n, r, 3000, 9000), decay(n, .015));
    const body = thud(n, r, { from: 5000 * f, to: 400 * f, fall: .05, t60: .09 });
    return densify(mix(n, [click, 0, .5], [clang, .001, .8], [sparkle, .001, .2], [body, .002, 1]), 2.2);
  },
  // Parry: bright and decisive — an edge scrape sliding up, a long dense ring with beating partials, the hand's jolt underneath.
  parry(r) {
    const n = S(.52), f = vary(r, 1, .06);
    const click = mul(broad(n, r, 1500, 10000), decay(n, .005));
    const scrape = mul(sweepBandpass(noise(n, r), t => 1100 + 1500 * Math.min(1, t * 6), 2), envelope(n, [[0, .3], [.05, 1], [.09, 0], [n / RATE, 0]]));
    const ring = dense(n, 1050 * f, 16, vary(r, .42, .1), r, { top: 2.8, roll: .84, grit: .3, spread: .02 });
    const beat = mode(n, 1050 * f * 1.011, .4, .6, { phase: r() * 6 });
    const zing = mul(broad(n, r, 3500, 8000), decay(n, .03));
    const body = thud(n, r, { from: 4500 * f, to: 340 * f, fall: .09, t60: .16 });
    const tone = punch(n, 380 * f, r, { t60: .1, tone: .6, burst: .3 });
    const tail = rumble(n, .3, r);
    return densify(mix(n, [click, 0, .5], [scrape, 0, .45], [ring, .002, .7], [beat, .002, .25], [zing, .001, .1], [body, .002, 1.2], [tone, .002, .5], [tail, .02, dbfs(-5)]), 2.4);
  },
  // Guard break: dull and wrong — close detuned low partials beating, a choked mid burst, a low thump, driven hard so it crunches.
  guard_break(r) {
    const n = S(.46), f = vary(r, 1, .07);
    const crack = mul(broad(n, r, 600, 5000), decay(n, .01));
    const rattle = dense(n, 300 * f, 10, vary(r, .32, .1), r, { top: 3.2, roll: .9, grit: .5, spread: .05 });
    const choke = mul(broad(n, r, 200, 900), decay(n, .07, .002));
    const body = thud(n, r, { from: 3500 * f, to: 340 * f, fall: .12, t60: .24 });
    const tone = punch(n, 330 * f, r, { t60: .12, tone: .6, burst: .3 });
    const thump = mode(n, 70 * f, .17, 1, { slide: 1.8, tau: .05 });
    const tail = rumble(n, .36, r);
    return fadeOut(densify(mix(n, [crack, 0, .7], [rattle, .002, .8], [choke, .002, .7], [body, .003, 1.3], [tone, .003, .5], [thump, .006, .14], [tail, .03, dbfs(-5)]), 3), .1);
  },
  // Charge: the raised blade gathers — iron partials swelling under a noise bow, a low drone rising with them.
  charge(r) {
    const n = S(.5), f = vary(r, 1, .04);
    const swell = envelope(n, [[0, 0], [.36, 1], [.42, .8], [.5, 0]]);
    const y = new Float32Array(n);
    [1, 1.5, 2.7, 3.9].forEach((ratio, k) => { let ph = r() * 6.28; for (let i = 0; i < n; i++) { const t = i / n; ph += 2 * Math.PI * 700 * f * ratio * (.96 + .04 * t) / RATE; y[i] += Math.sin(ph) * (.7 ** k) * swell[i]; } });
    const drone = mul(biquad(biquad(noise(n, r), 'bandpass', 180 * f, 1.2), 'lowpass', 500), swell);
    const bow = mul(broad(n, r, 600 * f, 2400 * f), swell);
    return densify(mix(n, [y, 0, .7], [drone, 0, .9], [bow, 0, .4]), 1.6, { lift: 2 });
  },
  // Kill: the body falls — a deep thud with a mid punch, a second slump, a long low tail. Layered under the killing hit at runtime.
  kill(r) {
    const n = S(.72), f = vary(r, 1, .08);
    const fall = mode(n, 80 * f, .32, 1, { slide: 1.7, tau: .06 });
    const body = thud(n, r, { from: 3500 * f, to: 300 * f, fall: .16, t60: .3 });
    const tone = punch(n, 330 * f, r, { t60: .12, tone: .6, burst: .3 });
    const low = mul(biquad(noise(n, r), 'lowpass', 160, .9), decay(n, .14, .003));
    const slump = thud(S(.32), r, { from: 2200 * f, to: 200 * f, fall: .1, t60: .16 });
    const tail = rumble(n, .55, r);
    return fadeOut(densify(mix(n, [fall, 0, .2], [body, 0, 1.3], [tone, 0, .5], [low, 0, .2], [slump, .19, .7], [tail, .05, dbfs(-3)]), 2.8), .15);
  },
};
const VARIANTS = { whoosh_light: 4, whoosh_heavy: 4, draw: 2, hit_flesh: 5, hit_heavy: 4, hit_kick: 4, block: 5, block_perfect: 4, parry: 5, guard_break: 4, charge: 2, kill: 3 };

// --- Sprite assembly ---------------------------------------------------------------------------------------------------
const cues = [];
for (const [name, count] of Object.entries(VARIANTS)) for (let v = 0; v < count; v++) {
  let seed = 0; for (const c of `${name}#${v}`) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  cues.push({ name, variant: v, samples: normalize(RECIPES[name](rng(seed)), -1) });
}
const total = cues.reduce((t, c) => t + LEAD + c.samples.length / RATE + GAP, 0);
const sprite = silence(S(total)), manifest = {};
let cursor = 0;
for (const cue of cues) {
  const start = cursor + LEAD, duration = cue.samples.length / RATE;
  add(sprite, cue.samples, start);
  (manifest[cue.name] ??= []).push([Math.round(start * 1000) / 1000, Math.round(duration * 1000) / 1000]);
  cursor = start + duration + GAP;
}

// --- Fingerprint: spectral centroid, the share of energy a phone speaker can play (≥ 300 Hz) and length per cue, so
// "materials distinct" and "not tinny" are numbers, not feelings.
function spectrum(x) {
  const N = 4096, half = N / 2, bins = new Float64Array(half); let num = 0, den = 0, power = 0, phone = 0;
  for (let start = 0; start + N <= x.length; start += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[start + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / N));
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
    for (let k = 1; k < half; k++) { const m = Math.hypot(re[k], im[k]), f = k * RATE / N; num += m * f; den += m; power += m * m; bins[k] += m * m; if (f >= 300) phone += m * m; }
  }
  // −15 dB bandwidth in octaves over third-octave-smoothed power: narrow = whistly / tinny.
  const thirds = []; for (let f = 60; f < 16000; f *= 2 ** (1 / 3)) { let p = 0, c = 0; for (let k = Math.round(f * N / RATE); k < Math.round(f * 2 ** (1 / 3) * N / RATE); k++) { p += bins[k] || 0; c++; } thirds.push([f, c ? p / c : 0]); }
  const max = Math.max(...thirds.map(t => t[1])), inside = thirds.filter(t => t[1] >= max * 10 ** (-1.5));
  const octaves = inside.length ? Math.log2(inside.at(-1)[0] * 2 ** (1 / 3) / inside[0][0]) : 0;
  // Crest over the first 150 ms: peak against RMS; high = a click and little else.
  const head = x.subarray(0, Math.min(x.length, S(.15))); let peak = 0, sq = 0; for (const v of head) { peak = Math.max(peak, Math.abs(v)); sq += v * v; }
  return { centroid: den ? Math.round(num / den) : 0, phone: power ? Math.round(100 * phone / power) : 0, octaves: Math.round(octaves * 10) / 10, crest: Math.round(20 * Math.log10(peak / Math.sqrt(sq / head.length)) * 10) / 10 };
}
const lengthMs = x => { const floor = dbfs(-60); let last = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > floor) last = i; return Math.round(last / RATE * 1000); };
const fingerprint = Object.keys(VARIANTS).map(name => { const own = cues.filter(c => c.name === name), spectra = own.map(c => spectrum(c.samples)), mean = a => Math.round(a.reduce((t, v) => t + v, 0) / a.length); return { name, variants: own.length, centroidHz: mean(spectra.map(s => s.centroid)), phone: mean(spectra.map(s => s.phone)), octaves: Math.round(spectra.reduce((t, s) => t + s.octaves, 0) / spectra.length * 10) / 10, crest: Math.round(spectra.reduce((t, s) => t + s.crest, 0) / spectra.length * 10) / 10, lengthMs: mean(own.map(c => lengthMs(c.samples))) }; });

// --- Write: WAV to a scratch path, encode both formats, emit the manifest module.
const dir = path.join('src', 'assets', 'audio'); await fs.mkdir(dir, { recursive: true });
const wavPath = path.join('artifacts', 'audio', 'sprite.wav'); await fs.mkdir(path.dirname(wavPath), { recursive: true });
const pcm = new Int16Array(sprite.length); for (let i = 0; i < sprite.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sprite[i] * 32767)));
const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.byteLength, 4); header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.byteLength, 40);
await fs.writeFile(wavPath, Buffer.concat([header, Buffer.from(pcm.buffer)]));
const encode = (args, file) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', ...args, path.join(dir, file)]);   // bit-exact: no encoder tags, timestamps or random stream serials, so two builds are byte-identical
encode(['-c:a', 'aac_at', '-b:a', '96k', '-movflags', '+faststart'], 'sprite.m4a');   // Apple AudioToolbox AAC-LC; Safari decodes it and honours its gapless padding
encode(['-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-application', 'audio'], 'sprite.ogg');
const manifestModule = `// Generated by scripts/build-audio.mjs — do not edit. Cue → variants → [start, duration] seconds inside the audio sprite.
export const SPRITE_SECONDS = ${Math.round(total * 1000) / 1000};
export const MANIFEST = ${JSON.stringify(manifest)} as const;
export type CueName = keyof typeof MANIFEST;
`;
await fs.writeFile(path.join('src', 'audio', 'manifest.ts'), manifestModule);
const sizes = {}; for (const file of ['sprite.m4a', 'sprite.ogg']) sizes[file] = (await fs.stat(path.join(dir, file))).size;
console.log(`sprite ${total.toFixed(2)} s, ${cues.length} cues · m4a ${sizes['sprite.m4a']} B · ogg ${sizes['sprite.ogg']} B`);
console.log('| cue | variants | centroid Hz | ≥ 300 Hz energy | −15 dB width (oct) | crest dB | length ms |\n|---|---|---|---|---|---|---|\n' + fingerprint.map(f => `| ${f.name} | ${f.variants} | ${f.centroidHz} | ${f.phone} % | ${f.octaves} | ${f.crest} | ${f.lengthMs} |`).join('\n'));
