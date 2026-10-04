// Usage: node scripts/sim-bot.mjs --sparring-url='/?spar=1&opponent=pitborn&difficulty=6&weapon=longsword&skill=none&special=none&yourSpecial=none' --fights=3
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { nextSeed } from '../src/match.ts';
import { runFight, strategyNames } from './lib/sim-bot.mjs';

const { values } = parseArgs({ options: {
  'sparring-url': { type: 'string' }, strategy: { type: 'string', default: 'light spam' },
  fights: { type: 'string', default: '3' }, seed: { type: 'string', default: '20261004' }, ticks: { type: 'string', default: '7200' },
  out: { type: 'string', default: 'artifacts/combat/sim-bot' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('Direct engine, no browser. Required: --sparring-url=<copied Start sparring URL>. Optional: --strategy=<name> --fights=3 --seed=20261004 --ticks=7200 --out=<directory>.');
  console.log('Strategies:', strategyNames.join(', '));
} else {
  if (!values['sparring-url']) throw new Error('Supply --sparring-url; never infer the engine level from the displayed rank');
  const fights = Number(values.fights), ticks = Number(values.ticks);
  let seed = Number(values.seed);
  if (!Number.isInteger(fights) || fights < 1 || fights > 1000) throw new Error('Fights must be 1–1000');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const digest = createHash('sha256');
  const hashTree = dir => { for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) hashTree(path);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.json')) digest.update(relative(root, path)).update('\0').update(readFileSync(path));
  } };
  hashTree(join(root, 'src'));
  for (const file of ['scripts/sim-bot.mjs', 'scripts/lib/sim-bot.mjs', 'tests/strategies.ts']) digest.update(file).update('\0').update(readFileSync(join(root, file)));
  let revision = null;
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* staged source: content hash is authoritative */ }
  const source = { revision, contentSha256: digest.digest('hex') };
  const out = resolve(values.out, new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
  mkdirSync(out, { recursive: true });
  const rows = [];
  for (let i = 0; i < fights; i++) {
    const start = performance.now(), fight = runFight(values['sparring-url'], seed, values.strategy, ticks);
    const receipt = { ...fight, source, elapsedMs: performance.now() - start };
    writeFileSync(join(out, `${i + 1}-${seed}.json`), JSON.stringify(receipt, null, 2));
    const row = { seed, outcome: fight.outcome, attacks: fight.attacks, heavyAttacks: fight.heavyAttacks, damageTaken: fight.damageTaken, damageDealt: fight.damageDealt };
    rows.push(row); console.log(JSON.stringify(row)); seed = nextSeed(seed);
  }
  writeFileSync(join(out, 'summary.json'), JSON.stringify({ evidenceTier: 'direct-engine-no-browser', source, sparringUrl: values['sparring-url'], strategy: values.strategy, fights: rows }, null, 2));
  console.log('Receipts:', out);
}
