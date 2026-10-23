#!/usr/bin/env bash
# The release train's PUBLISHER (Dom via Strategy + Lead, 2026-10-12: no operator turn in the loop). launchd runs it on the Mac every 2 min
# (ops/launchd/com.frankendom.release-train.plist); safe to run by hand. One tick:
#   1. stopped (~/.claude/state/release-train.stopped) or held (deploy_hold: a deploy is running or someone holds the box) -> nothing;
#   2. its own lock (a mkdir dir with the pid; a dead holder is broken) -> no double publish, even if launchd overlaps a long run;
#   3. the OLDEST open release-* candidate with the candidate:pass label AND an "Auditor|Lead: PASS @<head>" comment, every check green and unit-ci,
#      quality and release-checks present and green (scripts/release-train.mjs pick, on each candidate's FULL `gh pr view` check list) -> nothing if none;
#   4. no live deploy.sh run (deploy-lock.sh run files), deploy_hold created atomically holding this pid, trunk FAST-FORWARDED to the candidate sha (the
#      only write to trunk; trunk == the audited commit, so N+1, cut on N, still contains trunk), then scripts/deploy.sh in a release checkout
#      (scripts/release-worktree.sh) under deploy.sh's own locks, FRANKENDOM_RELEASE=1;
#   5. "Published <trunk sha>" in the log -> remove deploy_hold, comment the Published line on the candidate, close candidates live now contains.
# Any failure STOPS the train: deploy_hold stays, release-train.stopped holds the reason, ONE comment on the candidate, and the notify hook
# (RELEASE_TRAIN_NOTIFY: a command given the message as $1, e.g. Deploy's messenger; macOS notification otherwise). A person restarts it by
# removing both files. It runs from its OWN checkout (~/Developer/frankendom-train, detached on trunk, moved to origin/trunk each tick), never from a
# release slot: release-worktree.sh rewrites those. The body is one { } block, so bash has parsed all of it before the tick's checkout moves the file.
# Under launchd (Lead 2026-10-12): macOS TCC keeps the job out of ~/Desktop, so the repo, its release slot (RELEASE_SLOTS, default
# ~/Developer/frankendom-train-deploy, a worktree of the clone) and its Mac-rows checkout (MAC_ROWS_DIR) must not be worktrees of the ~/Desktop repo:
# scripts/release-train-setup.sh makes the standalone clone; a tick refuses (exit 1, no git call, no hold) when any of them is one (scripts/lib/train-layout.sh).
# Dry run (`--dry-run`, or the file $STATE/release-train.dry-run): the tick reads git and GitHub, picks and verifies, logs "DRY RUN: would publish …",
# and writes nothing (no hold, push, deploy or comment; a stopped/held box is reported, not obeyed). Deploy's proof: touch the file, launchctl kickstart.
# Env: RELEASE_TRAIN_STATE, RELEASE_TRAIN_REPO (default ~/Developer/frankendom-train), RELEASE_TRAIN_ENV (sourced before
# deploy.sh, default $STATE/release-train.env: Deploy's usual DEPLOY_* settings), RELEASE_TRAIN_DEPLOY / RELEASE_TRAIN_WORKTREE (tests).
set -uo pipefail
# Every git/gh call is bounded (2026-10-15/16: a fetch hung 73 min, a push 61 min, a gh poll 21 min, only inside this launchd job): a hang
# becomes a named stop or a "next tick" in seconds. A checkout without the helper runs unbounded rather than not at all.
. "$(dirname "$0")/lib/net-bound.sh" 2>/dev/null || { net_git() { shift; git "$@"; }; net_gh() { shift; gh "$@"; }; }
{
state="${RELEASE_TRAIN_STATE:-$HOME/.claude/state}"
hold="$state/deploy_hold"; stopped="$state/release-train.stopped"; lock="$state/release-train.lock"
repo="${RELEASE_TRAIN_REPO:-$HOME/Developer/frankendom-train}"
trunk="${TRUNK_BRANCH:-codex/01a09a76/task-1}"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) release-train: $*"; }
mkdir -p "$state"
dry=""; { [ "${1:-}" = --dry-run ] || [ -e "$state/release-train.dry-run" ]; } && dry=1
export RELEASE_SLOTS="${RELEASE_SLOTS:-$HOME/Developer/frankendom-train-deploy}" MAC_ROWS_DIR="${MAC_ROWS_DIR:-$HOME/Developer/frankendom-train-macrows}"
source "$(dirname "$0")/lib/train-layout.sh" || { log "no scripts/lib/train-layout.sh beside $0"; exit 1; }
for path in "$repo" $RELEASE_SLOTS "$MAC_ROWS_DIR"; do why=$(train_checkout_ok "$path") || { log "refusing to run: $why"; exit 1; }; done
skip() { if [ -n "$dry" ]; then log "DRY RUN: $*; going on"; else log "$*"; exit 0; fi; }   # a reason to do nothing this tick (a dry run reports it and reads on)
[ -e "$stopped" ] && skip "stopped ($(head -n 1 "$stopped")); remove $stopped and $hold to restart"
# The Mac-only rows start at the CUT (Strategy + Lead 2026-10-12): the oldest open candidate without a receipt gets scripts/mac-rows-early.sh in the
# background (one run at a time, its own checkout MAC_ROWS_DIR, the train's, checked above; under deploy.sh's Mac-rows lock); deploy.sh trusts the rows
# that passed for that tree. A dry run only says which candidate it would start.
deploy_running() {   # a live deploy.sh run (scripts/lib/deploy-lock.sh: the in-flight marker and one file per run), hand-run or ours; defined here because the early-rows block below needs it
  local f p
  for f in "${DEPLOY_LOCK:-$state/deploy_in_flight.json}" "${DEPLOY_RUNS_DIR:-$state/deploy_runs}"/*.json; do
    [ -e "$f" ] || continue
    p=$(sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$f" | head -n 1)
    [ -n "$p" ] && kill -0 "$p" 2>/dev/null && { echo "$p"; return 0; }
  done
  return 1
}
early_dir="${PRELAUNCH_DIR:-$state/pre-launch}"
# Run from $repo AND with --repo: this block sits before the tick's own `cd "$repo"` and launchd starts the job outside any repo, so a bare `gh pr list` exited 1 there on every tick
# since 10-12 (found 2026-10-19 by the failed-query log line). Neither the cwd nor the git remote may decide which repo this asks.
early_cands=$(cd "$repo" 2>/dev/null && net_gh 60 pr list --repo "${RELEASE_TRAIN_GH_REPO:-DomLynch/RPG-game}" --state open --base "$trunk" --limit 50 --json headRefName,headRefOid,createdAt \
  --jq '[.[] | select(.headRefName | startswith("release-"))] | sort_by(.createdAt) | .[].headRefOid' 2>/dev/null); early_rc=$?
# No silent skip (Lead 2026-10-19, JN's Mac rows never started and the train said nothing): a failed query, a missing checkout and a failed start are all logged.
[ "$early_rc" -eq 0 ] || log "mac rows (early): the open-candidate query failed (exit $early_rc); no start this tick"
early=$(printf '%s\n' "$early_cands" | while read -r c; do [ -n "$c" ] || continue; [ -e "$early_dir/$c.macrows.json" ] || { echo "$c"; break; }; done)
# The publishing release gets the Mac first (Lead 2026-10-19: a by-hand pre-flight held the Mac-rows lock and delayed JR's deploy 295 s): while a deploy.sh is running (it IS the Mac's user; its
# post-publish CI tail runs in the detached postcheck, not in deploy.sh) the early start waits and begins on the first tick after the run ends.
if [ -n "$early" ] && dp=$(deploy_running); then log "early rows deferred: deploy using the Mac (deploy.sh pid $dp); mac rows (early) for ${early:0:9} start after it"; early=""; fi
for m in "$state"/mac-rows-early.failed-*; do [ -e "$m" ] && log "mac rows (early) FAILED earlier: $(head -n 1 "$m") (marker $m; remove it after the cause is fixed)"; done
if [ -n "$early" ] && [ -n "$dry" ]; then log "DRY RUN: would start mac rows (early) for ${early:0:9} in $MAC_ROWS_DIR"
elif [ -n "$early" ] && [ ! -d "$repo" ]; then log "mac rows (early) for ${early:0:9}: NOT started, the train checkout $repo is missing"
elif [ -n "$early" ]; then
  # Its own session (perl setsid; macOS has no setsid binary): launchd ends the tick by killing the job's process group, and a plain `nohup … &` died with it. A start that exits
  # non-zero (no checkout, npm ci failed, rows lock timeout) is logged with its exit code and leaves $state/mac-rows-early.failed-<sha9>, which every tick prints until it is removed.
  ( cd "$repo" && PRELAUNCH_DIR="$early_dir" nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- bash -c '
      state=$1; sha=$2; shift 2; "$@" "$sha"; rc=$?
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) mac-rows-early ${sha:0:9}: exit $rc" >> "$state/mac-rows-early.log"
      case "$rc" in 0|130|137|143) rm -f "$state/mac-rows-early.failed-${sha:0:9}";; *) echo "$sha exit $rc at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$state/mac-rows-early.failed-${sha:0:9}";; esac' \
      _ "$state" "$early" ${RELEASE_TRAIN_MAC_ROWS:-bash scripts/mac-rows-early.sh} >> "$state/mac-rows-early.log" 2>&1 & )
  log "mac rows (early) for ${early:0:9}: started or already running (log $state/mac-rows-early.log)"
fi
# Pending post-publish CI tails (Lead 2026-10-18, #3177): the publisher writes $state/post-publish-pending-<rev8> (rev, rows, at) before it releases the hold, the tail records its pid in it and
# removes it when it finishes. A tail that is still alive is the overlap Lead allowed; a marker whose tail is DEAD (Mac sleep, reboot) or never started within the grace holds the next publish:
# nobody proved those rows, and "trust silently" is the one thing this never does. Remove the marker after looking at that release's CI.
# THE RULES OF THE OVERLAP (Lead + Strategy, standing procedure 2026-10-18):
#   - at most MAX_PENDING_TAILS (release-train.env, 2) releases have an unconfirmed detached tail at once; a further publish waits until the oldest tail reports;
#   - a RED tail from release N is fixed forward against whatever is live at that moment, named on that cut's thread, and never silently re-trusted (the tail writes deploy_hold and the
#     train starts nothing until a person has looked);
#   - a tail that died (pid gone) holds the next publish (the loop below).
pending=0
cap=${MAX_PENDING_TAILS:-$(sed -n 's/^export MAX_PENDING_TAILS=\([0-9][0-9]*\).*/\1/p' "${RELEASE_TRAIN_ENV:-$state/release-train.env}" 2>/dev/null | head -n 1)}
for m in "$state"/post-publish-pending-*; do
  [ -e "$m" ] || continue
  case "$m" in *.told) continue;; esac
  mp=$(sed -n 's/^pid=//p' "$m" | head -n 1); mat=$(sed -n 's/^at=//p' "$m" | head -n 1)
  if [ -n "$mp" ] && kill -0 "$mp" 2>/dev/null; then pending=$((pending + 1)); continue; fi
  if [ -z "$mp" ] && [ $(( $(date +%s) - ${mat:-0} )) -lt "${POSTCHECK_START_GRACE_S:-300}" ]; then pending=$((pending + 1)); continue; fi
  [ -n "$dry" ] || [ -e "$m.told" ] || { touch "$m.told"; [ -n "${RELEASE_TRAIN_NOTIFY:-}" ] && $RELEASE_TRAIN_NOTIFY "release-train: post-publish CI tail for $(sed -n 's/^rev=//p' "$m" | head -n 1) died before it finished" || true; }
  skip "post-publish CI tail marker $m is stale (tail pid ${mp:-never started} is not running; rows $(sed -n 's/^rows=//p' "$m" | head -n 1) for $(sed -n 's/^rev=//p' "$m" | head -n 1) were never proved on CI): holding; look at that release's CI, then remove the marker"
done
log "cap=${cap:-none} pending=$pending"
# FAIL CLOSED (Auditor, Lead's requirement): a missing, empty, zero or malformed cap is no publish and a reason, never unlimited.
case "${cap:-}" in ''|*[!0-9]*|0) skip "MAX_PENDING_TAILS is missing or malformed (got '${cap:-}'; the row lives in ${RELEASE_TRAIN_ENV:-$state/release-train.env}): not publishing";; esac
if [ -n "${cap:-}" ] && [ "$pending" -ge "$cap" ] 2>/dev/null; then skip "$pending detached post-publish tail(s) still unconfirmed (MAX_PENDING_TAILS=$cap): the next publish waits until the oldest reports"; fi
if [ -e "$hold" ]; then   # held by a person (no pid), by a live publisher, or STALE: a publisher killed mid-publish (its pid is dead, no stopped file)
  hp=$(head -n 1 "$hold" 2>/dev/null | tr -cd '0-9')
  if [ -n "$hp" ] && ! kill -0 "$hp" 2>/dev/null; then
    log "STALE deploy_hold: publisher pid $hp is dead and the train is not stopped; check the last publish, then remove $hold"
    [ -n "$dry" ] || [ -e "$hold.stale-told" ] || { touch "$hold.stale-told"; [ -n "${RELEASE_TRAIN_NOTIFY:-}" ] && $RELEASE_TRAIN_NOTIFY "release-train: stale deploy_hold (publisher pid $hp dead)" || true; }
  fi
  skip "deploy_hold present: a deploy is running or the box is held"
fi
if p=$(deploy_running); then skip "deploy.sh is running (pid $p)"; fi
if [ -z "$dry" ]; then   # a dry run writes nothing, not even the lock
  if ! mkdir "$lock" 2>/dev/null; then
    holder=$(cat "$lock/pid" 2>/dev/null || true)
    if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then log "a publish is in flight (pid $holder)"; exit 0; fi
    log "breaking a dead lock (pid ${holder:-?})"; rm -rf "$lock"; mkdir "$lock" || exit 0
  fi
  echo "$$" > "$lock/pid"
  trap 'rm -rf "$lock"' EXIT
fi
cd "$repo" || { log "no repo at $repo"; exit 1; }
# SCOPED FETCH (Strategy 2026-10-20): the all-refs `git fetch origin` races any lane that force-pushes its own branch while it runs ("cannot lock ref ... is at X but expected Y", 10-19 19:16 and 19:41); it only cost a tick
# at the first call but would STOP the train at the two below. The train needs trunk and the release-* candidates, nothing else; one retry covers a race on those.
fetch_scoped() { local i; for i in 1 2; do net_git 120 fetch -q origin "$@" && return 0; sleep 2; done; return 1; }
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then fetch_scoped "+refs/heads/$trunk:refs/remotes/origin/$trunk" && git switch -q --detach "origin/$trunk" || log "could not move $repo to origin/$trunk; using $(git rev-parse --short HEAD)"; else log "$repo is dirty: not moved"; fi

# Judge each candidate on its FULL check list: `gh pr list` returns at most 100 checks per PR, and a candidate has 150+, so the list cut quality/quality and
# release-checks/summary off DL #2431 (169 checks) and `pick` never chose it (2026-10-13: PASS + candidate:pass from 00:29Z, nothing published).
# Oldest first; the first that passes the gate on its own `gh pr view` is the pick (forward-only, as before).
cands=$(net_gh 90 pr list --state open --base "$trunk" --label candidate:pass --limit 50 --json number,headRefName,headRefOid,createdAt \
  --jq '[.[] | select(.headRefName | startswith("release-"))] | sort_by(.createdAt) | .[] | "\(.number) \(.headRefOid)"') || { log "gh pr list failed; next tick"; exit 0; }
pick=""
while read -r n listed; do
  [ -n "$n" ] || continue
  view=$(net_gh 120 pr view "$n" --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments) || { log "gh pr view #$n failed; next tick"; exit 0; }
  pick=$(printf '[%s]' "$view" | node scripts/release-train.mjs pick) || { log "pick failed on #$n; next tick"; exit 0; }
  [ -n "$pick" ] && break
  log "#$n @${listed:0:9} not publishable on its full check list: $(printf '%s' "$view" | node scripts/release-train.mjs verify "$listed")"   # why, for the log
done <<< "$cands"
[ -n "$pick" ] || { log "no candidate with candidate:pass, a PASS at its head and green unit-ci/quality/release-checks"; exit 0; }
read -r pr sha draft <<< "$pick"
# `gh pr list` returns at most 100 checks per PR (CQ #2342: 144 via `gh pr view`, exactly 100 via list): re-read THIS candidate's full rollup and re-check the gate.
if ! why=$(net_gh 120 pr view "$pr" --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments | node scripts/release-train.mjs verify "$sha"); then
  log "#$pr @${sha:0:9} not publishable on its full check list: ${why:-gh pr view failed}; next tick"; exit 0
fi
# A Lead "TRUST @<sha9> rows N — reason" line at this head (scripts/release-train.mjs trustAt) let the gate stand in for those release rows (only rows the runner lost: a failed row
# still blocks). deploy.sh gets the same rows, and as the reason the TRUST line verbatim with its comment URL (scripts/lib/deploy-trust.sh; deploy.sh repeats it in the Published block),
# so every use is audited. "Only Lead" is process: every lane posts as the repo owner. No line: nothing is exported and deploy.sh runs as before.
trust=$(net_gh 120 pr view "$pr" --json headRefOid,comments | node scripts/release-train.mjs trust "$sha") || trust=""
trust_rows=${trust%%$'\t'*}; trust_reason=${trust#*$'\t'}
[ -n "$trust" ] && log "#$pr @${sha:0:9}: rows $trust_rows trusted by TRUST line $trust_reason"
[ -n "$dry" ] && { log "DRY RUN: would publish #$pr @${sha:0:9} (repo $repo at $(git rev-parse --short HEAD); slots $RELEASE_SLOTS); nothing written"; exit 0; }
log "publishing #$pr @${sha:0:9}"

ffwd=""   # set once trunk has been fast-forwarded to $sha: from then on the PR reads "merged" but live is NOT $sha (HL2, 2026-10-16: the next tick saw no open candidate)
stop() {   # $1 = reason: the train stays stopped until a person removes both files
  local why="release-train STOPPED at #$pr @${sha:0:9}: $1"
  local resume=""; [ -n "$ffwd" ] && resume=" Trunk is ALREADY $sha (#$pr reads merged) but live is not: after the fix, remove both files and run: bash scripts/release-train-resume.sh $pr $sha (the tick will not pick it again)."
  printf '%s\n%s\n' "$why$resume" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stopped"
  log "$why$resume"
  net_gh 30 pr comment "$pr" --body "$why. deploy_hold is kept and the train is stopped: fix it, then remove \`$stopped\` and \`$hold\` on the Mac.$resume" >/dev/null 2>&1 || true
  if [ -n "${RELEASE_TRAIN_NOTIFY:-}" ]; then $RELEASE_TRAIN_NOTIFY "$why" || true
  elif command -v osascript >/dev/null 2>&1; then osascript -e "display notification \"${why//\"/}\" with title \"Frankendom release train\"" || true; fi
  exit 1
}
if p=$(deploy_running); then log "deploy.sh is running (pid $p)"; exit 0; fi   # again, right before the hold: the pick took network time
# A full disk fails every shell (2026-10-13): under FREE_GIB_MIN (default 20) the tick waits, before anything is held or pushed, and the next tick tries again.
# A checkout without the helper (the train runs the trunk it has) skips the check rather than stopping the train.
if [ -r scripts/lib/free-space.sh ] && ! space=$(bash scripts/lib/free-space.sh "${FREE_GIB_MIN:-20}" 2>&1); then log "not publishing: $space"; exit 0; fi
( set -o noclobber; echo "$$" > "$hold" ) 2>/dev/null || { log "deploy_hold appeared meanwhile"; exit 0; }
fetch_scoped "+refs/heads/$trunk:refs/remotes/origin/$trunk" "+refs/heads/release-*:refs/remotes/origin/release-*" || stop "${NET_WHY:-git fetch failed}"
git cat-file -e "$sha^{commit}" 2>/dev/null || fetch_scoped || stop "${NET_WHY:-candidate $sha not fetched}"   # a candidate on a branch the scoped refspec does not name: the old all-refs fetch, once, as the last resort
git cat-file -e "$sha^{commit}" 2>/dev/null || stop "candidate $sha not fetched"
git merge-base --is-ancestor "origin/$trunk" "$sha" || stop "trunk moved outside the train: the candidate does not contain origin/$trunk; nothing pushed, re-cut on trunk"
[ "$draft" = draft ] && { net_gh 60 pr ready "$pr" >/dev/null || stop "${NET_WHY:-gh pr ready failed}"; }
net_git "${NET_PUSH_S:-180}" push -q origin "$sha:refs/heads/$trunk" || {
  rc=$?   # 124 = killed at the limit: the push may have landed, so "refused ... nothing deployed" would be a claim nobody checked (the 04:17:54Z stop, 2026-10-16)
  [ "$rc" = 124 ] && stop "$NET_WHY: trunk state UNKNOWN (a push killed late may already have moved it); run git ls-remote origin $trunk before any retry; deploy.sh did not run"
  stop "the fast-forward of $trunk to $sha was refused (trunk moved?); nothing deployed"
}
ffwd=1
fetch_scoped "+refs/heads/$trunk:refs/remotes/origin/$trunk" || stop "${NET_WHY:-git fetch after the fast-forward failed}"
rev=$(git rev-parse "origin/$trunk") || stop "no origin/$trunk"
[ "$rev" = "$sha" ] || stop "trunk is $rev after the fast-forward, not the audited $sha: not deploying an unchecked commit"
dir=$(${RELEASE_TRAIN_WORKTREE:-bash scripts/release-worktree.sh} "$rev") || stop "no release checkout for $rev"
logf="$state/release-train-${rev:0:8}.log"
envf="${RELEASE_TRAIN_ENV:-$state/release-train.env}"
log "deploy.sh $rev in $dir (log $logf)"
( cd "$dir" && { [ -r "$envf" ] && set -a && . "$envf" && set +a; true; } && { [ -z "$trust" ] || export DEPLOY_TRUST_ROWS="$trust_rows" DEPLOY_TRUST_REASON="TRUST line on #$pr @${sha:0:9}: $trust_reason"; } && FRANKENDOM_RELEASE=1 ${RELEASE_TRAIN_DEPLOY:-bash scripts/deploy.sh} ) > "$logf" 2>&1
rc=$?
[ "$rc" -eq 0 ] || stop "deploy.sh exit $rc ($(tail -n 1 "$logf" | cut -c1-200)); log $logf"
grep -q "^Published $rev" "$logf" || stop "deploy.sh exited 0 without a Published $rev line; log $logf"
# POST_PUBLISH_DETACH=1 in the env file: deploy.sh left the CI-routed post-publish rows to a tail (one "post-publish CI tail: rows <csv> for <rev>" line). The marker is written BEFORE the hold is
# released; the tail runs from THIS checkout, detached, and re-holds the next publish only if CI does not prove the rows (scripts/release-train-postcheck.sh).
tail_rows=$(sed -n -E "s/^post-publish CI tail: rows ([0-9,]+) for $rev .*/\1/p" "$logf" | head -n 1)
marker="$state/post-publish-pending-${rev:0:8}"
# COALESCED WINDOW (Lead + Strategy 2026-10-18; TAIL_MIN_INTERVAL_S in release-train.env, 0 or absent = one tail per release): a release published inside an open window JOINS it (a member line in the
# window's marker, no tail of its own, no CI run of its own); the first release of a window owns the one tail, which runs ONE CI run against the newest member when the window closes.
win=${TAIL_MIN_INTERVAL_S:-$(sed -n 's/^export TAIL_MIN_INTERVAL_S=\([0-9][0-9]*\).*/\1/p' "${RELEASE_TRAIN_ENV:-$state/release-train.env}" 2>/dev/null | head -n 1)}
case "${win:-}" in ''|*[!0-9]*) win=0;; esac
joined=""
if [ -n "$tail_rows" ] && [ "$win" -gt 0 ]; then
  for m in "$state"/post-publish-pending-*; do
    [ -e "$m" ] || continue
    case "$m" in *.told|*.new|*.closed|*.final) continue;; esac   # a closed window takes no joiners: the publish below opens a new window of its own
    mw=$(sed -n 's/^window=//p' "$m" | head -n 1); mat=$(sed -n 's/^at=//p' "$m" | head -n 1); mp=$(sed -n 's/^pid=//p' "$m" | head -n 1)
    [ "${mw:-0}" -gt 0 ] 2>/dev/null && [ $(( $(date +%s) - ${mat:-0} )) -lt "$mw" ] || continue
    if [ -n "$mp" ] && ! kill -0 "$mp" 2>/dev/null; then continue; fi
    printf 'member=%s %s\n' "$rev" "$tail_rows" >> "$m"; joined=$m
    log "post-publish CI tail for $rev joined the open window of $(sed -n 's/^rev=//p' "$m" | head -n 1) (rows $tail_rows): no tail or CI run of its own"
    break
  done
fi
if [ -z "$joined" ] && [ -n "$tail_rows" ]; then
  printf 'rev=%s\nrows=%s\nat=%s\n' "$rev" "$tail_rows" "$(date +%s)" > "$marker"
  [ "$win" -le 0 ] || printf 'window=%s\n' "$win" >> "$marker"
fi
rm -f "$hold" "$hold.stale-told"
if [ -z "$joined" ] && [ -n "$tail_rows" ]; then
  log "post-publish CI tail for $rev: rows $tail_rows (postcheck log $state/release-train-postcheck-${rev:0:8}.log)"
  # Its own session (perl setsid; macOS has no setsid binary): the first detached cycle (IT, 2026-10-18) lost its tail to a SIGTERM when launchd ended the tick and killed the job's process group.
  ( nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- ${RELEASE_TRAIN_POSTCHECK:-bash "$(dirname "$0")/release-train-postcheck.sh"} "$rev" "$tail_rows" "$pr" > "$state/release-train-postcheck-${rev:0:8}.log" 2>&1 & )
fi
# Publish-to-publish minutes (Lead 2026-10-18, target <= 15), one line per cycle.
last="$state/release-train-last-publish"; now=$(date +%s)
if [ -r "$last" ]; then
  prev_at=$(sed -n 's/^at=//p' "$last" | head -n 1); prev_rev=$(sed -n 's/^rev=//p' "$last" | head -n 1)
  [ -z "$prev_at" ] || log "publish-to-publish $(( (now - prev_at + 30) / 60 )) min (${prev_rev:0:8} -> ${rev:0:8})"
fi
printf 'rev=%s\nat=%s\n' "$rev" "$now" > "$last"
summary=$(sed -n "/^Published $rev/,\$p" "$logf" | head -n 40)
net_gh 30 pr comment "$pr" --body "$(printf 'release-train: published #%s as trunk %s.\n\n```\n%s\n```' "$pr" "$rev" "$summary")" >/dev/null 2>&1 || true
# Every open PR whose head live now contains is done (forward-only publish; DI 2026-10-13 left its stacked members #2430/#2442/#2444/#2447/#2426 open): close it with a pointer.
net_gh 60 pr list --state open --limit 200 --json number,headRefOid --jq '.[] | "\(.number) \(.headRefOid)"' 2>/dev/null \
  | while read -r n h; do git merge-base --is-ancestor "$h" "$rev" 2>/dev/null && net_gh 30 pr close "$n" --comment "release-train: live $rev (#$pr) contains this head, so it is shipped; closing." >/dev/null 2>&1; done
log "published #$pr as $rev"
exit 0
}
