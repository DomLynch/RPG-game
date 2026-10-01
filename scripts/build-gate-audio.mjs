// Reproducible arena-gate winch: ~5 s of chain and drawbridge lift — pawl ticks on a ratchet, chain links, a straining timber groan,
// then the gate seating with a knock and a settling clatter. Synthesised here from noise and resonant modes: original work, no
// recordings, so no licence to carry. Its own small file (src/assets/gate-audio/): the sprite and the arena bank have no headroom left.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const RATE = 48000, S = s => Math.round(s * RATE), LENGTH = 5, SEAT = 4.34;
const TARGET_LUFS_M = -19, CEILING_DB = -4;   // the sprite's light landings sit at −19 LUFS-M on the phone band (build-audio.mjs LIGHT_LUFS), peaks at −4 dBFS
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r = rng(0x6761746e);   // "gatn": fixed seed, so a rebuild is byte-identical
const peakOf = x => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
const noise = n => Float32Array.from({ length: n }, () => r() * 2 - 1);
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
const load = t => t < .04 ? 0 : t < 1.4 ? (t - .04) / 1.36 : t < 3.6 ? 1 : t < 4.2 ? 1 - .7 * (t - 3.6) / .6 : Math.max(0, .3 * (1 - (t - 4.2) / .2));   // how hard the winch is working: none until the latch is off, easing at the top, released as the gate seats
const out = new Float32Array(S(LENGTH)), L = Object.fromEntries(['ticks', 'chain', 'groan', 'seat'].map(k => [k, new Float32Array(S(LENGTH))]));   // layers, balanced below

// Pawl ticks on the ratchet: quick at first, steady under load, easing as the gate nears the top.
const ticks = [];
for (let t = .05; t < 4.2;) { ticks.push(t); const d = t < 1.1 ? .21 - .095 * (t - .05) / 1.05 : t < 3.6 ? .115 : .115 + .085 * Math.min(1, (t - 3.6) / .6); t += d * (1 + (r() - .5) * .08); }
const tick = () => { const n = S(.09), env = decay(n, .012), body = biquad(noise(n), 'bandpass', 2400, 1.2).map((v, i) => v * env[i] * 6);
  const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = body[i];
  for (const [f, t60, a] of [[950, .03, .5], [3100, .05, .25], [4300, .04, .15]]) mode(n, f * (1 + (r() - .5) * .04), t60, a).forEach((v, i) => { y[i] += v; });
  return y; };
const clink = (g = 1) => { const n = S(.12), y = new Float32Array(n), f0 = 1800 + r() * 2600, t60 = .035 + .03 * r();
  for (const [m, a] of [[1, 1], [1.59, .6], [2.31, .35]]) mode(n, f0 * m, t60 / m, a).forEach((v, i) => { y[i] += v * g; });
  return y; };
for (const t of ticks) {
  const l = load(t); add(L.ticks, tick(), t, (.55 + .45 * l) * (.8 + .4 * r()));
  for (let k = 0, links = 3 + Math.floor(r() * 3); k < links; k++) add(L.chain, clink(.1 + .25 * r()), t + .012 + r() * .09, l);   // chain links jostling over the drum after each tick
}
for (let t = .07; t < 4.2; t += 1 / 26) add(L.chain, clink(.05 + .12 * r()), t + r() * .03, load(t));   // the loose chain between the ticks

// The timber groan: two detuned saws under a slow drift, strained in step with the ticks (slip-stick), only while the winch loads.
{ const n = out.length, groan = new Float32Array(n), wander = biquad(noise(n), 'lowpass', 3); let p1 = 0, p2 = 0, k = 0;
  const wmax = peakOf(wander);
  for (let i = 0; i < n; i++) { const t = i / RATE, l = load(t), f = 150 + 45 * l + 14 * wander[i] / wmax;
    while (k + 1 < ticks.length && ticks[k + 1] <= t) k++;   // strain builds and slips between one real tick and the next, so the groan keeps the ratchet's uneven time
    const span = (ticks[k + 1] ?? ticks[k] + .2) - ticks[k], slip = Math.abs(Math.sin(Math.PI * Math.max(0, t - ticks[k]) / span));
    p1 = (p1 + f / RATE) % 1; p2 = (p2 + f * 1.013 / RATE) % 1;
    groan[i] = (p1 + p2 - 1) * Math.pow(l, 1.3) * (.6 + .4 * slip); }
  const g = biquad(biquad(groan, 'lowpass', 1400), 'highpass', 200);
  for (let i = 0; i < n; i++) L.groan[i] += g[i]; }

// The gate seats: a heavy knock (a mid part the handset can play, a low part it mostly cannot), then a chain clatter settling.
{ const n = S(.7), knock = new Float32Array(n), env = decay(n, .25), body = biquad(noise(n), 'lowpass', 900).map((v, i) => v * env[i] * 2.4);
  for (const [f, t60, a] of [[140, .4, 1], [415, .2, .6], [230, .3, .5]]) mode(n, f, t60, a).forEach((v, i) => { knock[i] += v; });
  for (let i = 0; i < n; i++) knock[i] += body[i];
  add(L.seat, knock, SEAT);
  for (let k = 0; k < 16; k++) { const at = SEAT + .03 + k * .028 + r() * .02; add(L.seat, clink(.5 * Math.exp(-(at - SEAT) / .22)), at); } }
{ const n = S(.35), cr = new Float32Array(n);   // one last strain of timber as the weight comes off
  for (let i = 0; i < n; i++) { const t = i / RATE; cr[i] = Math.sin(2 * Math.PI * (170 - 40 * t) * t) * Math.sin(Math.PI * t / .35); }
  add(L.seat, biquad(cr, 'highpass', 200), SEAT + .2, .25); }

// Level: the same phone-band K-weighted momentary max the sprite's landings are matched on, and a −4 dBFS ceiling like every sprite cue.
function phoneMomentary(x) {
  const w = 2 * Math.PI * 300 / RATE, c = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + alpha;
  const hp = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0];
  const filter = (x, [b0, b1, b2, a1, a2]) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  const k = [hp, hp, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, .73248077421585], [1, -2, 1, -1.99004745483398, .99007225036621]].reduce(filter, x);
  const block = S(.4), hop = S(.1); let max = 0;
  for (let start = 0; start === 0 || start + block <= k.length; start += hop) { let sum = 0; for (let i = start; i < Math.min(k.length, start + block); i++) sum += k[i] * k[i]; max = Math.max(max, sum / block); }
  return -.691 + 10 * Math.log10(max);
}
const WEIGHT = { ticks: .11, chain: .54, groan: .46, seat: .29 };   // from the layers' own peaks and phone loudness (GATE_LAYERS=1 prints them): ticks and knock are 24 dB-crest transients, the groan and chain carry the level
for (const k of Object.keys(L)) for (let i = 0; i < out.length; i++) out[i] += L[k][i] * WEIGHT[k];
for (let i = 0, n = S(.06); i < n; i++) out[out.length - 1 - i] *= i / n;   // ends on zero
if (process.env.GATE_LAYERS) for (const k of Object.keys(L)) console.log(k, 'phone LUFS-M', phoneMomentary(L[k]).toFixed(1), 'peak dBFS', (20 * Math.log10(peakOf(L[k]))).toFixed(1));
// Soft clip c·tanh(v/c) never passes the ceiling; the gain is bisected until the phone-band momentary max lands on the target, so the
// clicks and the knock (a 23 dB crest before this) are squashed only as far as the loudness match needs.
const peakBefore = peakOf(out), c = 10 ** (CEILING_DB / 20), clip = g => out.map(v => c * Math.tanh(v * g / c));
let lo = 1e-3, hi = 1e3; for (let k = 0; k < 40; k++) { const g = Math.sqrt(lo * hi); if (phoneMomentary(clip(g)) < TARGET_LUFS_M) lo = g; else hi = g; }
const gain = Math.sqrt(lo * hi), shaped = clip(gain); out.set(shaped);
const level = { phoneMomentaryLufs: phoneMomentary(out), peakDbfs: 20 * Math.log10(peakOf(out)), gainDb: 20 * Math.log10(gain), unclippedPeakDbfs: 20 * Math.log10(peakBefore * gain), tickCount: ticks.length };

console.log('level', JSON.stringify(level));
const dir = 'src/assets/gate-audio', work = 'artifacts/audio/gate'; await fs.mkdir(dir, { recursive: true }); await fs.mkdir(work, { recursive: true });
const raw = `${work}/gate.f32`; await fs.writeFile(raw, Buffer.from(out.buffer));
const report = { seconds: LENGTH, level, codecs: {}, gzip: 0 };
for (const [file, codec] of [['gate.m4a', ['-c:a', 'aac_at', '-b:a', '48k', '-movflags', '+faststart']], ['gate.ogg', ['-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio']]]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', `${RATE}`, '-ac', '1', '-i', raw, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', ...codec, `${dir}/${file}`], { timeout: 60000 });
  const bytes = await fs.readFile(`${dir}/${file}`), decoded = execFileSync('ffmpeg', ['-v', 'error', '-i', `${dir}/${file}`, '-ac', '1', '-ar', `${RATE}`, '-f', 'f32le', '-'], { maxBuffer: 32e6, timeout: 60000 });
  const data = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.length / 4), tailPeak = peakOf(data.subarray(data.length - S(.03)));
  if (data.length < S(LENGTH - .1)) throw Error(`${file}: decoded ${data.length / RATE} s, expected ~${LENGTH} s`);
  if (peakOf(data) >= 1) throw Error(`${file}: encoded clipping`);
  if (tailPeak > .01) throw Error(`${file}: does not end on silence (last 30 ms peak ${tailPeak})`);
  report.codecs[file] = { bytes: bytes.length, gzip: gzipSync(bytes).length, peakDbfs: 20 * Math.log10(peakOf(data)), sha256: createHash('sha256').update(bytes).digest('hex') };
  report.gzip += gzipSync(bytes).length;
}
await fs.writeFile(`${work}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
