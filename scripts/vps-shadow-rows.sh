#!/usr/bin/env bash
# VPS shadow of the release rows (Lead, Dom via Strategy 2026-09-30). Runs the whole release row set (49 rows, 0 trusted) for one sha on
# the VPS, as the non-root row user under nice 15 / ionice idle, and brings back a per-row JSON. Nothing here loads the Mac: this side is
# ssh, scp and rsync only. deploy.sh is untouched and publish stays on the Mac; compare with scripts/vps-shadow-diff.mjs.
#
#   scripts/vps-shadow-rows.sh <sha>            start the run detached on the VPS and return (prints the run dir)
#   scripts/vps-shadow-rows.sh <sha> --wait     start, then poll until it ends (SHADOW_WAIT_MIN, default 90) and fetch
#   scripts/vps-shadow-rows.sh <sha> --status   one line: status, rows finished so far, load
#   scripts/vps-shadow-rows.sh <sha> --fetch    rsync runs/<sha>/latest/ to artifacts/vps-shadow/<sha>/ (rows.json + every row log)
# Env the VPS side needs (all already on the box, none copied by this script): the three public VITE_ keys in
# /opt/frankendom-shadow/env.production.local (VITE_SENTRY_DSN, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY — the same file the Mac
# builds with), PG_BIN from pg_config (row 13's disposable cluster), PLAYWRIGHT_BROWSERS_PATH set by run-rows.sh. No token: the repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."
sha="${1:?usage: vps-shadow-rows.sh <sha> [--wait|--status|--fetch]}"; mode="${2:-start}"
host="${SHADOW_HOST:-frankrows@49.12.7.18}"; key="${SHADOW_KEY:-$HOME/.ssh/binance_futures_tool}"   # the row user itself: never root (Lead, 09-30 lock-out ruling)
user=frankrows; home=/opt/frankendom-shadow
# No ControlMaster here: a persisted master keeps the caller's pipes open, and a hook or tool waiting on this script's stdout never returns.
ssh_options=(-o BatchMode=yes -o ConnectTimeout=8 -o IdentitiesOnly=yes -i "$key")
remote() { ssh "${ssh_options[@]}" "$host" "$@"; }
full=$(git rev-parse --verify -q "$sha^{commit}" 2>/dev/null || echo "$sha")
[[ "$full" =~ ^[0-9a-f]{40}$ ]] || { echo "not a full sha and not resolvable here: $sha"; exit 2; }

status() {
  remote "s=\$(cat $home/runs/$full/latest/status 2>/dev/null || echo none); n=\$(grep -c -E '^Release check [0-9]+/[0-9]+ (passed|FAILED|CEILING)' $home/runs/$full/latest/rows.log 2>/dev/null || true); \
    echo \"status=\$s rows_finished=\${n:-0} load=\$(cut -d' ' -f1-3 /proc/loadavg) latest=\$(readlink $home/runs/$full/latest 2>/dev/null || echo -)\""
}
fetch() {
  local dest="artifacts/vps-shadow/$full"
  mkdir -p "$dest"
  rsync -az -e "ssh ${ssh_options[*]}" "$host:$home/runs/$full/latest/" "$dest/"
  [[ -f "$dest/rows.json" ]] || { echo "fetched $dest, but no rows.json: the run is not finished (status: $(cat "$dest/status" 2>/dev/null || echo unknown))"; return 0; }
  echo "fetched -> $dest/rows.json"
  node -e 'const r=require(process.argv[1]);console.log(`VPS ${r.sha.slice(0,8)} build=${r.buildStatus} rows=${r.rowsStatus} wall=${r.wall}s rows_wall=${r.rowsWallSeconds}s`, JSON.stringify(r.summary))' "$PWD/$dest/rows.json"
}
start() {
  # The VPS runs THIS checkout's copy of the runner (a sha before this PR merged has none): three small files, owned by the row user.
  remote "mkdir -p $home/bin"
  scp -q "${ssh_options[@]}" scripts/vps-shadow/run-rows.sh scripts/vps-shadow/rows-json.mjs scripts/vps-shadow/rows-lib.mjs "$host:$home/bin/"
  remote "cd $home && nohup nice -n 15 ionice -c3 bash $home/bin/run-rows.sh $full > $home/runs/start-$full.log 2>&1 < /dev/null & sleep 3; head -3 $home/runs/start-$full.log"
  echo "started on $host as $user (nice 15, ionice idle): $home/runs/$full/latest — poll with: $0 $sha --status"
}
case "$mode" in
  start) start ;;
  --status) status ;;
  --fetch) fetch ;;
  --wait)
    start
    deadline=$(( $(date +%s) + ${SHADOW_WAIT_MIN:-90} * 60 ))
    while :; do
      sleep 30
      line=$(status); echo "$(date +%H:%M:%S) $line"
      [[ "$line" == *"status=done"* ]] && break
      (( $(date +%s) < deadline )) || { echo "gave up after ${SHADOW_WAIT_MIN:-90} min; the run continues on the VPS, fetch later"; exit 5; }
    done
    fetch ;;
  *) echo "unknown mode $mode"; exit 2 ;;
esac
