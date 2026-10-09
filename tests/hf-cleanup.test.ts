import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { costOf, ledgerJobs } from '../scripts/hf-cleanup.mjs';

// A fake hf: `jobs inspect <id>` answers from a state file (RUNNING until cancelled), `jobs cancel <id>` records and flips it.
const setup = (jobs: { id: string; flavor: string; stage: string; stuck?: boolean }[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'hf-cleanup-'));
  const state = join(dir, 'state.json'), cancelled = join(dir, 'cancelled'), ledgerDir = join(dir, 'ledger');
  writeFileSync(state, JSON.stringify(jobs));
  mkdirSync(ledgerDir);
  writeFileSync(join(ledgerDir, 'abc.ledger'), jobs.map(j => `${j.id} 1200\n`).join(''));
  const fake = join(dir, 'hf');
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require('fs'); const [, , , verb, id] = process.argv; const jobs = JSON.parse(fs.readFileSync(${JSON.stringify(state)}, 'utf8'));
const job = jobs.find(j => j.id === id);
if (verb === 'cancel') { fs.appendFileSync(${JSON.stringify(cancelled)}, id + '\\n'); if (job && !job.stuck) job.stage = 'CANCELED'; fs.writeFileSync(${JSON.stringify(state)}, JSON.stringify(jobs)); }
else if (verb === 'inspect') console.log(JSON.stringify([{ id, flavor: job.flavor, created_at: new Date(Date.now() - 600000).toISOString().replace('T', ' '), status: { stage: job.stage } }]));
`);
  chmodSync(fake, 0o755);
  const run = () => spawnSync(process.execPath, ['scripts/hf-cleanup.mjs'], { encoding: 'utf8', env: { ...process.env, HF_BIN: fake, HF_LEDGER_DIR: ledgerDir } });
  return { run, cancelled, ledgerDir };
};
const A = 'a'.repeat(24), B = 'b'.repeat(24);

test('a release that left jobs running cancels them and logs "0 running"; the ledger is retired so the next release counts only its own jobs', () => {
  const t = setup([{ id: A, flavor: 't4-medium', stage: 'RUNNING' }, { id: B, flavor: 'cpu-upgrade', stage: 'COMPLETED' }]);
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^HF: 2 jobs, 0 running, <=\$0\.\d\d$/m);
  assert.equal(readFileSync(t.cancelled, 'utf8').trim(), A, 'only the running job is cancelled');
  assert.ok(!existsSync(join(t.ledgerDir, 'abc.ledger')) && existsSync(join(t.ledgerDir, 'abc.done')));
});

test('a job that survives the cancel is a RED LINE and exit 1 (nothing is left running, or the log says so)', () => {
  const t = setup([{ id: A, flavor: 't4-medium', stage: 'RUNNING', stuck: true }]);
  const r = t.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RED LINE HF: 1 jobs, 1 running/);
});

test('cost is an upper bound: price x min(age, the job\'s own timeout); the ledger parser keeps only 24-hex ids', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  assert.equal(costOf({ flavor: 't4-medium', created_at: '2026-10-09 11:00:00+00:00' }, 1200, now).toFixed(2), '0.20');   // capped at 20 min
  assert.equal(costOf({ flavor: 'cpu-upgrade', created_at: '2026-10-09 11:50:00+00:00' }, 0, now).toFixed(4), '0.0050');
  assert.deepEqual(ledgerJobs(`${A} 1200\nnot-an-id 5\n\n`), [{ id: A, timeoutS: 1200 }]);
});
