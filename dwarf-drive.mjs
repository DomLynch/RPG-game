// Hand-driven duel on live under the harness clock: time moves only when a command moves it.
// Commands (one per line appended to ./cmd): hold <Code> <ms> | press <Code> | run <ms> | hud | shot <name> | beat | quit
import { chromium } from 'playwright';
import fs from 'node:fs';
import { harnessClock } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/scripts/lib/harness-clock.mjs';

const DIR = new URL('.', import.meta.url).pathname, CMD = DIR + 'cmd', OUT = DIR + 'out';
const log = s => fs.appendFileSync(OUT, s + '\n');
fs.writeFileSync(CMD, ''); fs.writeFileSync(OUT, '');
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(30000);
await page.route('**/*sentry.io/**', r => r.abort());
await page.goto('https://frankendom.com/?opponent=dwarf&debug=1');
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
await page.getByRole('button', { name: 'Enter the arena' }).tap();
await page.waitForFunction(() => document.querySelector('#welcome').hidden);
await page.getByRole('button', { name: 'Menu and field journal' }).tap();
await page.locator('label[for=journal-tab-arena]').tap();
await page.locator('#finisher-select').selectOption('plainDeath');
await page.getByRole('button', { name: 'Close journal' }).tap();
await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
const { run } = await harnessClock(page); await run(200);
const rel = await page.evaluate(() => fetch('/release.json').then(r => r.json()).then(j => j.revision).catch(() => null));
log(`ready live ${rel?.slice(0, 8)} ${await page.locator('#difficulty').textContent()}`);

const hud = async () => page.evaluate(() => {
  const d = document.querySelector('#debug');
  return { hp: +document.querySelector('#player-health').value, enemy: +document.querySelector('#target-health').value, text: d.textContent.split('\n').slice(0, 9).join(' | ') };
});
const box = () => page.evaluate(() => {
  const b = el => { const r = el && !el.hidden ? el.getBoundingClientRect() : null; return r && r.width ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
  return { fallen: JSON.parse(document.querySelector('#debug').dataset.fallenRect || 'null'), panel: b(document.getElementById('loot-panel')), buttons: b(document.querySelector('.loot-panel-actions')) };
});
const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);

let seen = 0;
for (;;) {
  const lines = fs.readFileSync(CMD, 'utf8').split('\n').filter(Boolean);
  if (lines.length <= seen) { await new Promise(r => setTimeout(r, 200)); continue; }
  for (const line of lines.slice(seen)) {
    seen++;
    const [cmd, a, b] = line.trim().split(/\s+/);
    try {
      if (cmd === 'hold') { await page.keyboard.down(a); await run(+b); await page.keyboard.up(a); }
      else if (cmd === 'press') { await page.keyboard.press(a); await run(16); }
      else if (cmd === 'run') await run(+a);
      else if (cmd === 'shot') await page.screenshot({ path: `${DIR}${a}.png` });
      else if (cmd === 'beat') {
        // Wait for the finisher-complete latch, then the loot beat series exactly as the release harness samples it.
        for (let t = 0; t < 15000 && !(await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.complete)); t += 16) await run(16);
        const times = [...Array.from({ length: 11 }, (_, i) => i * 100), ...Array.from({ length: 18 }, (_, i) => 1500 + i * 500)];
        const series = [];
        for (const [i, t] of times.entries()) {
          if (i) await run(t - times[i - 1]);
          if (t === 0 || t === 5000 || t === 10000) await page.screenshot({ path: `${DIR}dwarf-plainDeath-${t / 1000}s.png` });
          const s = await box();
          series.push(`${t}:${overlap(s.fallen, s.panel)}/${overlap(s.fallen, s.buttons)}${s.fallen ? '' : '(unseen)'}${t === 0 ? ' fallen=' + JSON.stringify(s.fallen) + ' panel=' + JSON.stringify(s.panel) : ''}`);
        }
        log('beat ' + series.join(' '));
      } else if (cmd === 'quit') { await browser.close(); log('bye'); process.exit(0); }
      const h = await hud();
      log(`${line} => you ${h.hp} dwarf ${h.enemy} | ${h.text}`);
    } catch (e) { log(`${line} => ERROR ${String(e).slice(0, 200)}`); }
  }
}
