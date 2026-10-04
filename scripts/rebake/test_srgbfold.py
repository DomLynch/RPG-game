"""Run: python3 test_srgbfold.py [path/to/rebake-nb.py ...]   (exit 1 on failure)"""
import re
import sys

import numpy as np

from srgbfold import fold_base_factor

fails = []


def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + detail if detail else ''))
    if not ok:
        fails.append(name)


# Hero Look's measured case: Shieldmaiden glove factor, factor-only material (flat white texels).
got = fold_base_factor(np.full((4, 4, 3), 255.0), [0.16, 0.105, 0.065])[0, 0]
check('factor-only glove -> sRGB [111, 91, 72] +-1', np.abs(got.astype(int) - [111, 91, 72]).max() <= 1, str(got.tolist()))
old = np.clip(np.full((4, 4, 3), 255.0) * np.array([0.16, 0.105, 0.065], np.float32), 0, 255).astype(np.uint8)[0, 0]
check('the old line gives the dark value (guards the test itself)', old.tolist() == [40, 26, 16] or np.abs(old.astype(int) - [40, 27, 17]).max() <= 1, str(old.tolist()))
check('old and new differ by > 50 levels', (got.astype(int) - old.astype(int)).max() > 50)
# factor 1 keeps texels byte-exact
t = np.arange(48, dtype=np.float32).reshape(4, 4, 3) * 5
check('factor 1 is byte-exact', (fold_base_factor(t, [1, 1, 1]) == t.astype(np.uint8)).all())
# textured x tint: mid grey 128 x 0.5 linear -> 93 (not 64)
g = fold_base_factor(np.full((1, 1, 3), 128.0), [0.5, 0.5, 0.5])[0, 0, 0]
check('grey 128 x 0.5 -> 93 +-1', abs(int(g) - 93) <= 1, str(int(g)))
check('black stays black, white x 1 channel stays 255', fold_base_factor(np.zeros((1, 1, 3)), [0.3, 0.3, 0.3]).max() == 0 and fold_base_factor(np.full((1, 1, 3), 255.0), [1, 0.5, 0.22])[0, 0, 0] == 255)
# the scripts themselves must no longer multiply sRGB bytes by the factor
for path in sys.argv[1:]:
    src = open(path).read()
    check(f'{path}: no b_*bcf on sRGB bytes', not re.search(r'b_\s*\*\s*bcf', src))
    check(f'{path}: calls fold_base_factor', 'fold_base_factor(' in src)
sys.exit(1 if fails else 0)
