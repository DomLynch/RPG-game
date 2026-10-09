#!/usr/bin/env bash
# Reads back keys from a box env file (/etc/frankendom/*.env) for an install receipt WITHOUT ever printing a value that could be a secret.
#   bash ops/env-readback.sh <file> [KEY ...]     one line per key: `<KEY> present=y|n len=<n> sha8=<first 8 hex of sha256>`
#                                                 no KEY: every KEY= line in the file, the same way
# A value is shown in clear ONLY when it is a short number (a flag or a port: ^[0-9]{1,6}$), as ` value=<n>`; anything else is length + hash, so a key never leaves the box.
# Two files hold the same secret when their sha8 match. (2026-10-08: a hand-written sed redaction printed ORIGINS_WRITER_INTERNAL_KEY; receipts use this instead.)
set -euo pipefail
file="${1:?usage: env-readback.sh <file> [KEY ...]}"; shift
[ -r "$file" ] || { echo "env-readback: cannot read $file" >&2; exit 1; }
hash() { if command -v sha256sum >/dev/null; then printf %s "$1" | sha256sum | cut -c1-8; else printf %s "$1" | shasum -a 256 | cut -c1-8; fi; }
keys=("$@")
if [ ${#keys[@]} -eq 0 ]; then while IFS= read -r k; do keys+=("$k"); done < <(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$file"); fi   # no mapfile: macOS bash 3.2 runs the test too
for k in "${keys[@]}"; do
  [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "env-readback: not a key name: $k" >&2; exit 1; }
  if ! grep -q "^$k=" "$file"; then echo "$k present=n"; continue; fi
  v="$(grep "^$k=" "$file" | tail -n 1 | cut -d= -f2-)"
  if [[ "$v" =~ ^[0-9]{1,6}$ ]]; then echo "$k present=y value=$v"; else echo "$k present=y len=${#v} sha8=$(hash "$v")"; fi
done
