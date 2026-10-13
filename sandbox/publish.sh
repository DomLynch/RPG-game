#!/usr/bin/env bash
# Combat Sandbox preview: sync this worktree's tracked files to the VPS, build there with the sandbox config, copy into the served
# /preview/sandbox/ folder of the current release. No release rows, no lock, the live revision does not change.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$HOME/.ssh/binance_futures_tool"; HOST=root@49.12.7.18; DIR=/root/frankendom-worktrees/sandbox
SSH=(ssh -i "$KEY" -o BatchMode=yes)
TRUNK=origin/codex/01a09a76/task-1
BASE=$(git rev-parse --short "$(git merge-base HEAD $TRUNK)")
MECHS=$(git log --format=%s "$TRUNK"..HEAD | sed -n 's/^sandbox-mech: //p' | paste -sd, - | sed 's/,/, /g'); MECHS=${MECHS:-none}
LIST=$(mktemp); { git ls-files; ls sandbox/*; } | sort -u > "$LIST"
"${SSH[@]}" "$HOST" "mkdir -p $DIR"
rsync -a -e "ssh -i $KEY -o BatchMode=yes" --files-from="$LIST" . "$HOST:$DIR/"
"${SSH[@]}" "$HOST" "set -e; cd $DIR; [ -d node_modules ] && cmp -s package-lock.json node_modules/.lock-copy || { nice npm ci --no-audit --no-fund >/dev/null && cp package-lock.json node_modules/.lock-copy; }
  FP=\$(nice node scripts/rng-fingerprint.mjs | sha256sum | cut -c1-12)
  export SANDBOX_INFO="trunk $BASE · engine fingerprint \$FP (rows off) · mechs: $MECHS"
  nice npx vite build --config sandbox/vite.config.mjs --base /preview/sandbox/ --outDir dist-sandbox --emptyOutDir >/dev/null
  T=/var/www/frankendom/current/preview/sandbox; rm -rf \$T.new; cp -r dist-sandbox \$T.new; rm -rf \$T; mv \$T.new \$T; echo published \$(readlink -f /var/www/frankendom/current)"
echo "https://frankendom.com/preview/sandbox/  (trunk $BASE, branch $(git rev-parse --short HEAD), mechs: $MECHS)"
