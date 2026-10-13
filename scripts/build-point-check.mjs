// "Place your point" at a phone (Web, programme 2a), against a STUB writer on loopback that answers build_get / build_set the way Backend's real one does (#2426): the shared validateBuild decides what is legal,
// taking points off is free to level 10 and then once per rank (409 'respread-spent'), and a stale version is a 409 'moved'. The stored session is a stub token; nothing reaches Supabase or the live writer.
// Walks: a guest sees nothing; a level-3 character gets the dialog on load with 3 points; + stops when none are left; Confirm POSTs the placement and the dot goes; taking back is free; at level 12 with the
// rank spent the - buttons are off; a build that moved under the player is read again with the sentence. Fails on a control under 44 px, off screen, text clipped or horizontal scroll.
// Serves this tree's build (`npx vite build` first). Usage: OUT=<dir> node scripts/build-point-check.mjs [--engine webkit]; PIT_GL=1 = the browser's own GL (the VPS). Stills: <OUT>/point-*.png.
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { validateBuild } from '../src/fight/sheet-rows.ts';

const out = process.env.OUT || 'artifacts/build-point'; await fs.mkdir(out, { recursive: true });
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const TOKEN = 'stub-access', requests = [];
const state = { level: 3, placed: {}, respreadRank: 0, version: 1 };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(), body = raw ? JSON.parse(raw) : {};
    requests.push({ op, body });
    const send = (code, result) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(code === 200 ? { ok: true, result } : { ok: false, error: result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return send(200, { marks: 0, career: { seed_credit: 5000, world_credit: 700, total_credit: 5000000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 }, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'build_get') return send(200, { ...state, placed: { ...state.placed } });
    if (op === 'build_set') {
      const placed = Object.fromEntries(Object.entries(body.placed).filter(([, n]) => n !== 0));
      const problems = validateBuild({ level: state.level, placed }); if (problems.length) return send(400, problems.join('; '));
      if (body.version !== state.version) return send(409, 'moved');
      const took = Object.keys({ ...state.placed, ...placed }).some((id) => (placed[id] ?? 0) < (state.placed[id] ?? 0)), rank = Math.floor(state.level / 10);
      if (took && state.level > 10) { if (state.respreadRank >= rank) return send(409, 'respread-spent'); state.respreadRank = rank; }
      state.placed = placed; state.version += 1; return send(200, { ...state, placed: { ...state.placed } });
    }
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
const reset = (s) => Object.assign(state, { level: 3, placed: {}, respreadRank: 0, version: 1 }, s);

async function load(w, h, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  if (signedIn) await context.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } })); } catch { /* none */ } }, TOKEN);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => fails.push(`${w}: ${String(e).slice(0, 160)}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
  // The Pit page's CSP only lets it call its own origin, so the page keeps its default writer path (/origins) and the stub answers it through the browser's routing (not a ?writer= override).
  await context.route('**/origins/*', async (route) => { const op = new URL(route.request().url()).pathname.split('/').pop(); await route.fulfill({ response: await route.fetch({ url: `${writerUrl}/${op}` }) }); });
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('#welcome').hidden); await page.waitForTimeout(1500);
  return { context, page };
}
const left = (page) => page.locator('#build-dialog .build-left').textContent();
const layout = (page, name) => page.evaluate((n) => {
  const d = document.getElementById('build-dialog'), vw = innerWidth, bad = [];
  for (const e of d.querySelectorAll('button')) { const r = e.getBoundingClientRect(); if (r.width && (r.height < 44 || r.width < 44 || r.right > vw + 1 || r.left < -1)) bad.push(`${e.className} ${Math.round(r.width)}x${Math.round(r.height)}`); }
  const clipped = [...d.querySelectorAll('span, b, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 20));
  return { bad: bad.map((b) => `${n}: ${b}`), clipped, hscroll: d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > vw + 1 };
}, name);

try {
  for (const [name, w, h] of [['phone', 375, 812], ['small', 320, 568]]) {
    // a guest: no token, no dialog, no dot
    { const { context, page } = await load(w, h, { signedIn: false }); check(!(await page.locator('#build-dialog').evaluate((d) => d.open)) && await page.locator('#build-dot').evaluate((e) => e.hidden), `${name}: a guest sees no build prompt`); await context.close(); }
    reset({}); requests.length = 0;
    const { context, page } = await load(w, h);
    await page.waitForFunction(() => document.getElementById('build-dialog').open, null, { timeout: 30000 }).catch(() => {});
    check(await page.locator('#build-dialog').evaluate((d) => d.open), `${name}: the moment opens on load with a point to place`);
    check(/^3 points to place/.test(await left(page)), `${name}: three points at level 3 (${await left(page)}; writer saw ${requests.map((r) => r.op)}; url ${page.url().slice(0, 90)})`);
    check(await page.locator('#build-dot').evaluate((e) => !e.hidden), `${name}: the dot shows`);
    const plus = (i) => page.locator('#build-dialog .build-row').nth(i).locator('.build-plus');
    await plus(0).click({ force: true }); await plus(0).click({ force: true }); await plus(10).click({ force: true });
    check(/^Every point is placed/.test(await left(page)), `${name}: three clicks spend three points (${await left(page)})`);
    check(await plus(1).isDisabled(), `${name}: + stops when no point is left`);
    await page.screenshot({ path: `${out}/point-${name}-draft.png` });
    const m = await layout(page, name); for (const b of m.bad) check(false, `control too small or off screen: ${b}`); check(!m.clipped.length, `${name}: text clipped: ${m.clipped}`); check(!m.hscroll, `${name}: horizontal scroll`);
    await page.locator('#build-dialog .build-confirm').click({ force: true }); await page.waitForFunction(() => !document.getElementById('build-dialog').open);
    const set = requests.filter((r) => r.op === 'build_set').at(-1);
    check(set && Object.values(set.body.placed).reduce((a, b) => a + b, 0) === 3 && set.body.character === 'pc:stub-1' && set.body.version === 1, `${name}: build_set carried the placement, character and version (${JSON.stringify(set?.body)})`);
    check(await page.locator('#build-dot').evaluate((e) => e.hidden), `${name}: the dot goes once every point is placed`);
    // taking back is free at level 3
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true }); 
    await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600); await page.locator('#journal .tab-fighter').click({ force: true }); await page.waitForTimeout(300);
    await page.locator('#build-open').click({ force: true }); await page.waitForFunction(() => document.getElementById('build-dialog').open);
    await page.locator('#build-dialog .build-row').nth(0).locator('.build-minus').click({ force: true });
    check(/^1 point to place/.test(await left(page)), `${name}: a point taken back is free to place again (${await left(page)})`);
    await page.locator('#build-dialog .build-confirm').click({ force: true }); await page.waitForTimeout(500);
    check(state.placed && Object.values(state.placed).reduce((a, b) => a + b, 0) === 2, `${name}: the server holds two placed after the take-back (${JSON.stringify(state.placed)})`);
    // a build that moved under the player
    state.version += 1; state.placed = {};
    await page.locator('#build-dialog .build-row').nth(1).locator('.build-plus').click({ force: true }); await page.locator('#build-dialog .build-confirm').click({ force: true }); await page.waitForTimeout(600);
    check(/changed somewhere else/.test(await page.locator('#build-dialog .build-note').textContent()), `${name}: a moved build says so`);
    check(/^3 points to place/.test(await left(page)), `${name}: and is read again (${await left(page)})`);
    await context.close();
    // level 12, this rank's re-spread spent: no way to take back
    reset({ level: 12, placed: { attack: 5 }, respreadRank: 1, version: 7 });
    const second = await load(w, h);
    if (await second.page.locator('#welcome').isVisible()) await second.page.getByRole('button', { name: 'Enter the arena' }).click({ force: true }); await second.page.locator('#journal-button').click({ force: true }); await second.page.waitForTimeout(500); await second.page.locator('#journal .tab-fighter').click({ force: true }); await second.page.locator('#build-open').click({ force: true });
    await second.page.waitForFunction(() => document.getElementById('build-dialog').open);
    check(await second.page.locator('#build-dialog .build-row').nth(0).locator('.build-minus').isDisabled(), `${name}: with the rank's re-spread spent, - is off`);
    await second.page.screenshot({ path: `${out}/point-${name}-spent.png` });
    await second.context.close();
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); await server.close(); writer.close(); }
console.log(fails.length ? `build-point-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `build-point-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
