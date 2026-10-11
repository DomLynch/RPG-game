// MANUAL real signed-in smoke against production (writes: the writer's `open`), run on the VPS by Backend after a release that touches signed-in paths. NOT a CI gate.
//   sudo node scripts/qa-signedin-smoke.mjs      reads /etc/frankendom/qa-account.env (QA_EMAIL, QA_PASSWORD) and origins-writer.env (SUPABASE_URL, SUPABASE_ANON_KEY, PORT); prints OK/FAIL per step, never a credential or token.
// The board checks pass vacuously while the QA account has no rating or daily result: the proof that is_test fighters are filtered is 0021's real-PG check (scripts/fighter-is-test-database-check.mjs); here they only catch a leak of a real row.
// daily_board exposes only display_name, so its check needs the QA fighter's name to be unique.
// Order is the safety rule: the QA fighter row must already be is_test=true BEFORE `open`, or the client could create it as a normal fighter that reaches the boards.
import fs from 'node:fs';
import console from 'node:console';
import process from 'node:process';

const QA_ENV = process.env.QA_ENV ?? '/etc/frankendom/qa-account.env', WRITER_ENV = process.env.WRITER_ENV ?? '/etc/frankendom/origins-writer.env';
const step = (name, ok, why = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !why ? '' : ` (${why})`}`); if (!ok) process.exit(1); };
const envOf = (file) => {
  try { return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return null; }
};
const qa = envOf(QA_ENV), w = envOf(WRITER_ENV);
step('read credential files', !!(qa?.QA_EMAIL && qa?.QA_PASSWORD && w?.SUPABASE_URL && w?.SUPABASE_ANON_KEY && w?.PORT), 'missing file or key');
const send = async (url, init) => { try { const res = await globalThis.fetch(url, { ...init, signal: globalThis.AbortSignal.timeout(20_000) }); return { status: res.status, json: await res.json().catch(() => null) }; } catch { return { status: 0, json: null }; } };
const base = w.SUPABASE_URL, key = w.SUPABASE_ANON_KEY;

const signin = await send(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ email: qa.QA_EMAIL, password: qa.QA_PASSWORD }) });
step('password sign-in (anon key)', signin.status === 200 && !!signin.json?.access_token, `http ${signin.status}${signin.json?.error_code ? ` ${signin.json.error_code}` : ''}`);
const token = signin.json.access_token, uid = signin.json.user?.id;
const auth = { apikey: key, authorization: `Bearer ${token}` };
let ownStatus = 0;
const own = async () => { const r = await send(`${base}/rest/v1/fighter_profiles?select=is_test,public_no,display_name&user_id=eq.${uid}`, { headers: auth }); ownStatus = r.status; return r.json; };

const before = await own();
step('profile row is_test=true BEFORE open', Array.isArray(before) && before.length === 1 && before[0].is_test === true, `http ${ownStatus}; row missing or not flagged: Deploy's is_test insert has not landed`);

const open = await send(`http://127.0.0.1:${w.PORT}/origins/open`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
step('writer open', open.status === 200 && open.json?.ok === true, `http ${open.status}`);

const after = await own();
step('profile row still is_test=true after open', Array.isArray(after) && after.length === 1 && after[0].is_test === true && after[0].public_no === before[0].public_no, `http ${ownStatus}`);
const { public_no: no, display_name: name } = after[0];

const lb = await send(`${base}/rest/v1/rpc/leaderboards`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{"p_limit":50}' });
step('leaderboards() readable', lb.status === 200 && Array.isArray(lb.json), `http ${lb.status}`);
step('account absent from leaderboards()', !lb.json.some((r) => r.fighter_id === no || r.display_name === `Fighter #${no}`));

const db = await send(`${base}/rest/v1/daily_board?select=display_name&display_name=eq.${encodeURIComponent(name)}&limit=1`, { headers: auth });
step('daily_board readable', db.status === 200 && Array.isArray(db.json), `http ${db.status}`);
step('account absent from daily_board', db.json.length === 0);
console.log('ALL OK');
