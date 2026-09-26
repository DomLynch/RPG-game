// Armour contact sheets (Armour lane, 2026-09-26): every takeable non-weapon piece worn by the HERO, one still per piece from the fight's
// opening camera and one from the journal's Profile tab paperdoll, at 375 CSS px wide (Dom judges from 375 stills), composed into one
// sheet per slot. The seeding is worn-loot-check.mjs's: a guest ledger straight into localStorage (keyed by PAPERDOLL key, not slot
// name — cleanLoot drops a slot-named key), the page reloaded with ?debug=1, the rig's worn draws read back from #debug's data-worn.
//   node scripts/armour-contact-sheet.mjs [--label audit] [--slots Helmet,Boots] [--opponents dwarf,goblin] [--only fight|doll] [--sets] [--rungs [--levels 1,5,10]]
// Writes artifacts/armour/<label>/{fight,doll}/<id>.png, sheet-<Slot>.png and receipt.json. Serves this tree's dist (npm run build first),
// or QA_URL. Never part of a gate: a person reads the sheets.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'vite';
import { LOOT, LOOT_SLOTS, PAPERDOLL, isWeaponLoot, paperdollOf, slotOf } from '../src/loot.ts';
import { TIERS } from '../src/grades.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const label = arg('label', 'audit'), only = arg('only', 'both');
const slots = arg('slots', '').split(',').filter(Boolean), opponents = arg('opponents', '').split(',').filter(Boolean);
const dir = `artifacts/armour/${label}`; for (const sub of ['fight', 'doll']) await fs.mkdir(path.join(dir, sub), { recursive: true });

// --sets: one cell per opponent wearing his WHOLE armour set (every paperdoll key his kit fills; a crest yields to the helmet), for
// slot-to-slot clipping. Each cell is still a `piece` row: id `<opponent>.Set`, slot 'Set', and `equipped` the full map.
const sets = process.argv.includes('--sets');
const pieces = sets
  ? Object.entries(LOOT).map(([opponent, ids]) => { const equipped = {}; for (const id of ids.filter((id) => !isWeaponLoot(id))) { const key = paperdollOf(slotOf(id)); if (!equipped[key] || slotOf(id) === 'Helmet') equipped[key] = id; } return { opponent, id: `${opponent}.Set`, slot: 'Set', equipped }; })
    .filter((p) => !opponents.length || opponents.includes(p.opponent))
  : Object.entries(LOOT).flatMap(([opponent, ids]) => ids.filter((id) => !isWeaponLoot(id)).map((id) => ({ opponent, id, slot: slotOf(id), key: paperdollOf(slotOf(id)), equipped: { [paperdollOf(slotOf(id))]: id } })))
    .filter((p) => (!slots.length || slots.includes(p.slot)) && (!opponents.length || opponents.includes(p.opponent)));
// --rungs: the standing acceptance sheet (Dom, 2026-09-26: "visibly cooler per level"). Every piece at every rung 1..10 (Provenance.tier,
// the rung it was TAKEN at, which its finish shows on the hero: rank-tint.ts), fight camera + Profile; one sheet per slot with a row per rung,
// split into parts ≤ 2,800 px so a phone can open them, and an index page with the adjacent-rung pairs to mark pass/fail by hand.
const rungs = process.argv.includes('--rungs'), levels = rungs ? arg('levels', '1,2,3,4,5,6,7,8,9,10').split(',').map(Number) : [0];
const cells = pieces.flatMap((p) => levels.map((level) => ({ ...p, level, id: level ? `${p.id}@${level}` : p.id, base: p.id })));
const DAY = '2026-09-26';
const ledgerFor = (cell) => { const owned = Object.values(cell.equipped); const loot = { owned, equipped: cell.equipped }; if (cell.level) loot.taken = Object.fromEntries(owned.map((id) => [id, { opponent: cell.opponent, attempt: 1, healthLeft: 1, recordId: null, day: DAY, tier: cell.level }])); return loot; };
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
  // The bare hero, twice: the readability numbers (below) are differences against bare-1, and bare-1 vs bare-2 is the noise floor the idle
  // breath and the sand's shimmer put under every difference.
  for (const n of [1, 2]) {
    await page.evaluate(() => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: [], equipped: {} }; localStorage.setItem(key, JSON.stringify(p)); });
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    await page.waitForTimeout(300);
    if (only !== 'doll') await page.screenshot({ path: path.join(dir, `fight/bare-${n}.png`), clip: FIGURE });
  }
  for (const piece of cells) {
    const { equipped } = piece, want = Object.keys(equipped).length;
    await page.evaluate((loot) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = loot; localStorage.setItem(key, JSON.stringify(p)); }, ledgerFor(piece));
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    await page.waitForFunction((want) => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).length >= want, want, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    const { worn: draws = [] } = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn || '{}'));
    const entry = { draws, fight: null, doll: null };
    if (only !== 'doll') { entry.fight = `fight/${piece.id}.png`; await page.screenshot({ path: path.join(dir, entry.fight), clip: FIGURE }); }
    if (only !== 'fight') {
      await page.locator('#journal-button').tap();
      await page.locator('#journal-tab-profile').check({ force: true }).catch(() => {});
      const doll = page.locator('.doll');
      await doll.waitFor({ state: 'visible' });
      await page.waitForFunction((keys) => keys.every((key) => getComputedStyle(document.querySelector(`.doll-layer[data-layer='${key}']`)).backgroundImage !== 'none'), Object.keys(equipped), { timeout: 5000 }).catch(() => { entry.dollLayer = 'none'; });
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
      await page.waitForTimeout(200);
      entry.doll = `doll/${piece.id}.png`; await doll.screenshot({ path: path.join(dir, entry.doll) });
      await page.locator('#close-journal').tap().catch(() => {});
    }
    receipt.pieces[piece.id] = entry;
    console.log(`${piece.id}: ${draws.length} draw(s)${entry.dollLayer ? ', no doll layer' : ''}`);
  }
  // Fight-camera readability (Strategy's standard 1, bar accepted provisionally 2026-09-26): per piece, against the bare hero inside the
  // figure clip, L = rec.601 luma 0..1, T = .06: changed = |L − L_bare1| > T and not a noise pixel (|L_bare1 − L_bare2| > T);
  //   changedShare  = changed / figure pixels (%), figure = bare-1 pixels farther than .09 in RGB from the clip's median sand colour;
  //   valueDelta    = mean L of the changed pixels − mean L of the bare figure (signed, darker < 0);
  //   silhouette    = changed pixels OUTSIDE the figure mask / figure pixels (%): the part of the change that is a new outline.
  // Bar (provisional): changedShare ≥ 15 AND (|valueDelta| ≥ .08 OR silhouette ≥ 3). Computed on a canvas in the sheet page: no image library.
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const uri = async (file) => `data:image/png;base64,${(await fs.readFile(path.join(dir, file))).toString('base64')}`;   // about:blank cannot load file: URLs
  if (only !== 'doll') {
    const b1 = await uri('fight/bare-1.png'), b2 = await uri('fight/bare-2.png');
    for (const cell of cells) {
      const e = receipt.pieces[cell.id]; if (!e?.fight) continue;
      e.readability = await sheet.evaluate(async ([b1, b2, c]) => {
        const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); const k = document.createElement('canvas'); k.width = img.width; k.height = img.height; const g = k.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, k.width, k.height).data; };
        const [A, B, C] = await Promise.all([b1, b2, c].map(load)), n = A.length / 4, T = .06;
        const L = (d, i) => (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) / 255;
        const r = [], g = [], b = []; for (let i = 0; i < n; i++) { r.push(A[i * 4]); g.push(A[i * 4 + 1]); b.push(A[i * 4 + 2]); }
        const med = (v) => v.slice().sort((x, y) => x - y)[v.length >> 1], sand = [med(r), med(g), med(b)];
        let figure = 0, changed = 0, outside = 0, sumFig = 0, sumChanged = 0;
        for (let i = 0; i < n; i++) {
          const dist = Math.hypot(A[i * 4] - sand[0], A[i * 4 + 1] - sand[1], A[i * 4 + 2] - sand[2]) / 255, inFig = dist > .09;
          const la = L(A, i), lb = L(B, i), lc = L(C, i), noise = Math.abs(la - lb) > T;
          if (inFig) { figure++; sumFig += la; }
          if (!noise && Math.abs(lc - la) > T) { changed++; sumChanged += lc; if (!inFig) outside++; }
        }
        const changedShare = 100 * changed / figure, valueDelta = changed ? sumChanged / changed - sumFig / figure : 0, silhouette = 100 * outside / figure;
        return { changedShare: +changedShare.toFixed(1), valueDelta: +valueDelta.toFixed(3), silhouette: +silhouette.toFixed(1), figurePx: figure, pass: changedShare >= 15 && (Math.abs(valueDelta) >= .08 || silhouette >= 3) };
      }, [b1, b2, await uri(e.fight)]);
    }
  }
  const fmt = (e) => e.readability ? ` · Δ${e.readability.changedShare}% v${e.readability.valueDelta > 0 ? '+' : ''}${e.readability.valueDelta} s${e.readability.silhouette}% ${e.readability.pass ? 'PASS' : 'fail'}` : '';
  // One sheet per slot: fight still over doll still, captioned, composed in the browser (no image library in the tree).
  const sheetSlots = [...LOOT_SLOTS, 'Set'].filter((s) => pieces.some((p) => p.slot === s));
  if (rungs) {
    // Row per rung, column per opponent, fight over doll at 150 px; five rows a part keeps a part under 2,800 px.
    const ROWS = 5, index = [];
    for (const slot of sheetSlots) {
      const cols = pieces.filter((p) => p.slot === slot);
      for (let part = 0; part * ROWS < levels.length; part++) {
        const rows = await Promise.all(levels.slice(part * ROWS, part * ROWS + ROWS).map(async (level) => `<tr><th>${level}<br><small>${TIERS[level - 1]}</small></th>${(await Promise.all(cols.map(async (p) => { const e = receipt.pieces[`${p.id}@${level}`]; return `<td>${e?.fight ? `<img src="${await uri(e.fight)}">` : ''}${e?.doll ? `<img src="${await uri(e.doll)}" class="doll">` : ''}<small>${e ? fmt(e).slice(3) : ''}</small></td>`; }))).join('')}</tr>`));
        const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:12px/1.3 system-ui;padding:10px}h1{font-size:15px;margin:0 0 8px}table{border-collapse:collapse}th{text-align:left;padding:2px 6px;vertical-align:top;font-size:13px}th small{color:#aaa;font-weight:400}td{padding:2px;vertical-align:top}td small{display:block;color:#bbb;font-size:10px;width:150px}thead th{font-size:11px;color:#ccc}img{display:block;width:150px;background:#333}img.doll{width:150px;margin-top:2px}</style><h1>${slot} — rungs ${levels[part * ROWS]}–${levels[Math.min(levels.length, part * ROWS + ROWS) - 1]} (row) × opponent (column), hero at the fight camera over the Profile tab, 375 wide, ${label}, ${receipt.revision?.revision ?? 'local'}. Dom: "visibly cooler per level".</h1><table><thead><tr><th></th>${cols.map((p) => `<th>${p.opponent}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
        await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
        const file = `sheet-${slot}-${part + 1}.png`; await sheet.screenshot({ path: path.join(dir, file), fullPage: true }); index.push({ slot, part: part + 1, file });
      }
    }
    // The index: sheets per slot, and the adjacent-rung pairs to mark by hand (pass = rung N+1 looks like something a player wants MORE than rung N, at the fight camera AND on the Profile).
    const pairs = levels.slice(1).map((l, i) => `${levels[i]}→${l}`);
    const md = [`# Rung acceptance sheet — ${label}, ${receipt.revision?.revision ?? 'local'}`, '', 'Dom (2026-09-26): "It should be visibly cooler per level, to keep players interested." Per slot, each adjacent pair passes only if rung N+1 reads as MORE desirable than rung N at the fight camera AND on the Profile.', '', '| slot | sheets | ' + pairs.join(' | ') + ' |', '|---|---|' + pairs.map(() => '---').join('|') + '|', ...sheetSlots.map((slot) => `| ${slot} | ${index.filter((i) => i.slot === slot).map((i) => i.file).join(', ')} | ${pairs.map(() => ' ').join(' | ')} |`), ''].join('\n');
    await fs.writeFile(path.join(dir, 'index.md'), md);
  } else
  for (const slot of sheetSlots) {
    const figures = (await Promise.all(pieces.filter((p) => p.slot === slot).map(async (p) => { const e = receipt.pieces[p.id]; return `<figure><figcaption>${p.id}<small>${e.draws.length} draw(s)${e.dollLayer ? ' · no doll layer' : ''}${fmt(e)}</small></figcaption>${e.fight ? `<img src="${await uri(e.fight)}">` : ''}${e.doll ? `<img src="${await uri(e.doll)}" class="doll">` : ''}</figure>`; }))).join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:13px/1.3 system-ui;padding:12px}h1{font-size:16px;margin:0 0 10px}main{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:200px;display:flex;flex-direction:column;gap:4px}figcaption{font-weight:600}small{display:block;font-weight:400;color:#aaa}img{width:200px;image-rendering:auto;background:#333}img.doll{width:200px}</style><h1>${slot} — hero at the fight camera (top) and Profile tab (bottom), 375 wide, ${label}, ${receipt.revision?.revision ?? 'local'}</h1><main>${figures}</main>`;
    await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await sheet.screenshot({ path: path.join(dir, `sheet-${slot}.png`), fullPage: true });
  }
} finally {
  await fs.writeFile(path.join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ pieces: Object.keys(receipt.pieces).length, errors }));
