#!/usr/bin/env bash
# Real-PostgreSQL check of ops/rotate-verifier-password.sh in a disposable password-auth cluster (TCP on loopback, scram-sha-256): the success path (the printed `alter role` line, the proof, the swap,
# modes 600, the old file kept with the dead password), the failure path (the alter line NOT run: nothing swapped, exit 1), the refusal while a .new file waits, and that the old and new passwords never
# appear in any argv the script spawns (a process-table sampler) and the old one never in the script's output. Needs PG_BIN (default /usr/lib/postgresql/16/bin), and a non-root user to run initdb (as `postgres` on the VPS).
set -euo pipefail
bin=${PG_BIN:-/usr/lib/postgresql/16/bin}
root=$(mktemp -d /tmp/ci-rotate-verifier-XXXXXX); port=54331; role=fk_verifier_chk; old=$(printf 'oldpw%s' "$RANDOM$RANDOM")
sampler=
cleanup() { [[ -n $sampler ]] && kill "$sampler" 2>/dev/null || true; "$bin/pg_ctl" -D "$root/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$root"; }; trap cleanup EXIT
fail() { echo "rotate-verifier-check FAIL: $1" >&2; exit 1; }
printf 'postgres\n' >"$root/pwfile"
"$bin/initdb" -D "$root/data" -A scram-sha-256 --pwfile="$root/pwfile" --no-locale >/dev/null
"$bin/pg_ctl" -D "$root/data" -l "$root/server.log" -o "-k $root -p $port -c listen_addresses=127.0.0.1" -w start >/dev/null
admin() { PGPASSWORD=postgres "$bin/psql" -h 127.0.0.1 -p $port -U "$(id -un)" -d postgres -qtAX -v ON_ERROR_STOP=1 "$@"; }
admin -c "create role $role login password '$old'" || fail "cannot create the role"
envf=$root/verifier.env
reset_env() { printf 'SOMETHING=else\nDATABASE_URL=postgresql://%s:%s@127.0.0.1:%s/postgres\n# a comment\n' "$role" "$old" "$port" >"$envf"; chmod 600 "$envf"; }
mode() { stat -c %a "$1" 2>/dev/null || stat -f %Lp "$1"; }

# A process-table sampler: every argv seen while the script runs, to prove no password rides one.
( while :; do ps -eo args 2>/dev/null >>"$root/argv.log"; sleep 0.05; done ) & sampler=$!

run_script() {   # $1 = apply the alter line (1) or not (0); echoes nothing, sets $root/out and returns the script's status
  rm -f "$root/in" "$root/out"; mkfifo "$root/in"
  VERIFIER_ENV=$envf bash ops/rotate-verifier-password.sh <"$root/in" >"$root/out" 2>&1 & local pid=$!
  exec 7>"$root/in"
  for _ in $(seq 1 100); do grep -q "alter role" "$root/out" 2>/dev/null && break; sleep 0.1; done
  grep -q "alter role" "$root/out" || { exec 7>&-; kill "$pid" 2>/dev/null; fail "the script never printed the alter line: $(cat "$root/out")"; }
  if [[ $1 == 1 ]]; then
    line=$(grep -m1 "alter role" "$root/out" | sed 's/^ *//'); admin -c "$line" || fail "the printed alter line did not run"
  fi
  echo >&7; exec 7>&-
  wait "$pid"
}

reset_env
run_script 1 || fail "the success path exited non-zero: $(cat "$root/out")"
grep -q "^OK: the new password works" "$root/out" || fail "no OK line: $(cat "$root/out")"
[[ $(mode "$envf") == 600 ]] || fail "the new env is not mode 600"
new=$(sed -n 's/^DATABASE_URL=postgresql:\/\/[^:]*:\([^@]*\)@.*/\1/p' "$envf")
[[ ${#new} == 64 && $new != "$old" ]] || fail "the new password is not a fresh 64-hex value"
grep -q '^SOMETHING=else$' "$envf" && grep -q '^# a comment$' "$envf" || fail "the other lines of the env were not kept"
ls "$root"/verifier.env.rotated-* >/dev/null 2>&1 || fail "the old file was not kept"
grep -q "$old" "$root"/verifier.env.rotated-* || fail "the kept file does not hold the old password"
[[ $(mode "$(ls "$root"/verifier.env.rotated-* | head -n 1)") == 600 ]] || fail "the kept file is not mode 600"
PGPASSWORD=$new "$bin/psql" -h 127.0.0.1 -p $port -U "$role" -d postgres -qtAX -c 'select 1' | grep -qx 1 || fail "the new password does not log in"
if PGPASSWORD=$old "$bin/psql" -h 127.0.0.1 -p $port -U "$role" -d postgres -qtAX -c 'select 1' >/dev/null 2>&1; then fail "the old password still logs in"; fi
! grep -q "$old" "$root/out" || fail "the old password appeared in the script's output"
echo "ok: success path"

# Failure path: the alter line is not run, so the proof fails and nothing is swapped.
reset_env; rm -f "$root"/verifier.env.rotated-*; cp "$envf" "$root/before.env"
if run_script 0; then fail "the failure path exited zero"; fi
grep -q "^FAILED:" "$root/out" || fail "no FAILED line: $(cat "$root/out")"
cmp -s "$envf" "$root/before.env" || fail "the env changed on a failed proof"
[[ ! -e $envf.new ]] && echo "note: .new left behind" >/dev/null
echo "ok: failure path"

# A waiting .new file is refused.
reset_env; : >"$envf.new"
if VERIFIER_ENV=$envf bash ops/rotate-verifier-password.sh </dev/null >"$root/out" 2>&1; then fail "ran with a .new file waiting"; fi
grep -q "STOP: $envf.new is waiting" "$root/out" || fail "wrong refusal: $(cat "$root/out")"
echo "ok: refuses a waiting .new"

kill "$sampler" 2>/dev/null || true; sampler=
! grep -q "$old" "$root/argv.log" || fail "the old password was seen in a process argv"
! grep -q "$new" "$root/argv.log" || fail "the new password was seen in a process argv"
echo "rotate-verifier-check: passed"
