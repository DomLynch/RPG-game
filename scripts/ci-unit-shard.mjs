// node scripts/ci-unit-shard.mjs <log> <shard> <of> <exit> <seconds> <out.json>: one shard's node:test summary as JSON (unit-ci.yml).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseShard } from './lib/ci-unit.mjs';

const [log, shard, of, exit, seconds, out] = process.argv.slice(2);
writeFileSync(out, JSON.stringify(parseShard({ log: readFileSync(log, 'utf8'), shard: Number(shard), of: Number(of), exit: Number(exit), seconds: Number(seconds) })));
