// Combat audio evidence harness. Renders the fixed scripted exchange (src/audio/exchange.ts) through the real
// createFeedback in a headless Chromium OfflineAudioContext — the same Web Audio implementation phones run — to
// artifacts/audio/<label>/: exchange.wav, one WAV per cue probe, a BS.1770 loudness table and a report. Same script,
// same seed, every iteration, so BEFORE/AFTER is like-for-like. Usage: node scripts/audio-preview.mjs [--label name] [--seed n] [--fallback]
// (--fallback renders the synth path the game uses until the sprite has decoded.)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { CUE_PROBES, scriptExchange } from '../src/audio/exchange.ts';
import { cuesFor } from '../src/audio/cues.ts';
import { COMBAT_LEVEL, FINISH_LEVEL } from '../src/feedback.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const label = arg('label', 'preview'), seed = Number(arg('seed', 731)), against = arg('against', 'baseline'), fallback = process.argv.includes('--fallback'), RATE = 48000, TAIL = 4, PROBE_AT = .05, PROBE_LENGTH = 1.2;
const out = path.join('artifacts', 'audio', label);
await fs.mkdir(path.join(out, 'events'), { recursive: true });

// --- the exchange: ticks → seconds; the render runs TAIL seconds past the last tick so decays finish.
const exchange = scriptExchange();
const cues = exchange.ticks.map(({ tick, events, presentation }) => ({ t: tick / 60, events, presentation }));
const seconds = exchange.length / 60 + TAIL;

// --- Chromium page served by the Vite dev server, so /src/feedback.ts and any asset it imports resolve exactly as in the game.
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: false }, optimizeDeps: { noDiscovery: true, include: [] } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
const rendered = {}, flat = {}; let path_ = '';
const probeLength = probe => ['quietOne','opened'].includes(probe.presentation?.override) ? 6.5 : probe.events.some(e => e.type === 'Killed') ? 4.5 : PROBE_LENGTH;
const checks = process.argv.includes('--check') ? {} : null;
try {
  browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  const page = await browser.newPage();
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  await page.route(`${origin}/harness`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="module">import { createFeedback } from '/src/feedback.ts'; import { spriteFormats, loadSprite } from '/src/audio/sprite.ts'; import { MANIFEST } from '/src/audio/manifest.ts'; window.harness = { createFeedback, spriteFormats, loadSprite, MANIFEST };</script>` }));
  await page.goto(`${origin}/harness`);
  await page.waitForFunction(() => !!window.harness, null, { timeout: 20000 });
  const render = (cues, seconds, balance) => page.evaluate(async ({ cues, seconds, rate, seed, fallback, balance }) => {
    const context = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
    let now = 0;
    const feedback = window.harness.createFeedback({ context, now: () => now, seed, ...(fallback ? { sprite: null } : {}), ...(balance ? { balance } : {}) });
    feedback.unlock(); const decoded = await feedback.ready();
    for (const { t, events, presentation, control } of cues) { now = t; if (control) feedback[control](); else feedback.update(events, presentation); }
    const data = (await context.startRendering()).getChannelData(0);
    // 16-bit PCM, transferred as base64 (Float32 arrays do not serialise through evaluate).
    const pcm = new Int16Array(data.length); for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)));
    const bytes = new Uint8Array(pcm.buffer); let text = ''; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { pcm: btoa(text), decoded };
  }, { cues, seconds, rate: RATE, seed, fallback, balance });
  const pcm = async (...args) => { const { pcm, decoded } = await render(...args); if (!fallback && !decoded) throw new Error('sprite did not decode in Chromium; rerun with --fallback to render the synth path'); const bytes = Buffer.from(pcm, 'base64'); return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2); };
  path_ = fallback ? 'synth fallback (--fallback)' : `sprite, formats tried in order ${JSON.stringify(await page.evaluate(() => window.harness.spriteFormats()))}`;
  rendered.exchange = await pcm(cues, seconds);
  if (checks) {
    checks.maxRepeatDelta = 0;
    for (let run = 0; run < 2; run++) {
      const repeat = await pcm(cues, seconds);
      assert.equal(repeat.length, rendered.exchange.length);
      for (let i = 0; i < repeat.length; i++) checks.maxRepeatDelta = Math.max(checks.maxRepeatDelta, Math.abs(repeat[i] - rendered.exchange[i]));
    }
    assert.ok(checks.maxRepeatDelta <= 1, `exchange changed by ${checks.maxRepeatDelta} PCM units; tolerance is one 16-bit rounding unit`);
    checks.codecs = await page.evaluate(async () => {
      const { loadSprite, MANIFEST } = window.harness;
      const context = new OfflineAudioContext(1, 48000, 48000), result = {};
      for (const format of ['aac', 'opus']) {
        const buffer = await loadSprite(context, [format]);
        if (!buffer) throw new Error(`${format} did not decode`);
        for (const [name, regions] of Object.entries(MANIFEST)) for (const [start, duration] of regions) {
          if (start + duration > buffer.duration) throw new Error(`${format}: ${name} extends past sprite`);
          const samples = buffer.getChannelData(0).subarray(Math.round(start * buffer.sampleRate), Math.round((start + duration) * buffer.sampleRate));
          if (!samples.some(v => Math.abs(v) > .001)) throw new Error(`${format}: ${name} is silent`);
        }
        result[format] = { seconds: buffer.duration, regions: Object.values(MANIFEST).flat().length };
      }
      let requests = 0;
      const recovered = await loadSprite(context, ['opus', 'aac'], (...args) => ++requests === 1 ? Promise.reject(new Error('forced primary failure')) : fetch(...args));
      if (!recovered || requests !== 2) throw new Error('format fallback failed');
      result.fallback = true;
      return result;
    });
    const stacked = await pcm([{ t: .05, events: Array.from({ length: 4 }, () => ({ tick: 3, actor: 0, type: 'Parried' })) }, { t: .06, events: Array.from({ length: 4 }, () => ({ tick: 4, actor: 1, type: 'Hit' })) }], 1.2);
    let peak = 0; for (const sample of stacked) peak = Math.max(peak, Math.abs(sample));
    checks.stackedPeakDbfs = 20 * Math.log10(peak / 32768);
    assert.ok(checks.stackedPeakDbfs <= -1, `stacked peak exceeds ceiling: ${checks.stackedPeakDbfs}`);
  }
  for (const probe of CUE_PROBES) rendered[`events/${probe.name}`] = await pcm([{ t: PROBE_AT, events: probe.events, presentation: probe.presentation }], probeLength(probe));
  // Phone-mix pin (checked after the loudness pass): the same probes with the balance stage at ×1.
  if (checks && !fallback && seed === 731) for (const probe of CUE_PROBES) if (rendered[`events/${probe.name}`].some(v => v !== 0)) flat[`events/${probe.name}`] = await pcm([{ t: PROBE_AT, events: probe.events, presentation: probe.presentation }], probeLength(probe), { combat: 1, finish: 1 });
  if (checks) {
    const fatal = CUE_PROBES.find(p => p.name === 'finish-decapitation');
    assert.ok(fatal, 'decapitation probe exists');
    const fatalCue = { t: .05, events: fatal.events, presentation: fatal.presentation };
    const withEmptyTicks = await pcm([fatalCue, ...Array.from({ length: 180 }, (_, i) => ({ t: .1 + i / 60, events: [] }))], 4.5);
    assert.ok(withEmptyTicks.every((v, i) => Math.abs(v - rendered['events/finish-decapitation'][i]) <= 1), 'empty simulation ticks preserve the finishing mix');
    const draw = { t: 2, events: CUE_PROBES.find(p => p.name === 'draw').events };
    const freshDraw = await pcm([draw], 3.2);
    for (const control of ['quiet', 'toggle']) {
      const cancelled = await pcm([{ t: .05, events: fatal.events, presentation: fatal.presentation }, { t: .1, control }], 4.5);
      assert.ok(cancelled.some(v => v !== 0), 'fatal impact plays before cancellation');
      assert.ok(cancelled.subarray(RATE).every(v => v === 0), `${control} leaves no delayed crowd or collapse after the room decays`);
      const resumed = await pcm([fatalCue, { t: .1, control }, { t: .2, control: control === 'quiet' ? 'unlock' : 'toggle' }, draw], 3.2);
      assert.ok(resumed.subarray(2 * RATE).every((v, i) => Math.abs(v - freshDraw[2 * RATE + i]) <= 1), `${control}: next duel restores ordinary volume without stale finishing audio`);
    }
    const quiet = CUE_PROBES.find(p => p.name === 'finish-quietOne');
    const quietCue = {t:PROBE_AT,events:quiet.events,presentation:quiet.presentation};
    const quietSamples=rendered['events/finish-quietOne'];
    assert.ok(quietSamples.subarray(1.8*RATE,2.5*RATE).every(v=>Math.abs(v)<=1),'Quiet One leaves a silent held beat before the body lands');
    assert.ok(quietSamples.subarray(2.6*RATE,3.8*RATE).some(v=>Math.abs(v)>100),'Quiet One body and gasp remain audible after the held beat');
    for(const control of ['quiet','toggle']) {
      const stopped=await pcm([quietCue,{t:.1,control}],6.5);
      assert.ok(stopped.subarray(RATE).every(v=>v===0),`${control} cancels Quiet One's late body and crowd`);
    }
    checks.quietOneHeldBeatAndCancellation = true;
    checks.finishMixLifecycle = true;
    checks.fatalCancellation = true;
    checks.fatalPeakDbfs = -Infinity;
    for (const [name, samples] of Object.entries(rendered)) if (name.startsWith('events/finish-')) {
      let peak = 0; for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      checks.fatalPeakDbfs = Math.max(checks.fatalPeakDbfs, 20 * Math.log10(peak / 32768));
      assert.ok(samples.subarray(Math.floor(((name.includes('quietOne') || name.includes('opened')) ? 6 : 3.8) * RATE)).every(v => v === 0), `${name}: tail finishes within the render`);
    }
    assert.ok(checks.fatalPeakDbfs <= -1, 'fatal stack respects the ceiling');
  }
  if (checks) {
    // Render the sampled mix at 4x rate to catch peaks reconstructed between 48 kHz samples.
    checks.fatalTruePeakDbfs = -Infinity;
    for (const [name, samples] of Object.entries(rendered)) if (CUE_PROBES.some(p => `events/${p.name}` === name && p.events.some(e => e.type === 'Killed'))) {
      const peak = await page.evaluate(async ({ samples, rate }) => {
        const context = new OfflineAudioContext(1, samples.length * 4, rate * 4);
        const buffer = context.createBuffer(1, samples.length, rate);
        buffer.copyToChannel(Float32Array.from(samples, v => v / 32768), 0);
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); source.start();
        const output = (await context.startRendering()).getChannelData(0);
        let peak = 0; for (const v of output) peak = Math.max(peak, Math.abs(v));
        return 20 * Math.log10(peak);
      }, { samples: Array.from(samples), rate: RATE });
      checks.fatalTruePeakDbfs = Math.max(checks.fatalTruePeakDbfs, peak);
    }
    assert.ok(checks.fatalTruePeakDbfs <= -1, `fatal reconstructed peak exceeds -1 dBFS: ${checks.fatalTruePeakDbfs}`);
  }
  assert.deepEqual(pageErrors, [], 'no browser errors');
} finally { try { await browser?.close(); } finally { await server.close(); } }

// --- WAV out.
function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.byteLength, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}
for (const [name, pcm] of Object.entries(rendered)) { if (pcm.some(v => v)) await fs.writeFile(path.join(out, `${name}.wav`), wav(pcm)); else await fs.rm(path.join(out, `${name}.wav`), { force: true }); }   // silent probes ship as a table row, not a blank file

// --- Loudness: ITU-R BS.1770-4 (K-weighting at 48 kHz, 400 ms blocks, 100 ms hop, −70 LUFS absolute and −10 LU relative gates), mono.
const biquad = (x, [b0, b1, b2, a1, a2]) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
const dB = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
function measure(pcm, cueAt) {
  const x = Float64Array.from(pcm, v => v / 32768);
  const k = biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585]), [1, -2, 1, -1.99004745483398, 0.99007225036621]);
  const block = Math.round(.4 * RATE), hop = Math.round(.1 * RATE), blocks = [];
  for (let start = 0; start + block <= k.length; start += hop) { let sum = 0; for (let i = start; i < start + block; i++) sum += k[i] * k[i]; blocks.push(sum / block); }
  if (k.length < block) { let sum = 0; for (const v of k) sum += v * v; blocks.push(sum / k.length); }
  const loud = z => -.691 + 10 * Math.log10(z), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const absolute = blocks.filter(z => loud(z) > -70), momentary = blocks.length ? loud(Math.max(...blocks)) : -Infinity;
  const gate = absolute.length ? loud(mean(absolute)) - 10 : -Infinity, gated = absolute.filter(z => loud(z) > gate);
  const integrated = gated.length ? loud(mean(gated)) : -Infinity;
  let peak = 0, first = -1, last = -1; const floor = 10 ** (-60 / 20);
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; if (a > floor) { if (first < 0) first = i; last = i; } }
  const round = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  return { lufsIntegrated: round(integrated), lufsMomentaryMax: round(momentary), peakDbfs: round(dB(peak)), onsetMs: first < 0 ? null : Math.round((first / RATE - cueAt) * 1000), lengthMs: first < 0 ? 0 : Math.round((last - first) / RATE * 1000), lufsPhone: round(phoneLoudness(x)) };
}
// Phone-band proxy: integrated loudness after a 300 Hz high-pass, not a model of a specific handset speaker.
function phoneLoudness(x) {
  const w = 2 * Math.PI * 300 / RATE, c = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + alpha;   // RBJ Butterworth high-pass, applied twice
  const hp = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0];
  const y = biquad(biquad(x, hp), hp);
  const k = biquad(biquad(y, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585]), [1, -2, 1, -1.99004745483398, 0.99007225036621]);
  const block = Math.round(.4 * RATE), hop = Math.round(.1 * RATE), blocks = [];
  for (let start = 0; start + block <= k.length; start += hop) { let sum = 0; for (let i = start; i < start + block; i++) sum += k[i] * k[i]; blocks.push(sum / block); }
  const loud = z => -.691 + 10 * Math.log10(z), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const absolute = blocks.filter(z => loud(z) > -70), gate = absolute.length ? loud(mean(absolute)) - 10 : -Infinity, gated = absolute.filter(z => loud(z) > gate);
  return gated.length ? loud(mean(gated)) : -Infinity;
}
const loudness = Object.fromEntries(Object.entries(rendered).map(([name, pcm]) => [name, measure(pcm, name === 'exchange' ? cues[0].t : PROBE_AT)]));
if (checks && !fallback && seed === 731) {
  // The owner's phone mix (ordinary ×0.5, fatal ×1.5, 2026-09-19) measured against the same render with the balance stage at
  // ×1 — self-contained, so it survives re-voicing and still catches a compensating compressor or a reset finishing gain.
  checks.phoneMix = { ordinary: 0, crowd: 0, fatal: 0 };
  // The 2.4–2.7 s tail is the cheer alone: a cheer that starts on the contact tick, a render long enough to hold it, no other cue landing in the window.
  const crowdTail = probe => { const cues = cuesFor(probe.events, probe.presentation); return probeLength(probe) >= 2.7 && cues.some(c => c.name === 'crowd_cheer' && (c.delay ?? 0) < .5) && !cues.some(c => (c.delay ?? 0) > 1.9 && (c.delay ?? 0) < 2.7); };
  const tailRms = pcm => { const tail = pcm.subarray(Math.round(2.4 * RATE), Math.round(2.7 * RATE)); return 10 * Math.log10(tail.reduce((sum, v) => sum + (v / 32768) ** 2, 0) / tail.length); };
  for (const probe of CUE_PROBES) {
    const name = `events/${probe.name}`;
    if (!flat[name]) continue; // intentionally silent simulation events
    const before = { lufsIntegrated: measure(flat[name], PROBE_AT).lufsIntegrated, tailRmsDbfs: crowdTail(probe) ? tailRms(flat[name]) : undefined };
    const delta = loudness[name].lufsIntegrated - before.lufsIntegrated;
    if (!probe.events.some(e => e.type === 'Killed')) {
      assert.ok(Math.abs(delta - 20 * Math.log10(COMBAT_LEVEL)) < .15, `${name}: ordinary level changed ${delta} dB, expected ${(20 * Math.log10(COMBAT_LEVEL)).toFixed(2)} (COMBAT_LEVEL)`);
      checks.phoneMix.ordinary++;
    } else {
      // FINISH_LEVEL nominal, −.82 … +.18 as when the pin was set (the output guard may take some of the boost); ± .05 for the .1 LUFS rounding.
      const boost = 20 * Math.log10(FINISH_LEVEL);
      assert.ok(delta >= boost - .87 && delta <= boost + .23, `${name}: boosted fatal loudness changed ${delta} dB, expected about ${boost.toFixed(2)} (FINISH_LEVEL)`);
      checks.phoneMix.fatal++;
    }
    if (before.tailRmsDbfs !== undefined) {
      assert.ok(Math.abs(tailRms(rendered[name]) - before.tailRmsDbfs - 20 * Math.log10(FINISH_LEVEL)) < .15, `${name}: crowd tail must follow FINISH_LEVEL`);
      checks.phoneMix.crowd++;
    }
  }
  // Coverage pinned from CUE_PROBES: 17 audible ordinary probes; 16 fatal; 12 of those with a clean cheer tail (Quiet One's gasp
  // starts at 2.8 s, gory Opened lands its second body cue at 2.68 s, a double death gasps).
  assert.deepEqual(checks.phoneMix, { ordinary: 17, crowd: 12, fatal: 16 });
}

// --- Payload: the shipped audio assets, raw and gzip; delta against the committed baseline when this is not the baseline.
async function payload(dir) {
  let raw = 0, gzip = 0;
  try { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { if (entry.isDirectory()) { const c = await payload(path.join(dir, entry.name)); raw += c.raw; gzip += c.gzip; } else { const bytes = await fs.readFile(path.join(dir, entry.name)); raw += bytes.length; gzip += gzipSync(bytes).length; } } } catch { /* no audio assets yet */ }
  return { raw, gzip };
}
const assets = await payload(path.join('src', 'assets', 'audio'));
const baseline = label === against ? null : await fs.readFile(path.join('artifacts', 'audio', against, 'loudness.json'), 'utf8').then(JSON.parse).catch(() => null);
const git = (cmd) => { try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const receipt = { checks, label, seed, rate: RATE, path: path_, generated: new Date().toISOString(), revision: git('git rev-parse --short HEAD'), dirty: git('git status --porcelain') !== '', exchange: { lengthTicks: exchange.length, seconds, beats: exchange.beats }, assets, loudness };
await fs.writeFile(path.join(out, 'loudness.json'), JSON.stringify(receipt, null, 2));

// --- Report.
const fmt = v => v === null || v === undefined ? '—' : String(v);
const delta = (name, key) => baseline?.loudness?.[name] ? (loudness[name][key] === null || baseline.loudness[name][key] === null ? '—' : `${loudness[name][key] - baseline.loudness[name][key] > 0 ? '+' : ''}${Math.round((loudness[name][key] - baseline.loudness[name][key]) * 10) / 10}`) : '';
const rows = Object.entries(loudness).filter(([name]) => name !== 'exchange').map(([name, m]) => `| ${name.slice(7)} | ${fmt(m.lufsIntegrated)} | ${fmt(m.lufsPhone)} | ${fmt(m.lufsMomentaryMax)} | ${fmt(m.peakDbfs)} | ${fmt(m.onsetMs)} | ${fmt(m.lengthMs)} |${baseline ? ` ${delta(name, 'lufsIntegrated')} | ${delta(name, 'lufsPhone')} |` : ''}`);
const report = `# Combat audio render — ${label}

Revision ${receipt.revision}${receipt.dirty ? ' (dirty tree)' : ''} · seed ${seed} · ${RATE} Hz mono · audio path: ${path_} · rendered ${receipt.generated} through Chromium OfflineAudioContext via \`node scripts/audio-preview.mjs --label ${label}\`.

## Exchange (${exchange.length} ticks = ${(exchange.length / 60).toFixed(2)} s, render ${seconds.toFixed(2)} s): \`exchange.wav\`
| beat | tick | time | events on that tick |
|---|---|---|---|
${exchange.beats.map(b => `| ${b.name} | ${b.tick} | ${(b.tick / 60).toFixed(2)} s | ${b.events.join(', ') || '(no event: movement emits none)'} |`).join('\n')}

Exchange loudness: integrated ${fmt(loudness.exchange.lufsIntegrated)} LUFS · phone band (> 300 Hz) ${fmt(loudness.exchange.lufsPhone)} LUFS · momentary max ${fmt(loudness.exchange.lufsMomentaryMax)} LUFS · peak ${fmt(loudness.exchange.peakDbfs)} dBFS.

## Per-cue renders: \`events/<name>.wav\` (one synthetic event at ${PROBE_AT * 1000} ms, ${PROBE_LENGTH} s render; fatal probes 4.5 s)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass; a rough proxy, not a specific handset response. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms |${baseline ? ` Δ LUFS-I vs ${against} | Δ phone vs ${against} |` : ''}
|---|---|---|---|---|---|---|${baseline ? '---|---|' : ''}
${rows.join('\n')}

## Payload
Shipped audio assets (src/assets/audio): ${assets.raw} B raw · ${assets.gzip} B gzip${baseline ? ` (baseline ${baseline.assets.raw} B raw · ${baseline.assets.gzip} B gzip; Δ ${assets.gzip - baseline.assets.gzip} B gzip)` : ''}. Lane budget: ≤ 1.0 MB gzip.

Browser checks: ${checks ? JSON.stringify(checks) : 'not requested (use --check for repeated renders, AAC/Opus region decoding, format fallback and stacked ceiling)'}.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
`;
await fs.writeFile(path.join(out, 'REPORT.md'), report);
console.log(report);
