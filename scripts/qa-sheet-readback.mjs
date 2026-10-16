// MANUAL signed-in read-back of the hero SHEET in the world (Combat's #2900), on the production QA account only. Run on the VPS by Backend ONCE, right after the release that carries #2900.
//   sudo node scripts/qa-sheet-readback.mjs --pr2900=<#2900's merge sha>     (run from a repo checkout that has that sha and the live one: `git fetch origin <trunk>` first)
// Reads /etc/frankendom/qa-account.env (QA_EMAIL, QA_PASSWORD) and origins-writer.env (SUPABASE_URL, SUPABASE_ANON_KEY, PORT, DATABASE_URL).
// Lead's ruling (2026-10-16, Strategy under Dom's delegation): the QA account is the is_test fighter "QA Smoke" and nothing else. ORDER (Lead's amendment: nothing irreversible before the preflight):
//   READ-ONLY PREFLIGHT  sign in; refuse any account that is not is_test "QA Smoke"; the live release.json sha contains #2900 (git merge-base --is-ancestor); load ?region=1 signed in and check
//                        that originsPreview.combat().trace exists. Any miss stops here, with nothing written.
//   THEN, all on the account's one character: (1) origins_set_level to 12 (once; it only raises; skipped when the build is already 12), the server's own kill-time call, run as the writer role
//   (DATABASE_URL); (2) build_set {armour 4, attack 4, health 4} (12 points = level 12); (3) gear_import of the dwarf Helmet/Body/Greaves/Warhammer at Legionary (idempotent per piece; QA only).
//   Then it reloads ?region=1 and prints the HUD (career) level, the trace's sheet and maxHealth.
// Expected (the LEVEL-12 trace in #2900's body, section "Acceptance (1) trace", the TRACE line of test "sheet-in-world, the real build row", head 877ab3c0d, produced from Backend's disposable-Postgres
// repro build {level 12, armour 4, attack 4, health 4} + the same four dwarf pieces at tier 2; the same body also carries the level-20 TRACE20 line, which this script does NOT use): sheet {attack 4,
// armour 31, health 6, poise 1}, maxHealth 159 against the bare 150.
// Safety: it REFUSES any account that is not is_test with display_name "QA Smoke" (checked before any write); it never prints a credential, a token or a connection string (the token only goes in an
// Authorization header and into the page's own session storage; the database password goes in the child's environment, never its arguments); it never opens presence (a presence page would show the
// QA character to real players). Prod evidence that a level-12 test row appears on no public board: the receipt on #2900.
import fs from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';
import { chromium } from 'playwright';

const QA_ENV = process.env.QA_ENV ?? '/etc/frankendom/qa-account.env', WRITER_ENV = process.env.WRITER_ENV ?? '/etc/frankendom/origins-writer.env';
const PAGE = process.env.QA_PAGE ?? 'https://frankendom.com/preview/origins/?region=1', RELEASE = process.env.QA_RELEASE ?? 'https://frankendom.com/release.json';
const LEVEL = 12, PLACED = { armour: 4, attack: 4, health: 4 };
const WORN = { head: 'dwarf.Helmet', chest: 'dwarf.Body', legs: 'dwarf.Greaves', main: 'dwarf.Warhammer' }, WANT = { attack: 4, armour: 31, health: 6, poise: 1, maxHealth: 159 };
const AUTH_KEY = 'frankendom.auth.v1';   // src/core/writer-call.ts: the page reads { access_token, expires_at } from here
const step = (name, ok, why = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !why ? '' : ` (${why})`}`); if (!ok) process.exit(1); };
const envOf = (file) => {
  try { return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return null; }
};
const send = async (url, init) => { try { const res = await globalThis.fetch(url, { ...init, signal: globalThis.AbortSignal.timeout(20_000) }); return { status: res.status, json: await res.json().catch(() => null) }; } catch { return { status: 0, json: null }; } };

// ---- preflight, part 1: no browser, no write -----------------------------------------------------------------------------------------------------------------------------------------------
step('refuse a presence page', !/presence/i.test(PAGE), 'QA_PAGE must not open presence');
const pr = process.argv.find((a) => a.startsWith('--pr2900='))?.slice('--pr2900='.length) ?? '';
step('--pr2900=<40-hex merge sha of #2900> given', /^[0-9a-f]{40}$/.test(pr));
const live = (await send(RELEASE)).json?.revision;
step('live release.json names a sha', typeof live === 'string' && /^[0-9a-f]{40}$/.test(live));
let contains = false;
try { execFileSync('git', ['merge-base', '--is-ancestor', pr, live], { stdio: 'ignore', timeout: 30_000 }); contains = true; } catch { /* not an ancestor, or a sha this checkout lacks */ }
step('the live release contains #2900 (its merge sha is an ancestor of the live sha)', contains, 'not an ancestor, or git fetch the trunk first');
const qa = envOf(QA_ENV), w = envOf(WRITER_ENV);
step('read credential files', !!(qa?.QA_EMAIL && qa?.QA_PASSWORD && w?.SUPABASE_URL && w?.SUPABASE_ANON_KEY && w?.PORT && w?.DATABASE_URL), 'missing file or key');
const base = w.SUPABASE_URL, key = w.SUPABASE_ANON_KEY, writerBase = `http://127.0.0.1:${w.PORT}/origins`;

const signin = await send(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ email: qa.QA_EMAIL, password: qa.QA_PASSWORD }) });
step('password sign-in (anon key)', signin.status === 200 && !!signin.json?.access_token, `http ${signin.status}`);
const token = signin.json.access_token, uid = signin.json.user?.id, expiresAt = signin.json.expires_at;
const auth = { apikey: key, authorization: `Bearer ${token}` };
const rows = await send(`${base}/rest/v1/fighter_profiles?select=is_test,display_name&user_id=eq.${uid}`, { headers: auth });
step('REFUSE unless the account is is_test "QA Smoke" (before any write)', Array.isArray(rows.json) && rows.json.length === 1 && rows.json[0].is_test === true && rows.json[0].display_name === 'QA Smoke', `http ${rows.status}`);

const op = async (name, body) => send(`${writerBase}/${name}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(([k, v]) => { try { globalThis.localStorage.setItem(k, v); } catch { /* storage blocked */ } }, [AUTH_KEY, JSON.stringify({ access_token: token, expires_at: expiresAt })]);
  const page = await context.newPage();
  const read = () => page.evaluate(() => {
    const p = globalThis.originsPreview, c = p?.combat?.(), t = c?.trace ?? p?.trace?.();
    return { trace: t ?? null, max: c?.hero?.max ?? null, career: p?.career?.() ?? null };
  });
  const settle = async (done) => { let got = await read(); for (let i = 0; i < 40 && !done(got); i++) { await page.waitForTimeout(1500); got = await read(); } return got; };
  const shaped = (g) => !!g.trace && typeof g.trace === 'object' && g.trace.sheet && typeof g.trace.maxHealth === 'number';

  // ---- preflight, part 2: the page (still no write) -----------------------------------------------------------------------------------------------------------------------------------------
  await page.goto(PAGE, { waitUntil: 'load', timeout: 60_000 });
  const pre = await settle(shaped);
  step('PREFLIGHT: originsPreview.combat().trace exists with a sheet and maxHealth', shaped(pre), pre.trace ? 'trace has no sheet/maxHealth' : 'no trace handle: the release does not carry #2900 as expected');
  console.log(`preflight: before any write the QA hero's maxHealth is ${pre.trace.maxHealth} (bare 150), sheet armour ${pre.trace.sheet.armour ?? '?'}`);

  // ---- the writes (all on the QA account's one character) ------------------------------------------------------------------------------------------------------------------------------------
  const open = await op('open', {});
  const pc = open.json?.result?.characters?.[0]?.id;
  step('writer open: the QA account has a character', open.status === 200 && typeof pc === 'string', `http ${open.status}`);
  let build = (await op('build_get', { character: pc })).json?.result;
  step('build_get answers', !!build && Number.isInteger(build.level), 'no build row shape');
  if (build.level < LEVEL) {   // the server's own call, as the writer role: the URL's parts go in the child's environment so no password reaches an argument list
    const u = new URL(w.DATABASE_URL);
    const pgEnv = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) || 'postgres', PGSSLMODE: 'require' };
    let ok = false;
    try { execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', `a=${uid}`, '-v', `c=${pc}`, '-v', `n=${LEVEL}`], { env: pgEnv, input: "select public.origins_set_level(:'a'::uuid, :'c', :'n'::int);", stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 }); ok = true; } catch { /* the message may carry the conninfo: print nothing from it */ }
    step(`origins_set_level ${LEVEL} on the QA character`, ok, 'psql failed (details withheld)');
    build = (await op('build_get', { character: pc })).json?.result;
  }
  step(`build level is ${LEVEL}`, build.level === LEVEL, `level ${build.level}`);
  if (JSON.stringify(Object.entries(build.placed).sort()) !== JSON.stringify(Object.entries(PLACED).sort())) {
    const set = await op('build_set', { character: pc, placed: PLACED, version: build.version });
    step('build_set armour 4 / attack 4 / health 4', set.status === 200 && set.json?.result?.version > build.version, `http ${set.status}`);
  }
  const imp = await op('gear_import', { character: pc, owned: Object.values(WORN), equipped: WORN, tiers: Object.fromEntries(Object.values(WORN).map((id) => [id, 2])) });
  step('gear_import the dwarf set (idempotent)', imp.status === 200 && imp.json?.ok === true, `http ${imp.status}`);
  const gear = (await op('gear_open', { character: pc })).json?.result;
  const worn = (gear?.pieces ?? []).filter((p) => p.where === 'equipped').map((p) => p.lootId).sort();
  step('gear_open: the four pieces are worn', JSON.stringify(worn) === JSON.stringify(Object.values(WORN).sort()), `worn ${worn.join(',')}`);

  // ---- the read-back: a fresh page load with the new build and gear ---------------------------------------------------------------------------------------------------------------------------
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  const got = await settle((g) => shaped(g) && g.trace.ready === true && g.trace.sheet.armour > (pre.trace.sheet.armour ?? 0));
  step('the reloaded page answers its trace (ready, with the new sheet)', shaped(got) && got.trace.ready === true, 'trace never showed the new build');
  const s = got.trace.sheet, maxHealth = got.trace.maxHealth;
  console.log(`HUD career level ${got.career?.level ?? '?'}; trace level ${got.trace.level ?? '?'}; sheet attack ${s.attack} armour ${s.armour} health ${s.health} poise ${s.poise}; maxHealth ${maxHealth} (bare 150)`);
  step('sheet equals the repro: attack 4, armour 31, health 6, poise 1', s.attack === WANT.attack && s.armour === WANT.armour && s.health === WANT.health && s.poise === WANT.poise);
  step('maxHealth 159, off the bare 150', maxHealth === WANT.maxHealth, `maxHealth ${maxHealth}`);
} finally { await browser.close(); }
console.log('qa-sheet-readback: all steps OK');
