// node scripts/vps-receipt-trust.mjs <sha> [--unit]
//   (default) prints the trusted row numbers "1,3,7" (empty = trust nothing); every shard receipt artifacts/vps-shadow/<sha>/rows*.json counts.
//   --unit    prints "ok" when artifacts/vps-shadow/<sha>/unit.json proves test:all for this tree, else nothing.
// Says why on stderr. VPS_RECEIPT_SHA names the candidate commit the VPS ran when it differs from <sha>: the tree, not the sha, binds
// a receipt, and so do the sha256s of the runner scripts it names (they must equal this tree's own copies).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { trustedFromShards, unitReceiptOk } from './lib/vps-receipts.mjs';

const [sha, flag] = process.argv.slice(2);
const rev = spawnSync('git', ['rev-parse', `${sha}^{tree}`], { encoding: 'utf8', timeout: 10_000 });
if (rev.error || rev.status !== 0 || !rev.stdout.trim()) { console.error(`vps-receipts: git rev-parse ${sha}^{tree} failed or timed out; trusting nothing, every row runs here`); process.exit(0); }
const tree = rev.stdout.trim();
const dir = `artifacts/vps-shadow/${process.env.VPS_RECEIPT_SHA || sha}`;
// The runners are hashed from the DEPLOY commit (git show), never from this machine's working tree.
const gitShow = path => { const r = spawnSync('git', ['show', `${sha}:${path}`], { timeout: 10_000, maxBuffer: 16 << 20 }); return r.error || r.status !== 0 ? null : r.stdout; };
const own = names => { const out = {}; for (const name of names) { const text = gitShow(`scripts/vps-shadow/${name}`); if (text === null) return {}; out[name] = createHash('sha256').update(text).digest('hex'); } return out; };
// Every job a receipt names, looked up on the Hub: { <id>: inspect record }. No answer = no jobs = nothing trusted.
const inspectJobs = ids => {
  if (!ids.length) return {};
  const r = spawnSync('hf', ['jobs', 'inspect', ...ids], { encoding: 'utf8', timeout: 60_000 });
  try { return r.status === 0 ? Object.fromEntries([].concat(JSON.parse(r.stdout)).map(info => [info.id, info])) : {}; } catch { return {}; }
};
const json = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

if (flag === '--unit') {
  const receipt = json(`${dir}/unit.json`);
  const ok = unitReceiptOk(receipt, tree, own(['run-unit.sh']), inspectJobs([receipt?.job].filter(Boolean)));
  console.error(`vps-receipts: unit suite ${ok ? `trusted (${receipt.pass} pass, node ${receipt.node}, job ${receipt.job})` : 'NOT trusted (missing, other tree, failed, unnamed flavor or runner checksum mismatch); the Mac runs its own'} from ${dir}/unit.json`);
  if (ok) process.stdout.write('ok');
} else {
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^rows.*\.json$/.test(f)) : [];
  if (!files.length) { console.error(`vps-receipts: no receipt in ${dir}; every row runs here`); process.exit(0); }
  const commands = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
  const source = script => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
  const receipts = files.map(f => json(`${dir}/${f}`)).filter(Boolean);
  const trusted = trustedFromShards(receipts, tree, commands, source, own(['run-rows.sh', 'rows-json.mjs', 'rows-lib.mjs']), inspectJobs([...new Set(receipts.map(r => r.job).filter(Boolean))]));
  console.error(`vps-receipts: ${trusted.length} of ${commands.length} rows trusted from ${receipts.length} receipt(s) in ${dir} (deploy tree ${tree.slice(0, 8)})`);
  process.stdout.write(trusted.join(','));
}
