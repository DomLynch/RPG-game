#!/usr/bin/env bash
# Installs the CPUWeight=1000 drop-in (ops/frankendom-cpuweight.conf) for the three live services on the VPS, as root: frankendom-origins-writer, frankendom-presence, frankendom-duel-relay.
# It copies the file and runs `systemctl daemon-reload`; it NEVER restarts or stops anything (a weight applies to the running cgroup after the reload, and a restart would drop open duels and world sessions).
# Idempotent: an identical file is left alone and nothing is reloaded. Touches only /etc/systemd/system/<unit>.service.d/10-cpuweight.conf; the units, their other drop-ins (including a runtime
# /run/systemd/system.control one from `systemctl set-property --runtime`) and every other project's files are not read or changed. CPUWEIGHT_ROOT (tests only) puts the paths under a prefix.
#   bash ops/install-cpuweight.sh            install / update
#   bash ops/install-cpuweight.sh --remove   remove the three drop-ins and daemon-reload (the units go back to the default weight 100, unless a runtime drop-in sets one)
# Not run by deploy.sh: the deployer runs it by hand when this file changes. Receipt: `systemctl show -p CPUWeight <unit>` for all three.
set -euo pipefail
root="${CPUWEIGHT_ROOT:-}"
here="$(cd "$(dirname "$0")" && pwd)"
units="frankendom-origins-writer frankendom-presence frankendom-duel-relay"
changed=0
for u in $units; do
  dest="$root/etc/systemd/system/$u.service.d/10-cpuweight.conf"
  if [ "${1:-}" = "--remove" ]; then
    [ -e "$dest" ] || { echo "install-cpuweight: no $dest, nothing to remove"; continue; }
    rm -f "$dest"; changed=1; echo "install-cpuweight: removed $dest"; continue
  fi
  if [ -f "$dest" ] && cmp -s "$here/frankendom-cpuweight.conf" "$dest"; then echo "install-cpuweight: $dest is already current"; continue; fi
  install -D -m 0644 "$here/frankendom-cpuweight.conf" "$dest"; changed=1; echo "install-cpuweight: installed $dest"
done
if [ "$changed" = 1 ]; then systemctl daemon-reload; echo "install-cpuweight: daemon-reload done; no unit restarted"; else echo "install-cpuweight: nothing changed; no reload"; fi
