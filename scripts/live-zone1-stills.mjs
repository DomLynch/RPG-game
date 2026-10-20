// LIVE Zone 1 stills at 375x812 against frankendom.com (or URL): (1) the spawn as a player gets it (presence ON: __zoneReady + 12 s, no placement), pos read back so the camp start is proven; (2) a salamander camp: a second page with ?presence=0
// (place() with presence on snaps the hero to (0,0), the Pit's centre) puts the hero 6 m south of the first salamander-* mob and shoots it. Env: URL (https://frankendom.com/zone1/), OUT (artifacts/live-zone1), DSF (2), GL=swiftshader on the VPS.
import fs from 'node:fs'; import { chromium } from 'playwright';
const URL = process.env.URL || 'https://frankendom.com/zone1/', OUT = process.env.OUT || 'artifacts/live-zone1'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = () => browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF ?? 2) });
const out = { url: URL, release: null, errors: [] };
const ready = (page) => page.waitForFunction(() => window.__zoneReady, null, { timeout: 300000 });
try {
  const rel = await fetch(new globalThis.URL('/release.json', URL)).then((r) => r.json()).catch(() => null); out.release = rel?.revision ?? null;
  const p1 = await (await ctx()).newPage(); p1.on('pageerror', (e) => out.errors.push(String(e).slice(0, 160)));
  const t0 = Date.now(); await p1.goto(URL, { waitUntil: 'load' }); await ready(p1); out.spawnReadyMs = Date.now() - t0; await p1.waitForTimeout(12000);
  out.spawn = await p1.evaluate(() => ({ ...window.originsPreview.pos, header: document.getElementById('place')?.textContent, prompt: document.getElementById('prompt')?.textContent }));
  out.salamanders = await p1.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => String(m.id).includes('salamander')).map((m) => ({ id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1) })));
  await p1.screenshot({ path: `${OUT}/spawn-375.png`, timeout: 180000 }); await p1.close();
  const p2 = await (await ctx()).newPage(); p2.on('pageerror', (e) => out.errors.push(String(e).slice(0, 160)));
  await p2.goto(URL + (URL.includes('?') ? '&' : '?') + 'presence=0', { waitUntil: 'load' }); await ready(p2); await p2.waitForTimeout(8000);
  const m = await p2.evaluate((c) => window.originsPreview.mobs().mobs.find((x) => String(x.id).includes(c)) ?? window.originsPreview.mobs().mobs.find((x) => String(x.id).includes('salamander')), process.env.CAMP || 'salamander-shrine');
  if (!m) throw Error('no salamander mob on the live page');
  out.camp = { id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1) };
  for (const [name, back] of [['wide', 12], ['near', 6]]) {
    await p2.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [m.x, m.z - back]); await p2.waitForTimeout(4000);
    await p2.screenshot({ path: `${OUT}/salamander-${name}-375.png`, timeout: 180000 });
    out[name] = await p2.evaluate(() => ({ ...window.originsPreview.pos, header: document.getElementById('place')?.textContent, prompt: document.getElementById('prompt')?.textContent }));
  }
} catch (e) { out.fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/live-zone1.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close(); if (out.fail) process.exit(1);
