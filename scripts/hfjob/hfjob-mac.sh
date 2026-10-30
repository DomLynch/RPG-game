#!/bin/bash
# hfjob (Mac wrapper; install as ~/.local/bin/hfjob with bundle.py beside it as ~/.local/bin/hfjob-bundle.py): same command as the VPS one, forwarded over ssh so the Hugging Face token never lives on the Mac.
#   hfjob [--timeout 30m] [--flavor cpu-upgrade] -- CMD ARGS...   runs CMD on a HF CPU job at this checkout's pushed HEAD (public GitHub sha)
#   hfjob --bundle [--include PATH]... [--exclude GLOB]... [--max-mb N] [--out DIR]... [--timeout 30m] [--flavor cpu-upgrade] -- CMD...
#                                                                  packs THIS working tree here (git ls-files -co + includes; .git, node_modules, .env*, keys, tokens excluded; secrets scanned),
#                                                                  streams the tarball to the VPS, which puts it in a PRIVATE HF dataset repo for the job
#   hfjob --batch FILE                                             each non-comment line of FILE = the args of one hfjob call, submitted concurrently, one `tier=hf-cpu job=<id>` line each
#   hfjob collect ID [--out DIR] [--wait SECS] | collect --all-from FILE_OR_IDS [--out DIR]   download + extract a --bundle job's results here, then delete them remotely
#   hfjob logs|inspect|cancel|ps|boxes ...                         pass straight through to the VPS hfjob
# The Mac side reads this checkout, packs it, and talks ssh. No secret is read, printed or passed here (the token stays on the VPS and reaches the job as a job secret).
# Env: HFJOB_VPS (host), HFJOB_SSH_KEY, HFJOB_REMOTE_HFJOB (remote command, default `hfjob`; set to test a branch copy), HFJOB_BUNDLE_PY (bundle.py path).
set -euo pipefail
host=${HFJOB_VPS:-root@49.12.7.18}
key=${HFJOB_SSH_KEY:-$HOME/.ssh/binance_futures_tool}
rhf=${HFJOB_REMOTE_HFJOB:-hfjob}
self=$(python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$0")
here=$(dirname "$self")
bpy=${HFJOB_BUNDLE_PY:-}
if [ -z "$bpy" ]; then for c in "$here/bundle.py" "$here/hfjob-bundle.py" "$HOME/.local/bin/hfjob-bundle.py"; do [ -f "$c" ] && { bpy=$c; break; }; done; fi
ssh_run() { ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$key" "$host" "$@"; }
need_bpy() { [ -n "$bpy" ] && [ -f "$bpy" ] || { echo "hfjob: bundle.py not found next to this wrapper (install it as ~/.local/bin/hfjob-bundle.py)" >&2; exit 2; }; }

case "${1:-}" in
  logs|inspect|cancel|ps|boxes|box-up|box-pause|box-logs)
    args=$(printf '%q ' "$@"); exec ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$key" "$host" "$rhf $args" ;;
  --batch)
    need_bpy; [ $# -eq 2 ] || { echo "usage: hfjob --batch FILE" >&2; exit 2; }
    exec python3 "$bpy" batch "$2" --script "$self" ;;
  collect)
    need_bpy; shift
    if [ "${1:-}" = --all-from ]; then [ $# -ge 2 ] || { echo "usage: hfjob collect --all-from FILE_OR_IDS [--out DIR]" >&2; exit 2; }
      spec=$2; shift 2; exec python3 "$bpy" collect-all "$spec" --script "$self" "$@"
    fi
    job=${1:-}; shift || true; out=""; wait=""
    [[ "$job" =~ ^[0-9a-f]{24}$ ]] || { echo "usage: hfjob collect JOB_ID [--out DIR] [--wait SECS]" >&2; exit 2; }
    while [ $# -gt 0 ]; do case "$1" in --out) out=${2:-}; shift 2 ;; --wait) wait=${2:-}; shift 2 ;; *) echo "hfjob collect: unknown arg $1" >&2; exit 2 ;; esac; done
    [[ -z "$wait" || "$wait" =~ ^[0-9]+$ ]] || { echo "hfjob collect: --wait takes seconds" >&2; exit 2; }
    out=${out:-hfjob-result-$job}
    # the VPS streams the result tarball and deletes it remotely only after the stream completed; extraction here is member-by-member and refuses links, devices and .. paths
    set -o pipefail
    ssh_run "$rhf collect $job --stdout ${wait:+--wait $wait}" | python3 "$bpy" extract --out "$out"
    exit 0 ;;
esac

timeout=30m; flavor=cpu-upgrade; box=""; wait=""; bundle=0; includes=(); excludes=(); max_mb=500; outs=()
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) timeout=${2:-}; shift 2 ;;
    --flavor) flavor=${2:-}; shift 2 ;;
    --box) box=${2:-}; shift 2 ;;
    --wait) wait=--wait; shift ;;
    --bundle) bundle=1; shift ;;
    --include) includes+=("${2:?--include needs a PATH}"); shift 2 ;;
    --exclude) excludes+=("${2:?--exclude needs a GLOB}"); shift 2 ;;
    --max-mb) max_mb=${2:-}; shift 2 ;;
    --out) outs+=("${2:?--out needs a DIR}"); shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ $# -ge 1 ] || { echo "usage: hfjob [--timeout 30m] [--flavor cpu-upgrade] -- <cmd...>   |   hfjob --bundle [--include PATH]... [--exclude GLOB]... [--max-mb N] [--out DIR]... -- <cmd...>   |   hfjob --batch FILE   |   hfjob collect ID   |   hfjob logs|inspect|cancel|ps ID" >&2; exit 2; }
[[ "$timeout" =~ ^[0-9]+[mh]$ ]] || { echo "hfjob: --timeout must look like 30m or 2h" >&2; exit 2; }

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hfjob: the cwd is not inside a git checkout" >&2; exit 2; }

if [ "$bundle" = 1 ]; then
  need_bpy
  [ -z "$box" ] || { echo "hfjob: --bundle and --box cannot be combined" >&2; exit 2; }
  [[ "$max_mb" =~ ^[0-9]+$ ]] || { echo "hfjob: --max-mb must be a whole number" >&2; exit 2; }
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/hfjob-mac.XXXXXX"); trap 'rm -rf "$tmp"' EXIT
  pargs=(pack --root "$top" --out "$tmp/b.tar.gz" --max-mb "$max_mb")
  for i in ${includes[@]+"${includes[@]}"}; do pargs+=(--include "$i"); done
  for x in ${excludes[@]+"${excludes[@]}"}; do pargs+=(--exclude "$x"); done
  python3 "$bpy" "${pargs[@]}" >/dev/null   # refuses (exit 2, with the reason) on a credential-looking name or content or over the size cap: nothing leaves the Mac
  rtar="/tmp/hfjob-bundle-$(python3 -c 'import uuid;print(uuid.uuid4().hex)').tar.gz"
  ssh_run "umask 077; cat > $rtar" < "$tmp/b.tar.gz"
  rargs=(--bundle-tar "$rtar" --max-mb "$max_mb" --timeout "$timeout" --flavor "$flavor")
  for o in ${outs[@]+"${outs[@]}"}; do rargs+=(--out "$o"); done
  rcmd=$(printf '%q ' "${rargs[@]}" -- "$@")
  name=$(basename "$top" | sed 's/[^A-Za-z0-9_.-]/-/g'); bsha=$(git -C "$top" rev-parse HEAD 2>/dev/null | cut -c1-12 || true)
  echo "hfjob: bundled $(basename "$top") from this Mac (tar sent to the VPS; the VPS re-scans it and uploads it to the private bundle repo)" >&2
  exec ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$key" "$host" "HFJOB_BUNDLE_NAME='$name' HFJOB_BUNDLE_SHA='${bsha:-none}' $rhf $rcmd"
fi

sha=$(git -C "$top" rev-parse HEAD)
pushed() { [ -n "$(git -C "$top" branch -r --contains "$sha" 2>/dev/null)" ]; }
if ! pushed; then
  git -C "$top" fetch -q origin 2>/dev/null || true
  if ! pushed; then
    ref="hfjob/$(id -un | sed 's/[^A-Za-z0-9_.-]/-/g')-${sha:0:12}"
    git -C "$top" push -q origin "$sha:refs/heads/$ref" 2>/dev/null \
      && echo "hfjob: pushed HEAD ${sha:0:9} to origin $ref (temp branch; delete it when the job is done)" >&2 \
      || { echo "hfjob: HEAD ${sha:0:9} is not pushed and the auto-push failed; push it yourself (or use --bundle for a private checkout)" >&2; exit 2; }
  fi
fi
[ -z "$(git -C "$top" status --porcelain --untracked-files=no 2>/dev/null)" ] || echo "hfjob: uncommitted changes are NOT in the job; it runs the committed sha ${sha:0:9} only" >&2

repo=${HFJOB_REPO:-$(git -C "$top" remote get-url origin)}
case "$repo" in git@github.com:*) repo="https://github.com/${repo#git@github.com:}" ;; esac
case "$repo" in *.git) ;; *) repo="${repo%/}.git" ;; esac
[[ "$repo" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$ ]] || { echo "hfjob: origin is not a plain public https://github.com/<owner>/<name> URL (set HFJOB_REPO, or use --bundle)" >&2; exit 2; }

argv=$(printf '%q ' "$@" | base64 | tr -d '\n')
lane=$(basename "$top" | sed 's/[^A-Za-z0-9_.-]/-/g' | cut -c1-40)
# VPS side: a throwaway git checkout of exactly that sha (public repo, depth 1), then the real hfjob inside it; the job id comes back on stdout.
remote="set -euo pipefail; d=\$(mktemp -d /tmp/hfjob-mac-XXXXXX); trap 'rm -rf \"\$d\"' EXIT; cd \"\$d\"; git init -q; git fetch -q --depth 1 '$repo' '$sha'; git checkout -q --detach FETCH_HEAD; git update-ref refs/remotes/origin/hfjob-mac '$sha'; git remote add origin '$repo'; a=\$(echo '$argv' | base64 -d); export HFJOB_REPO='$repo'; eval \"$rhf --timeout '$timeout' --flavor '$flavor' ${box:+--box '$box'} $wait -- \$a\""
echo "hfjob: forwarding to the VPS for ${repo##*/} @ ${sha:0:9} (lane $lane)" >&2
exec ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$key" "$host" "$remote"
