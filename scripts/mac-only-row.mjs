// `node scripts/mac-only-row.mjs <argv…>`: a browser row in .quality-gate.json completion_commands (the Stop gate). On a VPS lane it is NOT run: Chromium
// rows in a VPS lane's Stop gate trapped Deploy B ~2 h on 2026-10-12 (Lead: no browser rows in a VPS lane's Stop; route them through lanejob or the release).
// The same check still runs as a release row (release_commands) and in every Mac lane's Stop. Anywhere else (the Mac, CI) it runs <argv> as is: same stdio,
// same exit code. VPS = /opt/frankendom exists (the lanejob release install); MAC_ONLY_ROW_MARKER overrides the path (tests).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const argv = process.argv.slice(2);
if (!argv.length) { console.error('usage: node scripts/mac-only-row.mjs <command> [args…]'); process.exit(2); }
if (existsSync(process.env.MAC_ONLY_ROW_MARKER || '/opt/frankendom')) {
  console.log(`mac-only-row: not run on this VPS lane: ${argv.join(' ')} (no browser rows in a VPS Stop gate, Lead 2026-10-12); it runs as a release row and in Mac lanes`);
  process.exit(0);
}
const r = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit' });
process.exit(r.status ?? 1);
