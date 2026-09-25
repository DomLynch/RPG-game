// Scratch capture (not committed): the veteran-witchfire reference replay at 375x812@2x, one still at mid-windup, the gout, and the embers.
// node witchfire-stills.mjs <outdir> (imports and serves the witchfire worktree by absolute path)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'witchfire-stills'; mkdirSync(out, { recursive: true });
// A live fight against the Witch with Witch-fire equipped (the profile's loot.skill), cast from the SKILL button. The debug line names the
// move and its age ("skill_witchfire 30/86"); the overlay is hidden so the still is the full game frame.
const AGES = { windup: 30, gout: 41, embers: 58 };
const server = await createServer({ root: '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad/wt-witchfire', server: { port: 5199, strictPort: true }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const url = 'http://localhost:5199/?opponent=witch&debug';
await page.goto(url);
await page.evaluate(() => localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'witchfire-still-0001', name: 'Still', encounter: 'witch', loot: { owned: [], equipped: {}, skill: 'witchfire' } })));
await page.goto(url);
await page.addStyleTag({ content: '#debug{visibility:hidden!important}' });
await page.waitForTimeout(1500);
if (await page.locator('#welcome').isVisible()) await page.locator('#welcome button[type=submit], #welcome button').first().click();
const live = () => page.evaluate(() => document.getElementById('skill-button')?.getAttribute('aria-disabled'));
const deadline = Date.now() + 120_000;
while ((await live()) !== 'false' && Date.now() < deadline) { await page.keyboard.press('KeyF'); await page.waitForTimeout(700); }
console.log('skill button', await live());
await page.evaluate(() => document.getElementById('skill-button').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true })));
const shots = {};
for (const [name, age] of Object.entries(AGES)) {
  const seen = await page.waitForFunction(a => { const m = /you:[\s\S]*?skill_witchfire (\d+)\//.exec(document.getElementById('debug')?.textContent ?? ''); return m && Number(m[1]) >= a ? Number(m[1]) : false; }, age, { timeout: 20_000, polling: 'raf' });
  const before = await seen.jsonValue();
  await page.screenshot({ path: `${out}/${name}.png` });
  shots[name] = { asked: age, seen: before, after: await page.evaluate(() => /skill_witchfire (\d+)\//.exec(document.getElementById('debug')?.textContent ?? '')?.[1] ?? 'over') };
}
console.log(JSON.stringify(shots));
await browser.close(); await server.close();
