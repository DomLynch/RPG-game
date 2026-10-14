// test:all preflight (Dom/Lead 2026-10-11): while a release run holds the box (a marker in /run/frankendom-release, younger than 90 min) a raw `npm run test:all`
// refuses to start, so a lane's ssh run cannot overlap the release's unit measure (capture.sh already refuses its own jobs; this catches the rest).
// The release runner (scripts/lib/vps-unit.mjs buildRunner) sets FRANKENDOM_RELEASE_RUN=1. RELEASE_LOCK_DIR overrides the directory (tests use a temp dir).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const STALE_MS = 90 * 60_000;
export function releaseLockHeld(dir = process.env.RELEASE_LOCK_DIR || '/run/frankendom-release', now = Date.now()) {
  try { return readdirSync(dir).filter(f => now - statSync(join(dir, f)).mtimeMs < STALE_MS); } catch { return []; }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const held = process.env.FRANKENDOM_RELEASE_RUN === '1' ? [] : releaseLockHeld();
  if (held.length) {
    console.error(`test:all refused: a release run holds the box (${held.join(', ')}). Wait for it to end (marker older than 90 min is ignored) or run through \`capture\`, which queues.`);
    process.exit(1);
  }
}
