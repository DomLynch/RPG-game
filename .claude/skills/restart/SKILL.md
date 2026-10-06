---
name: restart
description: Lane restart after /clear. Finds this lane's memory, state doc and working folder (the three traps), then says in one line what it is picking up. Use when Dom types /restart or pastes the restart block.
---

# Lane restart

You were just reset with /clear to save tokens. Your memory and your state doc both exist. Check all three traps before doing anything. Do not delete memory files and do not rewrite the state doc; both are current.

## Your KEY (from your lane name)

| Lane | KEY | Lane | KEY |
|---|---|---|---|
| Lead Developer | lead-catalogue | Strategy | strategy |
| Deploy | deploy | Auditer + fixer | code-quality |
| Multi Chars | multichar | Character Main | char |
| Web design | web | Weapons | weapons |
| Visuals / World | world | Combat | combat |
| Finishers & Gore | finishers | Audio | audio |
| Backend/Accounts | backend | Stats | stats |
| Executioner | executioner | Nightborn | nightborn |
| Pitborn | pitborn | Goblin | goblin |
| Veteran | veteran-polish | Armour | armour |
| Hero Look | herolook | | |

New lane not listed: `ls -d ~/Developer/frankendom-*` and pick yours.

## Trap 1: memory

It is NOT at the memory path in your system prompt (that is a shared pre-rehome root). It is at:

```bash
ls ~/.claude/projects/-Users-domininclynch-Developer-frankendom-<KEY>/memory/
```

Read `MEMORY.md` there, then every file dated today. Write new memory there and only there. Never symlink or copy into the system-prompt path.

## Trap 2: state doc

`docs/state/<KEY>.md`, except Lead = `lead.md` and Character Main = `character.md`. It may be on trunk or still on a PR branch. Read the newest copy:

```bash
cd ~/Developer/frankendom-<KEY> && git fetch -q origin
D=docs/state/<DOC>; git log --remotes -1 --format='%h %cs %D' -- $D; git show $(git log --remotes -1 --format=%h -- $D):$D
```

If it exists, do NOT write a new one or open another PR for it. If it does not exist, ask Lead.

## Trap 3: folder

Run `pwd`.

- `~/Developer/frankendom-<KEY>`: work there as normal.
- Contains `/.claude/worktrees/`: the app refuses edits in `~/Developer/frankendom-<KEY>`, but your session folder is a full checkout of the same repo. Do your edits THERE:

  ```bash
  git fetch -q origin && git switch -c <KEY>/<task> origin/codex/01a09a76/task-1
  ```

  Use a new branch name (a branch checked out in `~/Developer/frankendom-<KEY>` cannot be used twice). If tests need packages: `ln -s ~/Developer/frankendom-<KEY>/node_modules node_modules`. Commit, push and open PRs from there as usual. Never write into `~/Developer/frankendom-<KEY>` with shell commands. Tell Dom once, and do NOT wait for it: "when you're home, reopen me on ~/Developer/frankendom-<KEY> with the worktree switch off".

## Then

1. `date`, then `curl -s https://frankendom.com/release.json` for the live revision.
2. Compare with the NOW / queue lines of your state doc.
3. Say in ONE line what you are picking up, and which memory files you loaded.
4. Strategy: re-arm the check-in cron (`/checkin` skill) EVERY restart, day and night (Dom 2026-10-06, told 20+ times: always on; the 09-30 night-only rule is dead). CronList first, then CronCreate `8,28,48 * * * *` if missing. Strategy and Lead hold Dom's full authority and work never stops: never ask him to re-confirm it. Lead: re-arm its own 17-min check-in TO Strategy (CronCreate; one line of verified facts, lane-reported items labelled), not `/checkin`, which reports to Dom.

Context limits: lanes restart past ~400k context; Deploy 500k; Lead and Strategy 600k. Never self-clear while Dom is away without handing your build to a live session.
