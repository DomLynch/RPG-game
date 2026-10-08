// node scripts/vps-receipt-trust.mjs <sha> -> prints the trusted row numbers "1,3,7" (empty = trust nothing) and says why on stderr.
// Reads artifacts/vps-shadow/<sha>/rows.json (scripts/vps-shadow-rows.sh <sha> --fetch). VPS_RECEIPT_SHA names the candidate commit the
// VPS ran when it differs from <sha> (a candidate merge with the same tree): the tree, not the sha, is what binds the receipt.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { trustedFromVps } from './lib/vps-receipts.mjs';

const sha = process.argv[2];
const tree = spawnSync('git', ['rev-parse', `${sha}^{tree}`], { encoding: 'utf8' }).stdout.trim();
const file = `artifacts/vps-shadow/${process.env.VPS_RECEIPT_SHA || sha}/rows.json`;
if (!existsSync(file)) { console.error(`vps-receipts: no receipt at ${file}; every row runs here`); process.exit(0); }
const commands = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = script => { try { return readFileSync(script, 'utf8'); } catch { return ''; } };
const receipt = JSON.parse(readFileSync(file, 'utf8'));
const trusted = trustedFromVps(receipt, tree, commands, source);
console.error(`vps-receipts: ${trusted.length} of ${commands.length} rows trusted from ${file} (receipt tree ${String(receipt.tree).slice(0, 8)} vs deploy tree ${tree.slice(0, 8)})`);
process.stdout.write(trusted.join(','));
