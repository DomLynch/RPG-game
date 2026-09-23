// Combat audio sprite build. Original procedural Foley plus hash-pinned CC0 recordings (src/assets/audio/SOURCES.json).
// Procedural layers use deterministic Node DSP
// (seeded noise, modal iron resonators, pitch-dropping body thumps, swept-filter air) — so the sprite is reproducible from
// this script and the source list; missing public recordings are cached under artifacts/audio/source-cache. Output: src/assets/audio/sprite.m4a (AAC, Safari) + sprite.ogg (Opus,
// Chrome/Android) + the generated src/audio/manifest.ts (cue → variants → [start, duration]). Usage: node scripts/build-audio.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const RATE = 48000, GAP = .04, LEAD = .02;
// Owner's ear, 2026-09-20: everything 30 % deeper. Applied to every frequency the recipes touch (filters, sweeps, modes) and
// as a length-preserving pitch shift on the recordings, so decays, lengths and timing are unchanged.
// Owner again, evening: "still pitch too high and tin-like, a deeper sound" — another 30 % (.7 × .7 ≈ .5), and weight (heft()) under
// every weapon, guard and shield impact.
const PITCH = .5;
// Owner 2026-09-20, after playing the −30 % mix: the end-of-match cheer is still high — the crowd recordings go another 30 %.
const PITCH_BY_SOURCE = { crowd: PITCH * .7, gasp: PITCH * .7, swordhit: 1, fleshslice: 1, bloodyblade: 1, messystab: 1, meatysplosh: 1 };   // the recordings play at their own pitch; the synth layers carry PITCH
// Length-preserving pitch shift: asetrate lowers pitch and slows; atempo (≤ 2 per stage, chained) restores the length.
const pitchFilter = pitch => { const tempo = 1 / pitch, stages = Math.ceil(Math.log(tempo) / Math.log(2)); return `asetrate=${RATE * pitch},aresample=${RATE},${Array.from({ length: stages }, () => `atempo=${tempo ** (1 / stages)}`).join(',')}`; };
const S = seconds => Math.round(seconds * RATE);
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Public CC0 previews are build inputs only, never additional runtime downloads. Hash changes fail closed.
const recordings = {}, sourceList = JSON.parse(await fs.readFile('src/assets/audio/SOURCES.json', 'utf8'));
await fs.mkdir('artifacts/audio/source-cache', { recursive: true });
for (const [name, source] of Object.entries(sourceList)) {
  // A source is either a public URL (cached under source-cache) or a local file with no stable public URL; both are hash-pinned.
  // Since 2026-09-23 every shipped recording is CC0 with a public URL, so a clean checkout rebuilds the sprite with no local cache.
  const file = source.file ?? `artifacts/audio/source-cache/${name}.mp3`;
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes && source.file) throw new Error(`${name}: committed source ${source.file} missing`);
  if (!bytes) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${name}: source HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`${name}: source hash mismatch`);
  if (!source.file) await fs.writeFile(file, bytes);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', pitchFilter(PITCH_BY_SOURCE[name] ?? PITCH), '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 64 * 1024 * 1024 });   // pitch × PITCH, same length
  recordings[name] = Float32Array.from(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4));
}
function recording(name, start, seconds, rate = 1) {
  const source = recordings[name], out = new Float32Array(S(seconds));
  for (let i = 0; i < out.length; i++) {
    const at = S(start) + i * rate, j = Math.floor(at), f = at - j;
    out[i] = ((source[j] || 0) * (1 - f) + (source[j + 1] || 0) * f) * Math.min(1, i / S(.006), (out.length - 1 - i) / S(.018));
  }
  return out;
}

// --- DSP primitives -------------------------------------------------------------------------------------------------
const noise = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);
const silence = n => new Float32Array(n);
// RBJ biquad; type in lowpass | highpass | bandpass | peaking | lowshelf | highshelf. Returns a new array.
function biquad(x, type, f, Q = .707, gainDb = 0) {
  const w = 2 * Math.PI * f * PITCH / RATE, cw = Math.cos(w), sw = Math.sin(w), A = 10 ** (gainDb / 40), alpha = sw / (2 * Q);
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
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fc(i / x.length) * PITCH, 12000) / RATE); low += f * band; const high = x[i] - low - q * band; band += f * high; y[i] = output === 'band' ? band : low; }
  return y;
}
const sweepBandpass = (x, fc, Q) => sweep(x, fc, Q, 'band');
// Exponentially decaying sinusoid: one resonant mode. t60 = seconds to −60 dB; slide = optional multiplier on f at t = 0 decaying with tau.
function mode(n, f, t60, amp = 1, { slide = 1, tau = .03, phase = 0 } = {}) {
  const y = new Float32Array(n), k = 6.9078 / (t60 * RATE); let ph = phase;
  for (let i = 0; i < n; i++) { const t = i / RATE, freq = f * PITCH * (1 + (slide - 1) * Math.exp(-t / tau)); ph += 2 * Math.PI * freq / RATE; y[i] = amp * Math.exp(-k * i) * Math.sin(ph); }
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
function add(target, x, at = 0, g = 1) { const o = S(at); for (let i = 0; i < x.length && o + i < target.length; i++) target[o + i] += x[i] * g; return target; }
const mix = (n, ...layers) => { const y = new Float32Array(n); for (const [x, at = 0, g = 1] of layers) add(y, x, at, g); return y; };
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
// Heft: the weight the owner asked for under weapons and guards. A phone speaker plays nothing at the fundamental, so the low
// tone is driven hard into tanh: its odd harmonics (3f, 5f, 7f) land in the 200–700 Hz band the speaker has, and the ear
// reconstructs the missing fundamental from them. A slow pitch drop over the first 60 ms gives it the "sag" of mass landing.
const heft = (n, f, r, { t60 = .3, drive = 4 } = {}) => normalize(saturate(mode(n, vary(r, f, .05), t60, 1, { slide: 2.4, tau: .06 }), drive), 0);
// Owner 2026-09-20, 23:20: two reference clips (a sword slice, a steel clash; measured, not copied — neither is licensed).
// Slice body: centroid 1.4–2.2 kHz, 47 Hz–7 kHz wide, −30 dB in .2 s. Steel clash: centroid 2.5–6.5 kHz, nothing below 300 Hz,
// ring .3–.8 s. These layers are voiced in absolute Hz so they land where the references sit whatever PITCH does to the bodies.
const abs = hz => hz / PITCH;
// Edge: the blade's bright slice — a broadband burst 1–7 kHz that is over in ~120 ms, laid over the weighted body.
const blade = (n, r, { lo = 1000, hi = 7000, t60 = .12 } = {}) => mul(broad(n, r, abs(lo), abs(hi)), decay(n, t60, .001));
// Steel ring: a dense inharmonic cluster placed where a real clash rings (f0 ~ 900–1300 Hz, partials to ~6 kHz), long decay.
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
// The steel guard voicing that was live at e1d0436 (deploy #35): kept as the second half of each guard cue's rotation.
const STEEL = .7;
const steel = (n, f0, t60, r, opts = {}) => dense(n, abs(f0 * STEEL), 16, t60, r, { top: 5.5, roll: .88, grit: .3, ...opts });
// The four weapon-landing voicings (see hit_flesh). `heavy` = slower recording playback + more heft + longer body.
const HITS = [
  (r, heavy, heavyRate = .92) => {   // CC0 recording: the same "Hit Impact Sword 3" a sixth lower — the deeper of the two takes.
    // Was the SoundFX "Sword Slash & Beheading" clip, dropped 2026-09-23: its stated terms carry no redistribution grant.
    const n = S(heavy ? .62 : .5), take = recording('swordhit', 0, heavy ? .62 : .5, (heavy ? heavyRate : vary(r, 1, .03)) * .86);
    return heavy ? mix(n, [take, 0, 1], [heft(n, 75, r, { t60: .35, drive: 5 }), .004, .45]) : take;
  },
  (r, heavy) => {   // #2 voiced: low thud, mid body, little above 300 Hz — a blunt landing
    const n = S(heavy ? .5 : .38), f = vary(r, 1, .07);
    const body = thud(n, r, { from: abs(2400 * f), to: abs(180 * f), fall: .09, t60: heavy ? .3 : .2 });
    const mid = mul(broad(n, r, abs(300), abs(1500)), decay(n, .05, .002));
    const weight = heft(n, abs(60 * f), r, { t60: heavy ? .4 : .28, drive: heavy ? 5 : 4 });
    return densify(mix(n, [body, .002, 1.2], [mid, .002, .5], [weight, .004, heavy ? .7 : .5], [rumble(n, heavy ? .4 : .28, r), .02, dbfs(-5)]), 2.8);
  },
  (r, heavy) => {   // #4 voiced: sharp slap transient (4–6 kHz) over a settling body
    const n = S(heavy ? .55 : .45), f = vary(r, 1, .06);
    const slap = mul(broad(n, r, abs(700 * f), abs(9000)), decay(n, .022, .001));
    const crack = mul(broad(n, r, abs(2500), abs(12000)), decay(n, .006));
    const body = thud(n, r, { from: abs(1800 * f), to: abs(260 * f), fall: .12, t60: heavy ? .34 : .26 });
    const weight = heft(n, abs(85 * f), r, { t60: heavy ? .36 : .26, drive: heavy ? 5 : 4 });
    return densify(mix(n, [crack, 0, .4], [slap, .001, .9], [body, .003, 1.1], [weight, .004, heavy ? .65 : .45], [rumble(n, heavy ? .4 : .3, r), .02, dbfs(-6)]), 2.6);
  },
  (r, heavy) => {   // #5 voiced: bright stab with a wet squelch and a short low thud
    const n = S(heavy ? .55 : .45), f = vary(r, 1, .06);
    const point = mul(broad(n, r, abs(2000 * f), abs(11000)), decay(n, .012, .001));
    const squelch = mul(sweepBandpass(noise(n, r), t => abs(2200 - 1400 * Math.min(1, t * 5)), 1.4), envelope(n, [[0, .2], [.03, 1], [.14, .35], [.3, 0], [n / RATE, 0]]));
    const body = thud(n, r, { from: abs(1500 * f), to: abs(220 * f), fall: .08, t60: heavy ? .3 : .22 });
    const weight = heft(n, abs(90 * f), r, { t60: heavy ? .32 : .22, drive: heavy ? 5 : 4 });
    return densify(mix(n, [point, 0, .6], [squelch, .004, .7], [body, .003, 1], [weight, .005, heavy ? .6 : .4], [rumble(n, heavy ? .35 : .25, r), .02, dbfs(-6)]), 2.5);
  },
  (r, heavy) => {   // CC0 recording: "Hit Impact Sword 3" (CogFireStudios, freesound 547042) — owner's pick 2026-09-22
    const n = S(heavy ? .75 : .62), take = recording('swordhit', 0, heavy ? .75 : .62, heavy ? .92 : vary(r, 1, .03));
    return heavy ? mix(n, [take, 0, 1], [heft(n, 75, r, { t60: .35, drive: 5 }), .004, .4]) : take;
  },
  // Owner 2026-09-23: four CC0 flesh landings, picked by ear from twelve (B, C, H, J; SOURCES.json) — each one take, at its own pitch,
  // with the .12 s fade-out he auditioned. Heavy (Lead 2026-09-23, on the owner's "hits still sound the same"): the same take played
  // slower and lower, with the sword hit's heft under it, so a heavy landing is the same flesh hit harder rather than a different sound.
  ...[['fleshslice', .13, .75], ['bloodyblade', .07, .6], ['messystab', 4.23, .7], ['meatysplosh', .04, .7]].map(([name, at, seconds]) => (r, heavy) => {
    const rate = heavy ? .88 : 1, length = seconds / rate, n = S(length);
    const take = normalize(mul(recording(name, at, length, rate), envelope(n, [[0, 1], [length - .12, 1], [length, 0]])), 0);   // heft is .4 of the take, not of the file's level
    return heavy ? mix(n, [take, 0, 1], [heft(n, 75, r, { t60: .35, drive: 5 }), .004, .4]) : take;
  }),
];
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
  // Owner 2026-09-21 13:40: "remove all of these except the kick; for the weapon lands on opponent use these" — six clips, five
  // kept for hits (the sixth, a shield clang, went to the guards). #1 (SoundFlakes, CC BY) is out: the owner wants no credit line
  // ("if its easier just remove this"). One ships as a recording: #6 "Sword Slash & Beheading" (stated free use); #2 / #4 / #5
  // carry no reuse grant and are voiced here to their measurements — #2 a low thud with a mid body (centroid ~870 Hz, mostly
  // below 300 Hz), #4 a sharp slap (4–6 kHz transient, 700 Hz–12 kHz) over a body that settles in ~.65 s, #5 a bright stab
  // with a wet squelch, ~.66 s. hit_flesh = the four at strike weight; hit_heavy = the same four hit harder.
  // Owner 2026-09-21 16:5x (audit of the live set): light keeps the slash-kill recording and the stab (blunt thud + slap out); heavy
  // keeps the slash-kill recording only — every synth heavy was cut. bone_crack still draws its two from the table.
  hit_flesh(r, v) { return HITS[[4, 3, 5, 6, 7, 8][v % 6]](r, false); },   // owner 2026-09-23: six different sounds, never one twice running — the
  // sword hit, the synth stab and the four CC0 flesh takes; the sword hit's lower take (HITS[0]) left the light rotation, it was the same recording
  hit_heavy(r, v) { return HITS[[4, 3, 5, 6, 7, 8][v % 6]](r, true); },   // the same six, hit harder (Lead 2026-09-23): heavy, charged and riposte
  // landings were one recording at two pitches, so every heavy blow sounded alike; now they rotate like the light ones
  // Kick: a cloth slap and a dull mid thud, no edge, no ring.
  hit_kick(r) {
    const n = S(.28), f = vary(r, 1, .08);
    const slap = mul(broad(n, r, 300 * f, 2500 * f), decay(n, .025, .002));
    const body = thud(n, r, { from: 3000 * f, to: 360 * f, fall: .08, t60: .14 });
    const tone = punch(n, 340 * f, r, { t60: .07, tone: .4, burst: .3 });
    const thump = mode(n, 120 * f, .14, 1, { slide: 1.9, tau: .03 });
    const weight = heft(n, 100 * f, r, { t60: .2 });
    const tail = rumble(n, .2, r);
    return densify(mix(n, [slap, 0, .55], [body, .003, 1.2], [tone, .003, .4], [thump, .004, .08], [weight, .004, .4], [tail, .02, dbfs(-6)]), 2.6);
  },
  // Owner 2026-09-21: option 3 of his six clips ("large metal sword hits metal shield", no reuse grant) voiced to its measurements —
  // ring centred 1.5–1.9 kHz, 84 % above 300 Hz, partials to ~6 kHz, −30 dB in .52 s — and added to the guard rotation.
  block_shield(r, perfect) {
    const n = S(perfect ? .38 : .48), f = vary(r, 1, .06);
    const click = mul(broad(n, r, abs(1500), abs(9000)), decay(n, .005));
    const ring = dense(n, abs(1250 * f), 16, vary(r, perfect ? .32 : .45, .1), r, { top: 4.8, roll: .87, grit: .3 });
    const body = thud(n, r, { from: abs(3000 * f), to: abs(320 * f), fall: .06, t60: .14 });
    const weight = heft(n, abs(95 * f), r, { t60: .24 });
    return densify(mix(n, [click, 0, .5], [ring, .001, 1], [body, .002, .7], [weight, .003, .4], [rumble(n, .22, r), .02, dbfs(-8)]), 2.4);
  },
  // Owner 2026-09-21 10:40: "new sounds for the swords/metal are ok, but I also like the older ones — add them back and put on random
  // rotation, same sound never twice in a row." Each guard cue's variants are half the new voicing, half the e1d0436 steel voicing;
  // the runtime's nextVariant() already forbids an immediate repeat.

  // Block: iron on iron into a braced guard — a hard broadband click, a dense clang the arms damp, the guard's own body.
  block_steel(r) {
    const n = S(.5), f = vary(r, 1, .07);
    const click = mul(broad(n, r, 1500 * STEEL, 10000 * STEEL), decay(n, .004));
    const clang = steel(n, 900 * f, vary(r, .5, .12), r);
    const muffle = mul(broad(n, r, 250, 1600), decay(n, .04, .001));
    const body = thud(n, r, { from: 4000 * f, to: 320 * f, fall: .07, t60: .14 });
    const tone = punch(n, 330 * f, r, { t60: .08, tone: .6, burst: .3 });
    const weight = heft(n, 95 * f, r, { t60: .28 });
    const zing = blade(n, r, { lo: 2000 * STEEL, hi: 10000 * STEEL, t60: .05 });
    const tail = rumble(n, .24, r);
    return densify(mix(n, [click, 0, .45], [clang, .001, 1], [muffle, .001, .4], [body, .002, .9], [tone, .002, .35], [weight, .003, .5], [zing, 0, .35], [tail, .02, dbfs(-8)]), 2.6);
  },

  // Perfect block: the same steel caught clean — brighter and tighter, a smaller body, a touch of edge.
  block_perfect_steel(r) {
    const n = S(.42), f = vary(r, 1, .06);
    const click = mul(broad(n, r, 2000 * STEEL, 10000 * STEEL), decay(n, .004));
    const clang = steel(n, 1300 * f, vary(r, .4, .1), r, { top: 5, roll: .85, grit: .25 });
    const sparkle = mul(broad(n, r, 3000 * STEEL, 9000 * STEEL), decay(n, .015));
    const body = thud(n, r, { from: 5000 * f, to: 400 * f, fall: .05, t60: .09 });
    const weight = heft(n, 110 * f, r, { t60: .2 });
    return densify(mix(n, [click, 0, .5], [clang, .001, .8], [sparkle, .001, .2], [body, .002, 1], [weight, .003, .4]), 2.2);
  },

  // Parry: bright and decisive — an edge scrape sliding up, a long dense ring with beating partials, the hand's jolt underneath.
  parry_steel(r) {
    const n = S(.66), f = vary(r, 1, .06);
    const click = mul(broad(n, r, 1500 * STEEL, 10000 * STEEL), decay(n, .005));
    const scrape = mul(sweepBandpass(noise(n, r), t => (1100 + 1500 * Math.min(1, t * 6)) * STEEL, 2), envelope(n, [[0, .3], [.05, 1], [.09, 0], [n / RATE, 0]]));
    const ring = steel(n, 1100 * f, vary(r, .7, .1), r, { spread: .02 });
    const beat = mode(n, abs(1100 * f * STEEL) * 1.011, .6, .5, { phase: r() * 6 });
    const zing = mul(broad(n, r, 3500 * STEEL, 8000 * STEEL), decay(n, .03));
    const body = thud(n, r, { from: 4500 * f, to: 340 * f, fall: .09, t60: .16 });
    const tone = punch(n, 380 * f, r, { t60: .1, tone: .6, burst: .3 });
    const weight = heft(n, 100 * f, r, { t60: .3 });
    const tail = rumble(n, .3, r);
    return densify(mix(n, [click, 0, .5], [scrape, 0, .45], [ring, .002, .7], [beat, .002, .25], [zing, .001, .1], [body, .002, 1.2], [tone, .002, .5], [weight, .003, .45], [tail, .02, dbfs(-5)]), 2.4);
  },
  // Parry, shield half: the same voicing block_shield uses, held longer and centred at the parry's measured ring. It replaces the
  // Jochi SFX "Shield Block" recording (dropped 2026-09-23 — its terms forbid redistribution); the recording measured 882-1116 Hz
  // centroid, 31-43 % above 300 Hz, -30 dB in .29-.32 s across its three takes, and this is voiced to that.
  parry_shield(r) {
    const n = S(.72), f = vary(r, 1, .06);
    const click = mul(broad(n, r, abs(1400), abs(9000)), decay(n, .005));
    const ring = dense(n, abs(1600 * f), 16, vary(r, .5, .1), r, { top: 4.6, roll: .88, grit: .3 });
    const body = thud(n, r, { from: abs(3200 * f), to: abs(300 * f), fall: .07, t60: .16 });
    const weight = heft(n, abs(92 * f), r, { t60: .3 });
    return densify(mix(n, [click, 0, .45], [ring, .001, .8], [body, .002, .95], [weight, .003, .7], [rumble(n, .26, r), .02, dbfs(-6)]), 2.4);
  },
  // Owner 2026-09-22: the armour-synth branch (the first 3 in the rendered guard-metal preview) removed — "remove them from the
  // game." block/block_perfect split evenly between the steel ring and the shield clang.
  block(r, v) {
    return v >= 2 ? RECIPES.block_shield(r, false) : RECIPES.block_steel(r);
  },
  // Perfect block: same split as block(), no armour-synth branch.
  block_perfect(r, v) {
    return v >= 2 ? RECIPES.block_shield(r, true) : RECIPES.block_perfect_steel(r);
  },
  parry(r, v) { return v >= 3 ? RECIPES.parry_steel(r) : RECIPES.parry_shield(r); },
  // Guard break: dull and wrong — close detuned low partials beating, a choked mid burst, a low thump, driven hard so it crunches.
  // Whip crack (Whipped: the lorarii/wall lash) — a real whip's supersonic tip, not a weapon: near-zero low end, a very fast
  // broadband burst that leans high (2–9 kHz), a thin descending sting as the leather uncoils, and a short dry tail (no ring,
  // no metal). Two takes so the no-repeat rotation has somewhere to go.
  whip(r, v) {
    const n = S(.28), f = vary(r, 1, v % 2 ? .1 : -.1);
    const crack = mul(broad(n, r, abs(2200 * f), abs(11000)), decay(n, .008, 0));
    const snap = mul(sweepBandpass(noise(n, r), t => abs((6500 - 4000 * Math.min(1, t * 26)) * f), 3), envelope(n, [[0, 1], [.03, .5], [.09, 0], [n / RATE, 0]]));
    const sting = mode(n, abs(3200 * f), .05, .5, { slide: .5, tau: .02 });
    const tail = mul(broad(n, r, abs(600), abs(3000)), decay(n, .05, .001));
    return densify(mix(n, [crack, 0, 1], [snap, 0, .7], [sting, .002, .3], [tail, .006, dbfs(-6)]), 2);
  },
  // Whip raise (WhipRaised: the lorarius lifts his whip, `lead` ticks before the lash) — the tell, not the hit: leather dragging
  // up through air, a soft rising rasp with no transient and no metal, so it reads across the arena as motion rather than an
  // impact. It must never be mistaken for the crack that follows it. Two takes for the no-repeat rotation.
  whip_raise(r, v) {
    const n = S(.4), f = vary(r, 1, v % 2 ? .08 : -.08);
    const lift = mul(sweepBandpass(noise(n, r), t => abs((420 + 1500 * Math.min(1, t * 1.25) ** 1.4) * f), 1.1), envelope(n, [[0, 0], [.06, .5], [.24, 1], [.34, .55], [n / RATE, 0]]));
    const leather = mul(broad(n, r, abs(180 * f), abs(1400 * f)), envelope(n, [[0, 0], [.1, .7], [.3, .5], [n / RATE, 0]]));
    const air = mul(broad(n, r, abs(2200), abs(7000)), envelope(n, [[0, 0], [.22, .35], [.33, .5], [n / RATE, 0]]));
    return densify(mix(n, [lift, 0, 1], [leather, .004, .55], [air, .01, dbfs(-9)]), 1.7, { lift: 2 });
  },
  guard_break(r) {
    const n = S(.46), f = vary(r, 1, .07);
    const crack = mul(broad(n, r, 600, 5000), decay(n, .01));
    const rattle = dense(n, 380 * f, 10, vary(r, .32, .1), r, { top: 3.4, roll: .9, grit: .5, spread: .05 });
    const choke = mul(broad(n, r, 280, 1600), decay(n, .07, .002));
    const body = thud(n, r, { from: 3500 * f, to: 460 * f, fall: .12, t60: .24 });
    const tone = punch(n, 330 * f, r, { t60: .12, tone: .6, burst: .3 });
    const thump = mode(n, 70 * f, .17, 1, { slide: 1.8, tau: .05 });
    const weight = heft(n, 80 * f, r, { t60: .4, drive: 5 });
    const tail = rumble(n, .36, r);
    return fadeOut(densify(mix(n, [crack, 0, .7], [rattle, .002, .8], [choke, .002, .7], [body, .003, 1.3], [tone, .003, .5], [thump, .006, .14], [weight, .005, .6], [tail, .03, dbfs(-5)]), 3), .1);
  },
  // Charge: the raised blade gathers — iron partials swelling under a noise bow, a low drone rising with them.
  charge(r) {
    const n = S(.5), f = vary(r, 1, .04);
    const swell = envelope(n, [[0, 0], [.36, 1], [.42, .8], [.5, 0]]);
    const y = new Float32Array(n);
    [1, 1.5, 2.7, 3.9].forEach((ratio, k) => { let ph = r() * 6.28; for (let i = 0; i < n; i++) { const t = i / n; ph += 2 * Math.PI * 700 * PITCH * f * ratio * (.96 + .04 * t) / RATE; y[i] += Math.sin(ph) * (.7 ** k) * swell[i]; } });
    const drone = mul(biquad(biquad(noise(n, r), 'bandpass', 180 * f, 1.2), 'lowpass', 500), swell);
    const bow = mul(broad(n, r, 600 * f, 2400 * f), swell);
    return densify(mix(n, [y, 0, .7], [drone, 0, .9], [bow, 0, .4]), 1.6, { lift: 2 });
  },
  // Movement-start textures only: cloth/leather friction and loose sand, no invented landing impact.
  roll(r) {
    const n = S(.32);
    const cloth = mul(broad(n, r, 240, 1700), decay(n, .3, .015));
    const sand = mul(broad(n, r, 1800, 6500), decay(n, .24, .006));
    const fold = mul(broad(n, r, 360, 2200), decay(n, .18, .008));
    return fadeOut(mix(n, [cloth, 0, 1], [sand, .008, .2], [fold, .065, .45]), .04);
  },
  backstep(r) {
    const n = S(.15);
    const scuff = mul(broad(n, r, 700, 4200), decay(n, .14, .004));
    const leather = mul(broad(n, r, 220, 1400), decay(n, .12, .006));
    return fadeOut(mix(n, [scuff, 0, .5], [leather, .003, 1]), .025);
  },
  // Human voices and organic contact, kept short and dry-forward. Two different recorded vocal performances.
  death_voice(r, v) { return biquad(recording(v % 2 ? 'grunt2' : 'grunt', v % 2 ? .16 : .008, v % 2 ? .62 : .44, v < 2 ? 1 : vary(r, .97, .015)), 'highpass', 120); },
  flesh_cut(r, v) { return biquad(recording('tear', .02 + v * .13, .18, vary(r, 1, .04)), 'lowpass', 4300); },
  flesh_stab(r, v) { return mul(biquad(recording('tear', v * .2, .16, 1.15), 'lowpass', 2200), decay(S(.16), .2, .002)); },
  flesh_tear(r, v) { return biquad(recording('tear', .02 + v * .29, .34, vary(r, .92, .025)), 'lowpass', 3800); },
  // Bloodless opponents (bone instead of flesh): the same weapon-landing pool — the owner replaced the old synths outright.
  bone_crack(r, v) { return HITS[v % 2](r, false); },
  crowd_gasp(r, v) { return biquad(recording('gasp', v ? 5.55 : 3.9, .42, vary(r, 1, .015)), 'highpass', 180); },
  crowd_cheer(r, v) {
    const n = S(2.5), cheer = biquad(biquad(recording('crowd', [.5, 21.85, 44.9][v], 2.28), 'highpass', 180), 'lowpass', 5500);
    for (let i = 0; i < cheer.length; i++) cheer[i] *= Math.min(1, i / S(.2));
    // Gasp first, then one of three actual cheering takes. Quiet delayed copies widen the group without a new runtime bus.
    return fadeOut(mix(n, [RECIPES.crowd_gasp(r, v % 2), 0, .3], [cheer, .22, 1], [cheer, .266, .17], [cheer, .323, .1]), .6);
  },
  // Kill: the body falls — a deep thud with a mid punch, a second slump, a long low tail. Layered under the killing hit at runtime.
  // Owner 2026-09-21: all three body-fall voicings cut ("not good sounds"); replaced by three steel strikes measured from his
  // "Parry Sound Effects v2" reference (ripped game assets, no reuse grant → voiced to the measurements, never shipped as audio).
  // Each = click (1.5–10 kHz, 5 ms) + the measured partial set + a sub thump at the measured ~35–80 Hz + low rumble.
  // Envelopes from the clip: #2 flat 100 ms then −14 dB @ 300 ms (t60 ≈ .5 s); #3 long ring (−6 dB @ 500 ms); #6 −11 dB @ 500 ms.
  kill(r, v) {
    const SETS = [
      { seconds: .62, partials: [[3167, .9], [3724, 1], [4421, .85], [4954, .95], [5558, .8], [10479, .5], [2660, .5], [1990, .3]], ring: .5, sub: [59, .2], subT: .3 },
      { seconds: .82, partials: [[4649, 1], [5247, .7], [5909, .5], [3513, .45], [9894, .4], [2988, .35], [2733, .45], [2150, .3]], ring: 1.3, sub: [40, .24], subT: .34 },
      { seconds: .7, partials: [[3349, 1], [4131, .65], [2783, .55], [5019, .5], [3519, .5], [7107, .3], [2399, .5], [1720, .3]], ring: .7, sub: [53, .22], subT: .3 },
    ];
    const { seconds, partials, ring, sub, subT } = SETS[v % 3], n = S(seconds), f = vary(r, 1, .04);
    const click = mul(broad(n, r, abs(1500), abs(10000)), decay(n, .005));
    const steelSet = normalize(mix(n, ...partials.map(([hz, a]) => [mode(n, abs(hz * f), ring * (.75 + .5 * r()), a, { phase: r() * 6.28 }), 0, 1])), 0);
    const rough = biquad(noise(n, r), 'lowpass', 70);
    for (let i = 0; i < n; i++) steelSet[i] *= 1 + .25 * rough[i] * 3;   // the beating between close partials the clip shows
    const splash = mul(broad(n, r, abs(8000), abs(14000)), decay(n, .12, .001));   // the strike's top-octave sizzle
    const body = mul(broad(n, r, abs(150), abs(900)), decay(n, .04, .002));
    const thump = mode(n, abs(sub[0] * f), subT, 1, { slide: 1.8, tau: .025 });
    const weight = heft(n, abs(sub[0] * f), r, { t60: subT, drive: 4 });
    return fadeOut(densify(mix(n, [click, 0, .5], [steelSet, .001, 1], [splash, 0, 1.2], [body, 0, .8], [thump, .002, sub[1]], [weight, .002, sub[1] * .8], [rumble(n, .3, r), .01, dbfs(-8)]), 2.2), .08);
  },
};
const VARIANTS = { whoosh_light: 4, whoosh_heavy: 4, draw: 2, hit_flesh: 6, hit_heavy: 6, hit_kick: 4, block: 4, block_perfect: 4, parry: 6, guard_break: 4, whip: 2, whip_raise: 2, charge: 2, kill: 3, roll: 4, backstep: 4, death_voice: 4, flesh_cut: 4, flesh_stab: 2, flesh_tear: 2, bone_crack: 2, crowd_gasp: 2, crowd_cheer: 3 };

// --- Sprite assembly ---------------------------------------------------------------------------------------------------
const cues = [];
for (const [name, count] of Object.entries(VARIANTS)) for (let v = 0; v < count; v++) {
  let seed = 0; for (const c of `${name}#${v}`) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  cues.push({ name, variant: v, samples: normalize(RECIPES[name](rng(seed), v), -4) });   // −4 dBFS: lossy decoders overshoot dense transients by 3–4 dB, and integer decoders would clip that
}
// Loudness match for the landing rotations (Lead 2026-09-23). Peak normalisation left the six light landings 14 LU apart on a
// phone (the bass-heavy "messy stabber" at the bottom: its low end spends the peak and a phone plays none of it), so the rotation
// read as some hits missing. Measure: phone-band (> 300 Hz) K-weighted momentary max, the speaker this mix is voiced for. A landing
// above its target is trimmed; one below is driven into tanh — heft()'s trick, the harmonics land where the speaker plays — and
// re-peaked at −4 dBFS, by the smallest drive that reaches the target (capped at MAX_DRIVE). Heavies sit HEAVY_LU above lights.
const LIGHT_LUFS = -19, HEAVY_LU = 2, MAX_DRIVE = 12, MATCHED = { hit_flesh: LIGHT_LUFS, hit_heavy: LIGHT_LUFS + HEAVY_LU };
function phoneMomentary(x) {
  const w = 2 * Math.PI * 300 / RATE, c = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + alpha;   // RBJ Butterworth high-pass, twice
  const hp = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0];
  const filter = (x, [b0, b1, b2, a1, a2]) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  const k = [hp, hp, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, .73248077421585], [1, -2, 1, -1.99004745483398, .99007225036621]].reduce(filter, x);   // BS.1770 K-weighting at 48 kHz
  const block = S(.4), hop = S(.1); let max = 0;
  for (let start = 0; start === 0 || start + block <= k.length; start += hop) { let sum = 0; for (let i = start; i < Math.min(k.length, start + block); i++) sum += k[i] * k[i]; max = Math.max(max, sum / block); }
  return -.691 + 10 * Math.log10(max);
}
const driven = (x, drive) => normalize(x.map(v => Math.tanh(v * drive / dbfs(-4))), -4);
const landings = cues.filter(c => c.name in MATCHED);
for (const c of landings) {
  const target = MATCHED[c.name]; c.before = phoneMomentary(c.samples); c.drive = 1;
  if (c.before > target) c.samples = c.samples.map(v => v * 10 ** ((target - c.before) / 20));
  else { let lo = .1, hi = MAX_DRIVE; if (phoneMomentary(driven(c.samples, hi)) > target) for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (phoneMomentary(driven(c.samples, mid)) < target) lo = mid; else hi = mid; } c.drive = hi; c.samples = driven(c.samples, hi); }
  c.after = phoneMomentary(c.samples);
}
console.log(`landings, phone momentary LUFS before → after (tanh drive): ${landings.map(c => `${c.name}#${c.variant} ${c.before.toFixed(1)} → ${c.after.toFixed(1)}${c.drive > 1 ? ` (×${c.drive.toFixed(1)})` : ''}`).join(' · ')}`);
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
encode(['-c:a', 'libopus', '-b:a', '72k', '-vbr', 'on', '-application', 'audio'], 'sprite.ogg');   // 72k / AAC 96k (aac_at steps coarsely; 96k is the last rung under budget): six light + six heavy landings (2026-09-23) push the sprite to ~48 s; Opus went 80k → 72k to hold the 1.0 MB cap
// Codec check: decode each encode and compare with the source over the impact cues — waveform SNR (dense transients are the
// hard case for both codecs) and the decoded peak, which must stay under full scale for integer decoders.
const codec = {};
for (const file of ['sprite.m4a', 'sprite.ogg']) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(dir, file), '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1 << 28 });
  const decoded = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2); let snr = 0, count = 0, peak = 0;
  for (const name of ['hit_flesh', 'hit_heavy', 'hit_kick', 'block', 'block_perfect', 'parry', 'guard_break', 'kill']) {
    const [start, duration] = manifest[name][0], a = S(start), n = S(duration); let sig = 0, err = 0;
    for (let i = 0; i < n; i++) { const x = sprite[a + i], d = decoded[a + i] ?? 0; sig += x * x; err += (d - x) ** 2; peak = Math.max(peak, Math.abs(d)); }
    snr += 10 * Math.log10(sig / err); count++;
  }
  codec[file] = { snrDb: Math.round(snr / count * 10) / 10, decodedPeak: Math.round(peak * 100) / 100 };
  if (peak > 1) throw new Error(`${file}: decoded peak ${peak.toFixed(2)} exceeds full scale; lower the cue normalisation`);
}
const manifestModule = `// Generated by scripts/build-audio.mjs — do not edit. Cue → variants → [start, duration] seconds inside the audio sprite.
export const SPRITE_SECONDS = ${Math.round(total * 1000) / 1000};
export const MANIFEST = ${JSON.stringify(manifest)} as const;
export type CueName = keyof typeof MANIFEST;
`;
await fs.writeFile(path.join('src', 'audio', 'manifest.ts'), manifestModule);
const sizes = {}; for (const file of ['sprite.m4a', 'sprite.ogg']) sizes[file] = (await fs.stat(path.join(dir, file))).size;
console.log(`sprite ${total.toFixed(2)} s, ${cues.length} cues · m4a ${sizes['sprite.m4a']} B (impact SNR ${codec['sprite.m4a'].snrDb} dB, decoded peak ${codec['sprite.m4a'].decodedPeak}) · ogg ${sizes['sprite.ogg']} B (impact SNR ${codec['sprite.ogg'].snrDb} dB, decoded peak ${codec['sprite.ogg'].decodedPeak})`);
console.log('| cue | variants | centroid Hz | ≥ 300 Hz energy | −15 dB width (oct) | crest dB | length ms |\n|---|---|---|---|---|---|---|\n' + fingerprint.map(f => `| ${f.name} | ${f.variants} | ${f.centroidHz} | ${f.phone} % | ${f.octaves} | ${f.crest} | ${f.lengthMs} |`).join('\n'));
