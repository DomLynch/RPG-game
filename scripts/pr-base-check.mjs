// CI guard on every pull request: a PR whose base branch has ALREADY landed on trunk can only merge into a dead branch — that is how
// #358 (2026-09-21) "merged" and missed a deploy. Base = trunk passes; base still in flight is a stacked PR and passes with a note;
// base already an ancestor of trunk fails with the fix (retarget to trunk). Needs origin/<trunk> and origin/<base> fetched with history.
import { execFileSync } from 'node:child_process';

const TRUNK = process.env.TRUNK_BRANCH || 'codex/01a09a76/task-1';
const base = process.argv[2] || process.env.GITHUB_BASE_REF;
if (!base) throw new Error('pr-base-check: pass the base branch (or set GITHUB_BASE_REF)');
const ok = (...a) => { try { execFileSync('git', a, { encoding: 'utf8', stdio: 'pipe', timeout: 60_000 }); return true; } catch { return false; } };
if (base === TRUNK) { console.log(`pr-base-check: base is ${TRUNK}`); process.exit(0); }
if (!ok('rev-parse', '--verify', `origin/${base}`)) { console.error(`pr-base-check: base branch ${base} is not on origin — retarget this PR to ${TRUNK}`); process.exit(1); }
if (ok('merge-base', '--is-ancestor', `origin/${base}`, `origin/${TRUNK}`)) {
  console.error(`pr-base-check: base branch ${base} has already landed on ${TRUNK}; merging here reaches nothing — retarget this PR to ${TRUNK}`);
  process.exit(1);
}
console.log(`pr-base-check: stacked on ${base}, which is still in flight — it must land on ${TRUNK} before this PR counts as shipped`);
