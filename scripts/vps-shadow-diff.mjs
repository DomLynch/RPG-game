// Per-row comparison of a Mac release run against the VPS shadow run of the same sha (Lead 2026-09-30: a table, not a "looks fine").
//   node scripts/vps-shadow-diff.mjs --mac ~/Developer/deploy-<sha8>.log --vps artifacts/vps-shadow/<sha>/rows.json [--mac-logs <dir>]
// --mac: the Mac's deploy log (deploy.sh streams release-checks.mjs's lines into it) or its artifacts/release-checks.json receipt.
// --vps: rows.json written by scripts/vps-shadow/rows-json.mjs and fetched by scripts/vps-shadow-rows.sh --fetch (its logs/ sit beside it).
// --mac-logs: the Mac's artifacts/release-checks/ directory from that run, when Deploy kept it; gives the Mac side its pin values.
// Prints a markdown table (row, Mac result, VPS result, pin Mac, pin VPS, verdict) and a tally line. Exit 0 when every row read the same,
// 3 when any row differs, 4 when a side is missing rows (a Mac run with trusted rows compares nothing for them).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { diffTable, extractPins, macRows } from './vps-shadow/rows-lib.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const macPath = opt('mac'), vpsPath = opt('vps');
if (!macPath || !vpsPath) { console.error('usage: vps-shadow-diff.mjs --mac <deploy log | release-checks.json> --vps <rows.json> [--mac-logs <dir>]'); process.exit(2); }

const mac = macRows(readFileSync(macPath, 'utf8'));
const vpsJson = JSON.parse(readFileSync(vpsPath, 'utf8'));
const vps = { total: vpsJson.total, revision: vpsJson.sha, rows: vpsJson.rows.filter(r => r.status !== 'missing') };

const pinsFromDir = dir => {
  const map = new Map();
  if (!dir || !existsSync(dir)) return map;
  for (const file of readdirSync(dir)) {
    const m = /^(\d+)-/.exec(file);
    if (m) map.set(Number(m[1]), extractPins(readFileSync(join(dir, file), 'utf8')));
  }
  return map;
};
const pins = {
  mac: pinsFromDir(opt('mac-logs')),
  vps: new Map(vpsJson.rows.map(r => [r.index, r.pins?.length ? r.pins : (r.log ? extractPins(readFileSync(join(dirname(vpsPath), r.log), 'utf8')) : [])])),
};

const { lines, tally } = diffTable(mac, vps, pins);
const sha = s => (s ? s.slice(0, 8) : '?');
console.log(`Shadow rows: Mac ${sha(mac.revision)} vs VPS ${sha(vps.revision)}${mac.revision && vps.revision && mac.revision !== vps.revision ? '  ** DIFFERENT SHA **' : ''}` +
  ` — VPS node ${vpsJson.node ?? '?'}, playwright ${vpsJson.playwright ?? '?'}, rows wall ${vpsJson.rowsWallSeconds ?? '?'}s, load ${vpsJson.load ?? '?'}`);
console.log(lines.join('\n'));
const missing = vpsJson.rows.filter(r => r.status === 'missing').length;
console.log(`\n${tally.same} same, ${tally.differs} differ, ${tally.timingDiffers} differ but timing-sensitive (wall clock), ${tally.missing} not comparable${missing ? ` (${missing} VPS rows never ran)` : ''}, ${tally.flagged} flagged (Linux WebKit ≠ Mac Safari); Mac ${mac.rows.length}/${mac.total || '?'} rows read, VPS ${vps.rows.length}/${vps.total} rows read.`);
process.exit(tally.differs ? 3 : tally.missing || missing ? 4 : 0);
