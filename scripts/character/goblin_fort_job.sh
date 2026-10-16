#!/usr/bin/env bash
# Runs goblin_fort_kit.py inside an HF CPU job (cpu-upgrade, non-render export work): fetch Blender 5.2.2, run the kit script from the public repo at $REF,
# print the FORT lines (tris per piece) and the glb + atlas as base64 between markers so the Mac can rebuild them from the job log.
# env: REF (branch or sha, default char/goblin-fort-kit)
set -euo pipefail
REF="${REF:-char/goblin-fort-kit}"
apt-get update -qq >/dev/null && apt-get install -y -qq curl xz-utils libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libsm6 libxkbcommon0 >/dev/null
mkdir -p /work && cd /work
curl -sSL -o blender.tar.xz https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
tar xf blender.tar.xz
curl -sSL -o kit.py "https://raw.githubusercontent.com/DomLynch/RPG-game/${REF}/scripts/character/goblin_fort_kit.py"
./blender-5.2.2-linux-x64/blender --background --factory-startup --python-exit-code 1 --python kit.py -- /work/goblin-fort-kit.glb /work/goblin-fort-kit-atlas.png 2>&1 | grep -E "FORT|Error|Traceback|rror:" || true
ls -l /work/goblin-fort-kit.glb /work/goblin-fort-kit-atlas.png
echo "=== GLB-B64 ==="; base64 -w0 /work/goblin-fort-kit.glb; echo
echo "=== ATLAS-B64 ==="; base64 -w0 /work/goblin-fort-kit-atlas.png; echo
echo "=== DONE ==="
