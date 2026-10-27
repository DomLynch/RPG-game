// Phone-tier network capture of the live Zone 1 page: every request the page makes in its first N seconds, with the bytes that crossed the wire (CDP encodedDataLength, so the CDN's compression counts).
// Usage: node scripts/phone-budget-capture.mjs <page url> <seconds> <out json>   (iPhone UA + coarse pointer, 375 wide; no sign-in, presence off)
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import { chromium } from 'playwright';

const [url, secondsArg, out] = process.argv.slice(2), SECONDS = Number(secondsArg || 75);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const browser = await launchBrowser(chromium);
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
const reqs = new Map();
cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, status: e.response.status, type: e.type, encoding: e.response.headers['content-encoding'] ?? e.response.headers['Content-Encoding'] ?? '', mime: e.response.mimeType, at: Math.round(e.timestamp * 1000) }));
cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.wire = e.encodedDataLength; });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(SECONDS * 1000);
const rows = [...reqs.values()].filter((r) => r.wire !== undefined).sort((a, b) => a.at - b.at);
const t0 = rows[0]?.at ?? 0;
fs.writeFileSync(out, JSON.stringify(rows.map((r) => ({ ...r, at: r.at - t0 })), null, 1));
const sum = (f) => rows.filter(f).reduce((n, r) => n + r.wire, 0);
console.log(`captured ${rows.length} responses, total ${(sum(() => true) / 1048576).toFixed(1)} MB on the wire; glb ${(sum((r) => /\.glb(\?|$)/.test(r.url)) / 1048576).toFixed(1)} MB, images ${(sum((r) => /\.(png|jpe?g|webp|ktx2)(\?|$)/.test(r.url)) / 1048576).toFixed(1)} MB, js ${(sum((r) => /\.js(\?|$)/.test(r.url)) / 1048576).toFixed(1)} MB`);
await browser.close();
