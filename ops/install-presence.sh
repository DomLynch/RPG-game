#!/usr/bin/env bash
# Installs, updates or rolls back the Origins presence service on the VPS (docs/specs/origins/one-shard.md). Run by Deploy on the box, as root, from a trunk checkout, ONLY on a joint
# Lead + Strategy GO (nothing here runs from CI or from deploy.sh):
#   SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-presence.sh <revision>   install / update (idempotent)
#     The two are the project's PUBLIC url and anon key (the ones the page ships), used to check a player's token. Needed on the first install; kept in the env file after.
#     Presence stays OFF: the env file is written with ORIGINS_PRESENCE=0 and the unit is enabled but not started. Turn it on with the flag GO: set ORIGINS_PRESENCE=1 in the env file
#     and run this again (it restarts the unit and runs the health checks).
#   bash ops/install-presence.sh --link-writer     EXPLICIT OPT-IN, never a default: WRITES A SECRET (PRESENCE_INTERNAL_KEY) into /etc/frankendom/origins-writer.env when that file exists and
#                                                  lacks it. The key is never printed; the writer is not restarted (restart it as a separate, logged step). Undo: --unlink-writer.
#                                                  Also places ORIGINS_WRITER_INTERNAL_KEY (presence -> writer saved-location routes; generated at install, a SEPARATE secret) and PRESENCE_URL there.
#   bash ops/install-presence.sh --unlink-writer   undo --link-writer: remove PRESENCE_INTERNAL_KEY, PRESENCE_URL and ORIGINS_WRITER_INTERNAL_KEY from the writer's env file (the writer is not restarted)
#   bash ops/install-presence.sh --rollback        undo everything this script did: stop + disable the unit, remove the include, delete the snippet and the unit, reload nginx
# Touches only: /opt/frankendom-presence/<revision> (+ `current`; the files listed by ops/presence-files.mjs, nothing else), /etc/frankendom/presence.env (the internal key is generated once,
# root 0600, never printed), the unit, /etc/nginx/snippets/frankendom-presence.conf and ONE include line in the frankendom.com :443 server block (its prior copy kept as
# $root/etc/nginx/backup-presence/frankendom.com.before-presence, OUTSIDE sites-enabled). The relay's, the writer's and the verifier's units, the :80 block, every other site and every other project's files are not read or changed. nginx reloads only
# after `nginx -t` passes; on failure the include is taken back out. PRESENCE_ROOT (tests only) puts every path under a prefix.
set -euo pipefail
root="${PRESENCE_ROOT:-}"
site="$root/etc/nginx/sites-enabled/frankendom.com"
snippet="$root/etc/nginx/snippets/frankendom-presence.conf"
unit="$root/etc/systemd/system/frankendom-presence.service"
env="$root/etc/frankendom/presence.env"
writer_env="$root/etc/frankendom/origins-writer.env"
opt="$root/opt/frankendom-presence"
backup="$root/etc/nginx/backup-presence"   # OUTSIDE sites-enabled: nginx loads every file there, and a stale copy of the frankendom.com block would be a duplicate server whose first-loaded copy can shadow the include
include="    include $snippet;   # frankendom presence"
here="$(cd "$(dirname "$0")/.." && pwd)"

drop_include() { if grep -qF "$snippet" "$site"; then install -d -m 0700 "$backup"; grep -vF "$snippet" "$site" > "$backup/site.tmp" && cat "$backup/site.tmp" > "$site" && rm -f "$backup/site.tmp"; fi; }
get() { grep "^$1=" "$env" | head -n1 | cut -d= -f2-; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@" || true; }

if [ "${1:-}" = "--rollback" ]; then
  systemctl disable --now frankendom-presence.service 2>/dev/null || true
  [ -f "$site" ] && drop_include
  rm -f "$snippet" "$unit"; systemctl daemon-reload
  nginx -t && systemctl reload nginx
  # The writer-routes secret goes with the install (it is regenerated on a re-install; unset on the writer = its internal routes are off at its next restart).
  for f in "$env" "$writer_env"; do
    if [ -f "$f" ] && grep -q '^ORIGINS_WRITER_INTERNAL_KEY=' "$f"; then grep -v '^ORIGINS_WRITER_INTERNAL_KEY=' "$f" > "$f.tmp" || true; cat "$f.tmp" > "$f"; rm -f "$f.tmp"; fi
  done
  echo "install-presence: rolled back (presence stopped, include removed, ORIGINS_WRITER_INTERNAL_KEY removed; $env and $opt kept for a re-install)"
  exit 0
fi

if [ "${1:-}" = "--unlink-writer" ]; then
  [ -f "$writer_env" ] || { echo "install-presence: $writer_env does not exist: nothing to unlink"; exit 0; }
  grep -v -e '^PRESENCE_INTERNAL_KEY=' -e '^PRESENCE_URL=' -e '^ORIGINS_WRITER_INTERNAL_KEY=' "$writer_env" > "$writer_env.tmp" || true
  cat "$writer_env.tmp" > "$writer_env"; rm -f "$writer_env.tmp"
  echo "install-presence: removed PRESENCE_INTERNAL_KEY, PRESENCE_URL and ORIGINS_WRITER_INTERNAL_KEY from $writer_env (the writer is not restarted: do that as a separate, logged step)"
  exit 0
fi

if [ "${1:-}" = "--link-writer" ]; then
  [ -s "$env" ] || { echo "install-presence: $env does not exist yet: install first" >&2; exit 1; }
  [ -f "$writer_env" ] || { echo "install-presence: $writer_env does not exist: nothing to link (the writer's env is Dom's W3 step)" >&2; exit 1; }
  key="$(get PRESENCE_INTERNAL_KEY)"; [ -n "$key" ] || { echo "install-presence: no PRESENCE_INTERNAL_KEY in $env" >&2; exit 1; }
  # The writer's own PORT defaults to 8788, so presence has its own (8793) and the writer is told where it is.
  phost="$(get PRESENCE_HOST)"; pport="$(get PRESENCE_PORT)"
  grep -q '^PRESENCE_URL=' "$writer_env" || printf 'PRESENCE_URL=http://%s:%s\n' "${phost:-127.0.0.1}" "${pport:-8793}" >> "$writer_env"
  wkey="$(get ORIGINS_WRITER_INTERNAL_KEY || true)"; [ -n "$wkey" ] || { echo "install-presence: no ORIGINS_WRITER_INTERNAL_KEY in $env: re-run the install first" >&2; exit 1; }
  grep -q '^ORIGINS_WRITER_INTERNAL_KEY=' "$writer_env" || printf 'ORIGINS_WRITER_INTERNAL_KEY=%s\n' "$wkey" >> "$writer_env"   # the writer's internal routes: unset there = routes off
  if grep -q '^PRESENCE_INTERNAL_KEY=' "$writer_env"; then echo "install-presence: the writer's env already holds a PRESENCE_INTERNAL_KEY (left alone)"; exit 0; fi
  printf 'PRESENCE_INTERNAL_KEY=%s\n' "$key" >> "$writer_env"
  echo "install-presence: appended PRESENCE_INTERNAL_KEY, PRESENCE_URL and ORIGINS_WRITER_INTERNAL_KEY to $writer_env (the writer is not restarted)"
  exit 0
fi

revision="${1:?usage: install-presence.sh <revision> | --link-writer | --unlink-writer | --rollback}"
files="$(cd "$here" && node ops/presence-files.mjs)"   # fails (and so does the install) if presence imports an npm package
[ -n "$files" ] || { echo "install-presence: ops/presence-files.mjs listed nothing" >&2; exit 1; }
while IFS= read -r f; do install -D -m 0644 "$here/$f" "$opt/$revision/$f"; done <<< "$files"
ln -sfn "$opt/$revision" "$opt/current"

install -d -m 0700 "$root/etc/frankendom"
if [ ! -s "$env" ]; then
  umask 077
  printf 'ORIGINS_PRESENCE=0\nPRESENCE_HOST=127.0.0.1\nPRESENCE_PORT=8793\nPRESENCE_INTERNAL_KEY=%s\n' "$(openssl rand -hex 32)" > "$env"
fi
if ! grep -q '^PRESENCE_INTERNAL_KEY=' "$env"; then printf 'PRESENCE_INTERNAL_KEY=%s\n' "$(openssl rand -hex 32)" >> "$env"; fi
# Presence -> writer (the saved-location routes): its OWN secret, never the key the writer uses toward presence. WRITER_URL is the writer's loopback PORT (8788 by default).
if ! grep -q '^ORIGINS_WRITER_INTERNAL_KEY=' "$env"; then printf 'ORIGINS_WRITER_INTERNAL_KEY=%s\n' "$(openssl rand -hex 32)" >> "$env"; fi
if ! grep -q '^WRITER_URL=' "$env"; then printf 'WRITER_URL=http://127.0.0.1:8788\n' >> "$env"; fi
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
  install -d -m 0700 "$backup"; cp "$site" "$backup/frankendom.com.before-presence"
  # After the `server_name frankendom.com;` line: that exact line is the apex :443 block (the :80 block names www too, www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$backup/frankendom.com.before-presence" > "$site"
  grep -qF "$snippet" "$site" || { cp "$backup/frankendom.com.before-presence" "$site"; echo "install-presence: server_name frankendom.com; not found in $site" >&2; exit 1; }
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
port="$(get PRESENCE_PORT)"; port="${port:-8793}"
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
