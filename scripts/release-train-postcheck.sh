#!/usr/bin/env bash
# The CI tail of a published release (Lead GO 2026-10-18, citing Dom: overlapping publishes). `bash scripts/release-train-postcheck.sh <revision> <rows csv> <PR number>`.
# deploy.sh with POST_PUBLISH_DETACH=1 does the live read-backs and the rollback-capable Mac group inside the hold, then leaves the CI-routed post-publish rows open and
# says so on one line ("post-publish CI tail: rows <csv> for <rev>"). The train publisher releases the hold and starts THIS script detached, from the train's own checkout
# (never a release slot: the next publish rewrites those). It waits for the release-checks run of the tree, then:
#   - every row proved on CI  -> one "green" line in its log and one comment on the PR, nothing held;
#   - anything else (a red row, a row CI cannot prove, CI down, the wait ran out) -> deploy_hold is written (unless one exists) with the rows and the revision, the notify hook
#     and a PR comment say so. The next publish does not start until a person looks; one already in flight is fix-forward by its owner (Lead's rule 3): this script never rolls back
#     and never re-trusts a red row.
# Log: $STATE/release-train-postcheck-<rev8>.log. Publish-to-publish minutes are the train log's job (the published lines carry the times).
# Env: RELEASE_TRAIN_STATE, POST_PUBLISH_TRUSTED_CMD (default: node scripts/ci-trusted-checks.mjs), POST_PUBLISH_CI_WAIT_S (default 1500), RELEASE_TRAIN_NOTIFY.
set -uo pipefail
rev="${1:?revision}"; rows="${2:?rows csv}"; pr="${3:-}"
state="${RELEASE_TRAIN_STATE:-$HOME/.claude/state}"; hold="$state/deploy_hold"
dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
marker="$state/post-publish-pending-${rev:0:8}"   # the publisher wrote rev/rows/at before it released the hold; this tail adds its pid and removes the file when it finishes (any exit)
if [ -e "$marker" ]; then { grep -v '^pid=' "$marker"; printf 'pid=%s\n' "$$"; } > "$marker.new" && mv "$marker.new" "$marker"; fi   # keeps rev/rows/at/window/member lines, adds the pid
members="$rev"
say() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) release-train-postcheck: $*"; }
decided() { rm -f "$marker" "$marker.told"; }   # ONLY a decided outcome clears the marker: all green, or deploy_hold written for a red row
# A dying tail (Mac shutdown or reboot sends SIGTERM first; INT, HUP) decides nothing: it holds the next publish and keeps the marker, never clears itself (Auditor on #3177).
trap 'say "RED: interrupted"; [ -e "$hold" ] || printf "post-publish tail interrupted; remove this file after looking\nrows %s revision %s at %s\n" "$rows" "$rev" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$hold"; exit 143' TERM INT HUP
note() {   # one PR comment, best effort (POSTCHECK_COMMENT replaces gh in tests)
  [ -n "$pr" ] || return 0
  if [ -n "${POSTCHECK_COMMENT:-}" ]; then $POSTCHECK_COMMENT "$1" >/dev/null 2>&1 || true; else gh pr comment "$pr" --body "$1" >/dev/null 2>&1 || true; fi
}
raise() {   # $1 = why: hold the NEXT publish and tell a person
  say "RED: $1"
  [ -e "$hold" ] || printf 'post-publish CI tail failed for a live release; remove this file after looking\nrows %s revision %s: %s at %s (window members: %s)\n' "$rows" "$rev" "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$members" > "$hold"
  note "release-train post-publish: rows $rows for live $rev NOT proved on CI ($1); window members: $members. deploy_hold written; the release stays live. Owner fixes forward against live and names it on this cut's thread."
  [ -n "${RELEASE_TRAIN_NOTIFY:-}" ] && $RELEASE_TRAIN_NOTIFY "release-train: post-publish CI rows failed for $rev ($1)" || true
  decided   # the hold is written above: the red outcome is decided
  exit 1
}
trust="${POST_PUBLISH_TRUSTED_CMD:-node $dir/ci-trusted-checks.mjs}"
# COALESCED WINDOW (Lead + Strategy 2026-10-18, TAIL_MIN_INTERVAL_S in release-train.env): the runner pool was saturated by one CI run per release at 4-min cycles. The first release of a window
# owns this tail; releases published inside the window append "member=<rev> <rows>" to the marker and start no tail. At the window's end the tail dispatches ONE release-checks run against
# the NEWEST member (trunk contains the earlier ones), waits for it, and on green names every member, on red writes deploy_hold naming them (fix forward against live).
window=$(sed -n 's/^window=//p' "$marker" 2>/dev/null | head -n 1)
if [ -n "$window" ] && [ "$window" -gt 0 ] 2>/dev/null; then
  start=$(sed -n 's/^at=//p' "$marker" | head -n 1)
  while [ "$(date +%s)" -lt $(( ${start:-0} + window )) ]; do sleep "${POSTCHECK_WINDOW_TICK_S:-10}"; done
  members="$rev $(sed -n 's/^member=\([0-9a-f]*\) .*/\1/p' "$marker" | tr '\n' ' ')"; members=${members% }   # the opener first, then the joiners in publish order
  rows=$( { echo "$rows"; sed -n 's/^member=[0-9a-f]* //p' "$marker"; } | tr ',' '\n' | grep -E '^[0-9]+$' | sort -un | paste -sd, - )
  rev=${members##* }   # the newest member
  say "window of ${window}s closed: members ${members// /, }; ONE CI run for the newest, $rev (rows $rows)"
  if ! ${POST_PUBLISH_DISPATCH:-gh workflow run release-checks.yml --ref ${POST_PUBLISH_CI_REF:-codex/01a09a76/task-1} -f ref=$rev} >/dev/null 2>&1; then raise "the release-checks dispatch for the window's newest $rev failed (members ${members// /, })"; fi
fi
sleep "${POST_PUBLISH_CI_SETTLE_S:-30}"   # the dispatched run must exist before ci-trusted-checks can wait on it
trusted=$(cd "$dir/.." && CI_ROWS_WAIT_S="${POST_PUBLISH_CI_WAIT_S:-1500}" $trust "$rev" 2>/dev/null) || raise "the trust lookup failed"
left=$(node "$dir/lib/row-placement.mjs" subtract "$rows" "$trusted" 2>/dev/null) || left="$rows"   # fail closed: a failed subtract leaves every row open
[ -z "$left" ] || raise "rows $left not green on CI for the tree"
say "post-publish rows $rows for $rev: all CI-trusted (window members: $members)"
note "release-train post-publish: rows $rows for live $rev all green on CI (window members: $members)."
decided
exit 0
