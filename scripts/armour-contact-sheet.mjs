// Armour contact sheets (Armour lane, 2026-09-26): every takeable non-weapon piece worn by the HERO, one still per piece from the fight's
// opening camera and one from the journal's Profile tab paperdoll, at 375 CSS px wide (Dom judges from 375 stills), composed into one
// sheet per slot. The seeding is worn-loot-check.mjs's: a guest ledger straight into localStorage (keyed by PAPERDOLL key, not slot
// name — cleanLoot drops a slot-named key), the page reloaded with ?debug=1, the rig's worn draws read back from #debug's data-worn.
//   node scripts/armour-contact-sheet.mjs [--label audit] [--slots Helmet,Boots] [--opponents dwarf,goblin] [--only fight|doll]
// Writes artifacts/armour/<label>/{fight,doll}/<id>.png, sheet-<Slot>.png and receipt.json. Serves this tree's dist (npm run build first),
// or QA_URL. Never part of a gate: a person reads the sheets.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'vite';
import { LOOT, LOOT_SLOTS, PAPERDOLL, isWeaponLoot, paperdollOf, slotOf } from '../src/loot.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const label = arg('label', 'audit'), only = arg('only', 'both');
const slots = arg('slots', '').split(',').filter(Boolean), opponents = arg('opponents', '').split(',').filter(Boolean);
const dir = `artifacts/armour/${label}`; for (const sub of ['fight', 'doll']) await fs.mkdir(path.join(dir, sub), { recursive: true });

const pieces = Object.entries(LOOT).flatMap(([opponent, ids]) => ids.filter((id) => !isWeaponLoot(id)).map((id) => ({ opponent, id, slot: slotOf(id), key: paperdollOf(slotOf(id)) })))
  .filter((p) => (!slots.length || slots.includes(p.slot)) && (!opponents.length || opponents.includes(p.opponent)));
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(90000);
await page.route('**/*sentry.io/**', (route) => route.abort());
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
};
// The hero at the opening camera, 375×812: head to toe with the sand around him (worn-loot-check's 390-wide frame, rescaled and widened).
const FIGURE = { x: 95, y: 470, width: 185, height: 230 };
const receipt = { origin, revision: null, pieces: {}, errors };
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then((r) => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href); await ready();
  for (const piece of pieces) {
    const equipped = { [piece.key]: piece.id };
    await page.evaluate((equipped) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: Object.values(equipped), equipped }; localStorage.setItem(key, JSON.stringify(p)); }, equipped);
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    await page.waitForFunction(() => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).length >= 1, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    const { worn: draws = [] } = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn || '{}'));
    const entry = { draws, fight: null, doll: null };
    if (only !== 'doll') { entry.fight = `fight/${piece.id}.png`; await page.screenshot({ path: path.join(dir, entry.fight), clip: FIGURE }); }
    if (only !== 'fight') {
      await page.locator('#journal-button').tap();
      await page.locator('#journal-tab-profile').check({ force: true }).catch(() => {});
      const doll = page.locator('.doll');
      await doll.waitFor({ state: 'visible' });
      await page.waitForFunction((key) => getComputedStyle(document.querySelector(`.doll-layer[data-layer='${key}']`)).backgroundImage !== 'none', piece.key, { timeout: 5000 }).catch(() => { entry.dollLayer = 'none'; });
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
      await page.waitForTimeout(200);
      entry.doll = `doll/${piece.id}.png`; await doll.screenshot({ path: path.join(dir, entry.doll) });
      await page.locator('#close-journal').tap().catch(() => {});
    }
    receipt.pieces[piece.id] = entry;
    console.log(`${piece.id}: ${draws.length} draw(s)${entry.dollLayer ? ', no doll layer' : ''}`);
  }
  // One sheet per slot: fight still over doll still, captioned, composed in the browser (no image library in the tree).
  const sheetSlots = LOOT_SLOTS.filter((s) => pieces.some((p) => p.slot === s));
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (const slot of sheetSlots) {
    const uri = async (file) => `data:image/png;base64,${(await fs.readFile(path.join(dir, file))).toString('base64')}`;   // about:blank cannot load file: URLs
    const cells = (await Promise.all(pieces.filter((p) => p.slot === slot).map(async (p) => { const e = receipt.pieces[p.id]; return `<figure><figcaption>${p.id}<small>${e.draws.length} draw(s)${e.dollLayer ? ' · no doll layer' : ''}</small></figcaption>${e.fight ? `<img src="${await uri(e.fight)}">` : ''}${e.doll ? `<img src="${await uri(e.doll)}" class="doll">` : ''}</figure>`; }))).join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:13px/1.3 system-ui;padding:12px}h1{font-size:16px;margin:0 0 10px}main{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:200px;display:flex;flex-direction:column;gap:4px}figcaption{font-weight:600}small{display:block;font-weight:400;color:#aaa}img{width:200px;image-rendering:auto;background:#333}img.doll{width:200px}</style><h1>${slot} — hero at the fight camera (top) and Profile tab (bottom), 375 wide, ${label}, ${receipt.revision?.revision ?? 'local'}</h1><main>${cells}</main>`;
    await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await sheet.screenshot({ path: path.join(dir, `sheet-${slot}.png`), fullPage: true });
  }
} finally {
  await fs.writeFile(path.join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ pieces: Object.keys(receipt.pieces).length, errors }));
