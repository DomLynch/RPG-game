// One clip and one still per beta special on the sandbox preview, at the fight camera at 375 wide (Dom's look call, 2026-10-17). The page clock is fake and moved 1000/60 ms
// per step (scripts/lib/harness-clock.mjs), a picture every second step, so the mp4 plays at real speed however slow the renderer is. The player's SPECIAL 1 is pommel (or lunge
// when pommel is the one under test), SPECIAL 2 is the special under test, cast on the Dummy at 1 m. The still is the frame with the most impact particles alive.
// Shared box only (a real browser): ssh the VPS, `cd /root/frankendom-worktrees/sandbox && capture --prio 3 sandbox node scripts/special-look-clip.mjs --out out/special-look`
//   [--base https://frankendom.com/preview/sandbox/] [--only cleave,stomp]. Frames land in <out>/<skill>/f%05d.jpg; the mp4 is encoded here with ffmpeg.
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'https://frankendom.com/preview/sandbox/'), OUT = arg('out', 'out/special-look'), ONLY = arg('only', '');
const SPECIALS = ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'stomp'].filter((s) => !ONLY || ONLY.split(',').includes(s));
const SECONDS = Number(arg('seconds', '3.8'));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });

for (const special of SPECIALS) {
  const dir = `${OUT}/${special}`; await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
  const first = special === 'pommel' ? 'lunge' : 'pommel';
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await context.addInitScript(() => { try { localStorage.removeItem('frankendom.sandbox.loadout'); } catch { /* none */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}?spar=1&weapon=longsword&difficulty=dummy&skill=${first}&opponent=Centurion&special2=${special}&debug=1`);
  await page.getByRole('button', { name: 'Fight', exact: true }).first().click({ timeout: 600000 });
  await page.waitForFunction(() => globalThis.__sandboxMatch?.practice?.duel?.fighters?.[0]?.phase === 'ready', null, { timeout: 120000, polling: 500 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const { run } = await harnessClock(page);
  await skipDraws(page, true);
  for (let n = 0; n < 160; n++) await run(n % 3 === 2 ? 16 : 17);   // the first-cast wait
  await skipDraws(page, false); await run(17);
  await page.locator('#sbx-spell2').tap();
  await skipDraws(page, true);
  const steps = Math.round(SECONDS * 60), shots = Math.floor(steps / 2); let best = { alive: -1, file: '' }, k = 0;
  for (let n = 0; n < steps; n++) {
    if (n % 2 === 0) {   // a picture every second step: draw one step ahead of it
      await skipDraws(page, false); await run(17);
      const file = `${dir}/f${String(k++).padStart(5, '0')}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      const alive = await page.evaluate(() => globalThis.__view?.probe?.().skillImpact?.alive ?? 0);
      if (alive > best.alive) best = { alive, file };
      await skipDraws(page, true);
    } else await run(16);
  }
  await fs.copyFile(best.file, `${OUT}/still-${special}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${dir}/f%05d.jpg`, '-vf', 'scale=376:812,setsar=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', `${OUT}/clip-${special}.mp4`], { timeout: 120000 });
  console.log(`${special}: ${k} frames of ${shots}, most particles ${best.alive}, ${OUT}/clip-${special}.mp4`);
  await context.close();
}
await browser.close();
