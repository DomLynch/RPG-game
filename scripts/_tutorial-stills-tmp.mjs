// scratch (untracked): play ?tutorial=1 at 375 with real key presses on the harness clock; shot each step's first prompt + the Parry NOW!
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import fs from 'node:fs/promises';
import { preview } from 'vite';
import process from 'node:process';
import console from 'node:console';
/* global document */
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.OUT || 'out'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.route('**/*sentry.io/**', (r) => r.abort());
const plain = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
await plain.route('**/*sentry.io/**', (r) => r.abort());
await plain.goto(`${origin}/`);
await plain.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
await plain.waitForTimeout(1500); await plain.screenshot({ path: `${dir}/before-plain-first-fight.png` }); await plain.context().close();
await page.goto(`${origin}/?tutorial=1`);
await page.waitForFunction(() => typeof globalThis.__tutorial === 'function' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
const { run } = await harnessClock(page);
const st = () => page.evaluate(() => ({ ...globalThis.__tutorial(), word: document.getElementById('tutorial-word').textContent, hidden: document.getElementById('tutorial-prompt').hidden, go: !document.getElementById('tutorial-go').hidden }));
await run(300);
console.log('start', JSON.stringify(await st()));
const shot = async (n) => { await page.screenshot({ path: `${dir}/${n}.png` }); };
await shot('0-slash');
await page.keyboard.down('KeyW'); await run(500); await page.keyboard.up('KeyW'); await run(100);
const KEY = { slash: 'KeyF', stab: 'KeyT', heavy: 'KeyG', kick: 'KeyC', roll: 'KeyE' };
let shotNow = false, rollEnter = null, rollTarget = 15;
let lastLog = '';
for (let guard = 0; guard < 1500; guard++) {
  const s = await st();
  if (s.current === null) break;
  const lg = `${s.current}|${s.word}`; if (lg !== lastLog) { lastLog = lg; console.log('state', guard, lg, Math.round(process.uptime()) + 's'); }
  if (s.word === 'STEP CLOSER') { rollEnter = null; if (!globalThis.__shotCloser) { globalThis.__shotCloser = 1; await shot('closer'); } await page.keyboard.down('KeyW'); await run(60); await page.keyboard.up('KeyW'); continue; }
  if (s.current === 'parry') {
    if (s.word === 'NOW!') { if (!shotNow) { shotNow = true; await shot('5-parry-now'); } await page.keyboard.down('ArrowUp'); await page.keyboard.down('KeyQ'); await run(40); await page.keyboard.up('KeyQ'); await page.keyboard.up('ArrowUp'); }
    else await run(8);
  } else if (s.current === 'guard') { await page.keyboard.down('KeyQ'); for (let i = 0; i < 80 && (await st()).current === 'guard'; i++) await run(25); await page.keyboard.up('KeyQ'); await run(10); }
  else if (s.current === 'heavy') { await page.keyboard.down('KeyG'); await run(60); await page.keyboard.up('KeyG'); await run(60); }
  else if (s.current === 'roll') {   // stand in reach and idle; roll after a sweeping delay so one lands as his thrust comes (a roll at once carries us out of reach and he stops swinging)
    if (rollEnter === null) { rollEnter = (await st()).tick; if (!globalThis.__shotRoll) { globalThis.__shotRoll = 1; await shot('6-roll-prompt'); } }
    if ((await st()).tick - rollEnter >= rollTarget) { await page.keyboard.down('KeyE'); await run(200); await page.keyboard.up('KeyE'); await run(25); rollEnter = null; rollTarget = ((rollTarget + 25) % 175) + 15; console.log('roll pressed, next delay', rollTarget); }
    else await run(10);
  }
  else { await page.keyboard.press(KEY[s.current]); await run(40); }
  const n = await st();
  if (n.done.length !== s.done.length) { console.log('done', n.done.join(','), 'word', n.word); await shot(`${n.done.length}-after-${n.done.at(-1)}`); }
}
await run(60); await shot('9-ready-pre'); console.log('end', JSON.stringify(await st())); await shot('9-ready');
await browser.close(); server.httpServer.close();
