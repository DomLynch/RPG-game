// What presence says to a zone page: opens <url>, logs every websocket frame (sent and received, trimmed) for the first seconds and any close code, then where the hero stands. For "a zone page opened me in the Pit" (the hello / warp round trip).
//   CHROME=<Chrome app> node scripts/zone-hello-trace.mjs https://frankendom.com/zone2/
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const [url] = process.argv.slice(2);
if (!url) throw new Error('usage: zone-hello-trace.mjs <url>');
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const t0 = Date.now(), at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  page.on('websocket', (ws) => {
    console.log(at(), 'WS open', ws.url().replace(/token=[^&]+/, 'token=…'));
    ws.on('framesent', (f) => console.log(at(), 'SENT', String(f.payload).slice(0, 160)));
    ws.on('framereceived', (f) => console.log(at(), 'RECV', String(f.payload).slice(0, 200)));
    ws.on('close', () => console.log(at(), 'WS close'));
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
  let last = '';
  for (let i = 0; i < 40; i++) {   // the hero's place each half second: when the server's hello moves him
    const h = JSON.stringify(await page.evaluate(() => ({ x: +window.originsPreview.pos.x.toFixed(1), z: +window.originsPreview.pos.z.toFixed(1), place: document.getElementById('place')?.textContent, presence: window.originsPreview.presence?.().state }))); if (h !== last) console.log(at(), 'hero', h); last = h;
    await page.waitForTimeout(500);
  }
} finally { await browser.close(); }
