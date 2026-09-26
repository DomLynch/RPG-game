#!/usr/bin/env bash
# One-command rollback (Strategy, 2026-09-25): put `previous` (or a named release) back live in seconds, then re-run the live check
# (release.json names the target revision; the served bundle still carries the Supabase host).
#   scripts/rollback.sh              swap current <-> previous, then check live
#   scripts/rollback.sh <sha40>      point current at releases/<sha40> instead (previous becomes the release that was live)
#   scripts/rollback.sh --dry-run    change nothing: print the swap it would make and check that the live site matches `current`
# deploy.sh already keeps `previous` (it repoints it at the outgoing release before every switch), so no build or upload happens here.
# The daily verifier's /opt/frankendom-verifier/current follows the release when that revision's verifier directory exists.
set -euo pipefail
dry=0 want=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    -*) echo "unknown flag $arg" >&2; exit 2 ;;
    *) want=$arg ;;
  esac
done
[[ -z "$want" || "$want" =~ ^[0-9a-f]{40}$ ]] || { echo "revision must be a full 40-character sha" >&2; exit 2; }
# A deploy in flight would flip current again the moment it publishes: refuse rather than race it.
DEPLOY_LOCK="${DEPLOY_LOCK:-$HOME/.claude/state/deploy_in_flight.json}"
if [[ -s "$DEPLOY_LOCK" ]]; then
  pid=$(sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$DEPLOY_LOCK")
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then echo "Refusing: deploy.sh (pid $pid) holds $DEPLOY_LOCK" >&2; exit 1; fi
fi
host="${ROLLBACK_HOST:-root@49.12.7.18}" site="${ROLLBACK_SITE:-https://frankendom.com}"
root="${ROLLBACK_ROOT:-/var/www/frankendom}" verifier="${ROLLBACK_VERIFIER:-/opt/frankendom-verifier}"
ssh=(${ROLLBACK_SSH:-ssh} -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/binance_futures_tool")
curl=(${ROLLBACK_CURL:-curl} --fail --silent --show-error)

# ssh joins its arguments into one remote shell string: quote each, or an empty "$want" vanishes and the rest shift.
printf -v remote 'bash -s -- %q %q %q %q' "$dry" "$want" "$root" "$verifier"
plan=$("${ssh[@]}" "$host" "$remote" <<'REMOTE'
set -euo pipefail
dry=$1 want=$2 verifier=$4
cd "$3"
cur=$(readlink -f current)
if [[ -n "$want" ]]; then tgt="$PWD/releases/$want"; else tgt=$(readlink -f previous 2>/dev/null || true); fi
[[ -n "$tgt" && -s "$tgt/index.html" && -s "$tgt/release.json" ]] || { echo "no usable rollback target (${tgt:-previous is missing})" >&2; exit 1; }
[[ "$tgt" != "$cur" ]] || { echo "target is already live: $cur" >&2; exit 1; }
revision() { sed -n 's/.*"revision":"\([0-9a-f]*\)".*/\1/p' "$1/release.json"; }
echo "live-revision $(revision "$cur")"
echo "target-revision $(revision "$tgt")"
if [[ $dry = 1 ]]; then echo "dry run: would point current at $tgt and previous at $cur"; exit 0; fi
ln -sfn "$cur" previous
ln -sfn "$tgt" next
mv -Tf next current
echo "switched: current -> $tgt, previous -> $cur"
if [[ -d "$verifier/$(revision "$tgt")" ]]; then ln -sfn "$verifier/$(revision "$tgt")" "$verifier/current"; echo "verifier -> $(revision "$tgt")"
else echo "verifier left alone: no $verifier/$(revision "$tgt")"; fi
REMOTE
)
echo "$plan"
live=$(awk '$1 == "live-revision" { print $2 }' <<<"$plan") target=$(awk '$1 == "target-revision" { print $2 }' <<<"$plan")
expect=$target; [[ $dry = 1 ]] && expect=$live

release=$("${curl[@]}" "$site/release.json")
[[ "$release" == *"\"revision\":\"$expect\""* ]] || { echo "LIVE CHECK FAILED: release.json is $release, expected $expect" >&2; exit 1; }
bundle=$(grep -o 'assets/index-[^"]*\.js' <<<"$("${curl[@]}" "$site/")" | head -1)
[[ -n "$bundle" ]] || { echo "LIVE CHECK FAILED: no assets/index-*.js in the served index.html" >&2; exit 1; }
[[ "$("${curl[@]}" "$site/$bundle")" == *rxbewmzmovelckzoosss.supabase.co* ]] || { echo "LIVE CHECK FAILED: $bundle lacks the Supabase host" >&2; exit 1; }
if [[ $dry = 1 ]]; then echo "Dry run: live is $expect and checks out; a rollback would make $target live"
else echo "Rolled back: live is $expect ($bundle carries the Supabase host)"; fi
