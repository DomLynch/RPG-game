#!/usr/bin/env bash
# Installs, updates or rolls back the Origins writer on the VPS (origins/server). Run by Deploy on the box, as root, from a trunk checkout:
#   bash ops/install-origins-writer.sh <revision>     install / update (idempotent)
#   bash ops/install-origins-writer.sh --rollback     stop + disable the unit, remove the nginx include and limits, reload nginx
# It never creates or prints a secret: it only checks which keys exist. DATABASE_URL comes from /etc/frankendom/verifier.env (the verifier's own file, role frankendom_verifier;
# no second role password). /etc/frankendom/origins-writer.env is writer-only: SUPABASE_URL, SUPABASE_ANON_KEY (public values), PORT=8788, later PRESENCE_INTERNAL_KEY from
# install-presence.sh --link-writer. It must NOT set DATABASE_URL (it is read after verifier.env and would override it). Without those keys the files are installed but the service is NOT started.
# The flag (origins_config.origins_enabled) and the allowlist (origins_access) are the database's and are not touched here: until Strategy + Lead flip them
# the route answers 403 for everyone. Touches only: /opt/frankendom-origins/<revision> (+ `current`), the unit, /etc/nginx/snippets/frankendom-origins-writer.conf,
# /etc/nginx/conf.d/frankendom-origins-limits.conf and ONE include line in the frankendom.com :443 server block (prior copy kept as /etc/nginx/backups/frankendom.com.before-origins-writer, OUTSIDE sites-enabled).
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
backup="$r/etc/nginx/backups"   # as install-presence.sh: OUTSIDE sites-enabled, which nginx loads whole (a stale copy of the frankendom.com block is a duplicate server)
include="    include $snippet;   # frankendom origins writer"

if [ "${1:-}" = "--rollback" ]; then
  systemctl disable --now frankendom-origins-writer.service 2>/dev/null || true
  if grep -qF "$snippet" "$site"; then install -d -m 0700 "$backup"; grep -vF "$snippet" "$site" > "$backup/site.tmp" && cat "$backup/site.tmp" > "$site" && rm -f "$backup/site.tmp"; fi
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
# What the writer loads outside src/ and origins/ comes from its computed import closure (scripts/writer-closure.mjs, shared with deploy.sh's verifier
# install), never a hand list: CH's loader.ts imported scripts/lib/json-dup-keys.mjs, the old list missed it and the writer crash-looped. An import that
# resolves to no file stops the install here, before anything is copied.
closure="$(cd "$here" && node scripts/writer-closure-list.mjs --paths writer)" || { echo "install-origins-writer: the writer's import closure has an unresolved import; nothing installed" >&2; exit 1; }

# The writer imports ../src and ../origins (type-stripped .ts, Node >= 22.18); no node_modules: it has no dependencies.
install -d "$dest/scripts" "$dest/scripts/lib"
rm -rf "$dest/src" "$dest/origins"
cp -R "$here/src" "$here/origins" "$dest/"
find "$dest/origins" \( -name '*.test.ts' -o -name 'README.md' \) -delete
for f in $closure; do   # src/ and origins/ are copied whole above (a superset: rows read through fs, not imports, stay covered)
  case "$f" in src/*|origins/*) ;; *) install -d "$dest/$(dirname "$f")"; install -m 0644 "$here/$f" "$dest/$f" ;; esac
done
install -m 0644 "$here/package.json" "$dest/package.json"
# Before current flips: every closure module except the entry (importing it would start the server) is imported with this box's node. A missing
# file fails here and the running writer stays on the previous install.
(cd "$dest" && printf '%s\n' $closure | grep -vx 'scripts/origins-writer.mjs' | grep -E '\.(ts|mjs)$' | tr '\n' '\0' \
  | xargs -0 node --input-type=module -e 'import { pathToFileURL } from "node:url"; for (const f of process.argv.slice(1)) await import(pathToFileURL(f).href);') \
  || { echo "install-origins-writer: dry import failed in $dest with node $(node -v); current left on $(readlink "$opt/current" 2>/dev/null || echo none)" >&2; exit 1; }
# Blue-green (Strategy after the CH incident, part B): when the writer can start (both env files complete), the NEW install is started on a side port with
# the box's env and must answer one real request, POST /origins/consume without a token -> 401 "sign in" (it booted, loaded its handler table and routes),
# before current flips. Anything else (a crash, 404, no answer in ORIGINS_SIDE_WAIT_S) is failed-at-writer: nothing flips and the running writer is untouched.
writer_ready() { [ -s "$venv" ] && grep -q '^DATABASE_URL=' "$venv" && [ -s "$env" ] && grep -q '^SUPABASE_URL=' "$env" && grep -q '^SUPABASE_ANON_KEY=' "$env"; }
if writer_ready; then
  if grep -q '^DATABASE_URL=' "$env"; then echo "install-origins-writer: $env sets DATABASE_URL and would override the verifier's: remove that line; service NOT started" >&2; exit 1; fi
  side="${ORIGINS_SIDE_PORT:-8789}"; sidelog="$dest/.side-health.log"
  # The 401 must come from THIS install: a listener already on the side port (a side writer leaked by an interrupted earlier install) would answer
  # for a writer that crashed at boot. So the port must be free first, the side writer is killed on any exit, and the answer counts only while the
  # new process is alive and has logged its own listening line.
  if curl -s -o /dev/null -m 3 "http://127.0.0.1:$side/"; then echo "install-origins-writer: side port $side busy (something already answers there); current left on $(readlink "$opt/current" 2>/dev/null || echo none)" >&2; exit 1; fi
  ( set -a; . "$venv"; . "$env"; set +a; cd "$dest" && PORT="$side" exec node scripts/origins-writer.mjs ) > "$sidelog" 2>&1 &
  sidepid=$!; code=""
  trap 'kill "$sidepid" 2>/dev/null || true' EXIT
  for _ in $(seq 1 "${ORIGINS_SIDE_WAIT_S:-20}"); do
    code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' -X POST "http://127.0.0.1:$side/origins/consume" || true)
    [ "$code" = 401 ] && break
    kill -0 "$sidepid" 2>/dev/null || break
    sleep 1
  done
  if [ "$code" = 401 ] && ! { kill -0 "$sidepid" 2>/dev/null && grep -qF "origins-writer listening on 127.0.0.1:$side" "$sidelog"; }; then code="401-not-ours"; fi
  kill "$sidepid" 2>/dev/null || true; wait "$sidepid" 2>/dev/null || true; trap - EXIT
  if [ "$code" != 401 ]; then
    echo "install-origins-writer: failed-at-writer: $revision on :$side answered '${code:-nothing}' to POST /origins/consume (want 401); current left on $(readlink "$opt/current" 2>/dev/null || echo none)" >&2
    { grep -m 3 -iE 'error' "$sidelog"; tail -n 3 "$sidelog"; } >&2 || true   # the error line, not only the stack tail
    exit 1
  fi
  echo "install-origins-writer: side-port health ok: $revision on :$side answered 401 to POST /origins/consume"
fi
old=$(readlink -f "$opt/current" 2>/dev/null || true)   # the rollback target: kept as `previous` so the prune below never removes it
ln -sfn "$dest" "$opt/current"
[ -n "$old" ] && [ -d "$old" ] && [ "$old" != "$(readlink -f "$dest")" ] && ln -sfn "$old" "$opt/previous"
install -d -m 0700 "$r/etc/frankendom"
install -d -m 0700 "$backup"   # before any branch: the nginx -t failure path writes its temp file here even on a re-install where the include is already present
install -d "$r/etc/nginx/snippets" "$r/etc/nginx/conf.d" "$r/etc/systemd/system"
install -m 0644 "$here/ops/frankendom-origins-writer.service" "$unit"
install -m 0644 "$here/ops/nginx/frankendom-origins-writer.conf" "$snippet"
install -m 0644 "$here/ops/nginx/frankendom-origins-limits.conf" "$limits"
systemctl daemon-reload

if ! grep -qF "$snippet" "$site"; then
  install -d -m 0700 "$backup"; cp "$site" "$backup/frankendom.com.before-origins-writer"
  # After the `server_name frankendom.com;` line: that exact line is the apex :443 block (the :80 block names www too, www only redirects).
  awk -v inc="$include" '{ print } /^[[:space:]]*server_name frankendom\.com;[[:space:]]*$/ && !done { print inc; done = 1 }' "$backup/frankendom.com.before-origins-writer" > "$site"
  grep -qF "$snippet" "$site" || { cp "$backup/frankendom.com.before-origins-writer" "$site"; echo "install-origins-writer: server_name frankendom.com; not found in $site" >&2; exit 1; }
fi
if ! nginx -t 2>/dev/null; then
  grep -vF "$snippet" "$site" > "$backup/site.tmp" && cat "$backup/site.tmp" > "$site" && rm -f "$backup/site.tmp"
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
# Old installs pile up at ~400 MB each (33 dirs = 12 GB on 2026-10-10, root disk 86% used): keep current, previous and the newest others, 5 in all. A prune error is logged and never fails the install.
bash "${ORIGINS_PRUNE:-$here/scripts/lib/prune-releases.sh}" "$opt" 5 "" origins || echo "install-origins-writer: prune failed (exit $?), installs left as they are" >&2
