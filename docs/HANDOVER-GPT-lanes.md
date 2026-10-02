# Lane handoffs — newest entry per lane (generated 2026-10-02 07:52 +0400 by scripts/handover-lanes.sh)

Source per lane: the newest OPEN PR touching docs/state/<lane>.md if any, else trunk. Read the full file for history.

---

## armour  ·  source: codex/01a09a76/task-1

---

## audio  ·  source: codex/01a09a76/task-1

---

## backend  ·  source: codex/01a09a76/task-1

---

## career  ·  source: codex/01a09a76/task-1

---

## character  ·  source: PR #1331 char/state-handoff-1002

---

## code-quality  ·  source: codex/01a09a76/task-1

---

## combat  ·  source: PR #1319 combat/state-1002

---

## deploy  ·  source: PR #1326 deploy/state-1002e

---

## duel  ·  source: PR #1321 duel/state-1002

---

## executioner  ·  source: PR #1334 executioner/state-1003

---

## finishers  ·  source: PR #1332 finishers/state-1002-gpt

---

## goblin  ·  source: PR #1312 docs/goblin-state-1002

---

## herolook-sweep-2026-10-01  ·  source: codex/01a09a76/task-1

---

## herolook  ·  source: PR #1329 herolook/handoff-gpt

---

## lead  ·  source: codex/01a09a76/task-1

---

## multichar  ·  source: PR #1323 multichar/state-1002-handoff

---

## nightborn  ·  source: PR #1327 nightborn/handoff-1002

---

## pit  ·  source: PR #1330 pit/state-1002

---

## pitborn  ·  source: PR #1328 pitborn/handoff-1002

---

## stats  ·  source: PR #1318 stats/handoff-1002

---

## strategy  ·  source: PR #1315 strategy/handover-gpt-1002

---

## veteran-polish  ·  source: codex/01a09a76/task-1

---

## weapons  ·  source: PR #1333 weapons/handoff-gpt

---

## web  ·  source: PR #1314 web/duel-signed-in
## 2026-10-02 ~07:30 (+04) — HANDOFF before /clear. READ FIRST: PR #1314 (DUEL for every signed-in player) is open; test, stills and Auditer PASS owed

**Now (pick up here):** **#1314** `web/duel-signed-in` @14281157 (off trunk, Lead TOP PRIORITY: Dom opened duels to players). One line in src/account.ts `showTools`: `dataset.duelTools = String(!tools.hidden || !!userId)`, so DUEL shows on the end screen for any signed-in player and with the admin tools / ?debug; guests never get DUEL (no mint reachable; transport.ts still answers 401/403 "Sign in to challenge a friend"). CSS and main.ts untouched. tests/duel-share.test.ts re-pinned (the account.ts regex + test title). Lead code-read OK; Duel confirmed #1300 does not touch these lines. CI: 6 pass / rest pending at last read.
**Owed before READY (Lead's list):** (1) run `node --test tests/duel-share.test.ts` (never run: the deploy hook held the Mac); (2) stills of the player WIN screen DUEL/LINK/CLIP at 375 and desktop (full res), signed-in AND guest (guest = no DUEL, LINK/CLIP re-centred); a signed-out-after-signed-in still only if cheap (it equals the guest still); (3) push to a `stills/duel-signed-in` branch (recipe: gotcha xlvi), embed in the PR body; (4) CI green; (5) ask the Auditer for a PASS comment on the PR head; (6) send Lead the sha. Never READY myself.
**In flight:** background scripts in the session scratchpad (`waitrun.sh` = wait for deploy_in_flight/deploy_hold to clear then the test; `stills.sh` = wait, `npm run build`, then `scripts/_stills-win-tmp.mjs` x4: m-signedin, m-guest, d-signedin, d-guest into `scratchpad/stills/`). They die with the session: after /clear re-run them (or the commands inside) once `ls ~/.claude/state | grep deploy` is empty. `_stills-win-tmp.mjs` (untracked, mine) now takes DESKTOP=1 (1440x900), ADMIN=1 keeps data-duel-tools, ADMIN=0 deletes it; a local preview has no Supabase so "signed-in" is the attribute set by hand, say so in the PR.
**Still owed from before:** Pit-room stills (day + night, 375) of the hero in the Pit with the loadout sheet open, to Strategy (VPS capture queue, gotcha lviii).
**Gotchas (new):** (lxi) the deploy hook blocks tests/builds/browser runs by command text while a deploy holds the Mac (c107068 at the time): put them in a script file with a while-loop on `~/.claude/state/deploy_in_flight.json` / `deploy_hold`. (lxii) send_message to a lane needs `session_id` (Lead = local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9, Duel = local_0a992bdf-4e25-4edb-b77c-8ba9305dd243), not the lane name. (lxiii) The DUEL gate attribute is still `data-duel-tools` though it now also means "signed in"; renaming it would touch style.css 2016-2032 and tests, avoid while #1300 is open.
**Worktrees/branches:** checkout on `web/duel-signed-in` (this entry rides on it); `web/state-1002` is pushed (earlier handoff). Untracked, mine: `mockups-arena-draw/`, `mockups-profile/`, `scripts/_stills-tmp.mjs`, `scripts/_stills-win-tmp.mjs`.


---

## world  ·  source: PR #1316 docs/world-state-1002
