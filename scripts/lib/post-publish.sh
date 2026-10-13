# Post-publish rows (scripts/lib/row-placement.mjs POST_PUBLISH): slow rows that are not boot-critical run right AFTER the Published line, against the release that is already live.
# post_publish_rows <revision> <rows csv>: runs only those rows (release-checks.mjs, RELEASE_CHECKS_ONLY, its own receipt and log folder). A pass prints one line. A failure prints a
# RED line, writes deploy_hold if nobody holds the box (the next publish waits for a person) and returns 1, so deploy.sh exits 1 and the release train STOPS and keeps its hold
# (release-train-publish.sh): never a silent pass. The hold's first line carries no digit (the train reads digits there as a publisher pid).
# Third argument (optional, deploy.sh passes it for the Mac rows when the release is safe to undo): a command (or a deploy.sh function name) that puts the previous release back. A failed row then
# also runs it, prints ROLLED BACK (or ROLLBACK FAILED) and still holds the box and returns 1: the candidate is looked at by a person either way.
# POST_PUBLISH_PROMOTE=0 keeps a pass from promoting the pending full-run stamp. Env (tests): POST_PUBLISH_RUN (the command, default node scripts/release-checks.mjs), DEPLOY_HOLD_FILE.
post_publish_rows() {
  local rev="$1" rows="$2" rollback="${3:-}" hold="${DEPLOY_HOLD_FILE:-$HOME/.claude/state/deploy_hold}"
  [[ -n "$rows" ]] || return 0
  echo "post-publish rows $rows for $rev: running now, the release is live"
  if RELEASE_CHECKS_ONLY="$rows" RELEASE_CHECKS_DEFERRED="" RELEASE_CHECKS_SKIP="" RELEASE_CHECKS_OUT_OF_SCOPE="" \
      RELEASE_CHECKS_RECEIPT=artifacts/post-publish-rows.json RELEASE_CHECKS_LOG_DIR=artifacts/post-publish-rows bash -c "${POST_PUBLISH_RUN:-node scripts/release-checks.mjs}"; then
    echo "post-publish rows $rows passed for $rev"
    [[ "${POST_PUBLISH_PROMOTE:-1}" == 1 ]] || return 0   # another post-publish group is still owed (deploy.sh runs the Mac rows apart): it promotes
    # The pre-publish run was full but for these rows (release-checks.mjs left artifacts/pending-full-release.json): they passed, so it counts as a full run now.
    node -e 'const fs=require("fs");const [pending,full,rev]=process.argv.slice(1);try{if(JSON.parse(fs.readFileSync(pending,"utf8")).revision===rev){fs.renameSync(pending,full);console.log("full-run stamp promoted for "+rev)}}catch{}' artifacts/pending-full-release.json artifacts/last-full-release.json "$rev"
    return 0
  fi
  rm -f artifacts/pending-full-release.json   # a failed post-publish row never makes the run full
  echo "RED: post-publish rows $rows FAILED for the LIVE release $rev: the release stays live, the next publish is held until a person looks (logs: artifacts/post-publish-rows)" >&2
  [[ -e "$hold" ]] || printf 'post-publish rows failed for a live release; remove this file after looking\nrows %s revision %s at %s\n' "$rows" "$rev" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$hold"
  if [[ -n "$rollback" ]]; then
    # a subshell: deploy.sh passes a function name (it needs the ssh options and presence_back); a command string, and `exit` in it, work too
    if ( eval "$rollback" ); then echo "ROLLED BACK: rows $rows failed for $rev, the previous release is live again (hold kept)" >&2
    else echo "ROLLBACK FAILED: rows $rows failed for the LIVE release $rev and the rollback command did not complete: $rollback" >&2; fi
  fi
  return 1
}
