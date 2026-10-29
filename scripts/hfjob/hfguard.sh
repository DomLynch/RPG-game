#!/bin/bash
# hfguard (Strategy + Dom 2026-10-29): server-side enforcement that suites and builds do not run on the VPS. The VPS hit load 68 from lane suites/builds; Dom's ruling: "all lanes' suites/builds move to
# Hugging Face CPU, VPS = live sites only". The Mac hook cannot see a sub-agent's own ssh session, so this lives on the box: /usr/local/bin/{npm,npx,blender,playwright} are symlinks to this file
# (install: scripts/hfjob/install-hfguard.sh). It sits first in PATH for root AND lane users, so nothing a sub-agent types can skip it by choosing a different shell.
#
# What it does, in order:
#   1. not a heavy command (npm test / npm run test* build quality release-checks, npx playwright|vitest|jest|vite build, blender, playwright test): exec the real binary, untouched.
#   2. cwd is not a lane work area (HFGUARD_DIRS, default /srv/dev-jobs:/root:/home:/opt/frankendom-shadow:/tmp:/mnt): exec the real binary. Live-site dirs and deploys are not touched.
#   3. HFGUARD_OK=1: exec the real binary and log the bypass (user, cwd, command) loudly; for a deploy that must build here.
#   4. otherwise re-launch as `hfjob -- <same command>` and exit 75 (EX_TEMPFAIL) with a banner: the command was NOT run here. It is not a pass: read the result with `hfjob logs <id>`.
#   5. hfjob failed (no token for this user, HEAD unpushed and the push failed, HF down): log FAILED-TO-SPILL to stderr and /var/log/hfguard.log with the reason, then refuse (exit 2) when the 1-min
#      load is over HFGUARD_LOAD_MAX (20) and run locally with the banner when it is not. It never fails silently.
# Env (tests): HFGUARD_REAL_DIR (real binaries live here), HFGUARD_LOAD, HFGUARD_HFJOB, HFGUARD_LOG, HFGUARD_DIRS.
set -u

name=$(basename "$0")
case "$name" in
  npm) real=/usr/bin/npm ;;
  npx) real=/usr/bin/npx ;;
  blender) real=/opt/blender/blender-5.2.2-linux-x64/blender ;;
  playwright) real=/usr/local/lib/hfguard/real/playwright ;;
  *) echo "hfguard: invoked as '$name'; link it as npm, npx, blender or playwright" >&2; exit 2 ;;
esac
[ -n "${HFGUARD_REAL_DIR:-}" ] && real="$HFGUARD_REAL_DIR/$name"

heavy=0
case "$name" in
  npm) case "${1:-}" in
         test|t|tst) heavy=1 ;;
         run|run-script) case "${2:-}" in test|test:*|build|build:*|quality|quality:*|release-check|release-checks) heavy=1 ;; esac ;;
       esac ;;
  npx) a=""; for x in "$@"; do case "$x" in -*) ;; *) a=$x; break ;; esac; done
       case "$a" in playwright|vitest|jest) heavy=1 ;; vite) case " $* " in *" build "*) heavy=1 ;; esac ;; esac ;;
  blender) heavy=1 ;;
  playwright) case "${1:-}" in test) heavy=1 ;; esac ;;
esac
[ "$heavy" = 1 ] || exec "$real" "$@"

cwd=$(pwd -P)
in_area=0
IFS=: read -ra dirs <<< "${HFGUARD_DIRS:-/srv/dev-jobs:/root:/home:/opt/frankendom-shadow:/tmp:/mnt}"
for d in "${dirs[@]}"; do case "$cwd/" in "$d"/*) in_area=1 ;; esac; done
[ "$in_area" = 1 ] || exec "$real" "$@"

log="${HFGUARD_LOG:-/var/log/hfguard.log}"
cmdline="$name $*"

if [ "${HFGUARD_OK:-}" = 1 ]; then
  echo "hfguard: HFGUARD_OK=1, running '$cmdline' on this box (logged)" >&2
  printf '%s user=%s cwd=%s event=bypass cmd=%s\n' "$(date -u +%FT%TZ)" "$(id -un)" "$cwd" "$cmdline" >> "$log" 2>/dev/null || true
  exec "$real" "$@"
fi

load=${HFGUARD_LOAD:-$(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo 0)}
load=${load%%.*}
hfjob=${HFGUARD_HFJOB:-hfjob}

if out=$("$hfjob" -- "$name" "$@" 2>&1); then
  printf '%s user=%s cwd=%s event=spilled cmd=%s %s\n' "$(date -u +%FT%TZ)" "$(id -un)" "$cwd" "$cmdline" "$(printf '%s' "$out" | head -n 1)" >> "$log" 2>/dev/null || true
  printf '%s\n' "$out"
  echo "hfguard: '$cmdline' was NOT run on this box (suites, builds and browsers run on Hugging Face CPU; the VPS is for live sites). It was submitted above. This is not a pass: read the result with the hfjob logs line." >&2
  exit 75
fi

reason=$(printf '%s' "$out" | grep -v '^[[:space:]]*$' | tail -n 1 | cut -c1-300)
printf '%s user=%s cwd=%s event=FAILED-TO-SPILL load=%s reason=%s cmd=%s\n' "$(date -u +%FT%TZ)" "$(id -un)" "$cwd" "$load" "$reason" "$cmdline" >> "$log" 2>/dev/null || true
{
  echo "hfguard: !!! FAILED TO SPILL '$cmdline' to Hugging Face: $reason"
  echo "hfguard: Dom + Strategy 2026-10-29: suites/builds do not belong on the VPS. Fix hfjob (token for user '$(id -un)', push of HEAD, HF status) and rerun; logged in $log."
} >&2
if [ "$load" -gt "${HFGUARD_LOAD_MAX:-20}" ] 2>/dev/null; then
  echo "hfguard: refusing to run it here: load $load is over ${HFGUARD_LOAD_MAX:-20}" >&2
  exit 2
fi
echo "hfguard: load $load is under ${HFGUARD_LOAD_MAX:-20}, running it locally this once (logged)" >&2
exec "$real" "$@"
