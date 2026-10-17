// Signed-in DRESSED-hero row (Lead's priority, 2026-10-17): a signed-in player whose server ledger (a STUBBED `gear_open`) has the starter Knife, Helmet and Greaves worn (item:starter.* wield through
// origins/region1/starter-wield.json, #2973 lootIds). From [zone ready] (window.__zoneReady) through the engage of a wolf the page's linked render programs must not grow: a gear piece that links
// its program when the hero is dressed, or when the duel starts, is a stall in the player's hand (the program list is originsPreview.renderInfo().programNames, as the remote-heroes row reads it).
// Stub writer on loopback, stub session, no credentials (same shape as scripts/origins-signedin-check.mjs). Serves artifacts/origins-preview (built here when missing).
// Exit 1 with the receipt on a miss; receipt: artifacts/origins-signedin-gear.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
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

// The worn set, shaped as src/core/gear-ledger.ts GearView; the lootIds are read from the data row, not written here.
const wield = JSON.parse(fs.readFileSync('origins/region1/starter-wield.json', 'utf8')).wield;
const WORN = [['item:starter.knife', 'Knife', 'main'], ['item:starter.goblin-scrap-cap', 'Helmet', 'head'], ['item:starter.goblin-shin-plates', 'Greaves', 'legs']].map(([item, slot, paperdoll], i) => {
  const lootId = wield.find((w) => w.id === item)?.lootId; assert.ok(lootId, `starter-wield.json has a row for ${item}`);
  return { id: `inst:w${i}`, item, lootId, slot, where: 'equipped', index: null, paperdoll, tier: 'Recruit', version: 1, level: 0 };
});
const gear = { pieces: WORN, stock: [], worn: Object.fromEntries(WORN.map((p) => [p.paperdoll, p.id])), packSize: 8, bankSize: 100 };
const TOKEN = 'stub-access', requests = [];
const row = { seed_credit: 5000, world_credit: 700, total_credit: 5_000_000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(), body = raw ? JSON.parse(raw) : {};
    requests.push({ op, auth: req.headers.authorization, body });
    const reply = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return reply({ marks: 0, career: row, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'gear_open') return reply(gear);
    if (op === 'engage') return reply({ token: `tok-${body.instance}`, instance: body.instance, generation: 0, kind: 'character:ash-wolf', level: 1, hp: 30, expiresAt: new Date(Date.now() + 120_000).toISOString() });
    if (op === 'touch') return reply({ expiresAt: new Date(Date.now() + 120_000).toISOString() });
    if (op === 'kill_report') return reply({ result: 'killed', instance: body.token.replace(/^tok-/, ''), respawnAt: new Date(Date.now() + 70_000).toISOString(), loot: [], cp: 0, bronze: 0, beta: true });
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, worn: WORN.map((p) => p.lootId), errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } })); } catch { /* storage blocked */ } }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${origin}/preview/origins/?region=1&zone=1&writer=${encodeURIComponent(writerUrl)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).catch(() => { throw new Error('zone never ready: [zone ready] (window.__zoneReady) did not fire'); });
  const snap = () => page.evaluate(() => { const i = window.originsPreview.renderInfo(); return { names: i.programNames, owners: i.programOwners, keys: i.programKeys }; });
  receipt.programsAtReady = (await snap()).names.length;
  // the kit warm and then the gear sheet's mannequin build their programs after [zone ready] (#2938, Lead 2026-10-17): the baseline is taken once both have ended (originsPreview.remoteKitsWarm() waits for the mannequin)
  const kitWarmMs = JSON.parse(fs.readFileSync('origins/preview/preview-rules-defs.json', 'utf8')).rules.find((r) => r.id === 'kitWarmMs').value;
  assert.ok(await page.waitForFunction(() => window.originsPreview.remoteKitsWarm() !== null, null, { timeout: kitWarmMs + 90000 }).then(() => true).catch(() => false), 'the post-ready warm-up never finished (originsPreview.remoteKitsWarm() stayed null)');
  receipt.gearWarm = await page.evaluate(() => (window.originsPreview.gearWarm ? window.originsPreview.gearWarm() : 'no warm-up on this build'));   // { ms, drawMs: the one synchronous frame (the long task it leaves; budget 50 ms on the T4), failed }
  if (typeof receipt.gearWarm === 'object') assert.ok(receipt.gearWarm && !receipt.gearWarm.failed, `the mannequin warm-up ended without failing: ${JSON.stringify(receipt.gearWarm)}`);
  if (process.env.GEAR_TASK_MS && typeof receipt.gearWarm === 'object') assert.ok(receipt.gearWarm.drawMs <= Number(process.env.GEAR_TASK_MS), `the mannequin's synchronous frame took ${receipt.gearWarm.drawMs} ms (budget ${process.env.GEAR_TASK_MS})`);
  const before = await snap(); receipt.programsAfterWarm = before.names.length;

  await page.waitForFunction(() => window.originsPreview.career().source === 'saved', null, { timeout: 30000 }).catch(() => {});
  assert.equal((await page.evaluate(() => window.originsPreview.career())).source, 'saved', 'signed in: open answered a saved career');
  // the gear sheet opens mid-run (menu > Gear, as scripts/gear-in-zone1-check.mjs): its mannequin loads the hero rig and loot.glb and dresses the worn set, which must not link a program after ready
  await page.locator('#journal-button').tap(); await page.locator('#menu-gear').tap();
  await page.waitForSelector('#journal[open][data-gear="live"]', { timeout: 30000 });
  await page.waitForSelector('#slot-head[data-loot="goblin.Helmet"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(Number(process.env.RIG_WAIT_MS ?? 8000));   // the rig and loot.glb load on the first open
  const afterSheet = await snap(); receipt.programsAfterSheet = afterSheet.names.length;
  receipt.programsAddedBySheet = afterSheet.names.filter((n) => !before.names.includes(n)).map((n) => [n, String(afterSheet.keys[n] ?? '').split(',')[0], afterSheet.owners[n] ?? []]);
  assert.equal(receipt.programsAddedBySheet.length, 0, `opening the gear sheet linked render programs after zone ready (${receipt.programsAddedBySheet.length}): ${JSON.stringify(receipt.programsAddedBySheet)}`);
  await page.evaluate(() => document.getElementById('journal')?.close()); await page.waitForTimeout(500);   // close it again
  const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l.find((m) => /wolf/i.test(m.body)) || l[0]; });
  assert.ok(target, 'a drawn creature to fight'); receipt.target = { id: target.id, body: target.body };
  const near = async () => { const m = await page.evaluate((i) => { const x = window.originsPreview.mobs().mobs.find((q) => q.id === i); return x && [x.x, x.z]; }, target.id); assert.ok(m, `${target.id} is gone`); await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), m); };
  const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
  for (let attempt = 0; attempt < 4 && (await hp()) === null; attempt++) {
    await near(); await page.waitForTimeout(1500); await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    for (let k = 0; k < 32 && (await hp()) === null; k++) await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);   // the first frames of the duel with the dressed hero
  receipt.gearOpenAsked = requests.some((r) => r.op === 'gear_open');
  receipt.infight = await page.evaluate(() => document.body.classList.contains('infight'));
  assert.ok(receipt.infight && requests.some((r) => r.op === 'engage'), 'the tap engaged the wolf (body.infight, engage POSTed)');

  const after = await snap(); receipt.programsAtEngage = after.names.length;
  const added = after.names.filter((n) => !before.names.includes(n));
  receipt.programsAdded = added.map((n) => [n, String(after.keys[n] ?? '').split(',')[0], after.owners[n] ?? []]);
  assert.equal(added.length, 0, `the dressed hero linked render programs after zone ready (${added.length}): ${JSON.stringify(receipt.programsAdded)}`);
  assert.deepEqual(receipt.errors, [], 'no page errors');
  console.log('origins-signedin-gear-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('origins-signedin-gear-check FAIL', JSON.stringify({ ...receipt, requests: requests.map((r) => r.op) }), error.message); process.exitCode = 1;
} finally {
  fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-signedin-gear.json', JSON.stringify({ ...receipt, requests: requests.map((r) => r.op) }, null, 2));
  await browser.close(); server.close(); writer.close();
}
