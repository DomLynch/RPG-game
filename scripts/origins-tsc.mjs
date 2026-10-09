// origins/ under the type-checker (Lead GO, 2026-10-09). tsconfig.json covers src only and tsconfig.tests.json adds tests + scripts, so the Zone 1 page
// (origins/preview/main.ts) was never type-checked: #2006 removed `let walkCam` while main.ts still assigned it, tsc was clean, and the page threw a
// ReferenceError every frame. This runs tsc over src + origins (tsconfig.origins.json) and fails on any error not pinned in DEBT below.
// DEBT pins today's errors per FILE and per CODE, each with an owner lane: a new error fails, a new code in a pinned file fails (fixing an unused name
// cannot make room for a "cannot find name"), and a pin above today's count fails too, so the list only shrinks (as tests/origins-flow-boundary.test.ts).
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEBT = {
  // K2d leftovers: 8 unused names (TS6133); :522 `mobs` possibly null is guarded at runtime (the handler returns on why = 'no-mobs') but not narrowed for tsc.
  'origins/preview/main.ts': { owner: 'Combat & Specials', codes: { TS6133: 8, TS18047: 1 } },
  // :194 imports ./vite.config.mjs, which has no declaration file.
  'origins/preview/save.test.ts': { owner: 'Duels & Backend', codes: { TS7016: 1 } },
};

/** tsc --pretty false lines -> { file: { code: count } }. */
export function countErrors(output) {
  const counts = {};
  for (const m of output.matchAll(/^(.+?)\(\d+,\d+\): error (TS\d+):/gm)) {
    const at = (counts[m[1]] ??= {});
    at[m[2]] = (at[m[2]] ?? 0) + 1;
  }
  return counts;
}

/** What is wrong against the pins: errors over a pin (or unpinned), and pins above today's count (lower them). Empty = pass. */
export function judge(counts, debt = DEBT) {
  const over = [], stale = [];
  for (const [file, codes] of Object.entries(counts)) for (const [code, n] of Object.entries(codes)) {
    const pin = debt[file]?.codes[code] ?? 0;
    if (n > pin) over.push(`${file} ${code}: ${n} errors, pinned ${pin}`);
  }
  for (const [file, { owner, codes }] of Object.entries(debt)) for (const [code, pin] of Object.entries(codes)) {
    const n = counts[file]?.[code] ?? 0;
    if (n < pin) stale.push(`${file} ${code}: ${n} errors, pinned ${pin} (${owner}): lower the pin in scripts/origins-tsc.mjs so it cannot come back`);
  }
  return { over, stale };
}

function main() {
  const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.origins.json', '--pretty', 'false'], { encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`;
  if (run.status !== 0 && !/error TS\d+:/.test(output)) { console.error(output); process.exit(1); }   // tsc failed without a type error (config, crash)
  const { over, stale } = judge(countErrors(output));
  for (const line of over) console.error(`NEW  ${line}`);
  for (const line of stale) console.error(`DOWN ${line}`);
  if (over.length) console.error(output.split('\n').filter((l) => over.some((o) => l.startsWith(o.split(' ')[0]))).join('\n'));
  if (over.length || stale.length) process.exit(1);
  const pinned = Object.values(DEBT).reduce((n, { codes }) => n + Object.values(codes).reduce((a, b) => a + b, 0), 0);
  console.log(`origins tsc: no new errors (${pinned} pinned in ${Object.keys(DEBT).length} files)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
