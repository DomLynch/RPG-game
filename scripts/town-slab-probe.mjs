// What shows as the pale band at the town's horizon: on the zone 0 page, lists every mesh wider than 40 m (name, parent, size, material colour) and, with HIDE=a,b, hides those names one at a time and shoots.
//   BASE=http://localhost:5199 CHROME=<Chrome app> [DESKTOP=1] [HIDE=name,name] node scripts/town-slab-probe.mjs <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const [out] = process.argv.slice(2), base = process.env.BASE ?? 'http://localhost:5199';
if (!out) throw new Error('usage: town-slab-probe.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const desk = process.env.DESKTOP === '1';
  const page = await (await browser.newContext({ viewport: desk ? { width: 1280, height: 800 } : { width: 375, height: 812 }, deviceScaleFactor: desk ? 1 : 2, isMobile: !desk, hasTouch: !desk })).newPage();
  await page.addInitScript(() => { window.__scenes = []; window.__THREE_DEVTOOLS__ = new EventTarget(); window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => { if (e.detail?.isScene) window.__scenes.push(e.detail); }); });
  await page.goto(`${base}/preview/origins/?zone=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
  await page.waitForTimeout(14000);
  await page.evaluate(() => window.originsPreview.place(0, -36, 0)); await page.waitForTimeout(4000);
  await page.keyboard.down('a'); await page.waitForTimeout(120); await page.keyboard.up('a');   // a nudge: the first-load hint goes
  const big = await page.evaluate(() => {
    const rows = [], s = window.__scenes[0];
    s.traverse((o) => { if (!o.isMesh || !o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * Math.max(o.scale.x, o.scale.z);
      if (w > 40 || /Plane|Circle|Cylinder|Ring/.test(o.geometry.type)) { const m = Array.isArray(o.material) ? o.material[0] : o.material; rows.push({ name: o.name, parent: o.parent?.name, type: o.geometry.type, w: Math.round(w), y: Math.round(o.position.y * 10) / 10, colour: m?.color?.getHexString?.(), vis: o.visible, uuid: o.uuid.slice(0, 6) }); } });
    return rows;
  });
  console.log(JSON.stringify(await page.evaluate(() => { const s = window.__scenes[0]; return { background: s.background?.getHexString?.(), fog: s.fog?.color?.getHexString?.(), density: s.fog?.density, dome: (() => { let d; s.traverse((o) => { if (o.name === 'horizon-dome') d = { visible: o.visible, renderOrder: o.renderOrder, map: !!o.material.map }; }); return d; })() }; })));
  console.log(JSON.stringify(big).slice(0, 3000));
  await page.screenshot({ path: path.join(out, 'slab-base.png') });
  for (const n of (process.env.HIDE ?? '').split(',').filter(Boolean)) {
    const hit = await page.evaluate((names) => { let c = 0; const list = names.split('+'); window.__scenes[0].traverse((o) => { if (list.includes(o.name) || list.some((x) => x.length >= 6 && o.uuid.startsWith(x))) { o.visible = false; c++; } }); return c; }, n);   // `a+b`: hidden together
    await page.waitForTimeout(800); await page.screenshot({ path: path.join(out, `slab-no-${n.replaceAll(' ', '_')}.png`) }); console.log(n, 'hidden', hit);
    await page.evaluate((names) => { const list = names.split('+'); window.__scenes[0].traverse((o) => { if (list.includes(o.name) || list.some((x) => x.length >= 6 && o.uuid.startsWith(x))) o.visible = true; }); }, n);
  }
} finally { await browser.close(); }
