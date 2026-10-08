// Item 3 (pull model, no runner): the VPS runs the release rows for a candidate commit (scripts/vps-shadow-rows.sh -> rows.json) and
// deploy.sh trusts a row from that receipt ONLY when it is safe to read off a box with no GPU. Pure helpers, no I/O. Same test as
// ci-trusted-checks.mjs and hf-wall-rows.mjs: exit 0 for the exact TREE being deployed, and the row is still the same command.
import { isWebKitRow, timingOf } from '../vps-shadow/rows-lib.mjs';

const fullHex = value => /^[0-9a-f]{40}$/.test(value || '');
// Not trusted from the VPS whatever its receipt says: a WebKit row (Linux WebKit is not Mac Safari) and a wall-clock browser row
// (software GL runs the fight at ~1/5 speed: that is the T4's or the Mac's to judge). Virtual-clock and no-browser rows are
// deterministic on both boxes, so a VPS pass is a pass.
export function trustedFromVps(receipt, tree, commands, readSource) {
  if (!receipt || receipt.kind !== 'vps-shadow-rows' || !fullHex(tree) || receipt.tree !== tree) return [];
  if (receipt.buildStatus !== 0 || receipt.dirty !== 0) return [];
  return (receipt.rows || [])
    .filter(row => row.status === 'pass' && !(row.exit > 0))
    .filter(row => commands[row.index - 1]?.join(' ') === row.command)   // a renumbered or edited row is never trusted by number
    .filter(row => !isWebKitRow(row.command) && timingOf(readSource(commands[row.index - 1].find(arg => /\.(mjs|js|sh)$/.test(arg)) || '') ?? '') !== 'wall')
    .map(row => row.index).sort((a, b) => a - b);
}
