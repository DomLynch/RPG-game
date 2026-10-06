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
// Record hashes are unique in the table itself (loot_claims.record_hash), so one STRING is one claim before the sweep sees it. One FIGHT
// is one claim here (202610010001, Strategy's A+ 2026-10-01): the sweep first writes `fight_hash` (sha256 of record.ts fightBytes) on every
// claim and every shared fight still without one, then refuses a claim whose fight an earlier claim already won or is HELD on ("same fight
// as claim N"), or whose fight was first shared by another account or by a guest ("someone else's shared fight"). A guest who later signs
// in cannot claim his own earlier shared fight: the accepted beta cost. The unique index on verified claims backs the first rule.
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
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { awardFor, levelRefusal } from '../src/awards.ts';
import { verifyRecord } from '../src/replay.ts';
import { gunzipSync } from 'node:zlib';
import { decodeRecord, fromBase64Url, packRecord, RECORD_VERSION } from '../src/record.ts';
import { peekRecordHeader } from '../src/record-header.ts';

const LIMIT = 200;
const UUID = /^[0-9a-f-]{36}$/i, HEX64 = /^[0-9a-f]{64}$/, SHARE_ID = /^[A-Za-z0-9_-]{1,8}$/;
export const HELD_MAX_VERSION = 19;
const REACH = /version (\d+) is not supported for the \S+ from level/;   // record.ts's refusal of a version a later bump changed
// Not covered: a bump that drops 19 from READABLE_VERSIONS altogether refuses a still-pending v19 claim with the plain "version 19 is not
// supported (this build reads …)", so it is not HELD — keep pending = 0 before such a publish (Deploy's pre-publish check).
const ENGINES = /^[a-z][a-z+,]* @\d+ on [0-9a-f]{7,40}$/;   // --engines: "chromium+webkit @1800 on fc2254aa"   // the last record version whose sim reads the engine's own Math.* (v20+: detmath, engine-independent)
const STALE_MINUTES = 10;
const note = text => text.replace(/[^\x20-\x7e]/g, '?').slice(0, 200);   // loot_claims.note: at most 200 bytes
// The fight a record string carries, as bytes two encodings of one fight share (F2): the gzip wrapper is not canonical (header, level,
// block split) and `build` is a label the replay never reads. Decoded, the build blanked, packed again (flags re-derived, so unread flag
// bits drop too); every readable version shares the layout, so an older record packs as this build's and gets its own version byte back.
// Here, not in src/record.ts, which is sim-digested (record-version-guard): no bump for a verifier key. A record this build cannot unpack
// (a reach-refused older version) falls back to its gunzipped bytes, one that is not gzip to its own text. Never throws.
export async function fightBytes(record) {
  let raw;
  try { raw = gunzipSync(fromBase64Url(record), { maxOutputLength: 1_000_000 }); } catch { return Buffer.from(record); }
  try {
    const fight = await decodeRecord(record), bytes = packRecord({ ...fight, v: RECORD_VERSION, build: '' });
    bytes[2] = fight.v;
    return bytes;
  } catch { return raw; }
}
export const fightHash = async record => createHash('sha256').update(await fightBytes(record)).digest('hex');
const HASH_ROUNDS = 50;   // pages of LIMIT per sweep; past it the claims wait for the next sweep rather than settle before a share is hashed

// Writes fight_hash on every claim and shared fight that has none (shares first). Returns null to hold this sweep's claims (all `waiting`):
// only while a SHARE is left unhashed, since an unhashed share cannot refuse a theft of it. Otherwise the set of claims whose hash would not
// write: each holds only itself (`waiting`, never settled without its hash, so never verified outside the unique index; Auditer F1 on
// 0c2c48d9), is in the receipt's errors every sweep, and every other claim settles. The one expected case is two claims already verified before 202610010001
// that carry one fight: the unique index refuses the later one's hash. Runbook: keep the earlier claim (created_at, id); the later one is
// the re-encoded copy, and Deploy, on Dom's word (it deletes a mark and its award), runs as owner
// `delete from public.loot_claims where id = <later id>;` (its award goes with it, on delete cascade).
async function hashAll(db, receipt) {
  const failed = new Set();
  for (let round = 0; round < HASH_ROUNDS; round++) {
    const rows = (await db.unhashed(LIMIT + failed.size)).filter(row => !failed.has(`${row.kind}:${row.id}`));
    for (const row of rows) {
      try { await db.hash(row.kind, row.id, await fightHash(row.record)); receipt.hashed++; } catch (error) {
        receipt.errors.push({ id: row.id, error: `${row.kind} hash: ${error instanceof Error ? error.message : String(error)}` });
        if (row.kind === 'share') return null;
        failed.add(`${row.kind}:${row.id}`);
      }
    }
    if (rows.length < LIMIT) return failed;
  }
  return null;
}

// Why a claim's fight is not his to claim, or null. Two encodings of one fight share a fight_hash; see the header.
export async function duplicate(db, row) {
  const { claim, shared } = await db.twin(row.id, await fightHash(row.record));
  if (claim) return `same fight as claim ${claim}`;
  if (shared && shared.owner !== row.user_id) return "someone else's shared fight";
  return null;
}

// One sweep over `db` ({ pending, waiting, standing, settle } — see psqlAdapter).
export async function verifyClaims(db, { dry = false, recheck = false, heldMax = HELD_MAX_VERSION } = {}) {
  const rows = await db.pending(LIMIT, recheck);
  /** @type {{ checked: number, verified: number, awarded: number, waiting: number, hashed: number, refused: { id: number, reason: string }[], held: { id: number, version: number, opponent: string, reason: string }[], unawarded: { id: number, reason: string }[], errors: { id: number, error: string }[], dry: boolean }} */
  const receipt = { checked: 0, verified: 0, awarded: 0, waiting: 0, hashed: 0, refused: [], held: [], unawarded: [], errors: [], dry };
  const unhashed = dry ? new Set() : await hashAll(db, receipt);   // a dry sweep reads the hashes already written
  if (!unhashed) { receipt.waiting += rows.length; return receipt; }
  for (const row of rows) {
    if (unhashed.has(`claim:${row.id}`)) { receipt.waiting++; continue; }
    try { await settleOne(db, row, receipt, dry, heldMax); } catch (error) { receipt.errors.push({ id: row.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return receipt;
}

async function settleOne(db, row, receipt, dry, heldMax) {
  {
    if (await db.waiting(row.id)) { receipt.waiting++; return; }
    receipt.checked++;
    const standing = await db.standing(row.user_id, row.id);   // the account's server standing BEFORE this claim: the level floor and the award read it
    const reason = (await duplicate(db, row)) ?? (await refusal(row, standing, { heldMax }));   // a duplicate is never replayed, so never HELD
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
    const low = levelRefusal(record.level, standing.marks, record.v);
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
  const reason = (await duplicate(db, row)) ?? (record ? await refusal(row, standing, { replay: false }) : null);
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
// awards, execute standing_of; 202610010001: fight_hash on loot_claims and fight_records, and a shared fight's owner and age). Values are validated or reduced to digits before they are quoted into SQL.
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
    unhashed: async limit => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (select * from (select 'share' as kind, id, record from public.fight_records where fight_hash is null order by created_at, id limit ${Number(limit)}) s union all select * from (select 'claim', id::text, record from public.loot_claims where fight_hash is null order by id limit ${Number(limit)}) c limit ${Number(limit)}) r`)),
    hash: async (kind, key, fight) => {
      if (!HEX64.test(fight)) throw Error(`refusing to write a malformed fight hash: ${JSON.stringify(fight)}`);
      if (kind === 'claim') sql(`update public.loot_claims set fight_hash = '${fight}' where id = ${id(Number(key))}`);
      else if (kind === 'share' && SHARE_ID.test(key)) sql(`update public.fight_records set fight_hash = '${fight}' where id = '${key}'`);
      else throw Error(`refusing to hash a malformed row: ${JSON.stringify([kind, key])}`);
    },
    twin: async (claim, fight) => {
      if (!HEX64.test(fight)) throw Error(`refusing to query with a malformed fight hash: ${JSON.stringify(fight)}`);
      return JSON.parse(sql(`select json_build_object('claim', (select id from public.loot_claims where fight_hash = '${fight}' and id <> ${id(claim)} and (verified or note like 'HELD v%') order by created_at, id limit 1), 'shared', (select json_build_object('owner', user_id) from public.fight_records where fight_hash = '${fight}' order by created_at, id limit 1))`));
    },
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
