# Post-publish rows (scripts/lib/row-placement.mjs POST_PUBLISH): slow rows that are not boot-critical run right AFTER the Published line, against the release that is already live.
# post_publish_rows <revision> <rows csv>: runs only those rows (release-checks.mjs, RELEASE_CHECKS_ONLY, its own receipt and log folder). A pass prints one line. A failure prints a
# RED line, writes deploy_hold if nobody holds the box (the next publish waits for a person) and returns 1, so deploy.sh exits 1 and the release train STOPS and keeps its hold
# (release-train-publish.sh): never a silent pass. The hold's first line carries no digit (the train reads digits there as a publisher pid).
# Third argument (optional, deploy.sh passes it for the Mac rows when the release is safe to undo): a command (or a deploy.sh function name) that puts the previous release back. A failed row then
# also runs it, prints ROLLED BACK (or ROLLBACK FAILED) and still holds the box and returns 1: the candidate is looked at by a person either way.
# After a rollback no later group starts (post_publish_rows returns 1 with a SKIPPED line, never "live" for the rolled-back revision), and when POST_PUBLISH_LIVE_CMD (deploy.sh: the release.json
# lookup) is set, the live revision must equal the rows' target before they start (EB drill 2026-10-13: rows 9,46 ran after ROLLED BACK). The hold file is no guard: the train keeps it during every publish.
# POST_PUBLISH_PROMOTE=0 keeps a pass from promoting the pending full-run stamp. Env (tests): POST_PUBLISH_RUN (the command, default node scripts/release-checks.mjs), DEPLOY_HOLD_FILE.
# post_publish_ci_rows <revision> <rows csv>: prints (stdout) the rows the Mac still has to run; everything it says goes to stderr. Lead + Strategy 2026-10-17 (the IF publish put 14 rows on a Mac at load ~27):
# a post-publish row goes to the GitHub runners like a pre-publish one. CI leaves these rows out of a candidate's matrix but a workflow_dispatch runs them, so a row already green on CI for this tree is
# trusted (scripts/ci-trusted-checks.mjs: by tree, with a receipt), and for the rest one `release-checks` dispatch is started on the trunk ref with ref=<revision> and waited for (POST_PUBLISH_CI_WAIT_S, default
# 1200). Only what CI could not prove (WebKit/iPhone rows, a red or missing row, gh down) is left for the Mac, exactly as before. POST_PUBLISH_CI=off skips all of it. No workflow file is touched.
_pp_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# Two steps so the Mac group (which can roll the release back) never waits on CI (Lead, review of #3106): post_publish_ci_start looks once, dispatches the run for the rows CI has not proved and returns at once
# (stdout: the rows still open on CI); deploy.sh then runs the rollback-capable Mac group; post_publish_ci_collect waits (bounded) for the run and prints the rows the Mac must still run.
# Fail closed: a subtract that fails (_pp_left) leaves EVERY row for the Mac; the dispatch failing or CI being down does the same.
_pp_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
_pp_left() { node "$_pp_dir/row-placement.mjs" subtract "$1" "$2" 2>/dev/null || printf '%s' "$1"; }
# _pp_dispatch <revision> <ref>: start the release-checks run, and try again when GitHub says no (Strategy 2026-10-20: K6d's dispatch got an HTTP 500, nothing retried, the tail then found no run and
# raised RED, 10 min lost). POST_PUBLISH_DISPATCH_TRIES (default 3 = two more tries) and POST_PUBLISH_DISPATCH_RETRY_S (default 30) apart. Returns 1 only when every try failed.
_pp_dispatch() {
  local rev="$1" ref="$2" n=1 max="${POST_PUBLISH_DISPATCH_TRIES:-3}" gap="${POST_PUBLISH_DISPATCH_RETRY_S:-30}"
  while :; do
    if ${POST_PUBLISH_DISPATCH:-gh workflow run release-checks.yml --ref $ref -f ref=$rev} >&2 2>&1; then return 0; fi
    echo "post-publish: the release-checks dispatch failed (try $n of $max)" >&2
    [ "$n" -lt "$max" ] || return 1
    n=$((n + 1)); sleep "$gap"
  done
}
# A dispatch that failed every try leaves this file for the CI tail (scripts/release-train-postcheck.sh), which dispatches once more and, if that fails too, holds with "dispatch failed" instead of "not green".
_pp_dispatch_failed_file() { echo "${RELEASE_TRAIN_STATE:-$HOME/.claude/state}/post-publish-dispatch-failed-${1:0:8}"; }
post_publish_ci_start() {
  local rev="$1" rows="$2" trusted left
  local trust="${POST_PUBLISH_TRUSTED_CMD:-node scripts/ci-trusted-checks.mjs}" ref="${POST_PUBLISH_CI_REF:-codex/01a09a76/task-1}"
  [[ -n "$rows" ]] || return 0
  if [[ "${POST_PUBLISH_CI:-on}" == off ]]; then printf '%s' "$rows"; return 0; fi
  trusted=$($trust "$rev" 2>/dev/null || true)
  left=$(_pp_left "$rows" "$trusted")
  if [[ -n "$left" ]]; then
    echo "post-publish rows $left for $rev: not yet green on CI for this tree, dispatching release-checks on $ref (ref=$rev)" >&2
    if ! _pp_dispatch "$rev" "$ref"; then
      echo "post-publish: the release-checks dispatch failed every try; the Mac runs rows $left" >&2
      { mkdir -p "$(dirname "$(_pp_dispatch_failed_file "$rev")")" && printf 'rows %s revision %s ref %s at %s\n' "$left" "$rev" "$ref" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$(_pp_dispatch_failed_file "$rev")"; } 2>/dev/null || true
    fi
  fi
  printf '%s' "$left"
}
# post_publish_ci_collect <revision> <rows csv> <rows still open after _start>: the rows the Mac runs.
post_publish_ci_collect() {
  local rev="$1" rows="$2" open="$3" trusted left
  local trust="${POST_PUBLISH_TRUSTED_CMD:-node scripts/ci-trusted-checks.mjs}"
  [[ -n "$rows" ]] || return 0
  if [[ "${POST_PUBLISH_CI:-on}" == off ]]; then printf '%s' "$rows"; return 0; fi
  left="$open"
  if [[ -n "$open" ]]; then
    sleep "${POST_PUBLISH_CI_SETTLE_S:-30}"   # the run must exist before ci-trusted-checks can wait on it
    trusted=$(CI_ROWS_WAIT_S="${POST_PUBLISH_CI_WAIT_S:-1200}" $trust "$rev" 2>/dev/null || true)
    left=$(_pp_left "$rows" "$trusted")
  fi
  echo "post-publish rows $rows for $rev: Mac ${left:-none}, the rest CI-trusted" >&2
  printf '%s' "$left"
}
# The pre-publish run was full but for the post-publish rows (release-checks.mjs left artifacts/pending-full-release.json): once they all passed it counts as a full run.
post_publish_promote_stamp() {
  node -e 'const fs=require("fs");const [pending,full,rev]=process.argv.slice(1);try{if(JSON.parse(fs.readFileSync(pending,"utf8")).revision===rev){fs.renameSync(pending,full);console.log("full-run stamp promoted for "+rev)}}catch{}' artifacts/pending-full-release.json artifacts/last-full-release.json "$1"
}

post_publish_rows() {
  local rev="$1" rows="$2" rollback="${3:-}" hold="${DEPLOY_HOLD_FILE:-$HOME/.claude/state/deploy_hold}"
  [[ -n "$rows" ]] || return 0
  if [[ "${POST_PUBLISH_ROLLED_BACK:-0}" == 1 ]]; then echo "post-publish rows $rows SKIPPED for $rev: it was rolled back, no row runs against it" >&2; return 1; fi
  if [[ -n "${POST_PUBLISH_LIVE_CMD:-}" ]]; then
    local live_rev; live_rev=$(eval "$POST_PUBLISH_LIVE_CMD" 2>/dev/null || true)
    if [[ "$live_rev" != "$rev" ]]; then echo "post-publish rows $rows SKIPPED for $rev: live is ${live_rev:-unknown}, not $rev" >&2; return 1; fi
  fi
  echo "post-publish rows $rows for $rev: running now, the release is live"
  if RELEASE_CHECKS_ONLY="$rows" RELEASE_CHECKS_DEFERRED="" RELEASE_CHECKS_SKIP="" RELEASE_CHECKS_OUT_OF_SCOPE="" \
      RELEASE_CHECKS_RECEIPT=artifacts/post-publish-rows.json RELEASE_CHECKS_LOG_DIR=artifacts/post-publish-rows bash -c "${POST_PUBLISH_RUN:-node scripts/release-checks.mjs}"; then
    echo "post-publish rows $rows passed for $rev"
    [[ "${POST_PUBLISH_PROMOTE:-1}" == 1 ]] || return 0   # another post-publish group is still owed (deploy.sh runs the Mac rows apart): it promotes
    post_publish_promote_stamp "$rev"   # they passed, so the run counts as a full one now
    return 0
  fi
  rm -f artifacts/pending-full-release.json   # a failed post-publish row never makes the run full
  echo "RED: post-publish rows $rows FAILED for the LIVE release $rev: the release stays live, the next publish is held until a person looks (logs: artifacts/post-publish-rows)" >&2
  [[ -e "$hold" ]] || printf 'post-publish rows failed for a live release; remove this file after looking\nrows %s revision %s at %s\n' "$rows" "$rev" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$hold"
  if [[ -n "$rollback" ]]; then
    # a subshell: deploy.sh passes a function name (it needs the ssh options and presence_back); a command string, and `exit` in it, work too
    if ( eval "$rollback" ); then POST_PUBLISH_ROLLED_BACK=1; echo "ROLLED BACK: rows $rows failed for $rev, the previous release is live again (hold kept)" >&2
    else echo "ROLLBACK FAILED: rows $rows failed for the LIVE release $rev and the rollback command did not complete: $rollback" >&2; fi
  fi
  return 1
}
