#!/usr/bin/env bash
# Installs Frankendom's journald drop-in (ops/journald-frankendom.conf -> /etc/systemd/journald.conf.d/zz-frankendom.conf) on the VPS, as root. Idempotent: an identical file is left alone and
# journald is NOT restarted. A changed file is installed and systemd-journald is restarted once (its logs are kept; a restart is how journald re-reads its config). Touches nothing else:
# the other projects' drop-ins (size.conf, elite-trader.conf) are not edited. JOURNALD_ROOT (tests only) puts the paths under a prefix.
#   bash ops/install-journald.sh            install / update
#   bash ops/install-journald.sh --remove   remove the drop-in (the box goes back to size.conf's 500M) and restart journald
set -euo pipefail
root="${JOURNALD_ROOT:-}"
here="$(cd "$(dirname "$0")" && pwd)"
dest="$root/etc/systemd/journald.conf.d/zz-frankendom.conf"
if [ "${1:-}" = "--remove" ]; then
  [ -e "$dest" ] || { echo "install-journald: no $dest, nothing to remove"; exit 0; }
  rm -f "$dest"; systemctl restart systemd-journald; echo "install-journald: removed $dest, journald restarted"; exit 0
fi
if [ -f "$dest" ] && cmp -s "$here/journald-frankendom.conf" "$dest"; then echo "install-journald: $dest is already current; journald not restarted"; exit 0; fi
install -D -m 0644 "$here/journald-frankendom.conf" "$dest"
systemctl restart systemd-journald
echo "install-journald: installed $dest and restarted journald (logs kept)"
