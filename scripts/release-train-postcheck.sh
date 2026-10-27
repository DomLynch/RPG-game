#!/usr/bin/env bash
# The CI tail of a published release (Lead GO 2026-10-18, citing Dom: overlapping publishes). `bash scripts/release-train-postcheck.sh <revision> <rows csv> <PR number>`.
# deploy.sh with POST_PUBLISH_DETACH=1 does the live read-backs and the rollback-capable Mac group inside the hold, then leaves the CI-routed post-publish rows open and
# says so on one line ("post-publish CI tail: rows <csv> for <rev>"). The train publisher releases the hold and starts THIS script detached, from the train's own checkout
# (never a release slot: the next publish rewrites those). It waits for the release-checks run of the tree, then:
#   - every row proved on CI  -> one "green" line in its log and one comment on the PR, nothing held;
#   - anything else (a red row, a row CI cannot prove, CI down, the wait ran out) -> deploy_hold is written (unless one exists) with the rows and the revision, the notify hook
#     and a PR comment say so. The next publish does not start until a person looks; one already in flight is fix-forward by its owner (Lead's rule 3): this script never rolls back
#     and never re-trusts a red row.
# A release-checks dispatch that GitHub refuses (HTTP 500) is tried three times, 30 s apart (scripts/lib/post-publish.sh _pp_dispatch). If the publisher's every try failed it left
# $STATE/post-publish-dispatch-failed-<rev8>: this tail then dispatches again before it waits, and only a failure there holds, with the text "dispatch failed" (not "not green").
# Log: $STATE/release-train-postcheck-<rev8>.log. Publish-to-publish minutes are the train log's job (the published lines carry the times).
# Env: RELEASE_TRAIN_STATE, POST_PUBLISH_TRUSTED_CMD (default: node scripts/ci-trusted-checks.mjs), POST_PUBLISH_CI_WAIT_S (default 1500), RELEASE_TRAIN_NOTIFY.
set -uo pipefail
rev="${1:?revision}"; rows="${2:?rows csv}"; pr="${3:-}"
state="${RELEASE_TRAIN_STATE:-$HOME/.claude/state}"; hold="$state/deploy_hold"
dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
rev0="$rev"   # the revision the publisher dispatched for (a coalesced window moves $rev to its newest member)
. "$dir/lib/post-publish.sh"   # _pp_dispatch (three tries, 30 s apart) and the dispatch-failed file the publisher leaves
marker="$state/post-publish-pending-${rev:0:8}"   # the publisher wrote rev/rows/at before it released the hold; this tail adds its pid and removes the file when it finishes (any exit)
if [ -e "$marker" ]; then { grep -v '^pid=' "$marker"; printf 'pid=%s\n' "$$"; } > "$marker.new" && mv "$marker.new" "$marker"; fi   # keeps rev/rows/at/window/member lines, adds the pid
members="$rev"
say() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) release-train-postcheck: $*"; }
late=""; marker_open="$marker"
# ONLY a decided outcome clears the marker: all green, or deploy_hold written for a red row. Two layers against a release joining the window after its tail read the members (Auditor + Lead on #3214:
# it would be live, never proved, no hold): (1) the window is CLOSED ATOMICALLY first (the marker is renamed to <marker>.closed before the members are read, so a later publish finds no open window
# and opens its own with its own tail); (2) belt: at the end every member line still in the closed file, and any stray marker a racing joiner recreated at the open name, that is not in $members
# fails closed (the hold names it). A stray without a pid is also caught by the publisher's stale-marker guard.
scan_late() { # file: member revs (and the opener's rev=) not in $members
  [ -e "$1" ] || return 0
  { sed -n 's/^member=\([0-9a-f]*\) .*/\1/p' "$1"; sed -n 's/^rev=//p' "$1"; } | while read -r r; do case " $members " in *" $r "*) ;; *) echo "$r";; esac; done | tr '\n' ' '
}
close_marker() {
  late=""
  if [ -e "$marker" ]; then mv "$marker" "$marker.final" 2>/dev/null && { late="$(scan_late "$marker.final")"; rm -f "$marker.final"; }; fi
  if [ "$marker" != "$marker_open" ] && [ -e "$marker_open" ]; then late="$late$(scan_late "$marker_open")"; rm -f "$marker_open"; fi
  late=$(printf '%s' "$late" | tr ' ' '\n' | grep -E '^[0-9a-f]+$' | sort -u | paste -sd' ' -)   # each late rev once, no padding
  rm -f "$marker.told" "$marker_open.told"
}
decided() { close_marker; }
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
  if [ -n "${late% }" ]; then
    printf 'late joiners, live and never proved: %s\n' "$late" >> "$hold"
    note "release-train post-publish: release(s) $late joined the window AFTER its tail read the members and were never proved on CI; deploy_hold names them."
  fi
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
  if mv "$marker_open" "$marker_open.closed" 2>/dev/null; then marker="$marker_open.closed"; fi   # CLOSE the window atomically BEFORE reading the members (joiners skip *.closed and open a new window)
  members="$rev $(sed -n 's/^member=\([0-9a-f]*\) .*/\1/p' "$marker" | tr '\n' ' ')"; members=${members% }   # the opener first, then the joiners in publish order
  rows=$( { echo "$rows"; sed -n 's/^member=[0-9a-f]* //p' "$marker"; } | tr ',' '\n' | grep -E '^[0-9]+$' | sort -un | paste -sd, - )
  rev=${members##* }   # the newest member
  say "window of ${window}s closed: members ${members// /, }; ONE CI run for the newest, $rev (rows $rows)"
  if ! POST_PUBLISH_REV=$rev _pp_dispatch "$rev" "${POST_PUBLISH_CI_REF:-codex/01a09a76/task-1}"; then raise "dispatch failed: the release-checks dispatch for the window's newest $rev failed every try (members ${members// /, }); nothing was started on CI"; fi
  rm -f "$(_pp_dispatch_failed_file "$rev0")" "$(_pp_dispatch_failed_file "$rev")"   # this fresh dispatch replaces any the publisher failed
fi
# The publisher's own dispatch failed every try and left a file: dispatch again here (three more tries) before waiting for a run that does not exist; if that fails too the hold says "dispatch failed",
# not "not green" (Strategy 2026-10-20, K6d: HTTP 500, 10 min lost).
failed_file="$(_pp_dispatch_failed_file "$rev0")"; [ -e "$failed_file" ] || failed_file="$(_pp_dispatch_failed_file "$rev")"
if [ -e "$failed_file" ]; then
  say "the publisher's release-checks dispatch for $rev failed every try: dispatching again from the tail"
  if POST_PUBLISH_REV=$rev _pp_dispatch "$rev" "${POST_PUBLISH_CI_REF:-codex/01a09a76/task-1}"; then rm -f "$failed_file"; say "the release-checks dispatch went through on the tail's try"
  else raise "dispatch failed: the release-checks dispatch for $rev failed every try, in the publisher and again in this tail; rows $rows were never started on CI"; fi
fi
# The installed vps-scratch-sweep is a hand-copied delete tool (nothing installs it): say in the log when it differs from ops/vps-scratch-sweep at the live revision. A WARN line only: it never holds,
# never fails the release and never installs (Lead 2026-10-21; scripts/lib/sweep-tool-drift.sh).
. "$dir/lib/sweep-tool-drift.sh"; while IFS= read -r l; do say "$l"; done < <(sweep_tool_drift "$rev" 2>&1 || true)
sleep "${POST_PUBLISH_CI_SETTLE_S:-30}"   # the dispatched run must exist before ci-trusted-checks can wait on it
# WAIT HONESTLY (Strategy + Lead 2026-10-20, K5k and K5m tails raised RED ~4 min into a 1500 s wait while their CI run was still going with 0 failed): a lookup that FAILED, or that found no run
# or stopped waiting with rows unfinished (ci-trusted-checks says "all checks run locally" / "stopped waiting after"), is UNKNOWN, never red: ask again until the wait budget ends. The lookup's own
# stderr goes to the log (it was thrown away, so nobody could see why a tail gave up). Only a finished answer that leaves a row unproved, or an unknown at the end of the budget, can raise.
wait_s="${POST_PUBLISH_CI_WAIT_S:-1500}"; retry_s="${POSTCHECK_RETRY_S:-30}"; deadline=$(( $(date +%s) + wait_s )); errf=$(mktemp "${TMPDIR:-/tmp}/postcheck-lookup.XXXXXX"); why=""
left="$rows"
while :; do
  rem=$(( deadline - $(date +%s) )); [ "$rem" -gt 0 ] || rem=0
  trusted=$(cd "$dir/.." && CI_ROWS_WAIT_S="$rem" $trust "$rev" 2>"$errf"); rc=$?
  while IFS= read -r l; do say "lookup: $l"; done < "$errf"
  unknown=0
  if [ "$rc" -ne 0 ]; then unknown=1; why="the trust lookup failed"
  else
    why=""; left=$(node "$dir/lib/row-placement.mjs" subtract "$rows" "$trusted" 2>/dev/null) || left="$rows"   # fail closed: a failed subtract leaves every row open
    [ -z "$left" ] && break
    grep -qE 'all checks run locally|stopped waiting after' "$errf" && unknown=1
  fi
  if [ "$unknown" -eq 1 ] && [ $(( $(date +%s) + retry_s )) -lt "$deadline" ]; then say "lookup unknown (rc=$rc), rows ${left}: asking again in ${retry_s}s"; sleep "$retry_s"; continue; fi
  break
done
rm -f "$errf"
# A row CI did not prove, but that PASSED in this release's own deploy run (the deploy log of this revision, tree-bound; row 9 runs on the Mac right after Published), is proved: logged, never raised.
if [ -n "$left" ]; then
  kept=""
  for r in ${left//,/ }; do
    if grep -qE "^Release check $r/[0-9]+ passed" "$state/release-train-${rev:0:8}.log" "$state/release-train-${rev:0:8}.resume.log" 2>/dev/null; then say "row $r: not proved on CI, but it passed in this release's own deploy run: not raised"; else kept="$kept,$r"; fi
  done
  left=${kept#,}
fi
[ -z "$left" ] || raise "${why:-rows $left not green on CI for the tree}"
say "post-publish rows $rows for $rev: all CI-trusted (window members: $members)"
close_marker
[ -z "${late% }" ] || raise "release(s) $late joined the window after its members were read: never proved on CI"
note "release-train post-publish: rows $rows for live $rev all green on CI (window members: $members)."
exit 0
