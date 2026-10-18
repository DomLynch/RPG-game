#!/usr/bin/env bash
# Run a command in the sandbox worktree's VPS copy (heavy runs never on the Mac): sync tracked + sandbox files, then run it there.
#   sandbox/vps-run.sh node --test tests/sandbox-wounds.test.ts
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$HOME/.ssh/binance_futures_tool"; HOST=root@49.12.7.18; DIR=/root/frankendom-worktrees/sandbox
LIST=$(mktemp); { git ls-files; git ls-files --others --exclude-standard; find sandbox -type f; } | sort -u | while read -r f; do [ -f "$f" ] && echo "$f"; done > "$LIST"
rsync -a -e "ssh -i $KEY -o BatchMode=yes" --files-from="$LIST" . "$HOST:$DIR/"
ssh -i "$KEY" -o BatchMode=yes "$HOST" "cd $DIR && nice $(printf '%q ' "$@")"
