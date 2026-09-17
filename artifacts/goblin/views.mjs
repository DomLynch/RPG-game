// Goblin lane close-ups the shared harness has no cell for: chest trophies, the bracer, the ears, and a full-height pair at the goblin's own eye
// level. node artifacts/goblin/views.mjs <enemy glb url> <out png>   (same server + loader as scripts/character-preview.mjs)
import { createServer } from 'vite'; import { chromium } from 'playwright'; import fs from 'node:fs/promises';
const [enemy, out] = process.argv.slice(2);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?enemy=${encodeURIComponent(enemy)}`);
await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
const VIEWS = [
  ['chest front', 'Armed', 0, 'spine_03', 1.0, 0, .15], ['chest 3/4', 'Armed', 0, 'spine_03', 1.0, .8, .2], ['bracer', 'Armed', 0, 'lowerarm_l', .8, 1.2, .3], ['bracer inside', 'Armed', 0, 'lowerarm_l', .8, -.6, -.2],
  ['ear side', 'Armed', 0, 'Head', .75, 1.57, .1], ['ear back', 'Armed', 0, 'Head', .75, 2.4, .25], ['face', 'Armed', 0, 'Head', .8, .2, .05], ['full side', 'Armed', 0, 'spine_01', 3.4, 1.57, .05],
  ['full front', 'Idle', 0, 'spine_01', 3.4, 0, .05], ['full back', 'Idle', 0, 'spine_01', 3.4, 3.14, .05], ['walk', 'ArmedWalk', .3, 'spine_01', 3.4, 1.2, .1], ['roll', 'Roll', .25, 'spine_01', 3.4, 1.57, .1],
];
const data = await page.evaluate(v => __preview.details(v, 'opponent'), VIEWS);
await fs.writeFile(out, Buffer.from(data.split(',')[1], 'base64')); console.log(out);
await browser.close(); await server.close();
