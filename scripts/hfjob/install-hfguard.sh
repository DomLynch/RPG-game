#!/bin/sh
# Install hfguard on the VPS (Strategy + Dom 2026-10-29). Run as root from a checkout that has scripts/hfjob/hfguard.sh. Idempotent; `install-hfguard.sh uninstall` puts everything back.
#   - /usr/local/lib/hfguard/hfguard.sh is the one script
#   - /usr/local/bin/{npm,npx,blender,playwright} become symlinks to it (PATH has /usr/local/bin before /usr/bin for root and the lane users)
#   - the existing /usr/local/bin/blender (symlink) and /usr/local/bin/playwright (python entry point) are kept: blender via its absolute path inside hfguard, playwright moved to /usr/local/lib/hfguard/real/
#   - /var/log/hfguard.log is created world-appendable
set -eu
here=$(dirname "$(readlink -f "$0")")
lib=/usr/local/lib/hfguard
bin=/usr/local/bin
if [ "${1:-}" = uninstall ]; then
  for n in npm npx blender; do [ -L "$bin/$n" ] && [ "$(readlink "$bin/$n")" = "$lib/hfguard.sh" ] && rm -f "$bin/$n"; done
  [ -L "$bin/playwright" ] && rm -f "$bin/playwright"
  [ -f "$lib/real/playwright" ] && mv "$lib/real/playwright" "$bin/playwright"
  [ -f "$lib/blender.orig" ] && { rm -f "$bin/blender"; mv "$lib/blender.orig" "$bin/blender"; }
  echo "hfguard: uninstalled"; exit 0
fi
[ "$(id -u)" = 0 ] || { echo "install-hfguard: run as root" >&2; exit 2; }
bash -n "$here/hfguard.sh"
mkdir -p "$lib/real"
install -m 0755 "$here/hfguard.sh" "$lib/hfguard.sh"
touch /var/log/hfguard.log && chmod 0666 /var/log/hfguard.log
# keep the originals that hfguard execs
[ -e "$bin/playwright" ] && [ ! -L "$bin/playwright" ] && mv "$bin/playwright" "$lib/real/playwright"
[ -L "$bin/blender" ] && [ "$(readlink "$bin/blender")" != "$lib/hfguard.sh" ] && { cp -P "$bin/blender" "$lib/blender.orig"; rm -f "$bin/blender"; }
for n in npm npx blender playwright; do ln -sf "$lib/hfguard.sh" "$bin/$n"; done
echo "hfguard: installed ($(sha256sum "$lib/hfguard.sh" | cut -c1-12)); try: cd /srv/dev-jobs/x && npm test  -> spills to hfjob, exit 75"
