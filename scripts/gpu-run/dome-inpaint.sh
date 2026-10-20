#!/usr/bin/env bash
# The banner-free sky dome picture on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/dome-inpaint.sh landscape
# SDXL inpainting (public model, no token), scripts/dome-inpaint-sdxl.py, the banner boxes below (hand-drawn on the shipped picture, roofs kept). Writes artifacts/dome/<name>-clean.<ext> and the before/after crops of each box.
set -euo pipefail
NAME="${1:?landscape|portrait|panorama}"
case "$NAME" in
  landscape) SRC=public/zones/goblin-fortress-landscape.webp; EXT=webp
    BOXES="92,468,172,606;48,482,88,522;1022,386,1060,440;1200,364,1244,430;1246,368,1284,438;1404,534,1466,630;1598,470,1672,615" ;;
  *) echo "boxes for $NAME not drawn yet"; exit 2 ;;
esac
mkdir -p artifacts/dome
echo "== who: $(id -un) python: $(python3 --version 2>&1) pip: $(command -v pip3 || echo none) uv: $(command -v uv || echo none) nvidia: $(nvidia-smi -L 2>&1 | head -1)"
if ! python3 -m venv /tmp/v 2>/tmp/venv.err; then cat /tmp/venv.err; apt-get update -qq 2>&1 | tail -2; apt-get install -y -qq python3-venv python3-pip 2>&1 | tail -3; python3 -m venv /tmp/v; fi
/tmp/v/bin/pip install -q torch diffusers transformers accelerate pillow numpy safetensors 2>&1 | tail -4
/tmp/v/bin/python scripts/dome-inpaint-sdxl.py "$SRC" "artifacts/dome/$NAME-clean.$EXT" "$BOXES"
/tmp/v/bin/python - "$SRC" "artifacts/dome/$NAME-clean.$EXT" "$BOXES" <<'PY'
import sys
from PIL import Image
a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')
for i, bx in enumerate(sys.argv[3].split(';')):
    x0, y0, x1, y1 = map(int, bx.split(',')); p = 24
    r = (max(0, x0 - p), max(0, y0 - p), min(a.width, x1 + p), min(a.height, y1 + p))
    w, h = r[2] - r[0], r[3] - r[1]; s = Image.new('RGB', (w * 2 + 6, h), 'white'); s.paste(a.crop(r), (0, 0)); s.paste(b.crop(r), (w + 6, 0)); s.save(f'artifacts/dome/box{i}-before-after.png')
PY
