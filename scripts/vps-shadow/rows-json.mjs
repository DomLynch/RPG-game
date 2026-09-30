// Writes <run>/rows.json on the VPS after run-rows.sh: one entry per release row (pass/fail/ceiling, seconds, attempts, the pins its
// log printed) plus the run's provenance. cwd is the repo checkout. Every row of .quality-gate.json appears, so a row the log never
// mentions (the build failed, the run was killed) reads `status: "missing"` rather than vanishing from the table.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPins, parseRowsLog, rowSet } from './rows-lib.mjs';

const [run, ...rest] = process.argv.slice(2);
if (!run) throw new Error('usage: rows-json.mjs <run dir> --sha … --tree … [--key value …]');
const meta = {};
for (let i = 0; i < rest.length; i += 2) meta[rest[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = rest[i + 1];
const commands = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const set = rowSet(commands);
const log = existsSync(join(run, 'rows.log')) ? readFileSync(join(run, 'rows.log'), 'utf8') : '';
const parsed = parseRowsLog(log);
const byIndex = new Map(parsed.rows.map(r => [r.index, r]));
const logsDir = join(run, 'logs');
const logFor = index => (existsSync(logsDir) ? readdirSync(logsDir).find(f => f.startsWith(`${String(index).padStart(2, '0')}-`)) : undefined);
const rows = set.map(row => {
  const result = byIndex.get(row.index);
  const file = logFor(row.index);
  const pins = file ? extractPins(readFileSync(join(logsDir, file), 'utf8')) : [];
  return { ...row, status: result?.status ?? 'missing', seconds: result?.seconds ?? 0, attempts: result?.attempts ?? 0, ...(result?.exit !== undefined ? { exit: result.exit } : {}), ...(file ? { log: `logs/${file}` } : {}), pins };
});
const summary = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
const wall = /Release checks wall time (\d+)s/.exec(log);
const out = {
  kind: 'vps-shadow-rows', host: 'Brain (49.12.7.18)', runner: 'linux-x64', ...meta,
  buildStatus: Number(meta.buildStatus ?? 0), rowsStatus: Number(meta.rowsStatus ?? 0), wall: Number(meta.wall ?? 0), dirty: Number(meta.dirty ?? 0),
  rowsWallSeconds: wall ? Number(wall[1]) : null, total: set.length, summary, rows,
};
writeFileSync(join(run, 'rows.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`rows.json: ${set.length} rows — ${Object.entries(summary).map(([k, n]) => `${n} ${k}`).join(', ')}`);
