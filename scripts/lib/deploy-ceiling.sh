# Whole-deploy ceiling, sourced by scripts/deploy.sh. Deploy #71 (2026-09-21) sat 65 minutes in one wedged child with nothing above
# it to notice; per-check ceilings (#369) cover the release checks, this covers everything else — the quality gate, the transfer, the
# remote switch. After DEPLOY_CEILING_S (default 50 min) the watchdog names the current step, SIGKILLs every descendant of the deploy
# and leaves a marker; the killed step fails under set -e, deploy.sh's EXIT trap runs as usual, and deploy_ceiling_off — which must be
# the LAST command of that trap — turns the exit into 124. Works on macOS bash 3.2. `deploy_step NAME` records the step being run.
DEPLOY_CEILING_S="${DEPLOY_CEILING_S:-3000}"
DEPLOY_STEP_FILE="$(mktemp -t frankendom-deploy-step)"
deploy_step() { printf '%s' "$1" > "$DEPLOY_STEP_FILE"; echo "== $1"; }
deploy_descendants() { local pid; for pid in $(pgrep -P "$1" 2>/dev/null); do deploy_descendants "$pid"; echo "$pid"; done; }
deploy_ceiling_hit() {   # runs inside the watchdog subshell; bash 3.2 has no BASHPID, so the subshell learns its own pid via sh
  local me; me=$(sh -c 'echo $PPID')
  echo "Deploy ceiling: no exit after ${DEPLOY_CEILING_S}s in step '$(cat "$DEPLOY_STEP_FILE" 2>/dev/null)' — killing the deploy" >&2
  : > "$DEPLOY_STEP_FILE.hit"
  deploy_descendants "$$" | grep -v "^${me}$" | xargs kill -KILL 2>/dev/null || true
}
( sleep "$DEPLOY_CEILING_S"; deploy_ceiling_hit ) &
DEPLOY_WATCHDOG=$!
# Every line tolerates "already gone": this runs from the EXIT trap under set -e, and a failing kill must not abort the trap.
deploy_ceiling_off() {
  pkill -P "$DEPLOY_WATCHDOG" 2>/dev/null || true; kill "$DEPLOY_WATCHDOG" 2>/dev/null || true
  local hit=0; [ -e "$DEPLOY_STEP_FILE.hit" ] && hit=1
  rm -f "$DEPLOY_STEP_FILE" "$DEPLOY_STEP_FILE.hit"
  [ "$hit" = 1 ] && exit 124
  return 0
}
