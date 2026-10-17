#!/usr/bin/env bash
# Rotate the frankendom_verifier database password (Lead 2026-10-17: the old one was readable in `ps` until #3093 shipped).
# Run by Dom as root on the VPS, AFTER the release carrying #3093 is live (before it, the old installed verifier would put the NEW password on argv again).
# Same shape as /root/origins-writer-setup.sh: the new password is generated HERE and printed only to Dom's terminal; no agent ever sees it.
#   1. writes /etc/frankendom/verifier.env.new (root:600) = the current file with only the password in DATABASE_URL replaced;
#   2. prints ONE `alter role` line: Dom pastes it into the Supabase SQL editor (project 'Frankendom Origins') and presses Run;
#   3. waits for Enter, then proves the new password works (psql through a service file, no secret on argv) BEFORE swapping the file in;
#   4. swaps it in (the old file is kept as verifier.env.rotated-<stamp> until Dom deletes it: it holds the DEAD password), restarts nothing (the verifier is a timer: its next run reads the file).
# On a failed proof nothing is swapped and the script prints the revert line. Re-running is safe: it refuses while a .new file is waiting.
set -euo pipefail
umask 077
ENV=${VERIFIER_ENV:-/etc/frankendom/verifier.env}   # VERIFIER_ENV only for scripts/rotate-verifier-check.sh
NEW=$ENV.new
own() { chown root:root "$@" 2>/dev/null || true; }   # root on the box; a no-op for the disposable check
[[ -r $ENV ]] || { echo "STOP: cannot read $ENV"; exit 1; }
[[ ! -e $NEW ]] || { echo "STOP: $NEW is waiting from an earlier run; delete it (it holds an unused password) and run again."; exit 1; }
command -v openssl >/dev/null && command -v psql >/dev/null && command -v python3 >/dev/null || { echo "STOP: openssl, psql and python3 are needed"; exit 1; }

PW=$(openssl rand -hex 32)   # hex only, so no URL-encoding is needed
svc=$(mktemp); trap 'rm -f "$svc"' EXIT
ROT_PW=$PW python3 - "$ENV" "$NEW" <<'PY'   # the password rides the environment (private to this process), never argv
import os, re, sys
src, dst = sys.argv[1:3]
pw = os.environ["ROT_PW"]
out, hit = [], False
for line in open(src).read().splitlines():
    m = re.match(r'^(DATABASE_URL=)(["\']?)(postgres(?:ql)?://[^:@/]+:)[^@]*(@.*?)(["\']?)$', line)
    if m and not hit:
        out.append(f"{m.group(1)}{m.group(2)}{m.group(3)}{pw}{m.group(4)}{m.group(5)}"); hit = True
    else:
        out.append(line)
if not hit: sys.exit("STOP: no DATABASE_URL=postgres://user:password@host line to rotate")
open(dst, "w").write("\n".join(out) + "\n")
PY
own "$NEW"; chmod 600 "$NEW"
role=$(sed -n 's/^DATABASE_URL=["'\'']\{0,1\}postgres\(ql\)\{0,1\}:\/\/\([^:@\/]*\):.*/\2/p' "$NEW" | head -n 1)
[[ -n $role ]] || { rm -f "$NEW"; echo "STOP: could not read the role name"; exit 1; }

echo
echo "Wrote $NEW (root only, mode 600). Role: $role"
echo
echo "NOW: open Supabase -> project 'Frankendom Origins' -> SQL Editor, paste this ONE line and press Run:"
echo
echo "  alter role $role password '$PW';"
echo
read -r -p "Press Enter once the SQL editor says Success (Ctrl-C to abandon: nothing has changed yet): " _

# Prove the new password BEFORE swapping: a service file, never argv.
python3 -c 'import sys, urllib.parse as u
r = u.urlparse(sys.stdin.read().strip()); q = dict(u.parse_qsl(r.query))
v = {"host": r.hostname, "port": r.port, "dbname": (r.path or "/")[1:] or None, "user": u.unquote(r.username) if r.username else None, "password": u.unquote(r.password) if r.password else None, **q}
print("[fk]"); [print(f"{k}={x}") for k, x in v.items() if x is not None]' <<<"$(sed -n 's/^DATABASE_URL=//p' "$NEW" | head -n 1 | sed 's/^["'\'']//; s/["'\'']$//')" >"$svc"
if PGSERVICEFILE="$svc" PGSERVICE=fk psql -tAX -c 'select current_user' 2>/dev/null | grep -qx "$role"; then
  stamp=$(date +%Y%m%d-%H%M%S)
  mv "$ENV" "$ENV.rotated-$stamp"; mv "$NEW" "$ENV"; own "$ENV"; chmod 600 "$ENV"
  echo
  echo "OK: the new password works as $role and $ENV now holds it."
  echo "The old file is $ENV.rotated-$stamp (it holds the DEAD password); delete it when you are happy: shred -u $ENV.rotated-$stamp"
  echo "Other old copies to shred (they hold the dead password too): $(ls "$ENV".bak-* 2>/dev/null | tr '\n' ' ')"
  echo "If you keep a copy in the Mac Keychain, update it by hand; this script cannot reach the Mac."
  echo "Then tell the agent to run the verifier read-back (it needs no secret from you). Clear this terminal (Cmd+K)."
else
  echo
  echo "FAILED: the new password did not log in as $role. NOTHING was swapped; $ENV is unchanged."
  echo "If you already ran the alter role line, the live password is now the NEW one. Either re-run this script's check by hand, or revert in the SQL editor with the OLD password from $ENV:"
  echo "  alter role $role password '<the password inside $ENV>';   (read it with: sed -n 's/^DATABASE_URL=//p' $ENV)"
  exit 1
fi
