#!/bin/bash
# hfjob [--timeout 30m] [--flavor cpu-upgrade] -- CMD ARGS... : run CMD on a Hugging Face CPU job ($0.03/h, 8 vCPU / 32 GB) at the CURRENT checkout's pushed HEAD.
# Repo-agnostic (Dom 2026-10-27: "any dev any time can use hugging face"): no repo name lives in this file. It reads `git remote get-url origin` and HEAD of the cwd, refuses
# if HEAD is not pushed, then submits a detached job (the Playwright image from data/hf-boxes.json: Node, git, Chromium) that clones that repo at that sha, runs `npm ci` when there is a package-lock.json, and execs CMD.
# Prints `tier=hf-cpu job=<id> repo=<owner/name> sha=<sha>` and the `hfjob logs <id>` line (hfjob logs|inspect|cancel|ps pass through to `hf jobs`, with the token), and appends one line to the ledger. Exit 0 = submitted, 2 = usage/refused, 1 = hf failed.
# Public GitHub repos only (no secret goes into the job). The HF token is read here, inside the script, from /root/.hf/token when HF_TOKEN is unset; it is never echoed, logged or passed on a command line.
# Env: HFJOB_REPO (override origin), HFJOB_DEPTH (git fetch depth, default 1, 0 = full history), HFJOB_LEDGER (default /var/log/hfjob.log), HFJOB_BIN (the hf CLI, default hf), HFJOB_DRY=1 (print the hf command, run nothing).
# GPU jobs are not run here: they need a stated reason and go through scripts/gpu-run.mjs.
set -euo pipefail

# the hf CLI is not logged in as root: the token is read here, inside the script, and exported to the hf process only (never printed, never on a command line)
# /etc/hfjob/token (root:hf 0640, provisioned by Dom 2026-10-29) is read first so lane users in group hf can spill; root falls back to its own file.
with_token() { if [ -z "${HF_TOKEN:-}" ]; then for f in /etc/hfjob/token /root/.hf/token; do if [ -r "$f" ]; then HF_TOKEN=$(cat "$f"); export HF_TOKEN; break; fi; done; fi; }
# hfjob logs|inspect|cancel|ps ARGS... : the same hf subcommands, with the token, so a job can be followed without `hf auth login`
case "${1:-}" in logs|inspect|cancel|ps) with_token; exec "${HFJOB_BIN:-hf}" jobs "$@" ;; esac

here=$(dirname "$(readlink -f "$0")")
# Standing boxes (Dom 2026-10-27): hfjob boxes | box-up NAME [--update] | box-pause NAME | box-logs NAME ID [--follow] ; hfjob --box NAME [--wait] -- CMD runs on the Space <owner>/<prefix>NAME
# (names, flavor, sleep time all in data/hf-boxes.json; docs/HF-BOXES.md). Jobs below stay for fire-and-forget and need no box.
case "${1:-}" in
  boxes) shift; exec python3 "$here/boxes.py" list "$@" ;;
  box-up) shift; exec python3 "$here/boxes.py" up "$@" ;;
  box-pause) shift; exec python3 "$here/boxes.py" pause "$@" ;;
  box-logs) shift; exec python3 "$here/boxes.py" logs "$@" ;;
  box-tick) shift; exec python3 "$here/boxes.py" tick "$@" ;;   # cron, every minute (install-vps.sh): polls the recorded box jobs
  # hfjob --batch FILE : each non-comment line is the args of one hfjob call; they are submitted concurrently, one `tier=hf-cpu job=<id> ...` line each (a single command, no shell loop)
  --batch) [ $# -eq 2 ] || { echo "usage: hfjob --batch FILE   (each non-comment line = the args of one hfjob call)" >&2; exit 2; }
    exec python3 "$here/bundle.py" batch "$2" --script "$(readlink -f "$0")" ;;
  # hfjob collect JOB_ID [--out DIR] [--wait SECS] | collect --all-from FILE_OR_IDS [--out DIR] [--wait SECS] : download + extract a --bundle job's results, then delete them from the private repo
  collect) shift; with_token
    if [ "${1:-}" = --all-from ]; then [ $# -ge 2 ] || { echo "usage: hfjob collect --all-from FILE_OR_IDS [--out DIR]" >&2; exit 2; }
      spec=$2; shift 2; exec python3 "$here/bundle.py" collect-all "$spec" --script "$(readlink -f "$0")" "$@"
    fi
    [ $# -ge 1 ] || { echo "usage: hfjob collect JOB_ID [--out DIR] [--wait SECS]" >&2; exit 2; }
    exec python3 "$here/bundle.py" collect "$@" ;;
esac
timeout=30m; flavor=cpu-upgrade; timeout_set=0; box=""; wait=(); spill=0
bundle=0; includes=(); excludes=(); max_mb=500; outs=(); bundle_tar=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bundle) bundle=1; shift ;;
    --include) includes+=("${2:?--include needs a PATH}"); shift 2 ;;
    --exclude) excludes+=("${2:?--exclude needs a GLOB}"); shift 2 ;;
    --max-mb) max_mb=${2:-}; shift 2 ;;
    --out) outs+=("${2:?--out needs a DIR}"); shift 2 ;;
    --bundle-tar) bundle_tar=${2:-}; bundle=1; shift 2 ;;   # internal: the Mac wrapper packs and scans locally, ships the tarball here
    --timeout) timeout=${2:-}; timeout_set=1; shift 2 ;;
    --flavor) flavor=${2:-}; shift 2 ;;
    --box) box=${2:-}; shift 2 ;;
    --wait) wait=(--wait); shift ;;
    --spill) spill=1; shift ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ $# -ge 1 ] || { echo "usage: hfjob [--timeout 30m] [--flavor cpu-upgrade] [--box NAME [--wait]] -- <cmd...>   |   hfjob --bundle [--include PATH]... [--exclude GLOB]... [--max-mb N] [--out DIR]... -- <cmd...>   |   hfjob --batch FILE   |   hfjob collect ID|--all-from SPEC [--out DIR]   |   hfjob boxes | box-up NAME | box-pause NAME | box-logs NAME ID" >&2; exit 2; }
[[ "$timeout" =~ ^[0-9]+[mh]$ ]] || { echo "hfjob: --timeout must look like 30m or 2h, got '$timeout'" >&2; exit 2; }
case "$flavor" in cpu-upgrade|cpu-basic) ;; *) echo "hfjob: --flavor '$flavor' is not a CPU flavor (cpu-upgrade, cpu-basic); GPU jobs go through scripts/gpu-run.mjs" >&2; exit 2 ;; esac

if [ "$bundle" = 0 ] && { [ ${#includes[@]} -gt 0 ] || [ ${#excludes[@]} -gt 0 ] || [ ${#outs[@]} -gt 0 ]; }; then echo "hfjob: --include/--exclude/--out only make sense with --bundle" >&2; exit 2; fi

if [ "$bundle" = 1 ]; then
  # ---- hfjob --bundle: a PRIVATE checkout (or any folder) runs on HF CPU with no git credential and no public push. Design + security model: docs/HFJOB-BUNDLE.md.
  [ -z "$box" ] || { echo "hfjob: --bundle and --box cannot be combined (a box clones a public sha)" >&2; exit 2; }
  [[ "$max_mb" =~ ^[0-9]+$ ]] || { echo "hfjob: --max-mb must be a whole number, got '$max_mb'" >&2; exit 2; }
  out_list="hfjob-out"
  if [ ${#outs[@]} -gt 0 ]; then
    for o in "${outs[@]}"; do [[ "$o" =~ ^[A-Za-z0-9_][A-Za-z0-9_./-]*$ ]] && [[ "$o" != *..* ]] || { echo "hfjob: --out '$o' must be a relative path inside the checkout (no .., no spaces)" >&2; exit 2; }; done
    out_list="${outs[*]}"
  fi
  btmp=$(mktemp -d "${TMPDIR:-/tmp}/hfjob-bundle.XXXXXX"); trap 'rm -rf "$btmp"; case "$bundle_tar" in /tmp/hfjob-bundle-*.tar.gz) rm -f "$bundle_tar" ;; esac' EXIT
  if [ -n "$bundle_tar" ]; then
    [ -f "$bundle_tar" ] || { echo "hfjob: --bundle-tar $bundle_tar not found" >&2; exit 2; }
    tarball=$bundle_tar; sumj=$(python3 "$here/bundle.py" scan "$tarball" --max-mb "$max_mb") || exit 2   # the VPS never trusts a tarball it did not scan itself
    btop=${HFJOB_BUNDLE_NAME:-bundle}; bsha=${HFJOB_BUNDLE_SHA:-none}
    nfiles=$(python3 -c 'import sys,tarfile;print(sum(1 for m in tarfile.open(sys.argv[1]) if m.isfile()))' "$tarball"); mb=$(python3 -c 'import json,sys;print(round(json.loads(sys.argv[1])["bytes"]/1048576,1))' "$sumj")
  else
    top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hfjob: the cwd is not inside a git checkout (the bundle manifest is git ls-files -co --exclude-standard)" >&2; exit 2; }
    btop=$(basename "$top"); bsha=$(git -C "$top" rev-parse HEAD 2>/dev/null | cut -c1-12 || true); bsha=${bsha:-none}
    pargs=(pack --root "$top" --out "$btmp/b.tar.gz" --max-mb "$max_mb")
    for i in ${includes[@]+"${includes[@]}"}; do pargs+=(--include "$i"); done
    for x in ${excludes[@]+"${excludes[@]}"}; do pargs+=(--exclude "$x"); done
    sumj=$(python3 "$here/bundle.py" "${pargs[@]}") || exit 2
    tarball="$btmp/b.tar.gz"
    nfiles=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["files"])' "$sumj"); mb=$(python3 -c 'import json,sys;print(round(json.loads(sys.argv[1])["bytes"]/1048576,1))' "$sumj")
  fi
  bid=$(python3 -c 'import uuid;print(uuid.uuid4())')
  bargv=$(printf '%q ' "$@" | base64 | tr -d '\n')
  blane=$(printf '%s' "$btop" | sed -e 's/^frankendom-//' -e 's/[^A-Za-z0-9_.-]/-/g' | cut -c1-40)
  brepo=$(python3 - "${HFBOX_DATA:-$here/../../data/hf-boxes.json}" <<'PY'
import json, os, sys
print(os.environ.get("HFJOB_BUNDLE_REPO") or json.load(open(sys.argv[1]))["owner"] + "/hfjob-bundles")
PY
)
  bimage=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["image"])' "${HFBOX_DATA:-$here/../../data/hf-boxes.json}")
  binner=$(cat "$here/inner-bundle.sh")
  hf=${HFJOB_BIN:-hf}
  # HF_TOKEN reaches the job as a SECRET by name only (`--secrets HF_TOKEN` reads it from this process's environment): it is never in argv, a -e value, the bundle, the logs or the ledger
  bargs=(jobs run --detach --timeout "$timeout" --flavor "$flavor" --label "lane=$blane" --secrets HF_TOKEN
    -e "HFJOB_BUNDLE_ID=$bid" -e "HFJOB_BUNDLE_REPO=$brepo" -e "HFJOB_OUT=$out_list" -e "HFJOB_ARGV_B64=$bargv" "$bimage" bash -c "$binner")
  if [ "${HFJOB_DRY:-}" = 1 ]; then
    echo "hfjob: dry run: bundle $bid ($nfiles files, $mb MB) would go to private dataset $brepo as bundles/$bid.tar.gz; nothing uploaded" >&2
    printf '%q' "$hf"; printf ' %q' "${bargs[@]}"; printf '\n'; exit 0
  fi
  with_token
  python3 "$here/bundle.py" upload "$tarball" --id "$bid" >/dev/null || { echo "hfjob: bundle upload failed (see above); nothing was submitted" >&2; exit 1; }
  out=$("$hf" "${bargs[@]}" 2>&1) && rc=0 || rc=$?
  if [ "$rc" -ne 0 ]; then
    python3 "$here/bundle.py" drop "$bid" >/dev/null 2>&1 || true
    echo "hfjob: hf jobs run failed (rc=$rc): $(printf '%s' "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -v -e '^[[:space:]]*$' -e 'HF_DEBUG' | tail -n 3 | tr '\n' ' ' | cut -c1-300)" >&2; exit 1
  fi
  id=$(printf '%s\n' "$out" | sed -n 's/.*Job started with ID: *\([0-9a-f]\{24\}\).*/\1/p' | head -n 1)
  [ -n "$id" ] || { python3 "$here/bundle.py" drop "$bid" >/dev/null 2>&1 || true; echo "hfjob: submitted, but no job id in the hf output" >&2; exit 1; }
  line="tier=hf-cpu job=$id repo=$btop sha=$bsha bundle=$bid files=$nfiles mb=$mb"
  echo "$line"
  echo "follow: hfjob logs $id   (state: hfjob inspect $id, results: hfjob collect $id --out DIR)"
  echo "$(date -u +%FT%TZ) user=$(id -un) $line flavor=$flavor timeout=$timeout" >> "${HFJOB_LEDGER:-/var/log/hfjob.log}" 2>/dev/null || true
  exit 0
fi

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hfjob: the cwd is not inside a git checkout" >&2; exit 2; }
sha=$(git -C "$top" rev-parse HEAD 2>/dev/null) || { echo "hfjob: no HEAD commit in $top" >&2; exit 2; }
pushed() { [ -n "$(git -C "$top" branch -r --contains "$sha" 2>/dev/null)" ]; }
if ! pushed; then
  git -C "$top" fetch -q origin 2>/dev/null || true
  if ! pushed; then
    # Strategy + Dom 2026-10-29: "HEAD is unpushed" was the excuse for not using hfjob. Push the sha to a temp branch on origin instead of failing (HFJOB_NO_PUSH=1 keeps the old refusal; a dry run only says what it would do).
    ref="hfjob/$(id -un | sed 's/[^A-Za-z0-9_.-]/-/g')-${sha:0:12}"
    if [ "${HFJOB_NO_PUSH:-}" = 1 ]; then
      echo "hfjob: HEAD ${sha:0:9} is not pushed; push it first (the job clones the sha from GitHub)" >&2; exit 2
    elif [ "${HFJOB_DRY:-}" = 1 ]; then
      echo "hfjob: HEAD ${sha:0:9} is not pushed; would push it to origin $ref (dry run pushes nothing)" >&2
    elif perr=$(git -C "$top" push -q origin "$sha:refs/heads/$ref" 2>&1); then
      echo "hfjob: pushed HEAD ${sha:0:9} to origin $ref (temp branch; delete it when the job is done)" >&2
    else
      echo "hfjob: HEAD ${sha:0:9} is not pushed, and the auto-push to origin failed ($(printf '%s' "$perr" | grep -v '^[[:space:]]*$' | tail -n 1 | cut -c1-200)); push it yourself (the job clones the sha from GitHub)" >&2; exit 2
    fi
  fi
fi
[ -z "$(git -C "$top" status --porcelain --untracked-files=no 2>/dev/null)" ] || echo "hfjob: uncommitted changes are NOT in the job; it runs the committed sha ${sha:0:9} only" >&2

repo="${HFJOB_REPO:-$(git -C "$top" remote get-url origin 2>/dev/null || true)}"
case "$repo" in git@github.com:*) repo="https://github.com/${repo#git@github.com:}" ;; esac
case "$repo" in *.git) ;; https://github.com/*) repo="${repo%/}.git" ;; esac
[[ "$repo" =~ ^https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)\.git$ ]] || { echo "hfjob: origin '${repo##*@}' is not a plain public https://github.com/<owner>/<name> URL (set HFJOB_REPO)" >&2; exit 2; }
name=${BASH_REMATCH[1]}
depth=${HFJOB_DEPTH:-1}
[[ "$depth" =~ ^[0-9]+$ ]] || { echo "hfjob: HFJOB_DEPTH must be a number" >&2; exit 2; }

# the command travels base64 in the environment with its argument boundaries intact (printf %q), so nothing is re-quoted or interpolated into the job script
argv=$(printf '%q ' "$@" | base64 | tr -d '\n')
lane=$(basename "$top" | sed -e 's/^frankendom-//' -e 's/[^A-Za-z0-9_.-]/-/g' | cut -c1-40)

inner=$(cat "$here/inner.sh")   # the clone + npm ci + exec body, shared with the box runner
image=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["image"])' "${HFBOX_DATA:-$here/../../data/hf-boxes.json}")   # one image (Chromium baked in) for Jobs and boxes: data/hf-boxes.json

if [ "$spill" = 1 ] && [ -z "$box" ]; then   # lanejob's spill: the repo's box when Jobs would queue, a Job otherwise (the reason goes to stderr)
  with_token
  box=$(python3 "$here/boxes.py" pick "$name" || true)
fi

if [ -n "$box" ]; then
  [ "$timeout_set" = 1 ] && { secs=$(( ${timeout%[mh]} * $([ "${timeout: -1}" = h ] && echo 3600 || echo 60) )); tarr=(--timeout "$secs"); } || tarr=()
  bargs=(run "$box" --repo "$repo" --sha "$sha" --argv-b64 "$argv" --depth "$depth" ${tarr[@]+"${tarr[@]}"} ${wait[@]+"${wait[@]}"})
  if [ "${HFJOB_DRY:-}" = 1 ]; then HFJOB_DRY=1 exec python3 "$here/boxes.py" "${bargs[@]}"; fi
  with_token
  exec python3 "$here/boxes.py" "${bargs[@]}"   # boxes.py writes the start line to the ledger itself, at submit, for every caller
fi

hf=${HFJOB_BIN:-hf}
args=(jobs run --detach --timeout "$timeout" --flavor "$flavor" --label "lane=$lane"
  -e "HFJOB_REPO=$repo" -e "HFJOB_SHA=$sha" -e "HFJOB_DEPTH=$depth" -e "HFJOB_ARGV_B64=$argv" "$image" bash -c "$inner")

if [ "${HFJOB_DRY:-}" = 1 ]; then printf '%q' "$hf"; printf ' %q' "${args[@]}"; printf '\n'; exit 0; fi

with_token

out=$("$hf" "${args[@]}" 2>&1) && rc=0 || rc=$?
if [ "$rc" -ne 0 ]; then   # the hf CLI puts the reason a few lines above its "Set HF_DEBUG=1" hint: show the last three real lines, colour codes stripped
  echo "hfjob: hf jobs run failed (rc=$rc): $(printf '%s' "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -v -e '^[[:space:]]*$' -e 'HF_DEBUG' | tail -n 3 | tr '\n' ' ' | cut -c1-300)" >&2; exit 1
fi
id=$(printf '%s\n' "$out" | sed -n 's/.*Job started with ID: *\([0-9a-f]\{24\}\).*/\1/p' | head -n 1)
[ -n "$id" ] || { echo "hfjob: submitted, but no job id in the hf output: $(printf '%s' "$out" | tail -n 1 | cut -c1-200)" >&2; exit 1; }
line="tier=hf-cpu job=$id repo=$name sha=${sha:0:12}"
echo "$line"
echo "follow: hfjob logs $id   (state: hfjob inspect $id, stop: hfjob cancel $id)"
echo "$(date -u +%FT%TZ) user=$(id -un) $line flavor=$flavor timeout=$timeout" >> "${HFJOB_LEDGER:-/var/log/hfjob.log}" 2>/dev/null || true
