// Proof 2 on the live site: engage the ruin camp's first wolf, count who joins (wolves vs scavengers) over 12 s. Probe only, not committed.
import fs from 'node:fs'; import { chromium } from 'playwright';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(process.env.LIVE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000 });
  const all = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, body: m.body, name: m.name, x: m.x, z: m.z })));
  const camp = all.filter((m) => m.id.includes('reach-pack'));
  console.log('camp:', JSON.stringify(camp.map((m) => [m.id, m.name])));
  const near = (c) => all.filter((m) => Math.hypot(m.x - c.x, m.z - c.z) < 14).map((m) => `${m.id}:${m.name}`);
  const want = process.env.TAGS_TARGET || 'z2:reach-pack-a-1', t = all.find((m) => m.id === want); if (!t) throw new Error('no ' + want);
  console.log('within 14 m of', want, near(t));
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [t.x, t.z]); await page.waitForTimeout(2500);
  await page.evaluate((id) => window.originsPreview.tapMob(id), t.id);
  const seen = new Map(); const t0 = Date.now(); let infight = false;
  while (Date.now() - t0 < 14000) {
    const f = await page.evaluate(() => window.originsPreview.combat().fighters); infight ||= await page.evaluate(() => document.body.classList.contains('infight'));
    for (const x of f) if (x.id !== 'me') seen.set(x.id, Math.max(seen.get(x.id) ?? 0, 1));
    await page.waitForTimeout(400);
  }
  const ids = [...seen.keys()], wolves = ids.filter((i) => /pack/.test(i) && all.find((m) => m.id === i)?.body === 'wolf'), other = ids.filter((i) => !wolves.includes(i));
  console.log('infight:', infight, 'joined:', ids.length, 'wolves:', wolves.length, wolves, 'others:', other.length, other.map((i) => `${i}:${all.find((m) => m.id === i)?.name}`));
  console.log('wounds:', JSON.stringify(await page.evaluate(() => window.originsPreview.wounds?.() ?? null)));
  await page.screenshot({ path: `${out}/pack.png`, timeout: 120000 });
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); }
