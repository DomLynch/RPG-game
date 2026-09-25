// Scratch (not committed): frame-stepped capture of a replay link at 375x812@2x. rAF and performance.now are driven from here, so each
// still lands on the exact sim tick asked for, whatever the machine load. Usage: node stepped-stills.mjs <worktree> <linkfile> <outdir> name=tick ...
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const [root, linkFile, out, ...wanted] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const shots = wanted.map(w => { const [name, tick] = w.split('='); return { name, tick: Number(tick) }; });
const server = await createServer({ root, server: { port: 5197, strictPort: true }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  let now = 0; const queue = [];
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  window.__advance = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; for (const cb of queue.splice(0)) cb(now); } };
});
await page.goto(`http://localhost:5197/?opponent=witch&debug&replay=${readFileSync(linkFile, 'utf8').trim()}`);
await page.addStyleTag({ content: '#debug{visibility:hidden!important}' });
const tick = () => page.evaluate(() => Number(document.getElementById('debug')?.dataset.tick ?? -1));
const replaying = () => page.evaluate(() => /REPLAY/i.test(document.body.innerText));
const got = {};
for (const { name, tick: want } of shots) {
  for (let guard = 0; guard < 20000; guard++) {
    await page.evaluate(() => window.__advance(1));
    if (guard % 20 === 0) await page.waitForTimeout(5);   // let fetches and decodes resolve between frames
    if ((await replaying()) && (await tick()) >= want) break;
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  got[name] = { asked: want, got: await tick() };
}
console.log(JSON.stringify(got));
await browser.close(); await server.close();
