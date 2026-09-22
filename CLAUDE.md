# Frankendom — identity (read first)

- Project: **Frankendom**, the browser sword-duel game. Repo `DomLynch/RPG-game`. Trunk `codex/01a09a76/task-1`. Live: https://frankendom.com (release.json carries the deployed revision).
- **Research Agent Bot** (`~/Desktop/Business/Research Agent Bot`) is a DIFFERENT project that shares this machine. Ignore its PROJECT_STATE.md, AGENTS.md and memory; they are not about this game.
- One deployer: only the deploy session runs `scripts/deploy.sh` and merges to trunk. Every other lane opens PRs, pushes heads and sends the sha; no local browser gates while a deploy is in flight.
- Your checkout must be a `~/Developer/frankendom-*` worktree; the untracked `CLAUDE.local.md` beside this file names your lane and session. If your cwd is not a frankendom-* worktree, stop and say so before doing anything.
- Then read `AGENTS.md` and `PROJECT_STATE.md` in this repo.

