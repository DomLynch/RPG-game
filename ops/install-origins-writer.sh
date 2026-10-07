#!/usr/bin/env bash
# Installs, updates or rolls back the Origins writer on the VPS (origins/server). Run by Deploy on the box, as root, from a trunk checkout:
#   bash ops/install-origins-writer.sh <revision>     install / update (idempotent)
#   bash ops/install-origins-writer.sh --rollback     stop + disable the unit, remove the nginx include and limits, reload nginx
# It never creates or prints a secret: it only checks which keys exist. DATABASE_URL comes from /etc/frankendom/verifier.env (the verifier's own file, role frankendom_verifier;
# no second role password). /etc/frankendom/origins-writer.env is writer-only: SUPABASE_URL, SUPABASE_ANON_KEY (public values), PORT=8788, later PRESENCE_INTERNAL_KEY from
# install-presence.sh --link-writer. It must NOT set DATABASE_URL (it is read after verifier.env and would override it). Without those keys the files are installed but the service is NOT started.
# The flag (origins_config.origins_enabled) and the allowlist (origins_access) are the database's and are not touched here: until Strategy + Lead flip them
# the route answers 403 for everyone. Touches only: /opt/frankendom-origins/<revision> (+ `current`), the unit, /etc/nginx/snippets/frankendom-origins-writer.conf,
# /etc/nginx/conf.d/frankendom-origins-limits.conf and ONE include line in the frankendom.com :443 server block (prior copy kept as <site>.before-origins-writer).
# nginx reloads only after `nginx -t` passes; on failure the include is taken back out.
set -euo pipefail
r="${ORIGINS_INSTALL_ROOT:-}"   # empty on the box; a scratch directory in tests, with stub nginx/systemctl on PATH
site=$r/etc/nginx/sites-enabled/frankendom.com
snippet=$r/etc/nginx/snippets/frankendom-origins-writer.conf
limits=$r/etc/nginx/conf.d/frankendom-origins-limits.conf
unit=$r/etc/systemd/system/frankendom-origins-writer.service
env=$r/etc/frankendom/origins-writer.env
venv=$r/etc/frankendom/verifier.env
opt=$r/opt/frankendom-origins
include="    include $snippet;   # frankendom origins writer"

if [ "${1:-}" = "--rollback" ]; then
  systemctl disable --now frankendom-origins-writer.service 2>/dev/null || true
  if grep -qF "$snippet" "$site"; then grep -vF "$snippet" "$site" > "$site.tmp" && cat "$site.tmp" > "$site" && rm -f "$site.tmp"; fi
  rm -f "$snippet" "$limits" "$unit"; systemctl daemon-reload
  nginx -t >&2 || { echo "install-origins-writer: ROLLBACK INCOMPLETE: nginx -t failed after the include was removed; the running nginx still proxies /origins/* (the service is already stopped). Fix the nginx config and reload it by hand." >&2; exit 1; }
  systemctl reload nginx || { echo "install-origins-writer: ROLLBACK INCOMPLETE: nginx -t passed but the reload failed; the running nginx still proxies /origins/*. Reload it by hand." >&2; exit 1; }
  echo "install-origins-writer: rolled back (service stopped, include and limits removed; $env and /opt/frankendom-origins kept for a re-install)"
  exit 0
fi

revision="${1:?usage: install-origins-writer.sh <revision> | --rollback}"
nv="$(node -v 2>/dev/null || true)"; nv="${nv#v}"; major="${nv%%.*}"; minor="${nv#*.}"; minor="${minor%%.*}"
if ! { [ "${major:-0}" -gt 22 ] || { [ "${major:-0}" -eq 22 ] && [ "${minor:-0}" -ge 18 ]; }; } 2>/dev/null; then
  echo "install-origins-writer: node >= 22.18 is required (the writer runs type-stripped .ts); found ${nv:-none}" >&2; exit 1
fi
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$opt/$revision"

# The writer imports ../src and ../origins (type-stripped .ts, Node >= 22.18); no node_modules: it has no dependencies.
install -d "$dest/scripts"
rm -rf "$dest/src" "$dest/origins"
cp -R "$here/src" "$here/origins" "$dest/"
find "$dest/origins" \( -name '*.test.ts' -o -name 'README.md' \) -delete
install -m 0644 "$here/scripts/origins-writer.mjs" "$dest/scripts/origins-writer.mjs"
install -m 0644 "$here/package.json" "$dest/package.json"
ln -sfn "$dest" "$opt/current"
install -d -m 0700 "$r/etc/frankendom"
install -d "$r/etc/nginx/snippets" "$r/etc/nginx/conf.d" "$r/etc/systemd/system"
install -m 0644 "$here/ops/frankendom-origins-writer.service" "$unit"
install -m 0644 "$here/ops/nginx/frankendom-origins-writer.conf" "$snippet"
install -m 0644 "$here/ops/nginx/frankendom-origins-limits.conf" "$limits"
systemctl daemon-reload

if ! grep -qF "$snippet" "$site"; then
  cp "$site" "$site.before-origins-writer"
  # After the `server_name frankendom.com;` line: that exact line is the apex :443 block (the :80 block names www too, www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$site.before-origins-writer" > "$site"
  grep -qF "$snippet" "$site" || { cp "$site.before-origins-writer" "$site"; echo "install-origins-writer: server_name frankendom.com; not found in $site" >&2; exit 1; }
fi
if ! nginx -t 2>/dev/null; then
  grep -vF "$snippet" "$site" > "$site.tmp" && cat "$site.tmp" > "$site" && rm -f "$site.tmp"
  nginx -t >&2 || true; echo "install-origins-writer: nginx -t failed; include removed, nothing reloaded" >&2; exit 1
fi
systemctl reload nginx

if [ -s "$venv" ] && grep -q '^DATABASE_URL=' "$venv" && [ -s "$env" ] && grep -q '^SUPABASE_URL=' "$env" && grep -q '^SUPABASE_ANON_KEY=' "$env"; then
  if grep -q '^DATABASE_URL=' "$env"; then echo "install-origins-writer: $env sets DATABASE_URL and would override the verifier's: remove that line; service NOT started" >&2; exit 1; fi
  chmod 0600 "$env"
  systemctl enable --now frankendom-origins-writer.service
  systemctl restart frankendom-origins-writer.service
  echo "install-origins-writer: $revision installed and running on 127.0.0.1:8788; /origins/* is proxied (flag + allowlist decide who gets in)"
else
  echo "install-origins-writer: $revision installed, route proxied, service NOT started: needs DATABASE_URL in $venv and SUPABASE_URL + SUPABASE_ANON_KEY in $env"
fi
