# Release pipelining (Dom 2026-10-12, step 3 of the 40-runner work), sourced by scripts/deploy.sh: candidate N+1 runs its checks while N
# publishes. Each candidate runs deploy.sh in its own checkout (scripts/release-worktree.sh), so dist/, artifacts/ and the HF ledger are
# never shared; what two runs DO share is guarded here:
#   - the in-flight marker: one file per run in $DEPLOY_RUNS_DIR, plus the legacy $DEPLOY_LOCK the Claude hooks and rollback.sh read, which
#     always names a live run while any run is alive (the newest takes it; a finishing run hands it to a survivor or removes it);
#   - the publish lock ($DEPLOY_PUBLISH_LOCK): held ONLY from "transfer + switch" to the prune, so one release reaches the box at a time;
#   - the Mac-rows lock ($DEPLOY_ROWS_LOCK): the local release rows of one run at a time (Dom 2026-10-10: two WebKit rows at once put the load at 30);
#   - the superseded guard: under the publish lock, a candidate the live release already contains publishes nothing (N+1 may finish first).
# Locks are mkdir directories holding the owner's pid (macOS has no flock); a lock whose pid is dead is broken, never waited on.
# Works on macOS bash 3.2. Env: DEPLOY_LOCK, DEPLOY_RUNS_DIR, DEPLOY_PUBLISH_LOCK, DEPLOY_ROWS_LOCK, DEPLOY_LOCK_WAIT_S (default 1800), DEPLOY_LOCK_POLL_S.
DEPLOY_LOCK="${DEPLOY_LOCK:-$HOME/.claude/state/deploy_in_flight.json}"
DEPLOY_RUNS_DIR="${DEPLOY_RUNS_DIR:-$(dirname "$DEPLOY_LOCK")/deploy_runs}"
DEPLOY_PUBLISH_LOCK="${DEPLOY_PUBLISH_LOCK:-$(dirname "$DEPLOY_LOCK")/deploy_publish.lock}"
DEPLOY_ROWS_LOCK="${DEPLOY_ROWS_LOCK:-$(dirname "$DEPLOY_LOCK")/deploy_rows.lock}"
DEPLOY_LOCKS_HELD=""
deploy_pid_of() { sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$1" 2>/dev/null | head -n 1; }
deploy_lock_take() {   # the in-flight marker; $1 = revision
  mkdir -p "$DEPLOY_RUNS_DIR"
  printf '{"revision":"%s","started":"%s","pid":%d,"cwd":"%s"}\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$" "$PWD" > "$DEPLOY_RUNS_DIR/$$.json"
  cp "$DEPLOY_RUNS_DIR/$$.json" "$DEPLOY_LOCK"
}
deploy_lock_wait() {   # $1 = lock dir, $2 = what it guards (for the log); waits for a live holder, breaks a dead one
  local dir="$1" waited=0 holder
  while ! mkdir "$dir" 2>/dev/null; do
    holder=$(cat "$dir/pid" 2>/dev/null || true)
    if [[ -n "$holder" ]] && ! kill -0 "$holder" 2>/dev/null; then echo "$2 lock: holder pid $holder is dead, breaking it"; rm -rf "$dir"; continue; fi
    if (( waited >= ${DEPLOY_LOCK_WAIT_S:-1800} )); then echo "$2 lock: still held by pid ${holder:-?} ($(cat "$dir/revision" 2>/dev/null || echo '?')) after ${waited}s; giving up" >&2; return 1; fi
    (( waited % 60 == 0 )) && echo "$2 lock: waiting for pid ${holder:-?} ($(cat "$dir/revision" 2>/dev/null || echo '?'))"
    sleep "${DEPLOY_LOCK_POLL_S:-5}"; waited=$(( waited + ${DEPLOY_LOCK_POLL_S:-5} ))
  done
  echo "$$" > "$dir/pid"; printf '%s' "${revision:-}" > "$dir/revision"
  DEPLOY_LOCKS_HELD="$DEPLOY_LOCKS_HELD $dir"
  (( waited == 0 )) || echo "$2 lock: taken after ${waited}s"
}
deploy_lock_drop() {   # $1 = lock dir; only ever removes a lock this run holds
  [[ "$(cat "$1/pid" 2>/dev/null)" == "$$" ]] && rm -rf "$1"
  DEPLOY_LOCKS_HELD="${DEPLOY_LOCKS_HELD// $1/}"
  return 0
}
deploy_lock_release() {   # the EXIT trap: every lock this run holds, then the marker (handed to a live run, or removed)
  local dir file pid
  for dir in $DEPLOY_LOCKS_HELD; do deploy_lock_drop "$dir"; done
  rm -f "$DEPLOY_RUNS_DIR/$$.json"
  [[ "$(deploy_pid_of "$DEPLOY_LOCK")" == "$$" ]] || return 0
  for file in "$DEPLOY_RUNS_DIR"/*.json; do
    [[ -e "$file" ]] || continue
    pid=$(deploy_pid_of "$file")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then cp "$file" "$DEPLOY_LOCK"; return 0; fi
    rm -f "$file"   # a run killed without its trap
  done
  rm -f "$DEPLOY_LOCK"
}
# Under the publish lock: "superseded" when the live revision already contains this one (git decides; the live sha is fetched if unknown),
# "ok" otherwise. An unknown live revision is "ok": the switch below is atomic and the cmp checks still verify what went live.
deploy_superseded() {   # $1 = live revision (may be empty), $2 = this revision
  [[ -n "$1" && "$1" != "$2" ]] || { echo ok; return 0; }
  git cat-file -e "$1^{commit}" 2>/dev/null || git fetch -q origin 2>/dev/null || true
  if git merge-base --is-ancestor "$2" "$1" 2>/dev/null; then echo superseded; else echo ok; fi
}
