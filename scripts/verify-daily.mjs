// Server-side replay verifier for the daily warden (beta plan brief 4; migration 202609210003). A fighter's daily result is posted by
// the client with `verified = false`; this sweep, run on the VPS on a timer, replays each record headless through src/replay.ts
// `verifyRecord` — the same steps the live game took — and sets `verified = true` only when the record's meta matches the row and the
// day's seed, and the replay ends where the record says. Rows that fail stay grey (verified = false, never deleted), get `checked_at`
// stamped so the next sweep moves on to new rows, and are reported in the receipt; `--recheck` sweeps refused rows again (a rules
// change, a re-recorded fixture).
//
// Two ways in, one sweep: DATABASE_URL (a least-privilege Postgres role through psql: migration 202609210005) or SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY (PostgREST). Exit 0 with a JSON receipt; exit 1 only when the database cannot be reached.
// `node scripts/verify-daily.mjs --dry` replays without writing; `--recheck` includes rows already refused.
import { spawnSync } from 'node:child_process';
import { verifyRecord } from '../src/replay.ts';
import { decodeRecord } from '../src/record.ts';

const LIMIT = 200;   // rows per sweep; the timer comes round again for the rest
const DAY = /^\d{4}-\d{2}-\d{2}$/, UUID = /^[0-9a-f-]{36}$/i;

// One sweep over `db` ({ pending, seed, verify, refuse } — see restAdapter / psqlAdapter).
export async function verifyPending(db, { dry = false, recheck = false } = {}) {
  const rows = await db.pending(LIMIT, recheck);
  const seeds = new Map();   // day -> the warden's unsigned seed, from daily_fight(day) (the secret never leaves the database)
  /** @type {{ checked: number, verified: number, refused: { day: string, user_id: string, reason: string }[], dry: boolean }} */
  const receipt = { checked: rows.length, verified: 0, refused: [], dry };
  for (const row of rows) {
    const reason = await refusal(row, seeds, db);
    if (reason) { receipt.refused.push({ day: row.day, user_id: row.user_id, reason }); if (!dry) await db.refuse(row.day, row.user_id); continue; }
    if (!dry) await db.verify(row.day, row.user_id);
    receipt.verified++;
  }
  return receipt;
}

// Why a row cannot be marked verified, or null when the replay confirms it.
async function refusal(row, seeds, db) {
  let record;
  try { record = await decodeRecord(row.record); } catch (error) { return `undecodable record: ${error instanceof Error ? error.message : String(error)}`; }
  if (!seeds.has(row.day)) {
    const seed = await db.seed(row.day);
    if (!Number.isSafeInteger(seed)) return `no daily seed for ${row.day}`;
    seeds.set(row.day, seed >>> 0);   // the client fights on the signed hash as an unsigned seed (src/daily.ts fetchDaily)
  }
  if (record.seed !== seeds.get(row.day)) return `seed ${record.seed} is not the day's warden seed`;
  if (record.profile !== 'normal') return `daily fights are at normal, record says ${record.profile}`;
  for (const field of ['opponent', 'weapon', 'outcome', 'ticks']) {
    if (record[field] !== row[field]) return `${field}: record ${String(record[field])}, row ${String(row[field])}`;
  }
  const result = verifyRecord(record);
  return result.ok ? null : result.reason;
}

// PostgREST with the service-role key (bypasses RLS).
export function restAdapter(api, fetchFn = globalThis.fetch) {
  const base = api.url.replace(/\/$/, ''), headers = { apikey: api.key, Authorization: `Bearer ${api.key}`, 'Content-Type': 'application/json' };
  const json = async (url, init) => {
    const res = await fetchFn(url, init);
    if (!res.ok) throw Error(`${init?.method ?? 'GET'} ${url.replace(/\?.*$/, '')} -> ${res.status}`);
    return res.json();
  };
  return {
    pending: (limit, recheck) => json(`${base}/rest/v1/daily_results?verified=eq.false${recheck ? '' : '&checked_at=is.null'}&order=created_at.asc&limit=${limit}&select=day,user_id,opponent,weapon,outcome,ticks,record`, { headers }),
    seed: async day => { const fight = await json(`${base}/rest/v1/rpc/daily_fight`, { method: 'POST', headers, body: JSON.stringify({ on_day: day }) }); return (Array.isArray(fight) ? fight[0] : fight)?.seed; },
    verify: (day, userId) => patch(day, userId, { verified: true, checked_at: new Date().toISOString() }),
    refuse: (day, userId) => patch(day, userId, { checked_at: new Date().toISOString() }),
  };
  async function patch(day, userId, body) {
    const res = await fetchFn(`${base}/rest/v1/daily_results?day=eq.${day}&user_id=eq.${userId}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    if (!res.ok) throw Error(`daily_results PATCH ${res.status} for ${day}/${userId}`);
  }
}

// psql as the verifier role (migration 202609210005: select + update (verified) on daily_results, execute daily_fight). Values are
// validated before they are quoted into SQL; the role can do nothing else even if they were not.
export function psqlAdapter(databaseUrl, run = spawnSync) {
  const sql = statement => {
    const res = run('psql', [databaseUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', statement], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C.UTF-8' } });
    if (res.status !== 0) throw Error(`psql: ${(res.stderr || res.error?.message || '').trim() || `exit ${res.status}`}`);
    return res.stdout.trim();
  };
  const check = (value, pattern, what) => { if (!pattern.test(value)) throw Error(`refusing to query with a malformed ${what}: ${JSON.stringify(value)}`); return value; };
  return {
    pending: async (limit, recheck) => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (select day::text, user_id::text, opponent, weapon, outcome, ticks, record from public.daily_results where not verified${recheck ? '' : ' and checked_at is null'} order by created_at asc limit ${Number(limit)}) r`)),
    seed: async day => { const out = sql(`select seed from public.daily_fight(date '${check(day, DAY, 'day')}')`); return out === '' ? null : Number(out); },
    verify: async (day, userId) => { sql(`update public.daily_results set verified = true, checked_at = now() where day = date '${check(day, DAY, 'day')}' and user_id = '${check(userId, UUID, 'user id')}'`); },
    refuse: async (day, userId) => { sql(`update public.daily_results set checked_at = now() where day = date '${check(day, DAY, 'day')}' and user_id = '${check(userId, UUID, 'user id')}'`); },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { DATABASE_URL: dbUrl, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  const db = dbUrl ? psqlAdapter(dbUrl) : url && key ? restAdapter({ url, key }) : null;
  if (!db) { console.error('verify-daily: set DATABASE_URL, or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  verifyPending(db, { dry: process.argv.includes('--dry'), recheck: process.argv.includes('--recheck') })
    .then(receipt => { console.log(JSON.stringify({ ...receipt, at: new Date().toISOString() })); })
    .catch(error => { console.error(`verify-daily: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
}
