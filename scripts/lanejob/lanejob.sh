#!/bin/bash
# lanejob [--long] CMD ARGS... : run a heavy lane job inside lanejobs.slice (cores 4-15 only, 900% CPU cap, IO weight 10) so nginx, the
# writer, the relay and presence always have cores 0-3. A scope, not a service: same cwd, env, stdio and exit code.
# 2026-10-10 (Dom: "self-inflicted, no guard-rails"; two full suites jammed the box, slice peaked 29 GB vs 8 GB max): non-root callers
# get (a) 4 slots; (b) per-job MemoryMax=4G CPUQuota=300% (LANEJOB_MEM / LANEJOB_CPU override); (c) timeout 1800 unless --long;
# (d) full suites refused; (e) one line `tier=vps slot=n queued=Ns` on stderr at start (the COO counts placement from it);
# (f) SPILL (Dom's work waterfall, Deploy's launch.mjs job, PR #2079): when all 4 slots are busy, or the wait passes 120 s, a job whose
# checkout HEAD is pushed goes to Hugging Face CPU instead of waiting: it prints `tier=hf-cpu slot=n queued=Ns job=<id>` and exits 0
# (the HF job runs detached; follow it with `hf jobs logs <id>`). Exit 75 from launch.mjs (no HF slot) = keep waiting for a VPS slot.
# Root takes a slot and the load gate too (2026-10-12); it keeps its unlimited scope (no memory/CPU cap, no timeout).
refuse_re='(^|[[:space:];&|(])(npm[[:space:]]+run[[:space:]]+(test:all|test:slow|test:browser|quality(:[[:alnum:]_-]+)?)|npm[[:space:]]+(run[[:space:]]+)?test|(node|tsx|npx[[:space:]]+tsx)[[:space:]]+([^[:space:]]+[[:space:]]+)*--test(([[:space:]]+[^[:space:]-][^[:space:]]*){2,}|[[:space:]]+[^[:space:]]*[*][^[:space:]]*))([[:space:]]|$)'
# 2026-10-12 (Lead, Strategy defects 1+2): a job goes to the VPS only when a slot is free AND load1 < VPS_MAX_LOAD1, read from scripts/lib/waterfall.mjs (the
# waterfall's one number) NEXT TO this script: /opt/frankendom/lanejob/<sha>/scripts/{lanejob,lib}/ is the release copy that /usr/local/bin/lanejob execs (scripts/lanejob/install-vps.sh).
# LANEJOB_WATERFALL overrides (tests). Router unreadable = REFUSE, never a guess: `lanejob: router unreadable, not routing`, exit 75, no spill (Strategy 2026-10-12).
# Over the gate the job spills to hf-cpu at once (no 120 s wait); if the spill is refused it falls back to the slot queue. Root takes a slot and the gate too. LANEJOB_LOAD overrides load1 (tests).
probing=0
router_unreadable() {
  if [ "$probing" = 1 ]; then echo "would=refuse reason=router-unreadable"; else tierlog "tier=refuse reason=router-unreadable"; echo "lanejob: router unreadable, not routing" >&2; fi
  exit 75
}
vps_max() {
  local f
  for f in "${LANEJOB_WATERFALL:-}" "$(dirname "$(readlink -f "$0")")/../lib/waterfall.mjs"; do
    [ -r "$f" ] && { sed -n 's/^export const VPS_MAX_LOAD1 = \([0-9][0-9]*\(\.[0-9][0-9]*\)\{0,1\}\);.*/\1/p' "$f" | head -1; return; }
  done
}
over_load() {
  local m l; m=$(vps_max)
  [ -n "$m" ] || router_unreadable
  l="${LANEJOB_LOAD:-$(cut -d' ' -f1 /proc/loadavg)}"
  awk -v l="$l" -v m="$m" 'BEGIN{exit !(l+0>=m+0)}'
}
# --probe CMD (Strategy + Dom 2026-10-12, the Mac middle tier): print where CMD WOULD go and run nothing, take no slot, write no log.
#   would=vps | would=spill reason=slots|release-lock|load | would=refuse (non-root only, like the run; root goes through the load, release and slot gates).  A Mac caller runs this over ssh and only
#   considers its own slot when the answer is would=spill. LANEJOB_SLOTS / RELEASE_LOCK_DIR override the live paths (tests use a tmp dir).
if [ "$1" = "--probe" ]; then
  shift; probing=1
  [ -n "$(vps_max)" ] || router_unreadable   # before any other answer: an unreadable router must never read as spill (Deploy B on #2332)
  [ "$(id -u)" -ne 0 ] && printf '%s\n' "$*" | grep -Eq "$refuse_re" && { echo "would=refuse"; exit 0; }   # the refusal is a non-root rule in the run path, so root is not refused here either
  if find "${RELEASE_LOCK_DIR:-/run/frankendom-release}" -mindepth 1 -maxdepth 1 -mmin -90 2>/dev/null | grep -q .; then echo "would=spill reason=release-lock"; exit 0; fi
  if over_load; then echo "would=spill reason=load"; exit 0; fi
  for i in 1 2 3 4; do
    exec {fd}>>"${LANEJOB_SLOTS:-/run/lanejobs}/slot$i" || { echo "would=vps"; exit 0; }
    if flock -n "$fd"; then echo "would=vps"; exit 0; fi
    exec {fd}>&-
  done
  echo "would=spill reason=slots"; exit 0
fi
long=0; [ "$1" = "--long" ] && { long=1; shift; }
if [ "$(id -u)" -ne 0 ] && printf '%s\n' "$*" | grep -Eq "$refuse_re"; then
  echo "lanejob: refused. full suites run on HF via Deploy (launch.mjs unit)" >&2; exit 126
fi
start=$SECONDS
spill() {  # 0 = the job was submitted to HF (printed), 1 = stay on the VPS queue
  [ "${LANEJOB_NO_SPILL:-0}" = 1 ] && return 1
  local top sha tools lane out rc id tier
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  sha=$(git -C "$top" rev-parse HEAD 2>/dev/null) || return 1
  [ -n "$(git -C "$top" branch -r --contains "$sha" 2>/dev/null)" ] || return 1   # HF checks out the sha: it must be pushed
  tools="${LANEJOB_TOOLS:-$HOME/.spill-tools}"
  if [ -z "$LANEJOB_TOOLS" ]; then
    git -C "$top" fetch -q origin 2>/dev/null
    git -C "$tools" checkout -q --detach "$(git -C "$top" symbolic-ref --short refs/remotes/origin/HEAD)" 2>/dev/null || return 1
  fi
  lane="${LANEJOB_LANE:-$(basename "$top" | sed 's/^frankendom-//')}"
  out=$(cd "$tools" && node scripts/vps-shadow/launch.mjs job "$sha" --lane "$lane" --timeout "${LANEJOB_HF_TIMEOUT:-30m}" --max-wait-s "${LANEJOB_HF_WAIT:-20}" -- "$@" 2>&1); rc=$?
  [ "$rc" -eq 0 ] || { [ "$rc" -ne 75 ] && echo "lanejob: spill refused (rc=$rc): $(printf '%s' "$out" | tail -1 | cut -c1-160)" >&2; return 1; }
  id=$(printf '%s\n' "$out" | sed -n 's/.*Job started with ID: *\([0-9a-f]\{24\}\).*/\1/p' | head -1)
  tier=$(printf '%s\n' "$out" | grep -m1 '^tier=')
  tierlog "${tier:-tier=hf-cpu} job=${id:-unknown} (detached; follow: hf jobs logs $id)"
  return 0
}
tierlog() { echo "$1" >&2; echo "$(date -u +%FT%TZ) user=$(id -un) $1" >> "${LANEJOB_LOG:-/var/log/lanejob.log}" 2>/dev/null || true; }
slots="${LANEJOB_SLOTS:-/run/lanejobs}"; got=; said=; lastspill=
while [ -z "$got" ]; do
  if over_load && { [ -z "$lastspill" ] || [ $((SECONDS-lastspill)) -ge "${LANEJOB_SPILL_WAIT:-120}" ]; }; then
    lastspill=$SECONDS; spill "$@" && exit 0
  fi
  for i in 1 2 3 4; do
    exec {fd}>>"$slots/slot$i" || exit 1
    if flock -n "$fd"; then got=$i; break; fi
    exec {fd}>&-
  done
  [ -n "$got" ] && break
  if [ -z "$lastspill" ] || [ $((SECONDS-lastspill)) -ge "${LANEJOB_SPILL_WAIT:-120}" ]; then
    lastspill=$SECONDS; spill "$@" && exit 0
  fi
  [ -z "$said" ] && { echo "lanejob: queued behind pid $(cat "$slots/slot1" 2>/dev/null) (4 jobs running)" >&2; said=1; }
  sleep 1
done
echo $$ > "$slots/slot$got"
tierlog "tier=vps slot=$got queued=$((SECONDS-start))s"
if [ "$(id -u)" -eq 0 ]; then   # root keeps its unlimited scope (no memory/CPU cap, no timeout), but inside the slot
  systemd-run --scope --quiet --collect --slice=lanejobs.slice "$@"; exit $?
fi
u="$(id -un)"; h="$(getent passwd "$u" | cut -d: -f6)"
t=(timeout 1800); [ "$long" = 1 ] && t=()
# the outer sudo resets HOME to /root, so hand the caller's HOME/USER/LOGNAME back to the job
sudo -n systemd-run --scope --quiet --collect --slice=lanejobs.slice -p MemoryMax="${LANEJOB_MEM:-4G}" -p CPUQuota="${LANEJOB_CPU:-300%}" \
  sudo -n -u "$u" -E -- env HOME="$h" USER="$u" LOGNAME="$u" "${t[@]}" "$@"
exit $?
