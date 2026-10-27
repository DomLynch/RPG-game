#!/bin/bash
# hfjob [--timeout 30m] [--flavor cpu-upgrade] -- CMD ARGS... : run CMD on a Hugging Face CPU job ($0.03/h, 8 vCPU / 32 GB) at the CURRENT checkout's pushed HEAD.
# Repo-agnostic (Dom 2026-10-27: "any dev any time can use hugging face"): no repo name lives in this file. It reads `git remote get-url origin` and HEAD of the cwd, refuses
# if HEAD is not pushed, then submits a detached node:22 job that clones that repo at that sha, runs `npm ci` when there is a package-lock.json, and execs CMD.
# Prints `tier=hf-cpu job=<id> repo=<owner/name> sha=<sha>` and the `hf jobs logs <id>` line, and appends one line to the ledger. Exit 0 = submitted, 2 = usage/refused, 1 = hf failed.
# Public GitHub repos only (no secret goes into the job). The HF token is read here, inside the script, from /root/.hf/token when HF_TOKEN is unset; it is never echoed, logged or passed on a command line.
# Env: HFJOB_REPO (override origin), HFJOB_DEPTH (git fetch depth, default 1, 0 = full history), HFJOB_LEDGER (default /var/log/hfjob.log), HFJOB_BIN (the hf CLI, default hf), HFJOB_DRY=1 (print the hf command, run nothing).
# GPU jobs are not run here: they need a stated reason and go through scripts/gpu-run.mjs.
set -euo pipefail

timeout=30m; flavor=cpu-upgrade
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) timeout=${2:-}; shift 2 ;;
    --flavor) flavor=${2:-}; shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ $# -ge 1 ] || { echo "usage: hfjob [--timeout 30m] [--flavor cpu-upgrade] -- <cmd...>" >&2; exit 2; }
[[ "$timeout" =~ ^[0-9]+[mh]$ ]] || { echo "hfjob: --timeout must look like 30m or 2h, got '$timeout'" >&2; exit 2; }
case "$flavor" in cpu-upgrade|cpu-basic) ;; *) echo "hfjob: --flavor '$flavor' is not a CPU flavor (cpu-upgrade, cpu-basic); GPU jobs go through scripts/gpu-run.mjs" >&2; exit 2 ;; esac

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hfjob: the cwd is not inside a git checkout" >&2; exit 2; }
sha=$(git -C "$top" rev-parse HEAD 2>/dev/null) || { echo "hfjob: no HEAD commit in $top" >&2; exit 2; }
pushed() { [ -n "$(git -C "$top" branch -r --contains "$sha" 2>/dev/null)" ]; }
pushed || { git -C "$top" fetch -q origin 2>/dev/null || true; pushed; } || { echo "hfjob: HEAD ${sha:0:9} is not pushed; push it first (the job clones the sha from GitHub)" >&2; exit 2; }

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

inner='set -euo pipefail; t0=$(date +%s); lap(){ echo "LAP $1 $(( $(date +%s) - t0 ))s"; }
mkdir -p /w && cd /w && git init -q && git remote add origin "$HFJOB_REPO"
f=(); [ "$HFJOB_DEPTH" = 0 ] || f=(--depth "$HFJOB_DEPTH")
for i in 1 2 3; do timeout 120 git fetch -q "${f[@]}" origin "$HFJOB_SHA" && break; [ "$i" = 3 ] && { echo "hfjob: could not fetch $HFJOB_SHA from $HFJOB_REPO" >&2; exit 1; }; sleep $((i * 5)); done
git checkout -q --detach FETCH_HEAD; lap checkout
if [ -f package-lock.json ]; then timeout 600 npm ci --no-audit --no-fund >/dev/null 2>&1 || { echo "hfjob: npm ci failed" >&2; exit 1; }; lap npm-ci; fi
echo "hfjob: running at $(git rev-parse --short HEAD): $(printf %s "$HFJOB_ARGV_B64" | base64 -d)"
exec bash -c "$(printf %s "$HFJOB_ARGV_B64" | base64 -d)"'

hf=${HFJOB_BIN:-hf}
args=(jobs run --detach --timeout "$timeout" --flavor "$flavor" --label "lane=$lane" --label "sha=${sha:0:12}"
  -e "HFJOB_REPO=$repo" -e "HFJOB_SHA=$sha" -e "HFJOB_DEPTH=$depth" -e "HFJOB_ARGV_B64=$argv" node:22 bash -c "$inner")

if [ "${HFJOB_DRY:-}" = 1 ]; then printf '%q' "$hf"; printf ' %q' "${args[@]}"; printf '\n'; exit 0; fi

# the token: read here only, exported to the hf process, never printed (Dom 2026-10-21)
if [ -z "${HF_TOKEN:-}" ] && [ -r /root/.hf/token ]; then HF_TOKEN=$(cat /root/.hf/token); export HF_TOKEN; fi

out=$("$hf" "${args[@]}" 2>&1) && rc=0 || rc=$?
if [ "$rc" -ne 0 ]; then echo "hfjob: hf jobs run failed (rc=$rc): $(printf '%s' "$out" | tail -n 1 | cut -c1-200)" >&2; exit 1; fi
id=$(printf '%s\n' "$out" | sed -n 's/.*Job started with ID: *\([0-9a-f]\{24\}\).*/\1/p' | head -n 1)
[ -n "$id" ] || { echo "hfjob: submitted, but no job id in the hf output: $(printf '%s' "$out" | tail -n 1 | cut -c1-200)" >&2; exit 1; }
line="tier=hf-cpu job=$id repo=$name sha=${sha:0:12}"
echo "$line"
echo "follow: hf jobs logs $id   (state: hf jobs inspect $id, stop: hf jobs cancel $id)"
echo "$(date -u +%FT%TZ) user=$(id -un) $line flavor=$flavor timeout=$timeout" >> "${HFJOB_LEDGER:-/var/log/hfjob.log}" 2>/dev/null || true
