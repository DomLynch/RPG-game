#!/usr/bin/env bash
# Installs, updates or rolls back the Origins presence service on the VPS (docs/specs/origins/one-shard.md). Run by Deploy on the box, as root, from a trunk checkout, ONLY on a joint
# Lead + Strategy GO (nothing here runs from CI or from deploy.sh):
#   SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-presence.sh <revision>   install / update (idempotent)
#     The two are the project's PUBLIC url and anon key (the ones the page ships), used to check a player's token. Needed on the first install; kept in the env file after.
#     Presence stays OFF: the env file is written with ORIGINS_PRESENCE=0 and the unit is enabled but not started. Turn it on with the flag GO: set ORIGINS_PRESENCE=1 in the env file
#     and run this again (it restarts the unit and runs the health checks).
#   bash ops/install-presence.sh --link-writer     append PRESENCE_INTERNAL_KEY to /etc/frankendom/origins-writer.env when that file exists and lacks it (the key is never printed;
#                                                  the writer is not restarted)
#   bash ops/install-presence.sh --rollback        undo everything this script did: stop + disable the unit, remove the include, delete the snippet and the unit, reload nginx
# Touches only: /opt/frankendom-presence/<revision> (+ `current`; the files listed by ops/presence-files.mjs, nothing else), /etc/frankendom/presence.env (the internal key is generated once,
# root 0600, never printed), the unit, /etc/nginx/snippets/frankendom-presence.conf and ONE include line in the frankendom.com :443 server block (its prior copy kept as
# <site>.before-presence). The relay's, the writer's and the verifier's units, the :80 block, every other site and every other project's files are not read or changed. nginx reloads only
# after `nginx -t` passes; on failure the include is taken back out. PRESENCE_ROOT (tests only) puts every path under a prefix.
set -euo pipefail
root="${PRESENCE_ROOT:-}"
site="$root/etc/nginx/sites-enabled/frankendom.com"
snippet="$root/etc/nginx/snippets/frankendom-presence.conf"
unit="$root/etc/systemd/system/frankendom-presence.service"
env="$root/etc/frankendom/presence.env"
writer_env="$root/etc/frankendom/origins-writer.env"
opt="$root/opt/frankendom-presence"
include="    include $snippet;   # frankendom presence"
here="$(cd "$(dirname "$0")/.." && pwd)"

drop_include() { if grep -qF "$snippet" "$site"; then grep -vF "$snippet" "$site" > "$site.tmp" && cat "$site.tmp" > "$site" && rm -f "$site.tmp"; fi; }
get() { grep "^$1=" "$env" | head -n1 | cut -d= -f2-; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@" || true; }

if [ "${1:-}" = "--rollback" ]; then
  systemctl disable --now frankendom-presence.service 2>/dev/null || true
  [ -f "$site" ] && drop_include
  rm -f "$snippet" "$unit"; systemctl daemon-reload
  nginx -t && systemctl reload nginx
  echo "install-presence: rolled back (presence stopped, include removed; $env and $opt kept for a re-install)"
  exit 0
fi

if [ "${1:-}" = "--link-writer" ]; then
  [ -s "$env" ] || { echo "install-presence: $env does not exist yet: install first" >&2; exit 1; }
  [ -f "$writer_env" ] || { echo "install-presence: $writer_env does not exist: nothing to link (the writer's env is Dom's W3 step)" >&2; exit 1; }
  key="$(get PRESENCE_INTERNAL_KEY)"; [ -n "$key" ] || { echo "install-presence: no PRESENCE_INTERNAL_KEY in $env" >&2; exit 1; }
  if grep -q '^PRESENCE_INTERNAL_KEY=' "$writer_env"; then echo "install-presence: the writer's env already holds a PRESENCE_INTERNAL_KEY (left alone)"; exit 0; fi
  printf 'PRESENCE_INTERNAL_KEY=%s\n' "$key" >> "$writer_env"
  echo "install-presence: appended PRESENCE_INTERNAL_KEY to $writer_env (the writer is not restarted)"
  exit 0
fi

revision="${1:?usage: install-presence.sh <revision> | --link-writer | --rollback}"
files="$(cd "$here" && node ops/presence-files.mjs)"   # fails (and so does the install) if presence imports an npm package
[ -n "$files" ] || { echo "install-presence: ops/presence-files.mjs listed nothing" >&2; exit 1; }
while IFS= read -r f; do install -D -m 0644 "$here/$f" "$opt/$revision/$f"; done <<< "$files"
ln -sfn "$opt/$revision" "$opt/current"

install -d -m 0700 "$root/etc/frankendom"
if [ ! -s "$env" ]; then
  umask 077
  printf 'ORIGINS_PRESENCE=0\nPRESENCE_HOST=127.0.0.1\nPRESENCE_PORT=8788\nPRESENCE_INTERNAL_KEY=%s\n' "$(openssl rand -hex 32)" > "$env"
fi
if ! grep -q '^PRESENCE_INTERNAL_KEY=' "$env"; then printf 'PRESENCE_INTERNAL_KEY=%s\n' "$(openssl rand -hex 32)" >> "$env"; fi
for name in SUPABASE_URL SUPABASE_ANON_KEY; do
  if ! grep -q "^$name=" "$env"; then
    value="${!name:-}"
    [ -n "$value" ] || { echo "install-presence: $name is required on the first install (it checks a player's token)" >&2; exit 1; }
    printf '%s=%s\n' "$name" "$value" >> "$env"
  fi
done
chmod 0600 "$env"
install -D -m 0644 "$here/ops/frankendom-presence.service" "$unit"
install -D -m 0644 "$here/ops/nginx/frankendom-presence.conf" "$snippet"

if ! grep -qF "$snippet" "$site"; then
  cp "$site" "$site.before-presence"
  # After the `server_name frankendom.com;` line: that exact line is the apex :443 block (the :80 block names www too, www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$site.before-presence" > "$site"
  grep -qF "$snippet" "$site" || { cp "$site.before-presence" "$site"; echo "install-presence: server_name frankendom.com; not found in $site" >&2; exit 1; }
fi
if ! nginx -t 2>/dev/null; then
  drop_include
  nginx -t || true   # show nginx's own complaint; set -e must not stop us before the message below
  echo "install-presence: nginx -t failed; include removed, nothing reloaded" >&2; exit 1
fi

systemctl daemon-reload
systemctl enable frankendom-presence.service >/dev/null
systemctl reload nginx

if ! grep -q '^ORIGINS_PRESENCE=1$' "$env"; then
  systemctl stop frankendom-presence.service 2>/dev/null || true
  echo "install-presence: $revision installed, presence is OFF (ORIGINS_PRESENCE is not 1 in $env). Nothing listens; the nginx path answers 502 until the flag GO."
  echo "install-presence: rollback with: bash ops/install-presence.sh --rollback"
  exit 0
fi

systemctl restart frankendom-presence.service
port="$(get PRESENCE_PORT)"; port="${port:-8788}"
for _ in 1 2 3 4 5 6 7 8 9 10; do [ "$(code "http://127.0.0.1:$port/origins/presence/health")" = "200" ] && break; sleep 0.5; done
bad=""
[ "$(code "http://127.0.0.1:$port/origins/presence/health")" = "200" ] || bad="$bad local-health"
hdr="$(mktemp)"; trap 'rm -f "$hdr"' EXIT
( umask 077; printf 'Authorization: Bearer %s\n' "$(get PRESENCE_INTERNAL_KEY)" > "$hdr" )
zero="00000000-0000-4000-8000-000000000000"
[ "$(code -H "@$hdr" "http://127.0.0.1:$port/internal/where?account=$zero")" = "200" ] || bad="$bad where-with-key-not-200"
[ "$(code "http://127.0.0.1:$port/internal/where?account=$zero")" = "401" ] || bad="$bad where-without-key-not-401"
[ "$(code "https://frankendom.com/origins/presence/health")" = "404" ] || bad="$bad public-health-not-404"
if [ -n "$bad" ]; then
  case "$bad" in *public-health*) drop_include; nginx -t && systemctl reload nginx; echo "install-presence: the public health path is reachable: include removed" >&2;; esac
  echo "install-presence: health checks failed:$bad" >&2; exit 1
fi
echo "install-presence: $revision live; health, /internal/where (key 200, no key 401) and the public path (health 404, not proxied) all checked"
echo "install-presence: rollback with: bash ops/install-presence.sh --rollback"
