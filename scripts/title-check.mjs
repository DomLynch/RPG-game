// The player's title at a phone (Web, top-30 item 13), against a STUB writer on loopback that answers title_get the way Backend's #2523 does ({ fame, karma, title } for the account's character). The stored session is a stub token;
// nothing reaches Supabase or the live writer. Walks: a guest has no title line and sends no title_get; a signed-in character with a title sees it under the name on the Pit page's identity plate AND on the Stats tab;
// an unrenowned character (empty title) and a writer that has no title_get yet (404) show no line at all; the line never overlaps its neighbours, is not clipped and adds no horizontal scroll.
// Serves this tree's build (`npx vite build` first). Usage: OUT=<dir> node scripts/title-check.mjs [--engine webkit]; PIT_GL=1 = the browser's own GL (the VPS). Stills: <OUT>/title-*.png.
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';

const out = process.env.OUT || 'artifacts/title'; await fs.mkdir(out, { recursive: true });
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const TOKEN = 'stub-access', requests = [], state = { reply: { fame: 4200, karma: 1800, title: 'The Honoured Gladiator of the Sunken Arena' }, missing: false };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(); requests.push(op);
    const send = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return send({ marks: 0, career: { seed_credit: 5000, world_credit: 700, total_credit: 5000000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 }, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'title_get') { if (state.missing) { res.writeHead(404, cors); return res.end(); } return send(state.reply); }
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
async function load(w, h, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  if (signedIn) await context.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } })); } catch { /* none */ } }, TOKEN);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => fails.push(`${w}: ${String(e).slice(0, 160)}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
  await context.route('**/origins/*', async (route) => { const op = new URL(route.request().url()).pathname.split('/').pop(); await route.fulfill({ response: await route.fetch({ url: `${writerUrl}/${op}` }) }); });   // the Pit page's CSP only lets it call its own origin
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
  return { context, page };
}
const geometry = (page, id, neighbours) => page.evaluate(([i, ns]) => {
  const e = document.getElementById(i), r = e.getBoundingClientRect(), vw = innerWidth;
  const overlaps = ns.filter((n) => { const q = document.getElementById(n)?.getBoundingClientRect(); return q && q.width && q.height && r.width && r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1; });
  return { shown: !e.hidden && r.width > 0, text: e.textContent, inView: r.left >= -1 && r.right <= vw + 1, clipped: e.scrollWidth > e.clientWidth + 2, hscroll: document.documentElement.scrollWidth > vw + 1, overlaps };
}, [id, neighbours]);
const gone = (page, id) => page.evaluate((i) => { const e = document.getElementById(i), r = e.getBoundingClientRect(); return e.hidden || r.width === 0; }, id);
const NEIGH = { 'identity-title': ['rank', 'save-status', 'name-button'], 'journal-title': ['journal-rank', 'journal-save', 'journal-name'] };

try {
  for (const [name, w, h] of [['phone', 375, 812], ['small', 320, 568], ['short', 844, 340]]) {
    // a guest: nothing sent, no line
    { requests.length = 0; const { context, page } = await load(w, h, { signedIn: false }); await page.waitForTimeout(1500);
      check(!requests.includes('title_get'), `${name}: a guest sends no title_get`); check(await gone(page, 'identity-title') && await gone(page, 'journal-title'), `${name}: a guest sees no title line`); await context.close(); }
    // signed in with a long title: both places
    state.missing = false; state.reply = { fame: 4200, karma: 1800, title: 'The Honoured Gladiator of the Sunken Arena' };
    { const { context, page } = await load(w, h);
      await page.waitForFunction(() => document.getElementById('identity-title') && !document.getElementById('identity-title').hidden, null, { timeout: 30000 }).catch(() => {});
      let g = await geometry(page, 'identity-title', NEIGH['identity-title']);
      check(g.shown && /Honoured Gladiator/.test(g.text), `${name}: the title shows on the identity plate (${g.text})`);
      check(g.inView && !g.clipped && !g.hscroll && !g.overlaps.length, `${name}: identity title fits (${JSON.stringify(g)})`);
      await page.screenshot({ path: `${out}/title-${name}-identity.png` });
      if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true });
      await page.waitForFunction(() => document.querySelector('#welcome').hidden); await page.waitForTimeout(1200);
      await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600); await page.locator('#journal .tab-fighter').click({ force: true }); await page.waitForTimeout(400);
      g = await geometry(page, 'journal-title', NEIGH['journal-title']);
      check(g.shown && /Honoured Gladiator/.test(g.text), `${name}: the title shows under the name on the Stats tab (${g.text})`);
      check(g.inView && !g.clipped && !g.hscroll && !g.overlaps.length, `${name}: stats title fits (${JSON.stringify(g)})`);
      await page.screenshot({ path: `${out}/title-${name}-stats.png` }); await context.close(); }
    // unrenowned and a writer without the op: no line
    for (const [why, setup] of [['an unrenowned character', () => { state.missing = false; state.reply = { fame: 0, karma: 0, title: '' }; }], ['a writer with no title_get yet', () => { state.missing = true; }]]) {
      setup(); const { context, page } = await load(w, h); await page.waitForTimeout(2500);
      check(await gone(page, 'identity-title') && await gone(page, 'journal-title'), `${name}: ${why} shows no title line`); await context.close(); }
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); await server.close(); writer.close(); }
console.log(fails.length ? `title-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `title-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
