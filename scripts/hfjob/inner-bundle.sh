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
# BEGIN blender5 (tests/hfjob-blender5.test.ts runs this block with a stub curl)
# No Blender in the Playwright image. Only for commands that mention it: the official Blender 5.2.1 LTS tarball (same major as the Macs; apt's 4.0.2 cannot read meshopt GLBs and has no
# numpy), pinned by sha256, mirrors tried in order (download.blender.org answers 403 to some datacenter ranges). Its bundled Python carries numpy. apt's package is the last fallback.
BLENDER_VER=${BLENDER_VER:-5.2.1}
BLENDER_SHA256=${BLENDER_SHA256:-a31f524fa99a527d3d52b7f5aaa68c34e1a19d5a1c9473f79c5cc610fd5b10e9}   # blender-5.2.1-linux-x64.tar.xz, from download.blender.org/release/Blender5.2/blender-5.2.1.sha256
BLENDER_ROOT=${BLENDER_ROOT:-/opt/blender5}; BLENDER_LINK=${BLENDER_LINK:-/usr/local/bin/blender}
BLENDER_MIRRORS=${BLENDER_MIRRORS:-"https://mirrors.ocf.berkeley.edu/blender/release/Blender5.2 https://ftp.nluug.nl/pub/graphics/blender/release/Blender5.2 https://download.blender.org/release/Blender5.2"}
install_blender5() {
  local tb=/tmp/blender5.tar.xz u got
  rm -f "$tb"
  for u in $BLENDER_MIRRORS; do
    # any curl failure (even one that left a full body, e.g. rc 18) discards the file: only a download that exits 0 AND matches the pin is kept
    curl -fsSL --retry 2 -A "Mozilla/5.0" -o "$tb" "$u/blender-$BLENDER_VER-linux-x64.tar.xz" 2>/dev/null || { echo "hfjob: blender mirror failed: ${u#https://}" >&2; rm -f "$tb"; continue; }
    got=$(sha256sum "$tb" 2>/dev/null | cut -d' ' -f1)
    [ "$got" = "$BLENDER_SHA256" ] && break
    echo "hfjob: blender sha256 mismatch from ${u#https://}" >&2; rm -f "$tb"
  done
  # re-verify after the loop and before anything is extracted: never trust loop state
  got=$([ -s "$tb" ] && sha256sum "$tb" 2>/dev/null | cut -d' ' -f1)
  [ -n "$got" ] && [ "$got" = "$BLENDER_SHA256" ] || { echo "hfjob: no blender tarball matches the pinned sha256; not extracting" >&2; rm -f "$tb"; return 1; }
  # the shared libraries Blender links (headless still loads them); best effort, a missing one shows up in the --version check below
  apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 xz-utils >/dev/null 2>&1 || true
  rm -rf "$BLENDER_ROOT"; mkdir -p "$BLENDER_ROOT" && tar -xJf "$tb" -C "$BLENDER_ROOT" --strip-components=1 || return 1
  ln -sf "$BLENDER_ROOT/blender" "$BLENDER_LINK" && "$BLENDER_LINK" --version >/dev/null 2>&1 || return 1
}
case "$cmd" in *blender*)
  if install_blender5; then echo "hfjob: blender $("$BLENDER_LINK" --version 2>/dev/null | head -n 1) (pinned tarball)"
  else
    echo "hfjob: blender $BLENDER_VER tarball unavailable; falling back to apt blender (older, no numpy guarantee)" >&2
    apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq blender python3-numpy >/dev/null 2>&1 || echo "hfjob: blender install failed" >&2
  fi
  lap blender ;;
esac
# END blender5
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
