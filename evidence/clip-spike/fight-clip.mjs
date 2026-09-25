// Real-fight clip in headless Chromium (control browser): the game canvas via captureStream(30) + the game's own WebAudio master via a
// MediaStreamDestination hooked in by wrapping AudioNode.connect (no src change) → MediaRecorder for 5 s mid-fight. Prints the
// recorder's mimeType, bytes, tracks, and rAF fps before / during / after recording. Usage: node evidence/clip-spike/fight-clip.mjs <dist> [out.webm]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { launch, phonePage, waitForGame } from '/Users/domininclynch/Developer/frankendom-code-quality/scripts/lib/harness.mjs';
const dir = process.argv[2], out = process.argv[3] ?? 'evidence/clip-spike/out/chromium-fight.webm';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2' };
const server = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(dir, u.pathname === '/' ? 'index.html' : u.pathname); if (!fs.existsSync(f)) f = path.join(dir, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}`;
const browser = await launch(); const errors = []; const { page } = await phonePage(browser, { deviceScaleFactor: 2, errors, timeout: 120000 });
await page.addInitScript(() => {
  // Any node that connects to an AudioContext's destination also feeds a MediaStreamDestination on that context: the game's master bus.
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) { const r = connect.call(this, target, ...rest); if (target && target.context && target === target.context.destination) { const ctx = target.context; if (!ctx.__dest) ctx.__dest = ctx.createMediaStreamDestination(); connect.call(this, ctx.__dest); window.__audioCtx = ctx; } return r; };
  window.__frames = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((t) => { window.__frames++; cb(t); });
});
await page.goto(`${url}/?opponent=executioner&gfx=phone&perf=1`); await waitForGame(page, { art: true });
await page.getByRole('button', { name: 'Enter the arena' }).tap({ timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#art-status').textContent === '');
await page.getByRole('button', { name: 'Draw sword', exact: true }).tap(); await page.waitForTimeout(2500);
const fps = async (ms) => page.evaluate(async (ms) => { const f0 = window.__frames, t0 = performance.now(); await new Promise(r => setTimeout(r, ms)); return +((window.__frames - f0) / ((performance.now() - t0) / 1000)).toFixed(1); }, ms);
const before = await fps(3000);
const result = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas'), ctx = window.__audioCtx, stream = canvas.captureStream(30);
  const audio = ctx?.__dest?.stream.getAudioTracks() ?? []; for (const t of audio) stream.addTrack(t);
  const pick = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, pick ? { mimeType: pick } : {}), chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => rec.onstop = r); rec.start(500); const f0 = window.__frames, t0 = performance.now(); await new Promise(r => setTimeout(r, 5000)); rec.stop(); await stopped;
  const during = +((window.__frames - f0) / ((performance.now() - t0) / 1000)).toFixed(1);
  const blob = new Blob(chunks, { type: rec.mimeType }), buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { mimeType: rec.mimeType, bytes: blob.size, tracks: stream.getTracks().map(t => t.kind), audioContextState: ctx?.state ?? 'no context seen', during, perf: document.querySelector('#perf')?.textContent ?? null, b64: btoa(s) };
});
const after = await fps(3000);
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.from(result.b64, 'base64'));
delete result.b64; console.log(JSON.stringify({ ...result, fpsBefore: before, fpsDuring: result.during, fpsAfter: after, pageErrors: errors.length, out }, null, 1));
await browser.close(); server.close();
