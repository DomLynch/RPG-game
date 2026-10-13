# The node a unit suite runs under on the Mac (Lead 2026-10-13): the pinned NODE_PIN of scripts/lib/vps-unit.mjs, the same node the VPS/HF receipt and
# unit-ci's shards use, or nothing. The Mac's default node was v25.8.1 while every trusted receipt ran v22.23.3, and record/replay fingerprints follow the
# node's float behaviour. Sourced by scripts/deploy.sh; every branch that runs a suite there calls `use_pinned_node || exit 1` first.
#   PATH's node already the pin -> nothing changes.
#   else the pinned install (DEPLOY_NODE_PIN_DIR, default ~/.frankendom/node-<pin>: an official tarball, unpacked) goes first on PATH, its npm with it.
#   else it stops with both versions and the install commands; the suite never runs under another node.
use_pinned_node() {
  local pin have dir
  pin=$(node -e "import('./scripts/lib/vps-unit.mjs').then((m) => console.log(m.NODE_PIN.version))" 2>/dev/null) || pin=
  [[ $pin =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "unit node: could not read NODE_PIN from scripts/lib/vps-unit.mjs; not running the suite"; return 1; }
  have=$(node -v 2>/dev/null || echo none)
  if [[ $have == "$pin" ]]; then echo "unit node: $pin (PATH)"; return 0; fi
  dir=${DEPLOY_NODE_PIN_DIR:-$HOME/.frankendom/node-$pin}
  if [[ -x $dir/bin/node && "$("$dir/bin/node" -v 2>/dev/null)" == "$pin" ]]; then
    export PATH="$dir/bin:$PATH"; hash -r
    echo "unit node: $pin from $dir (PATH had $have)"
    return 0
  fi
  local os arch; os=$(uname -s | tr '[:upper:]' '[:lower:]'); arch=$(uname -m); [[ $arch == x86_64 ]] && arch=x64; [[ $arch == aarch64 ]] && arch=arm64
  echo "unit node: the suite needs node $pin (NODE_PIN, scripts/lib/vps-unit.mjs); PATH has $have and $dir has no node $pin. Not running it under another node."
  echo "unit node: install once: mkdir -p ~/.frankendom && cd ~/.frankendom && curl -fsSLO https://nodejs.org/dist/$pin/node-$pin-$os-$arch.tar.xz && curl -fsSL https://nodejs.org/dist/$pin/SHASUMS256.txt | grep \" node-$pin-$os-$arch.tar.xz\$\" | shasum -a 256 -c - && tar -xJf node-$pin-$os-$arch.tar.xz && mv node-$pin-$os-$arch node-$pin"
  return 1
}
