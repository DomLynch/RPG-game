// A GUEST (no stored session, no stub) walks to the Cinder Fields' ground sword: is the sword drawn, does the prompt say "Sign in to take", at 375x812.
// The page, the view and the prompt are the real ones and no network is faked. BASE=<url of the page> (default the live /zone1/), OUT=<dir>.
//   node scripts/ground-guest-still.mjs   (HF T4 via scripts/gpu-run.mjs for a drawn still)
/* global process, console, window, document */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { centreOf } from './lib/origins-preview-harness.mjs';

const BASE = process.env.BASE || 'https://frankendom.com/zone1/?region=1', OUT = process.env.OUT || 'artifacts/ground-guest', SWORD = 'ground:zone1.rusty-sword-1';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.PIT_GL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const receipt = { base: BASE, errors: [] };
page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 150000 });
receipt.storage = await page.evaluate(() => Object.keys(localStorage));
receipt.anchorAtLoad = await page.evaluate((id) => window.originsPreview.ground.anchor(id) ?? null, SWORD).catch(() => 'no-ground-api');
await page.waitForFunction((id) => window.originsPreview.ground.anchor(id) !== undefined, SWORD, { timeout: 90000 }).catch(() => { receipt.anchorTimeout = true; });
const centre = await centreOf(page);
await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [centre.x, centre.z - 1.3]);
await page.waitForTimeout(4000);
const tri = async () => page.evaluate(() => window.originsPreview.renderInfo().triangles);
receipt.prompt = await page.evaluate(() => ({ hidden: document.getElementById('prompt')?.hidden, text: document.getElementById('prompt')?.textContent }));
receipt.anchor = await page.evaluate((id) => window.originsPreview.ground.anchor(id) ?? null, SWORD);
receipt.trianglesShown = await tri();
await page.screenshot({ path: `${OUT}/guest-375.png` });
await page.evaluate((id) => window.originsPreview.ground.hide(id), SWORD); await page.waitForTimeout(1500);
receipt.trianglesHidden = await tri();   // the sword's own triangles = shown - hidden: 0 means the row is "there" but nothing is drawn
await page.screenshot({ path: `${OUT}/guest-375-hidden.png` });
fs.writeFileSync(`${OUT}/receipt.json`, JSON.stringify(receipt, null, 1)); console.log(JSON.stringify(receipt));
await browser.close();
