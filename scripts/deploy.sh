#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing a dirty release'; exit 1; }
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
curl --fail --silent --show-error https://frankendom.com/release.json
printf '\nPublished %s\n' "$revision"
