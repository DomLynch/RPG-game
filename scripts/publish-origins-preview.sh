#!/usr/bin/env bash
# Publish /preview/origins/ (also served at /zone1/) from the checkout's own tree (Deploy, 2026-10-08).
# deploy.sh only carries previews forward; it never rebuilds them, so after every release that changes origins/preview this
# is the step that makes the page match the live revision. Order matters and is the point of the script:
#   1. build with VITE_SUPABASE_* in the PROCESS environment (the preview's vite root is origins/preview, so vite does not read the
#      repo-root .env.production.local itself);
#   2. node scripts/check-built-account.mjs on the build, BEFORE any copy: a guest-only bundle would make the session refresh a silent no-op;
#   3. rsync --delete into current/preview/origins/, then curl the page and its bundle.
#   scripts/publish-origins-preview.sh              build, check, publish
#   scripts/publish-origins-preview.sh --dry-run    build and check only; nothing is copied
# The checkout must be at the live revision (release.json) unless --allow-mismatch is given.
set -euo pipefail
cd "$(dirname "$0")/.."
dry=0 mismatch=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry=1 ;;
    --allow-mismatch) mismatch=1 ;;
    *) echo "usage: $0 [--dry-run] [--allow-mismatch]" >&2; exit 2 ;;
  esac
done
host="${PUBLISH_HOST:-root@49.12.7.18}" key="${PUBLISH_KEY:-$HOME/.ssh/binance_futures_tool}"
dest="${PUBLISH_DEST:-/var/www/frankendom/current/preview/origins/}" site="${PUBLISH_SITE:-https://frankendom.com}"
head="$(git rev-parse HEAD)" live="$(curl -fsS "$site/release.json" | sed -n 's/.*"revision":"\([0-9a-f]*\)".*/\1/p')"
if [ "$head" != "$live" ] && [ "$mismatch" = 0 ]; then echo "checkout $head is not the live revision $live (use --allow-mismatch to publish anyway)" >&2; exit 1; fi
[ -f .env.production.local ] || { echo ".env.production.local is missing: a guest-only preview would ship" >&2; exit 1; }
rm -rf artifacts/origins-preview
( set -a; . ./.env.production.local; set +a; npx vite build --config origins/preview/vite.config.mjs >/dev/null )
node scripts/check-built-account.mjs artifacts/origins-preview
if [ "$dry" = 1 ]; then echo "dry run: built and checked $head, nothing copied"; exit 0; fi
rsync -a --delete -e "ssh -i $key -o BatchMode=yes" artifacts/origins-preview/ "$host:$dest"
bundle="$(ls artifacts/origins-preview/assets | grep -m1 '^index-.*\.js$')"
curl -fsS -o /dev/null "$site/preview/origins/" && curl -fsS -o /dev/null "$site/preview/origins/assets/$bundle"
echo "published $head to $dest ($bundle)"
