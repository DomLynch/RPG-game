#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing a dirty release'; exit 1; }
node --input-type=module -e 'import { loadEnv } from "vite"; const dsn = process.env.VITE_SENTRY_DSN || loadEnv("production", process.cwd()).VITE_SENTRY_DSN; if (!dsn || new URL(dsn).protocol !== "https:") throw new Error("Configure VITE_SENTRY_DSN before deployment");'
export VITE_SENTRY_RELEASE="$(git rev-parse HEAD)"
npm run quality
revision=$(git rev-parse HEAD)
printf '{"revision":"%s","phase":"0A"}\n' "$revision" > dist/release.json
host=root@49.12.7.18
key="$HOME/.ssh/binance_futures_tool"
release="/var/www/frankendom/releases/$revision"
ssh -o BatchMode=yes -i "$key" "$host" "mkdir -p '$release'"
rsync -az --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "ssh -o BatchMode=yes -i $key" dist/ "$host:$release/"
ssh -o BatchMode=yes -i "$key" "$host" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
test -s "$1/index.html"
cd /var/www/frankendom
if test -L current; then ln -sfn "$(readlink current)" previous; fi
ln -sfn "$1" next
mv -Tf next current
REMOTE
cmp dist/index.html <(curl --fail --silent --show-error https://frankendom.com/)
cmp dist/release.json <(curl --fail --silent --show-error https://frankendom.com/release.json)
printf '\nPublished %s\n' "$revision"
