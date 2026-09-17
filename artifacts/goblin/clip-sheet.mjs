// The opponent's own 21-clip sheet (the harness's clips.png is the player's): node artifacts/goblin/clip-sheet.mjs <enemy glb url> <out png>
import { createServer } from 'vite'; import { chromium } from 'playwright'; import fs from 'node:fs/promises';
const [enemy, out] = process.argv.slice(2);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?enemy=${encodeURIComponent(enemy)}`);
await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
const CLIPS = [['Idle', .35], ['Walk', .35], ['Jog', .35], ['Run', .35], ['Armed', .35], ['ArmedWalk', .35], ['StrafeLeft', .35], ['StrafeRight', .35], ['Draw', .6], ['Attack', .35], ['Return', .35], ['Heavy', .2], ['Heavy', .47], ['Riposte', .33], ['Kick', .41], ['Roll', .3], ['Roll', .7], ['Guard', .5], ['BlockImpact', .5], ['Parry', .5], ['Deflected', .5], ['Hit', .35], ['Death', .5], ['Death', .95]];
const views = CLIPS.map(([c, t]) => [`${c}`, c, t, 'spine_01', 3.6, .55, .08, [0, -.15, 0]]);
const data = await page.evaluate(v => __preview.details(v, 'opponent'), views);
await fs.writeFile(out, Buffer.from(data.split(',')[1], 'base64')); console.log(out);
await browser.close(); await server.close();
