// A dropped item on the sheet, at a phone (Web, Lead 2026-10-17; visual-pr-stills): a signed-in player whose server ledger (a STUBBED writer) holds two packed copies of one helmet minted at different rungs
// (what #3052's rarity shift makes common) beside the worn starter set. Opens menu > Gear and asserts: each pack row names its own rung and shows its own line ("RES n" / "No bonus"), trying one on shows that
// copy's rung and a strip delta, and Wear this equips THAT server piece (the second copy, not the first). 375x812; stills of ready idle, the pack, and the try-on go to <out dir>.
//   node scripts/loot-sheet-check.mjs <out dir>        Serves artifacts/origins-preview (built here when missing). Stub writer on loopback, stub session, no credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { TIERS } from '../src/core/grades.ts';

const [out] = process.argv.slice(2), root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!out) throw new Error('usage: loot-sheet-check.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// The server's ledger, stubbed and mutable: the starter set worn, plus two packed copies of the worn helmet's id at two rungs (the ladder is read from grades.ts).
const wield = JSON.parse(fs.readFileSync('origins/region1/starter-wield.json', 'utf8')).wield;
const [LOW, HIGH] = [TIERS[5], TIERS[TIERS.length - 1]];
const WORN = [['item:starter.knife', 'Knife', 'main'], ['item:starter.goblin-scrap-cap', 'Helmet', 'head'], ['item:starter.goblin-shin-plates', 'Greaves', 'legs']].map(([item, slot, paperdoll], i) => {
  const lootId = wield.find((w) => w.id === item)?.lootId; assert.ok(lootId, `starter-wield.json has a row for ${item}`);
  return { id: `inst:w${i}`, item, lootId, slot, where: 'equipped', index: null, paperdoll, tier: 'Recruit', version: 1, level: 0 };
});
const helmetId = WORN[1].lootId;
const pieces = [...WORN, { id: 'inst:pA', item: `item:loot.${helmetId}`, lootId: helmetId, slot: 'Helmet', where: 'pack', index: 0, paperdoll: null, tier: LOW, version: 1, level: 0 }, { id: 'inst:pB', item: `item:loot.${helmetId}`, lootId: helmetId, slot: 'Helmet', where: 'pack', index: 1, paperdoll: null, tier: HIGH, version: 1, level: 0 }];
const gear = () => ({ pieces, stock: [], worn: Object.fromEntries(pieces.filter((p) => p.where === 'equipped').map((p) => [p.paperdoll, p.id])), packSize: 8, bankSize: 100 });
const TOKEN = 'stub-access', requests = [];
const row = { seed_credit: 5000, world_credit: 700, total_credit: 5_000_000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(), body = raw ? JSON.parse(raw) : {};
    requests.push({ op, id: body.id });
    const reply = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return reply({ marks: 0, career: row, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'gear_open') return reply(gear());
    if (op === 'gear_unequip') { const p = pieces.find((x) => x.id === body.id); if (p) { p.where = 'pack'; p.paperdoll = null; p.index = Math.max(-1, ...pieces.filter((x) => x.where === 'pack').map((x) => x.index)) + 1; } return reply(gear()); }
    if (op === 'gear_equip') { const p = pieces.find((x) => x.id === body.id); if (p) { p.where = 'equipped'; p.paperdoll = 'head'; p.index = null; } return reply(gear()); }
    if (op === 'touch') return reply({ expiresAt: new Date(Date.now() + 120_000).toISOString() });
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { low: LOW, high: HIGH, errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001', email: 'stub@example.test' } })); } catch { /* none */ } }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${origin}/preview/origins/?region=1&zone=1&writer=${encodeURIComponent(writerUrl)}&gearwarm=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 });
  await page.waitForFunction(() => window.originsPreview.career().source === 'saved', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, '1-ready-idle.png') });

  await page.locator('#journal-button').tap(); await page.locator('#menu-gear').tap();
  await page.waitForSelector('#journal[open][data-gear="live"]', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('#pack li[data-loot]').length === 2, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#pack li[data-loot]')].map((li) => ({ name: li.querySelector('strong')?.textContent, rank: li.querySelector('small[data-rank]')?.textContent, stats: li.querySelector('small[data-piece-stats]')?.textContent })));
  receipt.rows = rows;
  await page.screenshot({ path: path.join(out, '2-pack-two-rungs.png') });   // before the asserts, so a build without the feature (trunk) still yields its "before" still
  assert.equal(rows.length, 2); assert.equal(rows[0].rank, LOW, 'cell 0 is its own rung'); assert.equal(rows[1].rank, HIGH, 'cell 1 is its own rung (the same helmet id, a different rung)');
  assert.ok(rows.every((r) => r.stats), 'every backpack row shows what that piece gives');
  assert.notEqual(rows[0].stats, rows[1].stats, 'the two copies give different numbers');
  assert.match(rows[1].stats, /^RES \d+$/, 'the top-rung helmet gives RES');
  assert.match(rows[1].stats, /^RES \d+$/, 'the top-rung helmet gives RES');

  await page.locator('#pack li[data-loot]').nth(1).locator('button[data-fit]').tap();
  await page.waitForFunction(() => document.getElementById('fitting')?.dataset.mode === 'try', null, { timeout: 10000 });
  const fit = await page.evaluate(() => ({ name: document.getElementById('fitting-name')?.textContent, rank: document.getElementById('fitting-rank')?.textContent, compare: [...document.querySelectorAll('#fitting-compare [data-side="new"] [data-stat]')].map((e) => e.textContent) }));
  receipt.fit = fit;
  assert.equal(fit.name, rows[1].name, 'the try-on is titled with the tried copy, not the worn one');
  assert.ok(fit.rank?.startsWith(HIGH),`the try-on reads the cell's rung: ${fit.rank}`);
  assert.ok(fit.compare.some((t) => /Resistance/.test(t) && /\+\d/.test(t)), `the compare shows a Resistance gain for the tried copy: ${JSON.stringify(fit.compare)}`);
  await page.screenshot({ path: path.join(out, '3-try-on-top-copy.png') });

  await page.locator('#fitting-wear').tap();
  await page.waitForFunction(() => document.querySelectorAll('#pack li[data-loot]').length === 2 && document.getElementById('fitting')?.hidden, null, { timeout: 15000 });
  const ops = requests.filter((r) => /^gear_(un)?equip$/.test(r.op));
  receipt.ops = ops;
  assert.deepEqual(ops, [{ op: 'gear_unequip', id: 'inst:w1' }, { op: 'gear_equip', id: 'inst:pB' }], 'Wear this equips the copy that was tried on (the second), after taking the worn Recruit helmet off');
  const strip = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#gear-stats [data-stat]')].map((e) => [e.getAttribute('data-stat'), e.querySelector('dd')?.textContent])));
  receipt.stripAfter = strip;
  await page.screenshot({ path: path.join(out, '4-after-wear.png') });
  assert.deepEqual(receipt.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('loot-sheet-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('loot-sheet-check FAIL', JSON.stringify({ ...receipt, requests }), error.message); process.exitCode = 1;
} finally { await browser.close(); server.close(); writer.close(); }
