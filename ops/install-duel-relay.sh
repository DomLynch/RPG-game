#!/usr/bin/env bash
# Installs, updates or rolls back the duel relay on the VPS (docs/duel-architecture.md §4). Run by Deploy on the box, as root, from a
# trunk checkout:
#   SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-duel-relay.sh <revision>     install / update (idempotent)
#     The two are the project's PUBLIC url and anon key (the ones the page ships): the relay mints rooms for admins only, checking the
#     caller's own session against public.admins (scripts/duel-relay.mjs). Needed on the first install; kept in the env file after.
#   bash ops/install-duel-relay.sh --rollback     undo everything this script did: stop + disable the unit, remove the include, reload nginx
# Touches only: /opt/frankendom-relay/<revision> (+ `current`), /etc/frankendom/duel-relay.env (the HMAC secret, generated once, root
# 0600, never printed), the relay's systemd units (the template frankendom-duel-relay@.service, one instance per shard row of
# ops/duel-relay.json; the pre-shard frankendom-duel-relay.service is stopped and removed), /etc/nginx/snippets/frankendom-duel-relay.conf and ONE include line in the
# frankendom.com :443 server block (its prior copy kept as <site>.before-duel-relay). The verifier's units, the :80 block, every other
# site and every other project's files are not read or changed. nginx reloads only after `nginx -t` passes; on failure the include is
# taken back out.
set -euo pipefail
site=/etc/nginx/sites-enabled/frankendom.com
snippet=/etc/nginx/snippets/frankendom-duel-relay.conf
unit=/etc/systemd/system/frankendom-duel-relay@.service
single=/etc/systemd/system/frankendom-duel-relay.service   # the pre-shard unit (one process on 8787)
env=/etc/frankendom/duel-relay.env
include="    include $snippet;   # frankendom duel relay"
# Every shard instance systemd knows: enabled (a wants link) or loaded (running, failed or stopped).
relay_instances() {
  { ls /etc/systemd/system/multi-user.target.wants/ 2>/dev/null; systemctl list-units 'frankendom-duel-relay@*' --all --no-legend --plain 2>/dev/null | awk '{print $1}'; } \
    | grep -E '^frankendom-duel-relay@[0-9]+\.service$' | sort -u
}

if [ "${1:-}" = "--rollback" ]; then
  systemctl disable --now frankendom-duel-relay.service 2>/dev/null || true
  for at in $(relay_instances); do systemctl disable --now "$at" 2>/dev/null || true; done
  if grep -qF "$snippet" "$site"; then grep -vF "$snippet" "$site" > "$site.tmp" && cat "$site.tmp" > "$site" && rm -f "$site.tmp"; fi
  rm -f "$snippet" "$unit" "$single"; systemctl daemon-reload
  nginx -t && systemctl reload nginx
  echo "install-duel-relay: rolled back (relay stopped, include removed; $env and /opt/frankendom-relay kept for a re-install)"
  exit 0
fi

revision="${1:?usage: install-duel-relay.sh <revision> | --rollback}"
here="$(cd "$(dirname "$0")/.." && pwd)"

# The shard rows (ops/duel-relay.json): one loopback port each. Refuse before touching anything when a port is held by something that is
# not this relay (the writer sits on 8788 and presence on 8793 on this box).
ports="$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).shards;console.log(r.map((x)=>x.port).join(" "))' "$here/ops/duel-relay.json")"
for port in $ports; do
  pid="$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
  if [ -n "$pid" ] && ! ps -o unit= -p "$pid" | grep -q '^frankendom-duel-relay'; then
    echo "install-duel-relay: port $port is held by pid $pid ($(ps -o unit=,comm= -p "$pid" | xargs)), not the relay; change ops/duel-relay.json" >&2; exit 1
  fi
done
install -d "/opt/frankendom-relay/$revision/scripts" "/opt/frankendom-relay/$revision/ops"
install -m 0644 "$here/scripts/duel-relay.mjs" "/opt/frankendom-relay/$revision/scripts/duel-relay.mjs"
install -m 0644 "$here/ops/duel-relay.json" "/opt/frankendom-relay/$revision/ops/duel-relay.json"
ln -sfn "/opt/frankendom-relay/$revision" /opt/frankendom-relay/current
install -d -m 0700 /etc/frankendom
if [ ! -s "$env" ]; then
  umask 077; printf 'DUEL_RELAY_SECRET=%s\n' "$(openssl rand -hex 32)" > "$env"
fi
for name in SUPABASE_URL SUPABASE_ANON_KEY; do
  if ! grep -q "^$name=" "$env"; then
    value="${!name:-}"
    [ -n "$value" ] || { echo "install-duel-relay: $name is required on the first install (admins-only minting)" >&2; exit 1; }
    printf '%s=%s\n' "$name" "$value" >> "$env"
  fi
done
chmod 0600 "$env"
install -m 0644 "$here/ops/frankendom-duel-relay@.service" "$unit"
install -d /etc/nginx/snippets
install -m 0644 "$here/ops/nginx/frankendom-duel-relay.conf" "$snippet"

if ! grep -qF "$snippet" "$site"; then
  cp "$site" "$site.before-duel-relay"
  # After the `server_name frankendom.com;` line: that exact line is the apex :443 block (the :80 block names www too, www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$site.before-duel-relay" > "$site"
  grep -qF "$snippet" "$site" || { cp "$site.before-duel-relay" "$site"; echo "install-duel-relay: server_name frankendom.com; not found in $site" >&2; exit 1; }
fi
if ! nginx -t 2>/dev/null; then
  grep -vF "$snippet" "$site" > "$site.tmp" && cat "$site.tmp" > "$site" && rm -f "$site.tmp"
  nginx -t; echo "install-duel-relay: nginx -t failed; include removed, nothing reloaded" >&2; exit 1
fi

# The pre-shard unit holds 8787 (shard 0's port): it goes first. Instances past the last row (a shrunk config) are stopped and disabled.
if [ -f "$single" ]; then systemctl disable --now frankendom-duel-relay.service >/dev/null 2>&1 || true; rm -f "$single"; fi
systemctl daemon-reload
n=0; for _ in $ports; do systemctl enable "frankendom-duel-relay@$n.service" >/dev/null; systemctl restart "frankendom-duel-relay@$n.service"; n=$((n + 1)); done
for at in $(relay_instances); do
  k="${at#frankendom-duel-relay@}"; k="${k%.service}"
  [ "$k" -ge "$n" ] 2>/dev/null && systemctl disable --now "$at" >/dev/null 2>&1 || true
done
systemctl reload nginx
for port in $ports; do
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS "http://127.0.0.1:$port/duel/relay/health" >/dev/null 2>&1 && break; sleep 0.5; done
  echo "install-duel-relay: shard on $port: $(curl -fsS "http://127.0.0.1:$port/duel/relay/health" || echo DOWN)"
done
echo "install-duel-relay: $revision live, $n shard(s); public $(curl -fsS https://frankendom.com/duel/relay/health)"
echo "install-duel-relay: rollback with: bash ops/install-duel-relay.sh --rollback"
