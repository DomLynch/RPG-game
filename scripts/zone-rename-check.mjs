// A signed-in player renames from the zone page's ☰ Career card (src/core/rename.ts renameAccount), against a STUBBED Supabase (page.route on http://sb.test; build with VITE_SUPABASE_URL=http://sb.test
// VITE_SUPABASE_PUBLISHABLE_KEY=stub). Proves: the pencil shows for a signed-in session; the PATCH carries the new name at the revision read and the account's own marks and loot; a stale revision
// (the first PATCH matches no row, the account moved on) is refused, the fighter is read again and the retry keeps the newer marks. Stills: artifacts/zone-rename/ (375x812).
// Needs ZONE_DIST (the origins-preview build made with those two env vars) and a Chromium; PIT_GL=1 = the browser's own GL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const dir = process.env.RENAME_RECEIPT_DIR || 'artifacts/zone-rename'; await fs.mkdir(dir, { recursive: true });
const built = path.resolve(process.env.ZONE_DIST), root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` }; for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const zs = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [pre, r] of Object.entries(roots)) if (u.startsWith(pre)) hit = path.join(r, u.slice(pre.length) || 'index.html'); if (hit && existsSync(hit) && statSync(hit).isDirectory()) hit = path.join(hit, 'index.html'); if (!hit || !existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); createReadStream(hit).pipe(res); });
await new Promise((r) => zs.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${zs.address().port}`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600, user = { id: 'user-rename-1', aud: 'authenticated', email: 'qa@example.test' };
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated' })}.sig`, refresh_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
const profile = { version: 1, id: 'career-fighter-0001', name: 'Aldren', career: { victoryMarks: 9 }, loot: { owned: [], equipped: {} } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const receipt = { origin, errors: [], runs: {}, passed: false };

async function before(name) {   // ZR_BEFORE=1 on the base build: the signed-in card has no pencil there
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await context.addInitScript(([p, s]) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); localStorage.setItem('frankendom.auth.v1', JSON.stringify(s)); }, [profile, session]);
  const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, row = { display_name: 'Aldren', encounter: 'goblin', revision: 4, victory_marks: 9, loot: { owned: [], equipped: {} }, public_no: 7 };
  await page.route('http://sb.test/**', (route) => { const req = route.request(), ok = req.method() === 'OPTIONS' || (req.method() === 'GET' && new URL(req.url()).pathname.endsWith('/fighter_profiles')); return route.fulfill({ status: ok ? 200 : 404, contentType: 'application/json', headers: cors, body: ok && req.method() === 'GET' ? JSON.stringify(row) : '{}' }); });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 }); await page.waitForTimeout(3000);
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(1200);
  await page.locator('#journal .tab-career').click(); await page.waitForSelector('#career-root .career-name', { timeout: 60000 }); await page.waitForTimeout(1500);
  assert.equal(await page.locator('#career-root .career-pencil').count(), 0, `${name}: no pencil for a signed-in player on the base build`);
  await page.screenshot({ path: `${dir}/${name}-1-card.png` }); await context.close();
}
async function run(name, { stale }) {
  const row = { display_name: 'Aldren', encounter: 'goblin', revision: 4, victory_marks: 9, loot: { owned: [], equipped: {} }, public_no: 7 };
  const patches = [], gets = []; let staleLeft = stale ? 1 : 0;
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await context.addInitScript(([p, s]) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); localStorage.setItem('frankendom.auth.v1', JSON.stringify(s)); }, [profile, session]);
  const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.route('http://sb.test/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json(200, {});
    if (!url.pathname.endsWith('/fighter_profiles')) return json(404, { message: 'stub: not found' });
    if (req.method() === 'GET') { gets.push({ revision: row.revision }); return json(200, row); }
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON(), rev = Number(/revision=eq\.(\d+)/.exec(url.search)?.[1]);
      patches.push({ revision: rev, body });
      if (staleLeft-- > 0) { row.revision = 5; row.victory_marks = 11; return json(406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' }); }   // the account moved on: nothing matches revision 4
      if (rev !== row.revision) return json(406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'x' });
      Object.assign(row, body, { revision: row.revision + 1 }); return json(200, row);
    }
    return json(405, {});
  });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 }); await page.waitForTimeout(3000);
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(1200);
  await page.locator('#journal .tab-career').click();
  await page.waitForSelector('#career-root .career-pencil', { timeout: 30000 });
  assert.equal(await page.locator('#career-root .career-pencil').count(), 1, `${name}: a signed-in player has the zone pencil`);
  assert.equal(await page.locator('#career-root .career-name').innerText().then((t) => t.includes('Aldren')), true);
  await page.screenshot({ path: `${dir}/${name}-1-card.png` });
  await page.locator('#career-root .career-pencil').click();
  const field = page.locator('#career-root .career-name-input'); await field.fill('Brand'); await page.screenshot({ path: `${dir}/${name}-2-editing.png` });
  await field.press('Enter');
  await page.waitForFunction((n) => n === document.querySelector('#career-root .career-name strong')?.textContent, 'Brand'); await page.waitForTimeout(1500); await page.mouse.move(5, 5);   // the game's `dialog button:hover` is white: the pointer must not sit on the pencil in the still
  await page.screenshot({ path: `${dir}/${name}-3-saved.png` });
  const last = patches.at(-1);
  assert.equal(last.body.display_name, 'Brand', `${name}: the PATCH carries the new name`);
  assert.equal(last.body.victory_marks, stale ? 11 : 9, `${name}: the account's own marks, never the device's stale ones`);
  assert.equal(row.display_name, 'Brand'); assert.equal(row.victory_marks, stale ? 11 : 9);
  receipt.runs[name] = { patches: patches.map((p) => ({ revision: p.revision, name: p.body.display_name, marks: p.body.victory_marks })), reads: gets.length, finalRevision: row.revision, note: await page.locator('#career-root .career-profile .career-note').allInnerTexts() };
  if (stale) { assert.equal(patches.length, 2, 'the stale write was refused (revision 4) and retried once at revision 5'); assert.deepEqual(patches.map((p) => p.revision), [4, 5]); }
  else assert.equal(patches.length, 1);
  await context.close();
}
try {
  if (process.env.ZR_BEFORE) await before('before');
  else { await run('signed-in', { stale: false }); await run('stale-revision', { stale: true }); }
  assert.deepEqual(receipt.errors, [], 'no page errors');
  receipt.passed = true; console.log('zone-rename-check PASS', JSON.stringify(receipt.runs));
} catch (error) { console.error('zone-rename-check FAIL', error.message); process.exitCode = 1; }
finally { await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2)); await browser.close(); zs.close(); }
