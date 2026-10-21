// node scripts/ci-unit-receipt.mjs <dir of shard-*.json> <out.json> (unit-ci.yml's last job): sums the shards into the receipt and prints it as `RECEIPT {json}`.
// Exit 1 and the reason on stderr unless all shards are present and green. The tree is read from git for GITHUB_SHA-independent SHA in $UNIT_SHA, never from the shards.
import { NODE_PIN } from './lib/vps-unit.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildReceipt, latestShardFiles } from './lib/ci-unit.mjs';

const [dir, out] = process.argv.slice(2);
const sha = process.env.UNIT_SHA;
// One dir per downloaded artifact (unit-shard-<n>-a<attempt>/shard-<n>.json), or flat files; only each shard's latest attempt is read (lib/ci-unit.mjs latestShardFiles).
const found = readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? readdirSync(`${dir}/${e.name}`).map((f) => `${e.name}/${f}`) : [e.name]));
const shards = latestShardFiles(found).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const tree = execFileSync('git', ['rev-parse', `${sha}^{tree}`], { encoding: 'utf8', timeout: 10_000 }).trim();
const r = buildReceipt({ shards, sha, tree, runId: process.env.GITHUB_RUN_ID, node: NODE_PIN.version, repo: process.env.GITHUB_REPOSITORY });
if (!r.ok) { console.error(`unit receipt refused: ${r.reason}`); process.exit(1); }
writeFileSync(out, JSON.stringify(r.receipt));
console.log(`RECEIPT ${JSON.stringify(r.receipt)}`);
