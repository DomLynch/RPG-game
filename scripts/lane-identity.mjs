// Write an UNTRACKED CLAUDE.local.md into a Frankendom worktree so a session launched there knows which lane it is.
// Background (2026-09-22): every Frankendom session ran with cwd = the Research Agent Bot folder, so the start hooks fed
// it that project's PROJECT_STATE.md and memory; a model switch mid-session then re-read that state and concluded it was
// the paper pipeline. The fix is re-homing each session to its worktree; this file is the identity it reads on arrival.
//   node scripts/lane-identity.mjs --lane deploy --session "Frankendom - Deploy - Fable 5.1" [--worktree ~/Developer/frankendom-deploy] [--dry-run]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []).filter(Boolean));
const lane = args.lane, session = args.session;
if (!lane || !session || session === true) { console.error('usage: --lane <lane> --session "<exact session name>" [--worktree <dir>] [--dry-run]'); process.exit(2); }
const worktree = args.worktree && args.worktree !== true ? args.worktree : join(homedir(), 'Developer', `frankendom-${lane}`);
if (!existsSync(join(worktree, '.git'))) { console.error(`${worktree} is not a git worktree`); process.exit(2); }

const body = `# Lane identity (untracked, written by scripts/lane-identity.mjs)

This checkout is the Frankendom **${lane}** lane; your session name is **${session}**.
Repo: DomLynch/RPG-game. Trunk: codex/01a09a76/task-1. The one deployer is the deploy session; everyone else opens PRs.
Research Agent Bot (~/Desktop/Business/Research Agent Bot) is a DIFFERENT project: ignore its PROJECT_STATE.md and memory.
Read this repo's AGENTS.md and PROJECT_STATE.md for the current state.
If your cwd is not this worktree, stop and say so.

## Context is a per-task budget, not a diary

Every tool call re-reads this session's whole context. Measured 2026-09-22: the lanes spent ~4,800M tokens to
generate ~5.4M of output, because sessions opened at ~85k and ended pinned at the 966k ceiling. Held near 200k
the same work costs 1,707M. A long audit may legitimately sit at 600k; a seven-line fix at 860k is waste.

So when a task CLOSES (PR merged, or the work handed over) and the session is past ~200k, hand off and restart:

1. Write \`docs/state/${lane}.md\` with four sections — **Now** (what the next session should pick up),
   **Done today** (merged PRs, live shas), **Open** (blocked on whom/what), **Gotchas** (traps that cost time).
2. Write anything durable to your memory files (facts that outlive this task, not a task log).
3. \`/clear\`, then resume from those two files. Never restart mid-task.
`;
const target = join(worktree, 'CLAUDE.local.md');
const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
if (current === body) { console.log(`${target}: already current`); process.exit(0); }
if (args['dry-run']) { console.log(`DRY RUN would ${current === null ? 'create' : 'rewrite'} ${target}:\n${body}`); process.exit(0); }
writeFileSync(target, body);
console.log(`${current === null ? 'created' : 'rewrote'} ${target}`);
