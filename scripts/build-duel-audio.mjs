// Reproducible audio for the duel lobby: an opponent joining, the 3-2-1 tick and GO, and the win and loss stings. Synthesised from noise and resonant modes
// (drums, rim rings, a brass-ish horn): original work, no recordings, no licence to carry. Own small files (src/assets/duel-audio/): the sprite and the arena bank have no headroom.
// The helpers below repeat build-special-audio.mjs on purpose: that script's rebuild is pinned byte-identical, so it is not refactored to share them.
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
// Chamberlin state-variable filter with a moving cutoff (Hz as a function of time).
function sweep(x, type, fc, q = .7) {
  const y = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fc(i / RATE), 6000) / RATE), high = x[i] - low - q * band; band += f * high; low += f * band; y[i] = type === 'lowpass' ? low : type === 'bandpass' ? band : high; }
  return y;
}
const mix = (out, x, g = 1) => { for (let i = 0; i < out.length && i < x.length; i++) out[i] += x[i] * g; };
// A drum on skin: a low body that drops a little in pitch, a short slap above it.
const drum = (out, r, t, g = 1, f = 78, t60 = .22) => { const n = S(t60 + .1), y = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { p += f * (1 + .35 * Math.exp(-i / RATE / .03)) / RATE; y[i] = Math.sin(2 * Math.PI * p) * Math.exp(-6.9078 * i / RATE / t60); } const m = S(.03), s = biquad(noise(r, m), 'bandpass', 1800, 1), e = decay(m, .012, .0005); s.forEach((v, i) => { y[i] += v * e[i] * .6; }); add(out, y, t, g); };
// A brass-ish note: harmonics that thin out with height, a swell in, a slight waver; the phone plays the upper ones.
const horn = (out, t, f, len, g = 1) => { const n = S(len), y = new Float32Array(n); for (let i = 0; i < n; i++) { const u = i / n, ph = 2 * Math.PI * f * (i / RATE + .0016 * Math.sin(2 * Math.PI * 5.2 * i / RATE)), env = Math.min(1, u * len / .06) * Math.exp(-2.2 * Math.max(0, u - .55) / .45); let v = 0; for (let k = 1; k <= 9; k++) v += Math.sin(k * ph) / k * (k > 4 ? .55 : 1); y[i] = v * env; } add(out, y, t, g); };
const ringing = (out, t, freqs, t60 = .5, g = 1) => { for (const [f, a] of freqs) add(out, mode(S(t60 + .1), f, t60, a), t, g); };

// OPPONENT JOINED: a soft shield-rim ring over one low drum tap, a second tap a beat after: someone has come into the room.
function joined() {
  const r = rng(0x6a6f696e), out = new Float32Array(S(1.1));   // "join"
  drum(out, r, .02, .7, 70, .2); ringing(out, .02, [[880, .5], [1320, .3], [2110, .15]], .55, .6);
  drum(out, r, .3, .9, 84, .2); ringing(out, .3, [[1180, .4], [1770, .25]], .5, .5);
  return out;
}
// COUNT TICK (3, 2, 1): one dry drum tap with a wood click; the caller plays it once a second.
function tick() {
  const r = rng(0x7469636b), out = new Float32Array(S(.32));   // "tick"
  drum(out, r, .01, 1, 96, .14); ringing(out, .01, [[1500, .4], [2300, .2]], .1, .8);
  return out;
}
// GO: a bigger drum under a short open horn call, the same height as the third tick's call-and-answer.
function go() {
  const r = rng(0x676f2121), out = new Float32Array(S(1.0));   // "go!!"
  drum(out, r, .01, 1.2, 62, .35); drum(out, r, .01, .6, 120, .15);
  horn(out, .02, 196, .7, .55); horn(out, .02, 294, .7, .35);
  mix(out, sweep(noise(r, out.length), 'bandpass', () => 1800, .8).map((v, i) => v * Math.exp(-i / RATE / .25) * .5));
  return out;
}
// WIN: a rising horn call (a third and a fifth up), the crowd's roar swelling under it, a drum on the last note.
function win() {
  const r = rng(0x77696e21), out = new Float32Array(S(2.0));   // "win!"
  [[.05, 196, .5], [.45, 247, .5], [.85, 294, 1.0]].forEach(([t, f, len], k) => { horn(out, t, f, len, .6 + .15 * k); horn(out, t, f * 2, len, .2 + .1 * k); });
  mix(out, sweep(noise(r, out.length), 'bandpass', t => 600 + 500 * Math.min(1, t / 1.0), 1.0).map((v, i) => { const t = i / RATE; return v * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - .3) / 1.6))) * 1.4; }));
  drum(out, r, .85, 1.1, 66, .35);
  return out;
}
// LOSS: two slow low drum beats, a horn that sags a fourth and stops, the crowd's breath going out.
function loss() {
  const r = rng(0x6c6f7373), out = new Float32Array(S(2.0));   // "loss"
  drum(out, r, .05, .9, 58, .4); drum(out, r, .7, .7, 52, .5);
  let p = 0; for (let i = S(.1); i < S(1.5); i++) { const t = i / RATE, f = 220 * Math.exp(-(t - .1) / 1.1), u = (t - .1) / 1.4; p += f / RATE; let v = 0; for (let k = 1; k <= 7; k++) v += Math.sin(k * 2 * Math.PI * p) / k * (k > 3 ? .5 : 1); out[i] += v * .3 * Math.min(1, (t - .1) / .08) * Math.pow(1 - u, 1.5); }
  mix(out, sweep(noise(r, out.length), 'lowpass', t => 700 * Math.exp(-t / .8) + 150, .9).map((v, i) => { const t = i / RATE; return v * Math.exp(-t / .6) * 1.3; }));
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
// The stings sit a little above the specials' -25 (a lobby sound has no hit over it), the ticks and the join a little under.
const CUES = { joined: { make: joined, lufs: -24 }, tick: { make: tick, lufs: -24 }, go: { make: go, lufs: -22 }, win: { make: win, lufs: -22, fade: .25 }, loss: { make: loss, lufs: -23, fade: .25 } };
const dir = 'src/assets/duel-audio', work = 'artifacts/audio/duel'; await fs.mkdir(dir, { recursive: true }); await fs.mkdir(work, { recursive: true });
const report = {};
for (const [name, { make, lufs, fade = .04 }] of Object.entries(CUES)) {
  const out = make(), c = 10 ** (CEILING_DB / 20), clip = g => out.map(v => c * Math.tanh(v * g / c));
  for (let i = 0, n = S(fade); i < n; i++) out[out.length - 1 - i] *= i / n;   // ends on zero
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
