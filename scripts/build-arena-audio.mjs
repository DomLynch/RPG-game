// Reproducible optional arena bank. CC0 pins live beside the build evidence; no runtime remote audio.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { bellSamples } from '../src/audio/bell.ts';
const RATE = 48000, n = t => Math.round(t * RATE), recordings = {};
const PITCH = .7;   // owner 2026-09-20: audience 30 % deeper
const sources = { ...JSON.parse(await fs.readFile('src/assets/audio/SOURCES.json')), ...JSON.parse(await fs.readFile('src/assets/audio/arena-life.SOURCES.json')) };
await fs.mkdir('artifacts/audio/source-cache', { recursive: true });
for (const name of ['murmur', 'jeer', 'crowd', 'gasp', 'grunt', 'grunt2', 'boohall', 'whistle']) {
  const pin = sources[name], file = `artifacts/audio/source-cache/${name}.mp3`;
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) { const r = await fetch(pin.url, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw Error(`${name}: HTTP ${r.status}`); bytes = Buffer.from(await r.arrayBuffer()); }
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256) throw Error(`${name}: source hash mismatch`);
  await fs.writeFile(file, bytes);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', `asetrate=${RATE * PITCH},aresample=${RATE},atempo=${1 / PITCH}`, '-ac', '1', '-ar', `${RATE}`, '-f', 'f32le', '-'], { maxBuffer: 32e6 });   // owner 2026-09-20: audience 30 % deeper, same length; the generated bell is untouched
  recordings[name] = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
function cut(name, start, duration, rate = 1) {
  const input = recordings[name], out = new Float32Array(n(duration));
  if (n(start) + out.length * rate >= input.length) throw Error(`${name}: trim out of bounds`);
  for (let i = 0; i < out.length; i++) { const x = n(start) + i * rate, k = Math.floor(x); out[i] = input[k] * (1 - x + k) + input[k + 1] * (x - k); }
  return out;
}
function add(out, input, at = 0, gain = 1) { for (let i = 0; i < input.length && i + n(at) < out.length; i++) out[i + n(at)] += input[i] * gain; return out; }
function fade(x, attack = .03, release = .15) { return x.map((v, i) => v * Math.min(1, i / n(attack), (x.length - i - 1) / n(release))); }
function band(x, lo = 180, hi = 3400) {
  // Two cascaded one-pole filters each side remove rumble and distant-crowd hiss. The top follows PITCH like the content; the
  // low cut stays — below ~180 Hz a handset speaker plays nothing, so lowering it only feeds the codec and the phone-band gate.
  for (let pass = 0; pass < 2; pass++) {
    let low = 0, high = 0; const a = 1 - Math.exp(-2 * Math.PI * lo / RATE), b = 1 - Math.exp(-2 * Math.PI * hi * PITCH / RATE);
    x = x.map(v => { low += a * (v - low); high += b * (v - low - high); return high; });
  }
  return x;
}
function normal(x, rms = .12) {
  let peak = 0, sq = 0; for (const v of x) { peak = Math.max(peak, Math.abs(v)); sq += v * v; }
  if (!peak) throw Error('silent region');
  const gain = Math.min(.5 / peak, rms / Math.sqrt(sq / x.length)); return x.map(v => v * gain);
}
const regions = { bed: [], reaction: [], jeer: [], chant: [], grunt: [], bell: [], jeer_wall: [] };
for (let v = 0; v < 3; v++) {
  const bed = new Float32Array(n(6));   // 6 s (was 8): room for the three wall-jeer beds under the 450 KB budget; it loops with a .9 s crossfade
  for (let layer = 0; layer < 7; layer++) add(bed, cut('murmur', (v * 3.1 + layer * 1.73) % 10, 6, .88 + layer * .033), 0, 1 / 7);
  regions.bed.push(normal(fade(band(bed), .015, .015), .09));
  regions.reaction.push(normal(fade(band(cut('crowd', [1.3, 22.7, 45.8][v], 1.05)), .09, .4)));
}
regions.reaction.push(normal(fade(band(cut('gasp', 3.9, .5)), .02, .2)));
for (let v = 0; v < 2; v++) {
  regions.jeer.push(normal(fade(band(cut('jeer', [1.2, 8.3][v], 1.3)), .12, .5)));
  // Short wordless group calls; deliberately no modern songs or intelligible team names.
  const chant = new Float32Array(n(2.8));
  for (let beat = 0; beat < 4; beat++) {
    const syllable = fade(band(cut('jeer', [17.2, 24.7][v] + beat * .32, .42, beat % 2 ? 1.04 : .94)), .07, .16);
    add(chant, syllable, beat * .58); add(chant, syllable, beat * .58 + .047, .25); add(chant, syllable, beat * .58 + .103, .12);
  }
  regions.chant.push(normal(fade(chant)));
}
for (const [name, start] of [['grunt', .008], ['grunt2', .16], ['grunt2', .35]]) regions.grunt.push(normal(fade(band(cut(name, start, .24), 120, 4500), .008, .05)));
regions.bell.push(bellSamples(RATE));
// Brief 13 (owner 2026-09-22, "a, b, c — all good put them on rotation"): the crowd turns on a wall-hugger. Three 3 s beds, each
// a swell over the loiter clock (arena.ts scales them by loiter/ticks and drops them on leave/swing): A a low grumble rising to
// boos (big arena), B sharper small-mob jeers with wolf-whistles, C a rhythmic stamp-and-chant turning to boos (Colosseum).
// Sources CC0, pinned in arena-life.SOURCES.json; C's stamps are procedural.
const swell = (x, floor = .15) => x.map((v, i) => v * (floor + (1 - floor) * Math.min(1, i / x.length / .85)));
const tail = x => fade(x, .02, .25);
{ // A
  const a = new Float32Array(n(3));
  for (let layer = 0; layer < 5; layer++) add(a, cut('murmur', (2.2 + layer * 1.9) % 10, 3, .9 + layer * .03), 0, .25);
  add(a, swell(band(cut('jeer', 4, 3), 180, 3400), .05), 0, 1.1);
  add(a, band(cut('crowd', 21, 3), 120, 500), 0, .45);
  regions.jeer_wall.push(normal(tail(band(swell(a, .3))), .11));
}
{ // B
  const b = swell(band(cut('boohall', 1, 3, 1.15), 220, 3400), .1);
  for (const [at, start] of [[.7, .3], [1.6, 4.0], [2.3, 8.0]]) add(b, fade(band(cut('whistle', start, .7, 1.4), 600, 3400), .01, .2), at, .55);
  regions.jeer_wall.push(normal(tail(b), .11));
}
{ // C
  const c = new Float32Array(n(3)); let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [i, t] of [0, .5, 1, 1.5, 2, 2.5].entries()) {
    const amp = .3 + .7 * i / 5, feet = 6 + 2 * i;
    for (let f = 0; f < feet; f++) { const at = t + (rnd() - .5) * .05, g = amp * (.6 + .4 * rnd()); let lp = 0;
      for (let k = 0; k < n(.12); k++) { const j = n(at) + k; if (j < 0 || j >= c.length) continue; lp += ((rnd() * 2 - 1) - lp) * .08; c[j] += g * Math.exp(-k / n(.03)) * (lp * 1.6 + .5 * Math.sin(2 * Math.PI * 60 * k / RATE) * Math.exp(-k / n(.05))); }
    }
  }
  for (const [i, at] of [.5, 1, 1.5, 2].entries()) add(c, fade(band(cut('jeer', i % 2 ? 17.52 : 17.2, .42, i % 2 ? 1.04 : .94)), .07, .16), at, .5 + .1 * i);
  add(c, fade(band(cut('jeer', 4, 1.2)), .5, .3), 1.8, .9);
  regions.jeer_wall.push(normal(tail(c), .11));
}

const manifest = {}, chunks = []; let cursor = .02;
for (const [name, variants] of Object.entries(regions)) for (const samples of variants) {
  (manifest[name] ??= []).push([Number(cursor.toFixed(3)), samples.length / RATE]); chunks.push([cursor, samples]); cursor += samples.length / RATE + .06;
}
const bank = new Float32Array(n(cursor)); for (const [at, samples] of chunks) add(bank, samples, at);
const dir = 'src/assets/arena-audio'; await fs.mkdir(dir, { recursive: true });
const raw = 'artifacts/audio/arena-life/bank.f32'; await fs.writeFile(raw, Buffer.from(bank.buffer));
const report = { seconds: cursor, regions: Object.values(manifest).flat().length, codecs: {}, gzip: 0 };
for (const [file, codec] of [['arena.m4a', ['-c:a', 'aac_at', '-b:a', '48k', '-movflags', '+faststart']], ['arena.ogg', ['-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio']]]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', `${RATE}`, '-ac', '1', '-i', raw, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', ...codec, `${dir}/${file}`]);
  const bytes = await fs.readFile(`${dir}/${file}`), decoded = execFileSync('ffmpeg', ['-v', 'error', '-i', `${dir}/${file}`, '-ac', '1', '-ar', `${RATE}`, '-f', 'f32le', '-'], { maxBuffer: 32e6 });
  const data = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.length / 4); let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  for (const list of Object.values(manifest)) for (const [start, length] of list) {
    if (n(start + length) > data.length || !data.subarray(n(start), n(start + length)).some(v => Math.abs(v) > .001)) throw Error(`${file}: invalid region`);
  }
  if (peak >= 1) throw Error(`${file}: encoded clipping`);
  report.codecs[file] = { bytes: bytes.length, peakDbfs: 20 * Math.log10(peak), sha256: createHash('sha256').update(bytes).digest('hex') }; report.gzip += gzipSync(bytes).length;
}
if (report.gzip > 450000) throw Error(`Arena bank exceeds 450KB: ${report.gzip}`);
await fs.writeFile('src/audio/arena-manifest.ts', `// Generated by scripts/build-arena-audio.mjs. Regions are [offset, duration] seconds.\nexport const ARENA_MANIFEST = ${JSON.stringify(manifest)} as const;\nexport type ArenaCue = keyof typeof ARENA_MANIFEST;\n`);
await fs.writeFile('artifacts/audio/arena-life/assets.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
