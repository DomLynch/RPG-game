"""Run the existing parts.py with the geometry-first five-view head fitter.

Usage (from repo root):
  HEAD_PHOTO=1 blender -b -P scripts/character/parts_photo3d.py -- --body realistic
  node scripts/build-warrior.mjs

The stock scripts/character/head.py and v14 path are not modified.
"""
from pathlib import Path

here = Path(__file__).resolve().parent
parts = here / 'parts.py'
source = parts.read_text(encoding='utf-8')
needle = 'import head as HEADMOD  # noqa: E402  realistic head: UDIM tiles, sculpted normal, cards'
replacement = 'import head_photo3d as HEADMOD  # noqa: E402  geometry-first five-view portrait fit'
if needle not in source:
    raise RuntimeError('parts.py import line changed; refusing to patch the wrong source')
source = source.replace(needle, replacement, 1)
# Execute in this __main__ namespace so head.py/head_photo3d.py still see the
# helpers parts.py defines through `import __main__ as P`.
globals()['__file__'] = str(parts)
exec(compile(source, str(parts), 'exec'), globals(), globals())
