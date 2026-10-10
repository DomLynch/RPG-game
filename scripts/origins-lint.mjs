// origins/ under eslint as a ratchet (Lead GO, 2026-10-09). CI's `eslint src` never looked at origins/, so 13 errors in 6 files had piled up there unseen (prefer-const, unused
// names, an unused expression in the writer's db.ts). This runs eslint over origins/ and fails on any error not pinned in DEBT below. Same rules as scripts/origins-tsc.mjs (its
// judge() is reused): pins per FILE and per RULE, each with an owner lane; a new error fails, a new rule in a pinned file fails, and a pin above today's count fails, so it only shrinks.
import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { judge } from './origins-tsc.mjs';

export const DEBT = {
  // K2d leftovers (the same eight names the tsc ratchet pins as TS6133).
  'origins/preview/main.ts': { owner: 'Combat & Specials', codes: { '@typescript-eslint/no-unused-vars': 8 } },
  'origins/combat/zone1.test.ts': { owner: 'Combat & Specials', codes: { '@typescript-eslint/no-unused-vars': 1 } },
  'origins/preview/gear-mount.ts': { owner: 'Web & UI', codes: { 'prefer-const': 1 } },
  'origins/preview/leave-entry.test.ts': { owner: 'Web & UI', codes: { '@typescript-eslint/no-unused-vars': 2 } },   // :46 and :72 (`made` used only as a type; the second came with #2034)
  'origins/preview/mobs.ts': { owner: 'World, Pit & Audio', codes: { '@typescript-eslint/no-unused-vars': 1 } },
  'origins/server/db.ts': { owner: 'Duels & Backend', codes: { '@typescript-eslint/no-unused-expressions': 1 } },
  // Arrived with batch O's zone PRs (#2025/#2033): `_resolved` at :35 (Lead 2026-10-09: pin it, World removes it).
  'origins/zones/loader.ts': { owner: 'World, Pit & Audio', codes: { '@typescript-eslint/no-unused-vars': 1 } },
};

/** eslint --format json -> { file (repo-relative): { rule: count } }, errors only (severity 2); a parse error has no rule and counts as 'parse'. */
export function countLint(report, root = process.cwd()) {
  const counts = {};
  for (const f of report) for (const m of f.messages) {
    if (m.severity !== 2) continue;
    const file = relative(root, f.filePath).split('\\').join('/'), rule = m.ruleId ?? 'parse', at = (counts[file] ??= {});
    at[rule] = (at[rule] ?? 0) + 1;
  }
  return counts;
}

function main() {
  const run = spawnSync('npx', ['eslint', 'origins', '--format', 'json'], { encoding: 'utf8', timeout: 300_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 });   // ~8 s on the VPS
  let report;
  try { report = JSON.parse(run.stdout); } catch { console.error(run.error?.message ?? '', run.stderr, run.stdout.slice(0, 2000)); process.exit(1); }   // a timeout, a crash or a config error: no verdict
  const counts = countLint(report), { over, stale } = judge(counts, DEBT, 'scripts/origins-lint.mjs');
  for (const line of over) console.error(`NEW  ${line}`);
  for (const line of stale) console.error(`DOWN ${line}`);
  for (const f of report) for (const m of f.messages) if (m.severity === 2 && over.some((o) => o.startsWith(`${relative(process.cwd(), f.filePath)} ${m.ruleId ?? 'parse'}:`)))
    console.error(`${relative(process.cwd(), f.filePath)}:${m.line}:${m.column} ${m.ruleId ?? 'parse'} ${m.message}`);
  if (over.length || stale.length) process.exit(1);
  const pinned = Object.values(DEBT).reduce((n, { codes }) => n + Object.values(codes).reduce((a, b) => a + b, 0), 0);
  console.log(`origins lint: no new errors (${pinned} pinned in ${Object.keys(DEBT).length} files)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
