// Offline visual gate for both arms: front, weapon-side and rear views of the
// shipped rigs at ready, gait, guard, wind-up, contact and recovery poses.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const dir = process.env.CREATURE_POSE_DIR || 'artifacts/weapons/creature-weapons/poses';
await mkdir(dir, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const receipt = [], errors = [];
try {
  for (const [id, prefix, cut] of [['minotaur', 'Maul', 'Slash'], ['wraith', 'Claw', 'Slash']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?src=/src/assets/${id}.glb`);
    await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__preview.error), null);
    const poses = [['Idle', 0], ['Walk', .4], ['Guard', .9], ['Heavy', .26], [cut, .34], ['Heavy', .48], ['Thrust', .34], ['Heavy', .72]].map(([clip, t]) => [`${prefix}_${clip}`, t]);
    const captures = [];
    for (const [view, azimuth] of [['front', 0], ['side', 270], ['rear', 180]]) {
      const data = await page.evaluate(([p, a]) => window.__preview.clipSheet(p, a, true), [process.env.BASELINE ? [['Armed',0],['Attack',.34],['Heavy',.48],['Riposte',.34],['Idle',0],['Guard',.9],['ArmedWalk',.4],['Death',.5]] : poses, azimuth * Math.PI / 180]);
      const file = `${dir}/${id}-${view}.png`;
      await writeFile(file, Buffer.from(data.split(',')[1], 'base64')); captures.push(file);
      console.log(file);
    }
    receipt.push({ id, sha256: createHash('sha256').update(await readFile(`src/assets/${id}.glb`)).digest('hex'), poses, captures });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/receipt.json`, JSON.stringify({ receipt, errors }, null, 2));
} finally { await browser.close(); await server.close(); }
