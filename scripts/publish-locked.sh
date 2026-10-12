#!/usr/bin/env bash
# Run one live-box command under deploy.sh's publish lock (scripts/lib/deploy-lock.sh), so it never overlaps another release's transfer
# + switch: the Origins writer reinstall, a hand-run provision. Waits for a live holder, breaks a dead one, releases on any exit.
#   bash scripts/publish-locked.sh <command> [args...]      e.g. bash scripts/publish-locked.sh ssh root@host 'bash apply-1880.sh install <sha>'
set -euo pipefail
(( $# )) || { echo "usage: publish-locked.sh <command> [args...]" >&2; exit 2; }
source "$(dirname "$0")/lib/deploy-lock.sh"
trap 'deploy_lock_release' EXIT
revision="publish-locked: $1"
deploy_lock_wait "$DEPLOY_PUBLISH_LOCK" publish
"$@"
