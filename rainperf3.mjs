// Scratch: uncapped frame time of the real game, rain (arena b) vs sand (arena 1), phone tier, on the Mac's real GPU (Metal via ANGLE).
// node rainperf.mjs <repoRoot> <label> [still.png]
import { createServer } from 'vite';
import { chromium } from 'playwright';
const [root, label, still] = process.argv.slice(2), K = Number(process.env.K || 1);
const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const out = {};
for (const arena of (process.env.ARENAS || '1,b').split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 375 * K, height: 812 * K }, deviceScaleFactor: Number(process.env.DSF || 1), isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage(); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', arena, m.text().slice(0, 200)); }); if (process.env.CPU) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) }); }
  await page.goto(`http://localhost:5199/?arena=${arena}&gfx=phone`);
  await page.waitForTimeout(3000);
  if (await page.locator('#welcome').isVisible().catch(() => false)) { await page.fill('#welcome input', 'Perf'); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(9000);
  const r = await page.evaluate(async () => {
    const gl = document.querySelector('canvas').getContext('webgl2'), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?';
    const d = []; let last = performance.now();
    await new Promise(res => { const f = t => { d.push(t - last); last = t; if (d.length < 600) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    d.shift(); d.sort((a, b) => a - b);
    const q = p => d[Math.floor(p * (d.length - 1))];
    return { gpu, n: d.length, mean: d.reduce((a, b) => a + b, 0) / d.length, p50: q(.5), p95: q(.95), max: d[d.length - 1], canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] };
  });
  out[arena] = r;
  if (still && arena === 'b') await page.screenshot({ path: still });
  await ctx.close();
}
await browser.close(); await server.close();
const f = x => x.toFixed(2);
console.log(`${label} | GPU ${Object.values(out)[0].gpu} | canvas ${Object.values(out)[0].canvas}`);
for (const k of Object.keys(out)) console.log(`${label} ${k}: mean ${f(out[k].mean)} ms  p50 ${f(out[k].p50)}  p95 ${f(out[k].p95)}  max ${f(out[k].max)}  (n=${out[k].n})`);
