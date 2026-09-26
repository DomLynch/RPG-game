// Hero Look pilot, in-game stills (docs/state/herolook.md): the REAL game at 375x812 (dpr 3) replaying one real winning fight
// (scripts/herolook-kill-record.mjs) to its kill, once with today's Centurion kit worn by the hero and once with the pilot rig
// standing in for the hero (`?hero=`, stills only). Same record, same arena, same camera path, so each pair differs only in what the
// hero wears. A frame every --every seconds from the replay's start through the finisher window goes to
// artifacts/herolook/<label>/<today|pilot>/NN.png; pick the fight-camera and kill-screen frames from the same index in both.
//   node scripts/herolook-game-stills.mjs --label game-v1 --pilot /herolook/legionary.glb [--frames 16] [--every 1]
// Guest only: the ledger is seeded into localStorage, nothing is sent anywhere. Never part of the build or the runtime.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LABEL = arg('--label', 'game'), PILOT = arg('--pilot', '/herolook/legionary.glb'), FRAMES = Number(arg('--frames', 16)), EVERY = Number(arg('--every', 1));
const ONLY = arg('--only', 'today,pilot').split(','), START = Number(arg('--start', 0));   // --start: seconds after the replay begins before the first frame
const rec = JSON.parse(execFileSync('node', ['scripts/herolook-kill-record.mjs'], { encoding: 'utf8' }));
const KIT = { head: 'veteran.Helmet', crest: 'veteran.Crest', chest: 'veteran.Body', arms: 'veteran.Arms', hands: 'veteran.Gloves', legs: 'veteran.Greaves', feet: 'veteran.Boots', off: 'veteran.Shield' };
const LOOT = { owned: Object.values(KIT), equipped: KIT, pack: [] };
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const out = { record: { seed: rec.seed, opponent: rec.opponent, seconds: rec.seconds }, runs: {} };
try {
  for (const run of ONLY) {
    const dir = `artifacts/herolook/${LABEL}/${run}`; await fs.mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage(); page.setDefaultTimeout(240000);
    const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    // A guest profile first (the page writes it), then the kit (today) or nothing (the pilot wears his set on the rig itself).
    await page.goto(`${origin}/?opponent=${rec.opponent}`);
    await page.waitForFunction(() => localStorage.getItem('frankendom.fighter.v1'));
    await page.evaluate((loot) => { const key = 'frankendom.fighter.v1', p = JSON.parse(localStorage.getItem(key)); if (loot) p.loot = loot; else delete p.loot; localStorage.setItem(key, JSON.stringify(p)); }, run === 'today' ? LOOT : null);
    const hero = run === 'pilot' ? `&hero=${PILOT}` : '';
    await page.goto(`${origin}/?opponent=${rec.opponent}${hero}&${rec.query.slice(1)}`);
    await page.waitForFunction(() => document.querySelector('#replay-banner')?.textContent === 'Replay' && document.querySelector('#art-status')?.textContent === '');
    const t0 = Date.now();
    for (let i = 0; i < FRAMES; i++) {
      const due = t0 + (START + i * EVERY) * 1000; if (Date.now() < due) await page.waitForTimeout(due - Date.now());
      await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.png` });
    }
    out.runs[run] = { query: hero || '(none)', errors };
    console.log(`${dir}: ${FRAMES} frames every ${EVERY}s${errors.length ? `, page errors: ${errors.join(' | ')}` : ''}`);
    await context.close();
  }
} finally {
  await fs.writeFile(`artifacts/herolook/${LABEL}/receipt.json`, JSON.stringify(out, null, 2));
  await browser.close(); await server.close();
}
