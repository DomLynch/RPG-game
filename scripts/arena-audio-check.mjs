// Actual browser audio graph: optional bank, lifecycle, variation and mixed-output QC.
import { chromium, webkit } from 'playwright';
import { createServer, preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ARENA_MANIFEST } from '../src/audio/arena-manifest.ts';
import { CUE_PROBES } from '../src/audio/exchange.ts';
const out = process.env.ARENA_RECEIPT_DIR || 'artifacts/audio/arena-life'; await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true, include: [] } }); await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browserType = process.env.AUDIO_BROWSER === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({ headless: true });
const report = { browser: browserType.name(), physicalPhone: false, checks: [], errors: [] };
let production, inspectedUi;
try {
 if (!process.argv.includes('--ui-only')) {
 const page = await browser.newPage(); page.on('pageerror', e => report.errors.push(String(e)));
 await page.route(`${origin}/harness`, r => r.fulfill({ contentType: 'text/html', body: `<script type="module">import {createFeedback} from '/src/feedback.ts';import {loadArena} from '/src/audio/arena.ts';import {ARENA_MANIFEST} from '/src/audio/arena-manifest.ts';window.h={createFeedback,loadArena,ARENA_MANIFEST};</script>` }));
 await page.goto(`${origin}/harness`); await page.waitForFunction(() => !!window.h);
 report.codecs = await page.evaluate(async () => {
  const ctx = new OfflineAudioContext(1, 48000, 48000), results = {};
  for (const format of ['aac', 'opus']) {
   const b = await window.h.loadArena(ctx, [format]); if (!b) throw Error(`${format} decode failed`);
   for (const [name, regions] of Object.entries(window.h.ARENA_MANIFEST)) for (const [start, seconds] of regions) {
    if (start + seconds > b.duration || !b.getChannelData(0).subarray(start * 48000, (start + seconds) * 48000).some(v => Math.abs(v) > .001)) throw Error(`${name} region invalid`);
   }
   results[format] = b.duration;
  }
  let calls = 0; if (!await window.h.loadArena(ctx, ['opus', 'aac'], (...args) => ++calls === 1 ? Promise.reject(Error('primary failed')) : fetch(...args)) || calls !== 2) throw Error('fallback failed');
  if (await window.h.loadArena(ctx, ['opus', 'aac'], () => Promise.reject(Error('offline'))) !== null) throw Error('failure must be optional');
  return results;
 });
 const render = async (script, duration = 42, failure = false, startTick = 0) => page.evaluate(async ({ script, duration, failure, startTick }) => {
  const ctx = new OfflineAudioContext(1, duration * 48000, 48000), starts = [], original = ctx.createBufferSource.bind(ctx); let now = 0;
  ctx.createBufferSource = () => { const source = original(), start = source.start.bind(source), stop = source.stop.bind(source); let entry;
   source.start = (...args) => { const name = source.buffer.duration > 39 ? Object.entries(window.h.ARENA_MANIFEST).find(([, r]) => r.some(([offset]) => Math.abs(offset - args[1]) < .00001))?.[0] : source.buffer.duration === 2.6 ? 'bell' : 'combat'; entry = { name, at: args[0], offset: args[1], end: args[0] + args[2] / source.playbackRate.value }; starts.push(entry); return start(...args); };
   source.stop = (time) => { if (entry) entry.end = Math.min(entry.end, time); return stop(time); }; return source;
  };
  const fetchOriginal = window.fetch;
  if (failure) window.fetch = (...args) => (failure === 'aac' ? String(args[0]).endsWith('.ogg') : String(args[0]).includes('arena-audio')) ? Promise.reject(Error('forced codec/bank failure')) : fetchOriginal(...args);
  const f = window.h.createFeedback({ context: ctx, now: () => now }); f.unlock(); f.update(startTick ? [] : [{ type: 'ActionStarted', action: 'draw', actor: 0, tick: 0 }], undefined, { match: 731, ended: false, tick: startTick }); await f.ready(); window.fetch = fetchOriginal;
  for (let tick = 0; tick < duration * 60; tick++) {
   now = tick / 60;
   const step = script.find(s => s.tick === tick);
   if (step?.control) f[step.control]();
   if (!step?.skip) f.update(step?.events ?? [], step?.presentation, { match: script.filter(s => s.tick <= tick && s.match !== undefined).at(-1)?.match ?? 731, tick: startTick + tick - (script.filter(s => s.tick <= tick && s.match !== undefined).at(-1)?.tick ?? 0), ended: script.some(s => s.tick <= tick && s.ended) });
  }
  const data = (await ctx.startRendering()).getChannelData(0), bytes = new Uint8Array(data.buffer); let encoded = '';
  for (let i = 0; i < bytes.length; i += 32768) encoded += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { starts, pcm: btoa(encoded) };
 }, { script, duration, failure, startTick });
 const samples = r => { const b = Buffer.from(r.pcm, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
 const rms = (data, start, end) => { const part = data.subarray(start * 48000, end * 48000); return Math.sqrt(part.reduce((sum, v) => sum + v * v, 0) / part.length); };
 console.log('Codec checks passed; rendering lifecycle/mix probes');
 const idle = await render([]), idleData = samples(idle);
 assert.equal(idle.starts.filter(s => s.name === 'bell').length, 1);
 assert.ok(idle.starts.some(s => s.name === 'jeer'));
 const beds = idle.starts.filter(s => s.name === 'bed'); assert.ok(beds.length >= 5);
 for (let i = 1; i < beds.length; i++) { assert.notEqual(beds[i].offset, beds[i - 1].offset); assert.ok(beds[i].at < beds[i - 1].end, 'beds overlap'); }
 for (let t = 3; t < 41; t += .25) assert.ok(rms(idleData, t, t + .25) > .001, 'no silent bed seam');
 const late = await render([], 4, false, 1800);
 assert.ok(late.starts.some(s => s.name === 'bed')); assert.ok(late.starts.every(s => s.name !== 'bell'), 'first unmute late in match has no opening bell');
 report.checks.push('Late first unmute skips bell');
 report.checks.push('One opening bell; non-repeating overlapping beds; sparse idle jeers; no silent seams');
 const hit = { type: 'Hit', actor: 0, target: 1, move: 'heavy_overhead', tick: 1 };
 const combatScript = Array.from({ length: 39 }, (_, i) => ({ tick: (i + 2) * 60, events: [{ ...hit, move: i % 9 === 0 ? 'heavy_overhead' : 'light', tick: (i + 2) * 60 }] }));
 const fight = await render(combatScript), fightData = samples(fight);
 assert.ok(fight.starts.some(s => s.name === 'chant')); assert.ok(fight.starts.some(s => s.name === 'grunt')); assert.ok(fight.starts.some(s => s.name === 'reaction'));
 const reaction = fight.starts.filter(s => s.name === 'reaction'); for (let i = 1; i < reaction.length; i++) assert.ok(reaction[i].at - reaction[i - 1].at >= 4);
 const busy = await render(Array.from({ length: 600 }, (_, tick) => ({ tick, events: [hit, { type: 'Parried', actor: 0, tick }] })), 12);
 for (let t = 0; t < 12; t += .01) assert.ok(busy.starts.filter(s => s.name !== 'combat' && s.at <= t && s.end > t).length <= 6, 'bounded voices');
 const grunts = busy.starts.filter(s => s.name === 'grunt'); for (let i = 1; i < grunts.length; i++) assert.ok(grunts[i].at - grunts[i - 1].at >= .89);
 report.checks.push('Active-fight chants, delayed reactions, hit grunts, cooldowns and six-voice limit');
 for (const control of ['quiet', 'toggle']) {
  const r = await render([{ tick: 180, control }, { tick: 360, control: control === 'quiet' ? 'unlock' : 'toggle' }, { tick: 540, match: 991, events: [{ type: 'ActionStarted', action: 'draw', actor: 0, tick: 0 }] }], 12), data = samples(r);
  assert.equal(rms(data, 3.1, 5.9), 0); assert.ok(rms(data, 7, 8) > .001);
  assert.equal(r.starts.filter(s => s.name === 'bell').length, 2, 'only initial and rematch bell');
 }
 const fatal = CUE_PROBES.find(p => p.name === 'finish-decapitation');
 const death = await render([{ tick: 180, events: fatal.events, presentation: fatal.presentation, ended: true }], 8);
 assert.ok(death.starts.some(s => s.name === 'combat' && s.at > 3.3));
 assert.ok(death.starts.filter(s => s.name !== 'combat').every(s => s.end <= 3), 'death clears arena bank');
 assert.equal(rms(samples(death), 7, 8), 0);
 const deathAAC = await render([{ tick: 180, events: fatal.events, presentation: fatal.presentation, ended: true }], 8, 'aac');
 const missing = await render([{ tick: 60, events: [hit] }], 3, true); assert.ok(rms(samples(missing), 1, 2) > .001); assert.ok(missing.starts.every(s => s.name === 'combat' || s.name === 'bell'));
 report.checks.push('Pause/mute silence; resume without bell replay; rematch bell; fatal priority; missing bank preserves combat');
 // Resolve an intentionally delayed decode after quiet: decoding must never schedule a source by itself.
 console.log('Lifecycle renders passed; delayed decoder test');
 report.delayed = await page.evaluate(async () => {
  const ctx = new OfflineAudioContext(1, 48000, 48000); let now = 0, count = 0, release; const original = ctx.decodeAudioData.bind(ctx), create = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => { count++; return create(); };
  ctx.decodeAudioData = async data => { const b = await original(data); if (b.duration > 39) await new Promise(resolve => { release = resolve; }); return b; };
  const f = window.h.createFeedback({ context: ctx, now: () => now }); f.unlock(); f.update([], undefined, { match: 1, ended: false, tick: 1 });
  while (!release) await new Promise(resolve => setTimeout(resolve, 10));
  const before = count; f.quiet(); release(); await f.ready(); now = .1; f.update([], undefined, { match: 1, ended: false, tick: 1 }); if (count !== before) throw Error('decode resurrected playback'); return true;
 });
 for (const [name, r] of Object.entries({ idle, fight, death, deathAAC, busy })) {
  const raw = `${out}/${name}.f32`, wav = `${out}/${name}.wav`; await fs.writeFile(raw, Buffer.from(r.pcm, 'base64'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '1', '-i', raw, wav]);
 }
 const level = data => 20 * Math.log10(rms(data, 3, 10));
 report.levels = { bedDbfs: level(idleData), fightDbfs: level(fightData) };
 assert.ok(report.levels.fightDbfs - report.levels.bedDbfs > 5, 'combat remains in front of bed');
 for (const name of ['idle', 'fight', 'death', 'deathAAC', 'busy']) {
  const result = (await import('node:child_process')).spawnSync('ffmpeg', ['-hide_banner', '-i', `${out}/${name}.wav`, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const peak = Number([...result.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1]); assert.ok(Number.isFinite(peak) && peak <= -1, `${name}: true peak ${peak}`); (report.truePeaks ??= {})[name] = peak;
 }
 report.gzip = (await Promise.all(['arena.m4a', 'arena.ogg'].map(f => fs.readFile(`src/assets/arena-audio/${f}`)))).reduce((n, b) => n + gzipSync(b).length, 0); assert.ok(report.gzip <= 450000);
 const bands = {};
 for (const [name, filter] of [['full', 'anull'], ['phone', 'highpass=f=300,lowpass=f=5000']]) {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-i', 'src/assets/arena-audio/arena.m4a', '-af', filter, '-ar', '48000', '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 16e6 });
  bands[name] = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
 }
 report.phoneBand = {};
 for (const [name, regions] of Object.entries(ARENA_MANIFEST)) {
  const power = band => regions.reduce((sum, [at, duration]) => sum + bands[band].subarray(Math.round(at * 48000), Math.round((at + duration) * 48000)).reduce((s, v) => s + v * v, 0), 0);
  report.phoneBand[name] = power('phone') / power('full');
  assert.ok(report.phoneBand[name] >= (name === 'bell' ? .3 : .5), `${name}: too much energy outside phone band`);
 }
 }
 if (!process.argv.includes('--offline')) {
 // Real production UI and native nodes. No injected game state or simulation overrides.
 console.log('Production UI test');
 production = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
 const ui = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }); inspectedUi = ui;
 const stage = name => { report.nativeStep = name; console.log(name); };
 ui.on('pageerror', e => report.errors.push(String(e))); await ui.route('**/*sentry.io/**', r => r.abort());
 await ui.addInitScript(() => {
  window.__arena = []; const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop; let id = 0; const entries = new WeakMap();
  AudioBufferSourceNode.prototype.start = function(...args) { if (this.buffer?.duration > 39 || this.buffer?.duration === 2.6) { const entry = { id: ++id, offset: this.buffer.duration === 2.6 ? 37.43 : args[1], when: args[0] }; entries.set(this, entry); this.addEventListener('ended', () => { entry.ended = true; }); window.__arena.push(entry); } return start.apply(this, args); };
  AudioBufferSourceNode.prototype.stop = function(...args) { const entry = entries.get(this); if (entry) entry.stopped = true; return stop.apply(this, args); };
 });
 stage('load');
 await ui.goto(process.env.QA_URL || `http://127.0.0.1:${production.httpServer.address().port}`);
 await ui.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
 assert.equal(await ui.evaluate(() => window.__arena.length), 0);
 stage('enter');
 await ui.getByRole('button', { name: 'Enter the arena' }).tap(); await ui.waitForFunction(() => window.__arena.length >= 1, null, { timeout: 30000 });
 await ui.waitForTimeout(2200);
 assert.equal((await ui.evaluate(() => window.__arena)).filter(e => e.offset === ARENA_MANIFEST.bell[0][0]).length, 0, 'Enter waits silently for Draw');
 stage('menu');
 await ui.getByRole('button', { name: 'Menu and field journal' }).tap();
 let entries = await ui.evaluate(() => window.__arena); assert.ok(entries.every(e => e.stopped || e.ended));
 await ui.waitForTimeout(250); assert.equal(await ui.evaluate(() => window.__arena.length), entries.length);
 stage('resume');
 await ui.locator('#close-journal').tap(); await ui.locator('canvas').tap({ position: { x: 20, y: 100 } });
 await ui.waitForFunction(count => window.__arena.length > count, entries.length);
 entries = await ui.evaluate(() => window.__arena);
 assert.equal(entries.filter(e => e.offset === ARENA_MANIFEST.bell[0][0]).length, 0, 'menu before Draw does not ring');
 await ui.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
 stage('draw and wait for real defeat');
 await ui.locator('#attack-button').tap();
 await ui.waitForFunction(offset => window.__arena.filter(e => e.offset === offset).length === 1, ARENA_MANIFEST.bell[0][0]);
 await ui.locator('#reset-button').waitFor({ state: 'visible', timeout: 150000 });
 assert.ok((await ui.evaluate(() => window.__arena)).every(e => e.stopped || e.ended), 'actual defeat stops ambience');
 stage('rematch');
 await ui.locator('#reset-button').tap(); await ui.waitForTimeout(2200);
 assert.equal((await ui.evaluate(() => window.__arena)).filter(e => e.offset === ARENA_MANIFEST.bell[0][0]).length, 1, 'rematch waits for Draw');
 await ui.locator('#attack-button').tap(); await ui.waitForFunction(offset => window.__arena.filter(e => e.offset === offset).length === 2, ARENA_MANIFEST.bell[0][0]);
 report.native = await ui.evaluate(() => window.__arena); await ui.screenshot({ path: `${out}/native.png` });
 // Actual saved-profile reload: no welcome and no audio gesture for more than the old two-second cutoff.
 stage('returning player, unavailable crowd download');
 await ui.route(/\/assets\/arena-[^/]+\.(ogg|m4a)$/, r => r.abort());
 await ui.reload();
 await ui.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
 await ui.waitForTimeout(2200);
 assert.equal(await ui.evaluate(() => window.__arena.length), 0);
 await ui.locator('#attack-button').tap();
 await ui.waitForFunction(offset => window.__arena.filter(e => e.offset === offset).length === 1, ARENA_MANIFEST.bell[0][0], { timeout: 3000 });
 await ui.waitForTimeout(500);
 report.returningBell = await ui.evaluate(() => window.__arena);
 assert.equal(report.returningBell.filter(e => e.offset === ARENA_MANIFEST.bell[0][0]).length, 1);
 report.checks.push('Returning profile after old cutoff rings once with crowd download unavailable');
 report.checks.push('Production mobile viewport: welcome/Enter/menu/rematch do not ring; first Draw and rematch Draw ring once');
 }
 assert.deepEqual(report.errors, []); report.passed = true;
} finally { if (inspectedUi && !report.passed) report.diagnostic = await inspectedUi.evaluate(() => ({ art: document.querySelector('#art-status')?.textContent, status: document.querySelector('#combat-status')?.textContent, health: document.querySelector('#player-health')?.value, attack: document.querySelector('#attack-button')?.outerHTML, audio: window.__arena })).catch(e => String(e)); await fs.writeFile(`${out}/${process.argv.includes('--ui-only') ? 'native-checks' : process.argv.includes('--offline') ? 'offline-checks' : 'checks'}.json`, JSON.stringify(report, null, 2)); await browser.close(); await server.close(); await production?.close(); }
console.log(JSON.stringify(report, null, 2));
