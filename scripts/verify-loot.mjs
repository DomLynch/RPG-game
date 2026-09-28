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
//
// HELD (Strategy/Lead 2026-09-29, until every claim is v20+). Two refusals of a record up to v19 are HELD, never lost:
//   - divergence: a v≤19 record steps the sim with the engine's own Math.*, which differs by an ulp between the player's browser and
//     this Node, so its replay can diverge from a win the browser really played;
//   - reach: a later bump changed that opponent's fight (record.ts "version N is not supported for the <opponent> from level L"), so
//     a claim still pending when that bump publishes can no longer be read here at all.
// Such a refusal is settled as today but its note starts `HELD v<n>:` (`HELD v<n>: reach:` for the second), it is reported to Sentry
// (SENTRY_DSN in verifier.env; silent without it), and it is cleared by hand only. RUNBOOK: Backend replays the record headless in
// Chromium and WebKit on the LAST build that reads it (for divergence the deployed build; for reach the revision before the bump,
// e.g. fc2254aa for bump 20), and on that same checkout runs its own `refusal(row, standing)` with the account's standing_of: it must
// be null or a divergence. If a browser reaches the recorded win at the recorded tick, Deploy runs
// `node scripts/verify-loot.mjs --accept <id> --engines "<engines> @<tick> on <rev>"`, which re-runs every check this build can
// (all but the replay; for a reach hold the header's opponent and outcome, the level floor on <rev>) and settles it as a win. Never from a cron. A claim left unchecked over 10
// minutes is reported once per new claim.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { awardFor, levelRefusal } from '../src/awards.ts';
import { verifyRecord } from '../src/replay.ts';
import { decodeRecord } from '../src/record.ts';
import { peekRecordHeader } from '../src/record-header.ts';

const LIMIT = 200;
const UUID = /^[0-9a-f-]{36}$/i;
export const HELD_MAX_VERSION = 19;
const REACH = /version (\d+) is not supported for the \S+ from level/;   // record.ts's refusal of a version a later bump changed
// Not covered: a bump that drops 19 from READABLE_VERSIONS altogether refuses a still-pending v19 claim with the plain "version 19 is not
// supported (this build reads …)", so it is not HELD — keep pending = 0 before such a publish (Deploy's pre-publish check).
const ENGINES = /^[a-z][a-z+,]* @\d+ on [0-9a-f]{7,40}$/;   // --engines: "chromium+webkit @1800 on fc2254aa"   // the last record version whose sim reads the engine's own Math.* (v20+: detmath, engine-independent)
const STALE_MINUTES = 10;
const note = text => text.replace(/[^\x20-\x7e]/g, '?').slice(0, 200);   // loot_claims.note: at most 200 bytes

// One sweep over `db` ({ pending, waiting, standing, settle } — see psqlAdapter).
export async function verifyClaims(db, { dry = false, recheck = false, heldMax = HELD_MAX_VERSION } = {}) {
  const rows = await db.pending(LIMIT, recheck);
  /** @type {{ checked: number, verified: number, awarded: number, waiting: number, refused: { id: number, reason: string }[], held: { id: number, version: number, opponent: string, reason: string }[], unawarded: { id: number, reason: string }[], errors: { id: number, error: string }[], dry: boolean }} */
  const receipt = { checked: 0, verified: 0, awarded: 0, waiting: 0, refused: [], held: [], unawarded: [], errors: [], dry };
  for (const row of rows) {
    try { await settleOne(db, row, receipt, dry, heldMax); } catch (error) { receipt.errors.push({ id: row.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return receipt;
}

async function settleOne(db, row, receipt, dry, heldMax) {
  {
    if (await db.waiting(row.id)) { receipt.waiting++; return; }
    receipt.checked++;
    const standing = await db.standing(row.user_id, row.id);   // the account's server standing BEFORE this claim: the level floor and the award read it
    const reason = await refusal(row, standing, { heldMax });
    if (reason) {
      receipt.refused.push({ id: row.id, reason });
      const held = /^HELD v(\d+):/.exec(reason);
      if (held) receipt.held.push({ id: row.id, version: Number(held[1]), opponent: row.opponent, reason });
      if (!dry) await db.settle(row.id, { verified: false, note: note(reason), award: null });
      return;
    }
    const award = awardFor({ opponent: row.opponent, piece: row.piece }, standing);
    receipt.verified++;
    if (typeof award === 'string') receipt.unawarded.push({ id: row.id, reason: award });
    else if (award) receipt.awarded++;
    if (!dry) await db.settle(row.id, { verified: true, note: typeof award === 'string' ? note(award) : null, award: typeof award === 'string' ? null : award });
  }
}

// Why a claim is not a verified win, or null when the replay proves it. Never throws: a throw is a refusal. `standing`: the account's
// server standing before this claim; the level the win was fought at must clear its dial floor (src/awards.ts levelRefusal).
// A replay that diverges on a record up to HELD_MAX_VERSION is HELD (header); every other reason stays plain. `replay: false` is
// --accept's path: every check but the replay.
export async function refusal(row, standing, { replay = true, heldMax = HELD_MAX_VERSION } = {}) {
  try {
    const record = await decodeRecord(row.record);
    if (record.opponent !== row.opponent) return `record is against ${record.opponent}, claim says ${row.opponent}`;
    if (record.outcome !== 'killed') return `record outcome is ${record.outcome}, not a win`;
    const low = levelRefusal(record.level, standing.marks);
    if (low) return low;
    if (!replay) return null;
    const result = verifyRecord(record);
    // Only a replay that stepped and then diverged can pass a browser hand-check; an unknown opponent or a record this build cannot
    // step (practice null) is a plain refusal whatever its version.
    return result.ok ? null : result.practice && record.v <= heldMax ? `HELD v${record.v}: ${result.reason}` : result.reason;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error), reach = REACH.exec(message);
    return reach && Number(reach[1]) <= heldMax ? `HELD v${reach[1]}: reach: ${message}` : `unreadable record: ${message}`;
  }
}

// The runbook's manual grant for a HELD claim that a real browser engine replayed to its win (header). Refuses anything not HELD and
// anything past HELD_MAX_VERSION (a v20+ miss is a real refusal); re-runs every check but the replay; settles it as a sweep settles a
// win, with the audit line appended to its note. Returns the settle, or throws with the reason nothing was written.
export async function acceptHeld(db, id, engines, { now = new Date(), heldMax = HELD_MAX_VERSION } = {}) {
  if (!ENGINES.test(engines ?? '')) throw Error('--accept needs --engines "<engines that reached the win> @<tick> on <rev>", e.g. "chromium+webkit @1800 on fc2254aa"');
  const row = await db.claim(id);
  if (!row) throw Error(`claim ${id} not found`);
  if (row.verified || !/^HELD v\d+:/.test(row.note ?? '')) throw Error(`claim ${id} is not HELD (verified ${row.verified}, note ${JSON.stringify(row.note)})`);
  const reachHeld = /^HELD v\d+: reach:/.test(row.note);
  let record = null;
  try { record = await decodeRecord(row.record); } catch (error) { if (!reachHeld) throw error; }   // a divergence hold that no longer decodes: refused, nothing written
  // A reach hold cannot decode here: its header still names the opponent and the outcome (the level floor is the runbook's, on <rev>).
  const header = record ? null : await peekRecordHeader(row.record);
  if (!record && !header) throw Error(`claim ${id} is a reach hold with no readable record header`);
  if (header && header.opponent !== row.opponent) throw Error(`claim ${id} fails a check other than the replay: record is against ${header.opponent}, claim says ${row.opponent}`);
  if (header && header.outcome !== 'killed') throw Error(`claim ${id} fails a check other than the replay: record outcome is ${header.outcome}, not a win`);
  const version = record ? record.v : header.v;
  if (!(version <= heldMax)) throw Error(`claim ${id} is a v${version} record: its replay is engine-independent, so its refusal stands`);
  const standing = await db.standing(row.user_id, row.id);
  const reason = record ? await refusal(row, standing, { replay: false }) : null;
  if (reason) throw Error(`claim ${id} fails a check other than the replay: ${reason}`);
  const award = awardFor({ opponent: row.opponent, piece: row.piece }, standing);
  const audit = note(`ACCEPTED ${now.toISOString()} by runbook: ${engines}${typeof award === 'string' ? `; ${award}` : ''}`);
  const outcome = { verified: true, note: note(`${row.note.slice(0, Math.max(0, 200 - audit.length - 3))} | ${audit}`), award: typeof award === 'string' ? null : award };
  await db.settle(row.id, outcome);
  return outcome;
}

// Sentry (header): one event per HELD claim and one per NEWLY stale unchecked claim (the highest id already reported lives in
// `stateFile`, so a claim stuck for an hour is one event, not thirty). No DSN: nothing is sent and the receipt says so.
/**
 * @param {{ held: { id: number, version: number, opponent: string, reason: string }[] }} receipt
 * @param {number[]} stale
 * @param {{ dsn?: string, stateFile?: string, release?: string, now?: Date,
 *   send?: (url: string, init: { method: string, body: string, signal: AbortSignal }) => Promise<{ ok: boolean, status: number }> }} [options]
 */
export async function report(receipt, stale, { dsn, stateFile, release, send = fetch, now = new Date() } = {}) {
  if (!dsn) return { sent: 0, skipped: 'no SENTRY_DSN' };
  if (!stateFile) stale = [];   // a hand sweep outside systemd has no memory of what it reported: it reports HELD claims only
  let seen = 0;
  try { seen = Number(readFileSync(stateFile, 'utf8')) || 0; } catch { /* first run */ }
  const fresh = stale.filter(id => id > seen);
  const events = [
    ...receipt.held.map(h => ({ message: `loot claim ${h.id} HELD: v${h.version} replay diverged in the verifier`, level: 'warning', tags: { claim_id: String(h.id), record_version: String(h.version), opponent: h.opponent, reason: h.reason.slice(0, 200) } })),
    ...(fresh.length ? [{ message: `${fresh.length} loot claim(s) unchecked over ${STALE_MINUTES} minutes`, level: 'error', tags: { claim_ids: fresh.join(',').slice(0, 200) } }] : []),
  ];
  const { host, pathname, username } = new URL(dsn), project = pathname.replace(/^\//, '');
  let sent = 0;
  for (const event of events) {
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const body = [JSON.stringify({ event_id: eventId, dsn, sent_at: now.toISOString() }), JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: eventId, timestamp: now.getTime() / 1000, platform: 'node', logger: 'verify-loot', environment: 'production', release, ...event, message: { formatted: event.message } })].join('\n');
    const res = await send(`https://${host}/api/${project}/envelope/?sentry_key=${username}&sentry_version=7`, { method: 'POST', body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw Error(`sentry: HTTP ${res.status}`);
    sent++;
  }
  if (fresh.length && stateFile) writeFileSync(stateFile, String(Math.max(...fresh)));
  return { sent };
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
    claim: async claim => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (select id, user_id::text, opponent, piece, record, verified, note from public.loot_claims where id = ${id(claim)}) r`))[0] ?? null,
    stale: async () => JSON.parse(sql(`select coalesce(json_agg(id order by id), '[]') from public.loot_claims where checked_at is null and created_at < now() - interval '${STALE_MINUTES} minutes'`)),
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
  const db = psqlAdapter(dbUrl), arg = flag => { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; };
  const accept = arg('--accept');
  (accept !== undefined
    ? acceptHeld(db, Number(accept), arg('--engines')).then(outcome => { console.log(JSON.stringify({ accepted: Number(accept), ...outcome, at: new Date().toISOString() })); })
    : verifyClaims(db, { dry: process.argv.includes('--dry'), recheck: process.argv.includes('--recheck') }).then(async receipt => {
      let sentry = { skipped: 'dry run' };
      if (!receipt.dry) try {
        sentry = await report(receipt, await db.stale(), { dsn: process.env.SENTRY_DSN, stateFile: process.env.STATE_DIRECTORY && join(process.env.STATE_DIRECTORY, 'stale-reported'), release: basename(realpathSync(process.cwd())) });   // the revision `current` points at
      } catch (error) { sentry = { error: error instanceof Error ? error.message : String(error) }; }
      console.log(JSON.stringify({ ...receipt, sentry, at: new Date().toISOString() }));
    }))
    .catch(error => { console.error(`verify-loot: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
}
