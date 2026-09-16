// Rendered-output comparison: per cue WAV (through voices, compressor, ceiling, room) — −15 dB width in octaves, crest over
// 150 ms from the cue, share of energy ≥ 300 Hz — for two labels. Numbers, not design targets.
import fs from 'node:fs';
const [a, b] = process.argv.slice(2), RATE = 48000, CUE_AT = .05;
function fft(re, im) { const N = re.length; for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), p = i + k, q = p + len / 2, tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr; re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; } } }
function shape(file) {
  const x = new Int16Array(fs.readFileSync(file).buffer.slice(44)).subarray(Math.round(CUE_AT * RATE));
  const head = x.subarray(0, Math.round(.15 * RATE)); let peak = 0, sq = 0; for (const v of head) { peak = Math.max(peak, Math.abs(v)); sq += v * v; }
  const N = 4096, spec = new Float64Array(N / 2); let power = 0, phone = 0;
  for (let s = 0; s + N <= x.length + N / 2; s += N / 2) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N && s + i < x.length; i++) re[i] = x[s + i] / 32768 * (.5 - .5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 1; k < N / 2; k++) { const p = re[k] ** 2 + im[k] ** 2; spec[k] += p; power += p; if (k * RATE / N >= 300) phone += p; } }
  const thirds = []; for (let f = 60; f < 16000; f *= 2 ** (1 / 3)) { let p = 0, c = 0; for (let k = Math.round(f * N / RATE); k < Math.round(f * 2 ** (1 / 3) * N / RATE); k++) { p += spec[k] || 0; c++; } thirds.push([f, c ? p / c : 0]); }
  const max = Math.max(...thirds.map(t => t[1])), inside = thirds.filter(t => t[1] >= max * 10 ** -1.5);
  return { octaves: Math.log2(inside.at(-1)[0] * 2 ** (1 / 3) / inside[0][0]).toFixed(1), crest: (20 * Math.log10(peak / Math.sqrt(sq / head.length))).toFixed(1), phone: Math.round(100 * phone / power), band: `${Math.round(inside[0][0])}–${Math.round(inside.at(-1)[0] * 2 ** (1 / 3))}` };
}
const loud = l => JSON.parse(fs.readFileSync(`artifacts/audio/${l}/loudness.json`, 'utf8')).loudness;
const la = loud(a), lb = loud(b);
console.log(`| cue | width oct ${a} → ${b} | −15 dB band ${b} | crest dB ${a} → ${b} | ≥300 Hz ${a} → ${b} | phone LUFS ${a} → ${b} |\n|---|---|---|---|---|---|`);
for (const cue of ['hit-light', 'hit-heavy', 'hit-kick', 'blocked', 'blocked-perfect', 'parried', 'guard-broken', 'killed', 'swing-light', 'swing-heavy', 'draw', 'charged']) {
  const A = shape(`artifacts/audio/${a}/events/${cue}.wav`), B = shape(`artifacts/audio/${b}/events/${cue}.wav`);
  console.log(`| ${cue} | ${A.octaves} → ${B.octaves} | ${B.band} Hz | ${A.crest} → ${B.crest} | ${A.phone} % → ${B.phone} % | ${la[`events/${cue}`].lufsPhone} → ${lb[`events/${cue}`].lufsPhone} |`);
}
