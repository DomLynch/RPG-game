#!/usr/bin/env bash
# Exercises ops/install-origins-writer.sh in a scratch root (ORIGINS_INSTALL_ROOT) with stub nginx/systemctl/node on PATH: install, idempotent re-install, the nginx -t
# failure branch (keeps its diagnostic), the rollback (fails loud when nginx -t or the reload fails), the node >= 22.18 gate. Touches nothing outside a mktemp dir.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
checks=0
fail() { echo "origins-install-check: FAIL: $*" >&2; exit 1; }
ok() { checks=$((checks + 1)); }
expect() { local what="$1" got="$2" want="$3"; [ "$got" = "$want" ] || fail "$what: got '$got', wanted '$want'"; ok; }
contains() { local what="$1" text="$2" needle="$3"; case "$text" in *"$needle"*) ok ;; *) fail "$what: '$needle' not in: $text" ;; esac; }

bin="$tmp/bin"; mkdir -p "$bin"
cat > "$bin/nginx" <<'STUB'
#!/usr/bin/env bash
echo "nginx stub: $*" >> "$STUB_LOG"
[ "${NGINX_RC:-0}" = 0 ] || { echo "nginx: [emerg] stub failure" >&2; exit "$NGINX_RC"; }
STUB
cat > "$bin/systemctl" <<'STUB'
#!/usr/bin/env bash
echo "systemctl $*" >> "$STUB_LOG"
case "$1" in reload) exit "${RELOAD_RC:-0}" ;; esac
exit 0
STUB
cat > "$bin/node" <<'STUB'
#!/usr/bin/env bash
if [ -n "${FAKE_NODE:-}" ]; then [ "$1" = "-v" ] && { echo "$FAKE_NODE"; exit 0; }; exit 1; fi
exec "$REAL_NODE" "$@"
STUB
chmod +x "$bin"/*
export REAL_NODE="$(command -v node)" STUB_LOG="$tmp/log"
: > "$STUB_LOG"
export PATH="$bin:$PATH"
fresh() {   # a clean scratch root with the real site config, as a box before any installer ran: the repo conf carries the box's own include lines
  # (/etc/nginx/snippets/..., matching live), which the scratch root's prefixed snippet path would not recognise, so they are taken out here
  rm -rf "$tmp/root"; mkdir -p "$tmp/root/etc/nginx/sites-enabled"; grep -v 'include /etc/nginx/snippets/frankendom-' "$here/deploy/frankendom.com.conf" > "$tmp/root/etc/nginx/sites-enabled/frankendom.com"
  export ORIGINS_INSTALL_ROOT="$tmp/root"; : > "$STUB_LOG"; unset NGINX_RC RELOAD_RC FAKE_NODE
}
site() { echo "$tmp/root/etc/nginx/sites-enabled/frankendom.com"; }
includes() { grep -c 'frankendom-origins-writer.conf' "$(site)" || true; }
run() { out="$(bash "$here/ops/install-origins-writer.sh" "$@" 2>&1)"; rc=$?; }

fresh; before="$(cksum < "$(site)")"
run rev1
expect "install without the env file exits 0" "$rc" 0
contains "it says the service was not started" "$out" "service NOT started"
expect "one include inserted" "$(includes)" 1
[ -f "$tmp/root/etc/nginx/snippets/frankendom-origins-writer.conf" ] && ok || fail "snippet not installed"
[ -f "$tmp/root/etc/nginx/conf.d/frankendom-origins-limits.conf" ] && ok || fail "limits not installed"
[ -f "$tmp/root/etc/systemd/system/frankendom-origins-writer.service" ] && ok || fail "unit not installed"
[ -f "$tmp/root/opt/frankendom-origins/rev1/scripts/origins-writer.mjs" ] && ok || fail "writer not copied"
[ -z "$(find "$tmp/root/opt/frankendom-origins/rev1/origins" -name '*.test.ts' | head -1)" ] && ok || fail "tests were copied"
[ -L "$tmp/root/opt/frankendom-origins/current" ] && ok || fail "current symlink missing"
expect "sites-enabled holds only the site (nginx loads every file there: a backup would be a duplicate frankendom.com server)" "$(ls "$tmp/root/etc/nginx/sites-enabled")" "frankendom.com"
expect "the prior site file is kept in /etc/nginx/backups, exactly as it was" "$(cksum < "$tmp/root/etc/nginx/backups/frankendom.com.before-origins-writer")" "$before"
case "$(cat "$STUB_LOG")" in *"enable --now"*) fail "the service was started without an env file" ;; *) ok ;; esac
run rev1
expect "re-install is idempotent" "$(includes)" 1
mkdir -p "$tmp/root/etc/frankendom"; printf 'DATABASE_URL=postgresql://x\n' > "$tmp/root/etc/frankendom/verifier.env"
printf 'PORT=8788\n' > "$tmp/root/etc/frankendom/origins-writer.env"
: > "$STUB_LOG"; run rev1b
contains "no Supabase keys: not started" "$out" "service NOT started"
case "$(cat "$STUB_LOG")" in *"enable --now"*) fail "started without SUPABASE_URL/ANON_KEY" ;; *) ok ;; esac
printf 'PORT=8788\nSUPABASE_URL=https://x\nSUPABASE_ANON_KEY=y\nDATABASE_URL=postgresql://other\n' > "$tmp/root/etc/frankendom/origins-writer.env"
: > "$STUB_LOG"; run rev1c
expect "an env that sets DATABASE_URL is refused" "$rc" 1
contains "with the reason" "$out" "would override the verifier's"
case "$(cat "$STUB_LOG")" in *"enable --now"*) fail "started with an overriding DATABASE_URL" ;; *) ok ;; esac
printf 'PORT=8788\nSUPABASE_URL=https://x\nSUPABASE_ANON_KEY=y\n' > "$tmp/root/etc/frankendom/origins-writer.env"
: > "$STUB_LOG"; run rev2
expect "install with the env file exits 0" "$rc" 0
contains "the service is enabled" "$(cat "$STUB_LOG")" "enable --now frankendom-origins-writer.service"
contains "and restarted" "$(cat "$STUB_LOG")" "restart frankendom-origins-writer.service"
expect "the env file mode is 0600" "$(stat -c %a "$tmp/root/etc/frankendom/origins-writer.env" 2>/dev/null || stat -f %Lp "$tmp/root/etc/frankendom/origins-writer.env")" 600

# N1: the nginx -t failure branch keeps its diagnostic and takes the include back out
fresh; export NGINX_RC=1; run rev3
expect "a failing nginx -t makes the install exit non-zero" "$rc" 1
contains "the diagnostic is kept" "$out" "[emerg] stub failure"
contains "and the message says nothing was reloaded" "$out" "nginx -t failed; include removed, nothing reloaded"
expect "the include was taken back out" "$(includes)" 0
expect "the site file is as it was" "$(cksum < "$(site)")" "$before"
expect "and sites-enabled is clean (no stray .tmp or backup)" "$(ls "$tmp/root/etc/nginx/sites-enabled")" "frankendom.com"

# N1b: a RE-install (include already present, backups dir missing) whose nginx -t fails must really take the include out
fresh; run rev1; rm -rf "$tmp/root/etc/nginx/backups"; export NGINX_RC=1; run rev1
expect "a failing nginx -t on a re-install exits non-zero" "$rc" 1
expect "and the include is really gone, not just reported gone" "$(includes)" 0
expect "and sites-enabled is still clean" "$(ls "$tmp/root/etc/nginx/sites-enabled")" "frankendom.com"

# N2: node >= 22.18
fresh; export FAKE_NODE=v20.11.0; run rev4
expect "an old node stops the install" "$rc" 1
contains "with a clear message" "$out" "node >= 22.18 is required"
[ ! -e "$tmp/root/opt/frankendom-origins/rev4" ] && ok || fail "files were installed despite the node check"
fresh; export FAKE_NODE=v22.18.0; run rev4; expect "node 22.18 passes" "$rc" 0
fresh; export FAKE_NODE=v22.17.9; run rev4; expect "node 22.17 does not" "$rc" 1

# F1: the rollback fails loud
fresh; run rev1; expect "install before the rollback" "$(includes)" 1
run --rollback
expect "a rollback exits 0 when nginx is fine" "$rc" 0
expect "the include is gone" "$(includes)" 0
expect "a rollback leaves sites-enabled clean too" "$(ls "$tmp/root/etc/nginx/sites-enabled")" "frankendom.com"
[ ! -e "$tmp/root/etc/nginx/snippets/frankendom-origins-writer.conf" ] && [ ! -e "$tmp/root/etc/nginx/conf.d/frankendom-origins-limits.conf" ] && [ ! -e "$tmp/root/etc/systemd/system/frankendom-origins-writer.service" ] && ok || fail "rollback left files behind"
contains "the service was disabled" "$(cat "$STUB_LOG")" "disable --now frankendom-origins-writer.service"
fresh; run rev1; export NGINX_RC=1; run --rollback
expect "a failing nginx -t makes the rollback exit non-zero" "$rc" 1
contains "and says it is incomplete" "$out" "ROLLBACK INCOMPLETE: nginx -t failed"
case "$out" in *"rolled back (service stopped"*) fail "it still claimed to be rolled back" ;; *) ok ;; esac
fresh; run rev1; export RELOAD_RC=1; run --rollback
expect "a failing reload makes the rollback exit non-zero" "$rc" 1
contains "and says the reload failed" "$out" "ROLLBACK INCOMPLETE: nginx -t passed but the reload failed"
echo "origins-install-check: $checks checks passed"
