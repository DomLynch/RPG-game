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
const CUES = { charge: { make: charge, lufs: -24 }, quake: { make: quake, lufs: -23 }, tithe: { make: tithe, lufs: -25 } };
const dir = 'src/assets/special-audio', work = 'artifacts/audio/special'; await fs.mkdir(dir, { recursive: true }); await fs.mkdir(work, { recursive: true });
const report = {};
for (const [name, { make, lufs }] of Object.entries(CUES)) {
  const out = make(), c = 10 ** (CEILING_DB / 20), clip = g => out.map(v => c * Math.tanh(v * g / c));
  for (let i = 0, n = S(.04); i < n; i++) out[out.length - 1 - i] *= i / n;   // ends on zero
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
