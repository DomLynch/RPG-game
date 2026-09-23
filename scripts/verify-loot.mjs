// Server-side sweep for ladder-win loot claims (brief 19 deliverable 3; migration 202609230001), the loot twin of verify-daily.mjs.
// The client posts a claim for every ladder win with `verified = false`; this sweep, run on the VPS on a timer as frankendom_verifier,
// settles each one exactly once:
//   - the WIN: the record decodes, names the claim's opponent, says 'killed', and replays headless (src/replay.ts verifyRecord) to that
//     finish. A win is a mark: `verified = true`. Anything else is refused with a note, never skipped — an unchecked claim would hold
//     up every later claim from its account (below), so every claim leaves the sweep with `checked_at` set, whatever throws.
//   - the PIECE: src/awards.ts awardFor at the account's server standing before this claim (standing_of, claims earlier by
//     (created_at, id) only). An award is written with the flip; a piece the rule refuses keeps the mark and gets the reason as its note.
// Order independence: a claim waits while an earlier claim from the same account is still unchecked, so its tier never depends on
// which of the two a sweep reached first. `--recheck` also takes refused claims again (a rules change, a re-recorded fixture). A recheck
// that turns an EARLIER refused claim into a win raises the true standing of claims already settled after it; their stored tiers stay
// as they were (accepted, Backend N3 on #551). A database error on one claim is reported in `errors` and the sweep moves on (N1).
// Record hashes are unique in the table itself (loot_claims.record_hash), so one fight is one claim before the sweep sees it.
//
// DATABASE_URL only: the flip and the award are one transaction, which PostgREST cannot give. Exit 0 with a JSON receipt; exit 1 only
// when the database cannot be reached. `node scripts/verify-loot.mjs --dry` checks without writing.
import { spawnSync } from 'node:child_process';
import { awardFor } from '../src/awards.ts';
import { verifyRecord } from '../src/replay.ts';
import { decodeRecord } from '../src/record.ts';

const LIMIT = 200;
const UUID = /^[0-9a-f-]{36}$/i;
const note = text => text.replace(/[^\x20-\x7e]/g, '?').slice(0, 200);   // loot_claims.note: at most 200 bytes

// One sweep over `db` ({ pending, waiting, standing, settle } — see psqlAdapter).
export async function verifyClaims(db, { dry = false, recheck = false } = {}) {
  const rows = await db.pending(LIMIT, recheck);
  /** @type {{ checked: number, verified: number, awarded: number, waiting: number, refused: { id: number, reason: string }[], unawarded: { id: number, reason: string }[], errors: { id: number, error: string }[], dry: boolean }} */
  const receipt = { checked: 0, verified: 0, awarded: 0, waiting: 0, refused: [], unawarded: [], errors: [], dry };
  for (const row of rows) {
    try { await settleOne(db, row, receipt, dry); } catch (error) { receipt.errors.push({ id: row.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return receipt;
}

async function settleOne(db, row, receipt, dry) {
  {
    if (await db.waiting(row.id)) { receipt.waiting++; return; }
    receipt.checked++;
    const reason = await refusal(row);
    if (reason) { receipt.refused.push({ id: row.id, reason }); if (!dry) await db.settle(row.id, { verified: false, note: note(reason), award: null }); return; }
    const award = awardFor({ opponent: row.opponent, piece: row.piece }, await db.standing(row.user_id, row.id));
    receipt.verified++;
    if (typeof award === 'string') receipt.unawarded.push({ id: row.id, reason: award });
    else if (award) receipt.awarded++;
    if (!dry) await db.settle(row.id, { verified: true, note: typeof award === 'string' ? note(award) : null, award: typeof award === 'string' ? null : award });
  }
}

// Why a claim is not a verified win, or null when the replay proves it. Never throws: a throw is a refusal.
export async function refusal(row) {
  try {
    const record = await decodeRecord(row.record);
    if (record.opponent !== row.opponent) return `record is against ${record.opponent}, claim says ${row.opponent}`;
    if (record.outcome !== 'killed') return `record outcome is ${record.outcome}, not a win`;
    const result = verifyRecord(record);
    return result.ok ? null : result.reason;
  } catch (error) {
    return `unreadable record: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// psql as the verifier role (202609230001: select on loot_claims and account_seed, update (verified, checked_at, note), insert on
// awards, execute standing_of). Values are validated or reduced to digits before they are quoted into SQL.
export function psqlAdapter(databaseUrl, run = spawnSync) {
  const sql = statement => {
    const res = run('psql', [databaseUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', statement], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C.UTF-8' }, timeout: 60_000 });
    if (res.status !== 0) throw Error(`psql: ${(res.stderr || res.error?.message || '').trim() || `exit ${res.status}`}`);
    return res.stdout.trim();
  };
  const id = value => { if (!Number.isSafeInteger(value) || value < 1) throw Error(`refusing to query with a malformed claim id: ${JSON.stringify(value)}`); return value; };
  const uuid = value => { if (!UUID.test(value)) throw Error(`refusing to query with a malformed user id: ${JSON.stringify(value)}`); return value; };
  const text = value => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
  return {
    pending: async (limit, recheck) => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (select id, user_id::text, opponent, piece, record from public.loot_claims where not verified${recheck ? '' : ' and checked_at is null'} order by created_at, id limit ${Number(limit)}) r`)),
    waiting: async claim => sql(`select exists (select 1 from public.loot_claims c, public.loot_claims x where x.id = ${id(claim)} and c.user_id = x.user_id and c.checked_at is null and (c.created_at, c.id) < (x.created_at, x.id))`) === 't',
    standing: async (userId, claim) => { const [marks, owned] = sql(`select marks || '|' || owned::text from public.standing_of('${uuid(userId)}', ${id(claim)})`).split('|'); return { marks: Number(marks), owned: JSON.parse(owned) }; },
    settle: async (claim, { verified, note: why, award }) => {
      sql(`begin; update public.loot_claims set verified = ${verified ? 'true' : 'false'}, checked_at = now(), note = ${text(why)} where id = ${id(claim)};${
        award ? ` insert into public.awards (claim_id, piece, tier) values (${id(claim)}, ${text(award.piece)}, ${id(award.tier)});` : ''} commit;`);
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { DATABASE_URL: dbUrl } = process.env;
  if (!dbUrl) { console.error('verify-loot: set DATABASE_URL (the frankendom_verifier role)'); process.exit(1); }
  verifyClaims(psqlAdapter(dbUrl), { dry: process.argv.includes('--dry'), recheck: process.argv.includes('--recheck') })
    .then(receipt => { console.log(JSON.stringify({ ...receipt, at: new Date().toISOString() })); })
    .catch(error => { console.error(`verify-loot: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
}
