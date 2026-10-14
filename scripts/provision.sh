#!/usr/bin/env bash
# Installs frankendom.com's nginx: the site conf (deploy/frankendom.com.conf) AND the four files its includes need (ops/nginx: the origins writer, presence and
# duel-relay snippets in /etc/nginx/snippets, the writer's rate limits in /etc/nginx/conf.d), so `nginx -t` never sees an include whose file is missing. The service
# installers (ops/install-*.sh) install the same files byte for byte; a snippet whose service is not running just answers 502 on its paths.
# Any `nginx -t` failure restores every file it replaced and exits 1.
#   --dry-run   changes nothing on the box: prints the diff of every candidate against the installed file (empty output = the box already matches the repo).
set -euo pipefail
cd "$(dirname "$0")/.."
host=root@49.12.7.18
key="$HOME/.ssh/binance_futures_tool"
snippets="frankendom-origins-writer.conf frankendom-presence.conf frankendom-duel-relay.conf"
limits=frankendom-origins-limits.conf

if [ "${1:-}" = "--dry-run" ]; then
  ssh -o BatchMode=yes -i "$key" "$host" 'cat /etc/nginx/sites-available/frankendom.com' | diff -u --label live/frankendom.com - --label repo/deploy/frankendom.com.conf deploy/frankendom.com.conf || true
  for f in $snippets; do
    ssh -o BatchMode=yes -i "$key" "$host" "cat /etc/nginx/snippets/$f 2>/dev/null" | diff -u --label "live/snippets/$f" - --label "repo/ops/nginx/$f" "ops/nginx/$f" || true
  done
  ssh -o BatchMode=yes -i "$key" "$host" "cat /etc/nginx/conf.d/$limits 2>/dev/null" | diff -u --label "live/conf.d/$limits" - --label "repo/ops/nginx/$limits" "ops/nginx/$limits" || true
  exit 0
fi

ssh -o BatchMode=yes -i "$key" "$host" 'bash -s' <<'REMOTE'
set -euo pipefail
mkdir -p /var/www/frankendom/acme
config=/etc/nginx/sites-available/frankendom.com
if ! test -f "$config"; then
  cat > "$config" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name frankendom.com www.frankendom.com;
    root /var/www/frankendom/acme;
    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 503; }
}
NGINX
  ln -s "$config" /etc/nginx/sites-enabled/frankendom.com
  if ! nginx -t; then
    unlink /etc/nginx/sites-enabled/frankendom.com
    exit 1
  fi
  systemctl reload nginx
fi
certbot certonly --webroot --webroot-path /var/www/frankendom/acme -d frankendom.com -d www.frankendom.com --non-interactive --keep-until-expiring
mkdir -p /var/www/frankendom/nginx.candidate.d
REMOTE
rsync -az -e "ssh -o BatchMode=yes -i $key" deploy/frankendom.com.conf "$host:/var/www/frankendom/nginx.candidate"
rsync -az -e "ssh -o BatchMode=yes -i $key" ops/nginx/frankendom-origins-writer.conf ops/nginx/frankendom-presence.conf ops/nginx/frankendom-duel-relay.conf ops/nginx/frankendom-origins-limits.conf "$host:/var/www/frankendom/nginx.candidate.d/"
ssh -o BatchMode=yes -i "$key" "$host" 'bash -s' <<'REMOTE'
set -euo pipefail
config=/etc/nginx/sites-available/frankendom.com
cand=/var/www/frankendom/nginx.candidate.d
prev=/var/www/frankendom/nginx.previous.d
rm -rf "$prev"; mkdir -p "$prev" /etc/nginx/snippets /etc/nginx/conf.d
# every file this run replaces: its prior copy (or a marker that it did not exist), so a failed `nginx -t` puts the box back exactly
targets="/etc/nginx/snippets/frankendom-origins-writer.conf /etc/nginx/snippets/frankendom-presence.conf /etc/nginx/snippets/frankendom-duel-relay.conf /etc/nginx/conf.d/frankendom-origins-limits.conf"
cp "$config" /var/www/frankendom/nginx.previous
for t in $targets; do
  if test -f "$t"; then cp "$t" "$prev/$(basename "$t")"; else touch "$prev/$(basename "$t").absent"; fi
done
restore() {
  cp /var/www/frankendom/nginx.previous "$config"
  for t in $targets; do
    b=$(basename "$t")
    if test -f "$prev/$b.absent"; then rm -f "$t"; else cp "$prev/$b" "$t"; fi
  done
}
trap restore ERR   # any failed step from here on (an install, the copy, the reload) puts the box back exactly (Auditor LOW, #1891)
for t in $targets; do install -m 0644 "$cand/$(basename "$t")" "$t"; done
cp /var/www/frankendom/nginx.candidate "$config"
if ! nginx -t; then   # a failed condition does not fire ERR: restore by hand
  restore
  exit 1
fi
systemctl reload nginx
systemctl is-active nginx
REMOTE
