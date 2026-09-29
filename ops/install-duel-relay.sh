#!/usr/bin/env bash
# Installs or updates the duel relay on the VPS (docs/duel-architecture.md §4). Run by Deploy from a trunk checkout, on the box, as root:
#   bash ops/install-duel-relay.sh <revision>
# Idempotent. Touches only: /opt/frankendom-relay/<revision> (+ the `current` link), the relay's systemd unit, the nginx snippet, and one
# include line in the frankendom.com :443 server block. nginx is reloaded only after `nginx -t` passes; on failure the include is taken
# back out, so no other site on the box is affected. Nothing belonging to another project is read or changed.
set -euo pipefail
revision="${1:?usage: install-duel-relay.sh <revision>}"
here="$(cd "$(dirname "$0")/.." && pwd)"
site=/etc/nginx/sites-enabled/frankendom.com
snippet=/etc/nginx/snippets/frankendom-duel-relay.conf
include="    include $snippet;   # frankendom duel relay"

install -d "/opt/frankendom-relay/$revision/scripts"
install -m 0644 "$here/scripts/duel-relay.mjs" "/opt/frankendom-relay/$revision/scripts/duel-relay.mjs"
ln -sfn "/opt/frankendom-relay/$revision" /opt/frankendom-relay/current
install -m 0644 "$here/ops/frankendom-duel-relay.service" /etc/systemd/system/frankendom-duel-relay.service
install -d /etc/nginx/snippets
install -m 0644 "$here/ops/nginx/frankendom-duel-relay.conf" "$snippet"

if ! grep -qF "$snippet" "$site"; then
  cp "$site" "$site.before-duel-relay"
  # Insert after the `server_name frankendom.com;` line of the :443 block (the apex; www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$site.before-duel-relay" > "$site"
  grep -qF "$snippet" "$site" || { cp "$site.before-duel-relay" "$site"; echo "install-duel-relay: server_name frankendom.com; not found in $site" >&2; exit 1; }
fi
if ! nginx -t 2>/dev/null; then
  [ -f "$site.before-duel-relay" ] && cp "$site.before-duel-relay" "$site"
  nginx -t; echo "install-duel-relay: nginx -t failed; include removed, nothing reloaded" >&2; exit 1
fi

systemctl daemon-reload
systemctl enable frankendom-duel-relay.service >/dev/null
systemctl restart frankendom-duel-relay.service
systemctl reload nginx
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:8787/duel/relay/health >/dev/null 2>&1 && break; sleep 0.5; done
echo "install-duel-relay: $revision live; local $(curl -fsS http://127.0.0.1:8787/duel/relay/health), public $(curl -fsS https://frankendom.com/duel/relay/health)"
