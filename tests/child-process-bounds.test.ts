// Ratchet: no NEW unbounded synchronous child processes in scripts/. Deploy #71 (2026-09-21) sat an hour in a jpegtran with no timeout
// anywhere in its chain. Every execFileSync / execSync / spawnSync added from now on must pass `timeout:`; the sites below predate the
// rule and are debt to burn down (a file's count may only fall). Async spawn/exec are covered by the release-check and deploy ceilings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const KNOWN: Record<string, number> = {
  'scripts/account-browser-check.mjs': 1, 'scripts/account-database-check.mjs': 1, 'scripts/arena-audio-check.mjs': 3,
  'scripts/arena-closeup.mjs': 1, 'scripts/arena-preview.mjs': 1, 'scripts/audio-preview.mjs': 1, 'scripts/build-arena-audio.mjs': 3,
  'scripts/build-audio.mjs': 3, 'scripts/build-creatures.mjs': 2, 'scripts/build-player-weapon.mjs': 2, 'scripts/character-preview.mjs': 1,
  'scripts/ci-trusted-checks.mjs': 2, 'scripts/finisher-preview.mjs': 1, 'scripts/impact-preview.mjs': 1, 'scripts/release-checks.mjs': 2,
};
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : p.endsWith('.mjs') ? [p] : []; });
// A call is bounded when `timeout:` appears inside its argument list (balanced parentheses from the call's opening one).
const unbounded = (src: string) => { let n = 0; const re = /\b(execFileSync|execSync|spawnSync)\(/g; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) { let depth = 0, i = m.index + m[0].length - 1; for (; i < src.length; i++) { if (src[i] === '(') depth++; else if (src[i] === ')' && --depth === 0) break; }
    if (!/\btimeout\s*:/.test(src.slice(m.index, i))) n++; } return n; };
test('no new unbounded sync child processes in scripts/', () => {
  const found: Record<string, number> = {};
  for (const f of files(join(process.cwd(), 'scripts'))) { const n = unbounded(readFileSync(f, 'utf8')); if (n) found[relative(process.cwd(), f)] = n; }
  const grew = Object.entries(found).filter(([f, n]) => n > (KNOWN[f] ?? 0)).map(([f, n]) => `${f}: ${n} unbounded (allowed ${KNOWN[f] ?? 0}) — add timeout: to the call`);
  assert.deepEqual(grew, [], grew.join('\n'));
  const shrank = Object.entries(KNOWN).filter(([f, n]) => n > (found[f] ?? 0)).map(([f]) => f);
  assert.deepEqual(shrank, [], `debt paid down — lower KNOWN for: ${shrank.join(', ')}`);
});
