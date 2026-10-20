// Which clip a SPECIAL 1 / SPECIAL 2 press plays on the PIT page (Dom 2026-10-20: "the specials are not actually there in the Gladiator Pit"), a fresh guest, fight 1, at 375 wide on a real GPU.
// Usage: QA_URL=https://frankendom.com node scripts/pit-special-clip-probe.mjs <out dir>   (default URL: the live site)
// Samples every 50 ms for 3.5 s after each tap: the rig's playing clip (?debug=1 exposes __view.playing()), the special counters (__specials: fx spawned, cues played), the button's cooling state;
// three stills per press (the strip) land in <out>. Receipt: <out>/receipt.json.
/* global process, console, window, document, globalThis */
import fs from 'node:fs/promises';
import { launch, phonePage, waitForGame, writeReceipt } from './lib/harness.mjs';

const out = process.argv[2] ?? 'artifacts/pit-special-clip', URL_ = process.env.QA_URL ?? 'https://frankendom.com', SLOTS = [['#skill-button', 'SPECIAL 1'], ['#skill2-button', 'SPECIAL 2']];
await fs.mkdir(out, { recursive: true });
const browser = await launch(), receipt = { url: URL_, presses: [], errors: [] };
try {
  const { page } = await phonePage(browser, { viewport: { width: 375, height: 812 }, timeout: 20000, errors: receipt.errors });
  await page.goto(`${URL_}/?fight=1&debug=1`, { waitUntil: 'commit' });
  await waitForGame(page);
  await page.locator('#attack-button').tap();
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-label') === 'Light attack', null, { timeout: 30000 });
  const sample = () => page.evaluate(([a, b]) => ({ t: Math.round(performance.now()), clip: globalThis.__view?.playing?.() ?? null, fx: globalThis.__specials?.fx ?? null, cues: globalThis.__specials?.cues ?? null, one: document.querySelector(a)?.getAttribute('aria-disabled') ?? null, two: document.querySelector(b)?.getAttribute('aria-disabled') ?? null, labelOne: document.querySelector(a)?.getAttribute('aria-label') ?? null, labelTwo: document.querySelector(b)?.getAttribute('aria-label') ?? null }), [SLOTS[0][0], SLOTS[1][0]]);
  for (const [sel, name] of SLOTS) {
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-disabled') === 'false', sel, { timeout: 30000 }).catch(() => {});
    const before = await sample(); await page.locator(sel).tap({ timeout: 20000 }).catch((e) => console.log(name, 'tap failed', String(e).slice(0, 100)));
    const seen = [], shots = [];
    for (let k = 0; k < 70; k++) { await page.waitForTimeout(50); seen.push(await sample()); if (k === 3 || k === 10 || k === 18) { const f = `${out}/${name.replace(' ', '').toLowerCase()}-${String(k).padStart(2, '0')}.png`; await page.screenshot({ path: f }).catch(() => {}); shots.push(f); } }
    const clips = [...new Set(seen.map((s) => s.clip))], last = seen.at(-1), dimmed = seen.some((s) => (sel === SLOTS[0][0] ? s.one : s.two) === 'true');
    const row = { slot: name, label: sel === SLOTS[0][0] ? before.labelOne : before.labelTwo, accepted: dimmed, clips, fx: [before.fx, last.fx], cues: [before.cues, last.cues], shots };
    receipt.presses.push(row); console.log(JSON.stringify(row));
  }
} finally { await writeReceipt(`${out}/receipt.json`, receipt); await browser.close(); }
console.log('errors', receipt.errors.length);
