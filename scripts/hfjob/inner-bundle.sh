set -uo pipefail; t0=$(date +%s); lap(){ echo "LAP $1 $(( $(date +%s) - t0 ))s"; }
# hfjob --bundle job body (runs inside the HF job as root). Env: HFJOB_BUNDLE_ID, HFJOB_BUNDLE_REPO (private dataset), HFJOB_ARGV_B64, HFJOB_OUT (space-separated dirs to return),
# JOB_ID (set by Hugging Face), HF_TOKEN (a job SECRET: never echoed, never in argv). Steps: fetch the bundle, delete it from the repo, extract to /w, npm ci, run CMD, upload results/<JOB_ID>.tar.gz.
W=${HFJOB_WORKDIR:-/w}
export DEBIAN_FRONTEND=noninteractive
if ! python3 -c 'import huggingface_hub' 2>/dev/null; then
  { apt-get update -qq && apt-get install -y -qq python3-pip >/dev/null 2>&1 && pip3 install -q --break-system-packages huggingface_hub; } >/dev/null 2>&1 || { echo "hfjob: could not install huggingface_hub" >&2; exit 1; }
fi
lap hub
mkdir -p "$W" /tmp/hfjob-in && cd /tmp/hfjob-in
python3 - <<'PY' || { echo "hfjob: could not fetch the bundle" >&2; exit 1; }
import os, sys, tarfile
from huggingface_hub import HfApi, hf_hub_download
rid, bid, w = os.environ["HFJOB_BUNDLE_REPO"], os.environ["HFJOB_BUNDLE_ID"], os.environ.get("HFJOB_WORKDIR", "/w")
api = HfApi()
if not api.repo_info(rid, repo_type="dataset").private:
    sys.exit("bundle repo is public: refusing")
p = hf_hub_download(rid, f"bundles/{bid}.tar.gz", repo_type="dataset", force_download=True)
api.delete_file(f"bundles/{bid}.tar.gz", repo_id=rid, repo_type="dataset", commit_message=f"fetched {bid}")   # the remote copy is gone as soon as the job has it
with tarfile.open(p, "r:gz") as tf:
    for m in tf.getmembers():
        n = os.path.normpath(m.name)
        if n.startswith("/") or n.startswith("..") or m.isdev() or m.isfifo() or m.issym() or m.islnk():
            sys.exit(f"unsafe member {m.name}")
    tf.extractall(w, filter="data") if sys.version_info >= (3, 12) else tf.extractall(w)
os.remove(p)
PY
cd "$W"; lap extract
cmd=$(printf %s "$HFJOB_ARGV_B64" | base64 -d)
case "$cmd" in *blender*)   # no Blender in the Playwright image: apt's package (4.0.x on Ubuntu noble), installed only for commands that mention it
  apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq blender >/dev/null 2>&1 || echo "hfjob: blender install failed" >&2; lap blender ;;
esac
if [ -f package-lock.json ]; then timeout 600 npm ci --no-audit --no-fund >/dev/null 2>&1 || { echo "hfjob: npm ci failed" >&2; rc=1; }; lap npm-ci; fi
rc=${rc:-0}
if [ "$rc" = 0 ]; then
  echo "hfjob: running bundle ${HFJOB_BUNDLE_ID}: $cmd"
  bash -c "$cmd"; rc=$?
fi
echo "hfjob: command exited $rc"; lap done
mkdir -p "$W/hfjob-out"; echo "$rc" > "$W/hfjob-out/.exit"
out=(); for d in $HFJOB_OUT; do [ "$d" != hfjob-out ] && [ -e "$W/$d" ] && out+=("$d"); done   # hfjob-out is always included once (a repeat would be stored as a hard link, which collect refuses)
(cd "$W" && tar -czf /tmp/hfjob-result.tar.gz --dereference --hard-dereference hfjob-out ${out[@]+"${out[@]}"} 2>/dev/null) || { echo "hfjob: could not tar the results" >&2; }
python3 - <<'PY' || echo "hfjob: result upload failed" >&2
import os
from huggingface_hub import HfApi
HfApi().upload_file(path_or_fileobj="/tmp/hfjob-result.tar.gz", path_in_repo=f"results/{os.environ['JOB_ID']}.tar.gz", repo_id=os.environ["HFJOB_BUNDLE_REPO"], repo_type="dataset", commit_message="result")
PY
lap uploaded
exit "$rc"
