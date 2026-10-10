// Proof 2 "signed-in" row, repeatable and credential-free: a signed-in player on the built origins preview (?region=1) against a STUBBED Origins writer on loopback
// (the page's own ?writer=http://127.0.0.1:PORT override; the stored session is a stub token, nothing reaches Supabase or the live writer).
// Walks the whole path: sign-in (the stored session) -> `open` answers a saved career, the HUD says "Your saved career" with no Sign in link -> walk to a wolf -> tap -> `engage` is POSTed with the
// bearer token and the character from `open` -> the duel runs in the world (body.infight) -> the player cuts it down -> `kill_report` is POSTed with that engage's token and hits > 0
// -> the server's answer is applied: the kill toast shows what the writer paid and the saved career's CP rose by it (the result is saved server-side by the real writer; the stub proves the page asks for it).
//   SIGNEDIN_ZONE=2     the same path on Zone 2 (default 1)       SIGNEDIN_TARGET=wolves-1   a creature id (default: first drawn wolf, else first drawn)
// Serves artifacts/origins-preview (built here when missing). Exit 1 with the receipt on a miss; receipt: artifacts/origins-signedin.json.
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

// The stub writer: the four ops the zone page speaks (origins/preview/save.ts, spawn-net.ts), shaped as the real replies (tests/save.test.ts `good`, spawn-net engagedOf/killedOf).
const TOKEN = 'stub-access', CP = 20, BRONZE = 3, requests = [];
const row = { seed_credit: 5000, world_credit: 700, total_credit: 5_000_000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.replace(/^\//, '').split('?')[0], body = raw ? JSON.parse(raw) : {};
    requests.push({ op, auth: req.headers.authorization, body });
    const reply = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return reply({ marks: 0, career: row, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'engage') return reply({ token: `tok-${body.instance}`, instance: body.instance, generation: 0, kind: 'character:ash-wolf', level: 1, hp: 30, expiresAt: new Date(Date.now() + 120_000).toISOString() });
    if (op === 'touch') return reply({ expiresAt: new Date(Date.now() + 120_000).toISOString() });
    if (op === 'kill_report') return reply({ result: 'killed', instance: body.token.replace(/^tok-/, ''), respawnAt: new Date(Date.now() + 70_000).toISOString(), loot: [{ item: 'wolf-pelt', quantity: 2 }], cp: CP, bronze: BRONZE, beta: true });
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const zone = process.env.SIGNEDIN_ZONE || '1', want = process.env.SIGNEDIN_TARGET || '';
const receipt = { origin, zone, physicalPhone: false, stub: 'writer on loopback, stub session, no credentials', errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } })); } catch { /* storage blocked */ } }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${origin}/preview/origins/?region=1&zone=${zone}&writer=${encodeURIComponent(writerUrl)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });

  // 1. signed in: the saved career was opened with the bearer token, and the page says so
  await page.waitForFunction(() => window.originsPreview.career().source === 'saved', null, { timeout: 30000 }).catch(() => {});
  const career0 = await page.evaluate(() => window.originsPreview.career());
  const hud0 = await page.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' '), signInLink: [...document.querySelectorAll('a')].some((a) => a.offsetParent && /Sign in/i.test(a.textContent || '')) }));
  receipt.signedIn = { source: career0.source, level: career0.level, savedLine: /Your saved career/.test(hud0.text), signInLink: hud0.signInLink, openAuth: requests.find((r) => r.op === 'open')?.auth === `Bearer ${TOKEN}` };
  assert.equal(career0.source, 'saved', `open answered a saved career (source ${career0.source}, offline ${career0.offline})`);
  assert.ok(receipt.signedIn.savedLine && !receipt.signedIn.signInLink, 'the HUD says "Your saved career" and offers no Sign in link');

  // 2. walk to a wolf and tap it (the real tap path); the engage is POSTed with the bearer token and the character `open` returned
  const target = await page.evaluate((id) => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l.find((m) => (id ? m.id === id : /wolf/i.test(m.body))) || l[0]; }, want);
  assert.ok(target, 'a drawn creature to fight'); receipt.target = { id: target.id, body: target.body };
  await page.waitForTimeout(4000);
  const near = async () => { const m = await page.evaluate((i) => { const x = window.originsPreview.mobs().mobs.find((q) => q.id === i); return x && [x.x, x.z]; }, target.id); assert.ok(m, `${target.id} is gone`); await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), m); };
  const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
  for (let attempt = 0; attempt < 4 && (await hp()) === null; attempt++) {   // the creature joins the loop only once it has noticed him: walk up and tap again (scripts/zone-hit-stills.mjs)
    await near(); await page.waitForTimeout(1500); await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    for (let k = 0; k < 32 && (await hp()) === null; k++) await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 15000 }).catch(() => {});
  const engage = requests.find((r) => r.op === 'engage' && r.body.instance === target.id);
  receipt.duel = { infight: await page.evaluate(() => document.body.classList.contains('infight')), engage: engage && { auth: engage.auth === `Bearer ${TOKEN}`, character: engage.body.character, zoneId: engage.body.zoneId } };
  assert.ok(receipt.duel.infight, 'the tap starts the duel in the world (body.infight)');
  assert.ok(engage && receipt.duel.engage.auth && receipt.duel.engage.character === 'pc:stub-1', `engage POSTed with the bearer token and the opened character: ${JSON.stringify(engage)}`);

  // 3. cut it down; the kill is reported on that engage's token
  let down = false;
  for (let t = 0; t < 120 && !down; t++) {
    await page.evaluate(() => window.originsPreview.press('light'));
    for (let k = 0; k < 12 && !down; k++) { down = await page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.phase === 'dead', target.id); if (!down) await page.waitForTimeout(100); }
  }
  assert.ok(down, `${target.id} went down within the run`);
  await page.waitForFunction(() => /is down/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  const kill = requests.find((r) => r.op === 'kill_report');
  const hud1 = await page.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' '), career: window.originsPreview.career(), kills: window.originsPreview.hunt()?.kills }));
  receipt.result = { killReport: kill && { auth: kill.auth === `Bearer ${TOKEN}`, token: kill.body.token, hits: kill.body.hits }, toast: (/[A-Za-z ]+ is down\.[^]{0,80}/.exec(hud1.text) ?? [])[0], creditBefore: career0.credit, creditAfter: hud1.career.credit, kills: hud1.kills };
  assert.ok(kill && receipt.result.killReport.auth && kill.body.token === `tok-${target.id}` && kill.body.hits > 0, `kill_report POSTed on the engage's token with hits > 0: ${JSON.stringify(kill)}`);
  assert.ok(/is down\..*\+20 CP/.test(hud1.text), `the kill toast shows what the writer paid: ${receipt.result.toast}`);
  assert.equal(hud1.career.credit, career0.credit + CP, 'the saved career rose by the CP the writer paid');
  assert.equal(hud1.career.source, 'saved', 'the career is still the saved one after the kill');
  assert.deepEqual(receipt.errors, [], 'no page errors');
  console.log('origins-signedin-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('origins-signedin-check FAIL', JSON.stringify({ ...receipt, requests: requests.map((r) => r.op) }), error.message); process.exitCode = 1;
} finally {
  fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-signedin.json', JSON.stringify({ ...receipt, requests: requests.map((r) => r.op) }, null, 2));
  await browser.close(); server.close(); writer.close();
}
