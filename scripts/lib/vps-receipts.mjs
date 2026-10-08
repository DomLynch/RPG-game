// Item 3 (pull model, no runner): the VPS runs the release rows for a candidate commit (scripts/vps-shadow-rows.sh -> rows.json) and
// deploy.sh trusts a row from that receipt ONLY when it is safe to read off a box with no GPU. Pure helpers, no I/O. Same test as
// ci-trusted-checks.mjs and hf-wall-rows.mjs: exit 0 for the exact TREE being deployed, and the row is still the same command.
import { dirname, join } from 'node:path';
import { isWebKitRow, timingOf } from '../vps-shadow/rows-lib.mjs';

const fullHex = value => /^[0-9a-f]{40}$/.test(value || '');
const RELATIVE_IMPORT = /(?:from\s*|import\s*\(\s*|import\s+|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
// The script plus every relative import, transitively (a row that launches its browser through scripts/lib/harness.mjs shows nothing in
// its own file). null = the script or an import is missing: fail closed.
export function sourceWithImports(script, readSource, seen = new Set()) {
  if (seen.has(script)) return '';
  seen.add(script);
  const text = readSource(script);
  if (text === null || text === undefined || text === '') return null;
  let all = text;
  for (const [, rel] of text.matchAll(RELATIVE_IMPORT)) {
    const sub = sourceWithImports(join(dirname(script), rel), readSource, seen);
    if (sub === null) return null;
    all += `\n${sub}`;
  }
  return all;
}
// Not trusted from the VPS whatever its receipt says: a missing script, a WebKit launch (Linux WebKit is not Mac Safari), a real-clock
// resume, or a wall-clock browser row (software GL runs the fight at ~1/5 speed: the T4's or the Mac's to judge). Virtual-clock
// Chromium rows and no-browser rows are deterministic on both boxes, so a VPS pass is a pass. Judged on the script AND its imports.
export const vpsSafeRow = (command, argv, readSource) => {
  const script = argv.find(arg => /\.(mjs|js|sh)$/.test(arg));
  const source = script ? sourceWithImports(script, readSource) : null;
  if (source === null) return false;
  // Any non-comment `webkit` in the script or its imports (a row can pick its engine through a variable: engine = x ? webkit : chromium).
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (isWebKitRow(command) || /\bwebkit\b/i.test(code) || /clock\s*\.\s*resume/.test(code)) return false;
  return timingOf(source) !== 'wall';
};
export function trustedFromVps(receipt, tree, commands, readSource) {
  if (!receipt || receipt.kind !== 'vps-shadow-rows' || !fullHex(tree) || receipt.tree !== tree) return [];
  if (receipt.buildStatus !== 0 || receipt.dirty !== 0) return [];
  return (receipt.rows || [])
    .filter(row => row.status === 'pass' && !(row.exit > 0))
    .filter(row => commands[row.index - 1]?.join(' ') === row.command)   // a renumbered or edited row is never trusted by number
    .filter(row => vpsSafeRow(row.command, commands[row.index - 1], readSource))
    .map(row => row.index).sort((a, b) => a - b);
}
