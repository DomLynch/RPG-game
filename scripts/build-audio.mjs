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
// Time-varying state-variable band-pass: centre frequency follows fc(t in 0..1); the whoosh's Doppler-like sweep.
function sweepBandpass(x, fc, Q) {
  const y = new Float32Array(x.length); let low = 0, band = 0; const q = 1 / Q;
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fc(i / x.length), 12000) / RATE); low += f * band; const high = x[i] - low - q * band; band += f * high; y[i] = band; }
  return y;
}
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
// Voiced for a phone speaker, which reproduces little below ~300 Hz: every impact carries its weight in a 250–700 Hz "punch"
// layer, steel is a dense inharmonic cluster with grit rather than clean sines, and everything is driven into soft saturation
// for density. Sub layers stay for headphones. Every impact = transient (crack) + body (punch/thump) + tail (ring / rumble).
// `v` seeds the variant: frequencies ±spread, decays ±10 %.
const vary = (r, base, spread = .06) => base * (1 + (r() - .5) * 2 * spread);
const saturate = (x, drive) => x.map(v => Math.tanh(v * drive) / Math.tanh(drive));
// Punch: a band-limited burst plus a pitch-dropping tone around f — the body a small speaker can actually play.
const punch = (n, f, r, { t60 = .055, tone = .9, burst = 1 } = {}) => normalize(mix(n,
  [mul(biquad(biquad(noise(n, r), 'bandpass', f * 1.25, 1), 'lowpass', f * 2.4), decay(n, t60, .002)), 0, burst],
  [mode(n, f * .72, t60 * 1.7, 1, { slide: 1.9, tau: t60 * .6 }), .002, tone]), 0);
// Rumble: a low-mid tail (150–450 Hz) that lingers after the strike and reads as mass on a phone.
const rumble = (n, t60, r, f = 320) => mul(biquad(biquad(noise(n, r), 'lowpass', f, .9), 'highpass', 210), decay(n, t60, .01));
// Dense steel: `count` inharmonic partials from f0 up to ~f0 × top, each with its own jittered decay, amplitude-roughened
// by slow noise (grit) so the ring is not a clean synthesiser tone.
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
  // Air: swept band-pass noise, hump envelope, the sweep kept under 1.6 kHz so it reads as moving air, not hiss; a low-mid air body underneath.
  whoosh_light(r) {
    const n = S(vary(r, .17, .1)), f = vary(r, 1, .08);
    const air = sweepBandpass(noise(n, r), t => f * (380 + 1150 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.6), 1.7);
    const body = biquad(biquad(noise(n, r), 'bandpass', 330 * f, .8), 'lowpass', 900);
    const hump = envelope(n, [[0, 0], [n / RATE * .42, 1], [n / RATE * .62, .7], [n / RATE, 0]]);
    return saturate(mix(n, [mul(air, hump)], [mul(body, hump), 0, dbfs(-4)]), 1.3);
  },
  whoosh_heavy(r) {
    const n = S(vary(r, .27, .1)), f = vary(r, 1, .08);
    const air = sweepBandpass(noise(n, r), t => f * (170 + 780 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 1.5), 1.5);
    const body = biquad(biquad(noise(n, r), 'bandpass', 260 * f, .8), 'lowpass', 700);
    const hump = envelope(n, [[0, 0], [n / RATE * .48, 1], [n / RATE * .66, .6], [n / RATE, 0]]);
    return saturate(mix(n, [mul(air, hump)], [mul(body, hump), 0, dbfs(-2)]), 1.4);
  },
  // Draw: steel leaving leather — a leather "shhk" and a rising steel band, then the blade's short ring as it clears the mouth.
  draw(r) {
    const n = S(.30), f = vary(r, 1, .05);
    const slide = mul(biquad(biquad(noise(n, r), 'bandpass', 2000 * f, 1.2), 'highpass', 1000), envelope(n, [[0, 0], [.19, 1], [.23, .2], [.30, 0]]));
    const leather = mul(biquad(biquad(noise(n, r), 'bandpass', 700 * f, .9), 'lowpass', 1800), envelope(n, [[0, .2], [.12, 1], [.22, .3], [.30, 0]]));
    const ring = dense(S(.16), 1700 * f, 8, .12, r, { top: 3.2, grit: .2 });
    return saturate(mix(n, [slide], [leather, 0, dbfs(-1)], [ring, .2, dbfs(-12)]), 1.3);
  },
  // Flesh: edge meeting skin (click + wet burst), then the mid punch and the pitch-dropping thump, a low-mid rumble behind.
  hit_flesh(r) {
    const n = S(.32), f = vary(r, 1, .08);
    const click = mul(biquad(noise(n, r), 'highpass', 1400), decay(n, .012));
    const wet = mul(biquad(noise(n, r), 'bandpass', 1000 * f, 1.2), decay(n, .06, .002));
    const body = punch(n, 420 * f, r, { t60: .06 });
    const thump = mode(n, 150 * f, .13, 1, { slide: 2.2, tau: .035 });
    const tail = rumble(n, .24, r, 380);
    return saturate(mix(n, [click, 0, .5], [wet, .002, .55], [body, .002, 1.2], [thump, .004, .32], [tail, .02, dbfs(-8)]), 1.7);
  },
  hit_heavy(r) {
    const n = S(.42), f = vary(r, 1, .08);
    const click = mul(biquad(noise(n, r), 'highpass', 1100), decay(n, .016));
    const crack = mul(biquad(noise(n, r), 'bandpass', 2000 * f, 1.6), decay(n, .03, .001));
    const body = punch(n, 330 * f, r, { t60: .09, burst: 1.1 });
    const second = punch(S(.2), 260 * f, r, { t60: .06, tone: .6 });
    const thump = mode(n, 105 * f, .22, 1, { slide: 2.6, tau: .045 });
    const sub = mode(n, 48 * f, .3, 1, { slide: 1.6, tau: .06 });
    const tail = rumble(n, .34, r, 330);
    return saturate(mix(n, [click, 0, .55], [crack, .001, .45], [body, .003, 1.3], [second, .028, .6], [thump, .004, .32], [sub, .012, .18], [tail, .03, dbfs(-6)]), 2);
  },
  // Kick: a cloth slap and a dull mid thud, no edge, no ring.
  hit_kick(r) {
    const n = S(.26), f = vary(r, 1, .08);
    const slap = mul(biquad(noise(n, r), 'bandpass', 720 * f, 1.1), decay(n, .022, .002));
    const body = punch(n, 390 * f, r, { t60: .05, tone: .7 });
    const thump = mode(n, 120 * f, .1, 1, { slide: 1.9, tau: .03 });
    const tail = rumble(n, .16, r, 380);
    return saturate(mix(n, [slap, 0, .8], [body, .003, 1.2], [thump, .004, .15], [tail, .02, dbfs(-10)]), 1.5);
  },
  // Block: iron on iron into a braced guard — a hard click, a dense clang the arms damp quickly, and the guard's own mid body.
  block(r) {
    const n = S(.36), f = vary(r, 1, .07);
    const click = mul(biquad(noise(n, r), 'highpass', 2200), decay(n, .006));
    const clang = dense(n, 760 * f, 14, vary(r, .2, .12), r, { top: 4.4, roll: .84 });
    const muffle = mul(biquad(noise(n, r), 'lowpass', 700, 1), decay(n, .035, .001));
    const body = punch(n, 340 * f, r, { t60: .06, tone: .8 });
    const tail = rumble(n, .2, r, 300);
    return saturate(mix(n, [click, 0, .6], [clang, .001, .85], [muffle, .001, .6], [body, .002, .95], [tail, .02, dbfs(-12)]), 1.5);
  },
  // Perfect block: the same steel caught clean — brighter and tighter, a smaller body, a touch of edge.
  block_perfect(r) {
    const n = S(.28), f = vary(r, 1, .06);
    const click = mul(biquad(noise(n, r), 'highpass', 2600), decay(n, .005));
    const clang = dense(n, 1180 * f, 12, vary(r, .15, .1), r, { top: 4, roll: .8, grit: .25 });
    const sparkle = mul(biquad(noise(n, r), 'highpass', 4500), decay(n, .016));
    const body = punch(n, 430 * f, r, { t60: .04, tone: .6, burst: .8 });
    return saturate(mix(n, [click, 0, .7], [clang, .001, .55], [sparkle, .001, .2], [body, .002, 1.1]), 1.4);
  },
  // Parry: bright and decisive — an edge scrape sliding up, a long dense ring with beating partials, the hand's jolt underneath.
  parry(r) {
    const n = S(.50), f = vary(r, 1, .06);
    const click = mul(biquad(noise(n, r), 'highpass', 2400), decay(n, .006));
    const scrape = mul(sweepBandpass(noise(n, r), t => 1700 + 2300 * Math.min(1, t * 6), 3.5), envelope(n, [[0, .3], [.05, 1], [.09, 0], [n / RATE, 0]]));
    const ring = dense(n, 1300 * f, 16, vary(r, .42, .1), r, { top: 2.8, roll: .84, grit: .3, spread: .02 });
    const beat = mode(n, 1300 * f * 1.011, .4, .6, { phase: r() * 6 });
    const zing = mul(biquad(noise(n, r), 'highpass', 5500), decay(n, .03));
    const body = punch(n, 400 * f, r, { t60: .09, tone: .8, burst: 1 });
    const tail = rumble(n, .26, r, 420);
    return saturate(mix(n, [click, 0, .7], [scrape, 0, .4], [ring, .002, .55], [beat, .002, .25], [zing, .001, .12], [body, .002, 1.4], [tail, .02, dbfs(-6)]), 1.5);
  },
  // Guard break: dull and wrong — close detuned low partials beating, a choked mid burst, a low thump, driven hard so it crunches.
  guard_break(r) {
    const n = S(.44), f = vary(r, 1, .07);
    const crack = mul(biquad(noise(n, r), 'bandpass', 1400 * f, 2), decay(n, .01));
    const rattle = dense(n, 340 * f, 10, vary(r, .32, .1), r, { top: 3.2, roll: .9, grit: .5, spread: .05 });
    const choke = mul(biquad(biquad(noise(n, r), 'lowpass', 600, 1.2), 'highpass', 200), decay(n, .07, .002));
    const body = punch(n, 360 * f, r, { t60: .09, tone: .9, burst: 1.1 });
    const thump = mode(n, 70 * f, .17, 1, { slide: 1.8, tau: .05 });
    const tail = rumble(n, .3, r, 400);
    return fadeOut(saturate(mix(n, [crack, 0, .6], [rattle, .002, .8], [choke, .002, .9], [body, .003, 1.3], [thump, .006, .16], [tail, .03, dbfs(-7)]), 2.2), .1);
  },
  // Charge: the raised blade gathers — iron partials swelling under a noise bow, a low drone rising with them.
  charge(r) {
    const n = S(.5), f = vary(r, 1, .04);
    const swell = envelope(n, [[0, 0], [.36, 1], [.42, .8], [.5, 0]]);
    const y = new Float32Array(n);
    [1, 1.5, 2.7, 3.9].forEach((ratio, k) => { let ph = r() * 6.28; for (let i = 0; i < n; i++) { const t = i / n; ph += 2 * Math.PI * 1100 * f * ratio * (.96 + .04 * t) / RATE; y[i] += Math.sin(ph) * (.7 ** k) * swell[i]; } });
    const drone = mul(biquad(biquad(noise(n, r), 'bandpass', 240 * f, 1.4), 'lowpass', 600), swell);
    const bow = mul(biquad(noise(n, r), 'bandpass', 1900 * f, 1.5), swell);
    return saturate(mix(n, [y, 0, .7], [drone, 0, .8], [bow, 0, .3]), 1.3);
  },
  // Kill: the body falls — a deep thud with a mid punch, a second slump, a long low tail. Layered under the killing hit at runtime.
  kill(r) {
    const n = S(.7), f = vary(r, 1, .08);
    const fall = mode(n, 80 * f, .32, 1, { slide: 1.7, tau: .06 });
    const body = punch(n, 340 * f, r, { t60: .11, tone: .8, burst: 1.1 });
    const thud = mul(biquad(noise(n, r), 'lowpass', 160, .9), decay(n, .14, .003));
    const slump = punch(S(.3), 300 * f, r, { t60: .08, tone: .6 });
    const tail = rumble(n, .5, r, 420);
    return fadeOut(saturate(mix(n, [fall, 0, .2], [body, 0, 1.3], [thud, 0, .22], [slump, .19, .7], [tail, .05, dbfs(-5)]), 1.8), .15);
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
  const N = 4096, half = N / 2; let num = 0, den = 0, power = 0, phone = 0;
  for (let start = 0; start + N <= x.length; start += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[start + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / N));
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
    for (let k = 1; k < half; k++) { const m = Math.hypot(re[k], im[k]), f = k * RATE / N; num += m * f; den += m; power += m * m; if (f >= 300) phone += m * m; }
  }
  return { centroid: den ? Math.round(num / den) : 0, phone: power ? Math.round(100 * phone / power) : 0 };
}
const lengthMs = x => { const floor = dbfs(-60); let last = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > floor) last = i; return Math.round(last / RATE * 1000); };
const fingerprint = Object.keys(VARIANTS).map(name => { const own = cues.filter(c => c.name === name), spectra = own.map(c => spectrum(c.samples)), mean = a => Math.round(a.reduce((t, v) => t + v, 0) / a.length); return { name, variants: own.length, centroidHz: mean(spectra.map(s => s.centroid)), phone: mean(spectra.map(s => s.phone)), lengthMs: mean(own.map(c => lengthMs(c.samples))) }; });

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
console.log('| cue | variants | centroid Hz | ≥ 300 Hz energy | length ms |\n|---|---|---|---|---|\n' + fingerprint.map(f => `| ${f.name} | ${f.variants} | ${f.centroidHz} | ${f.phone} % | ${f.lengthMs} |`).join('\n'));
