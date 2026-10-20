#!/usr/bin/env bash
# The banner-free sky dome pictures on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/dome-inpaint.sh landscape [portrait ...]
# SDXL inpainting (public model, no token), scripts/dome-inpaint-sdxl.py, the banner boxes below (hand-drawn on the shipped pictures, roofs kept: a roof is outside every box).
# Writes artifacts/dome/<name>-clean.<ext> and the before/after crop of each box. The job runs as pwuser with no apt and no ensurepip: a pip-less venv, then pip's own bootstrap script.
set -euo pipefail
[[ $# -gt 0 ]] || { echo "usage: dome-inpaint.sh landscape|portrait|panorama ..."; exit 2; }
mkdir -p artifacts/dome
echo "== who: $(id -un) python: $(python3 --version 2>&1) nvidia: $(nvidia-smi -L 2>&1 | head -1)"
python3 -m venv --without-pip /tmp/v
curl -sSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py && /tmp/v/bin/python /tmp/get-pip.py -q 2>&1 | tail -2
/tmp/v/bin/pip install -q torch diffusers transformers accelerate pillow numpy safetensors 2>&1 | tail -4
for NAME in "$@"; do
  case "$NAME" in
    landscape) SRC=public/zones/goblin-fortress-landscape.webp; EXT=webp
      BOXES="92,468,172,606;48,482,88,522;1022,386,1060,440;1200,364,1244,430;1246,368,1284,438;1392,526,1478,640;1598,470,1672,615" ;;
    portrait) SRC=public/zones/goblin-fortress-portrait.webp; EXT=webp
      BOXES="28,955,112,1095;742,1022,802,1092;902,958,941,1078;786,752,842,842;840,758,886,828;598,778,636,852" ;;
    *) echo "boxes for $NAME not drawn yet"; exit 2 ;;
  esac
  /tmp/v/bin/python scripts/dome-inpaint-sdxl.py "$SRC" "artifacts/dome/$NAME-clean.$EXT" "$BOXES"
  /tmp/v/bin/python - "$SRC" "artifacts/dome/$NAME-clean.$EXT" "$BOXES" "$NAME" <<'PY'
import sys
from PIL import Image
a, b, name = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB'), sys.argv[4]
for i, bx in enumerate(sys.argv[3].split(';')):
    x0, y0, x1, y1 = map(int, bx.split(',')); p = 24
    r = (max(0, x0 - p), max(0, y0 - p), min(a.width, x1 + p), min(a.height, y1 + p))
    w, h = r[2] - r[0], r[3] - r[1]; s = Image.new('RGB', (w * 2 + 6, h), 'white'); s.paste(a.crop(r), (0, 0)); s.paste(b.crop(r), (w + 6, 0)); s.save(f'artifacts/dome/{name}-box{i}-before-after.png')
PY
done
