#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
host=root@49.12.7.18
key="$HOME/.ssh/binance_futures_tool"
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
REMOTE
rsync -az -e "ssh -o BatchMode=yes -i $key" deploy/frankendom.com.conf "$host:/var/www/frankendom/nginx.candidate"
ssh -o BatchMode=yes -i "$key" "$host" 'bash -s' <<'REMOTE'
set -euo pipefail
config=/etc/nginx/sites-available/frankendom.com
cp "$config" /var/www/frankendom/nginx.previous
cp /var/www/frankendom/nginx.candidate "$config"
if ! nginx -t; then
  cp /var/www/frankendom/nginx.previous "$config"
  exit 1
fi
systemctl reload nginx
systemctl is-active nginx
REMOTE
