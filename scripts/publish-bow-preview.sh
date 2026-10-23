#!/usr/bin/env bash
# Publish the bow sandbox page to /preview/bows/ (Deploy; the look-test path: no release rows, no lock, the live revision does not change).
#   scripts/publish-bow-preview.sh            build and publish
#   scripts/publish-bow-preview.sh --dry-run  build only
set -euo pipefail
cd "$(dirname "$0")/.."
dry=0; [ "${1:-}" = "--dry-run" ] && dry=1
host="${PUBLISH_HOST:-root@49.12.7.18}" key="${PUBLISH_KEY:-$HOME/.ssh/binance_futures_tool}" dest="${PUBLISH_DEST:-/var/www/frankendom/current/preview/bows/}" site="${PUBLISH_SITE:-https://frankendom.com}"
rm -rf artifacts/bow-preview
npx vite build --config vite.bow-preview.config.mjs >/dev/null
cp artifacts/bow-preview/bow-preview.html artifacts/bow-preview/index.html
if [ "$dry" = 1 ]; then echo "dry run: built $(git rev-parse --short HEAD), nothing copied"; exit 0; fi
rsync -a --delete -e "ssh -i $key -o BatchMode=yes" artifacts/bow-preview/ "$host:$dest"
curl -fsS -o /dev/null "$site/preview/bows/" && echo "published $(git rev-parse --short HEAD) to $site/preview/bows/"
