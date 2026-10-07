// Two of Dom's arena rulings that no test asserted (Web's sweep, #1750 row 13 and 14); each is pinned here with his words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_ONE_SCALE, RADIUS, WALL_INNER, BODY_RADIUS, playScaleFor, setPlayScale } from '../src/play-radius.ts';
import { ARENA_ROTATION, ARENA_THEMES } from '../src/arena-themes.ts';
import { RECORD_VERSION } from '../src/record.ts';

// Dom 2026-10-06 (docs/state/lead.md, "Arena 1 final"): "Dom rejected a further 15% (0.306) — reverted". The play circle is 0.36 and a smaller one is the thing he turned down.
test('Arena 1 stays at 0.36: Dom rejected a further 15 % (0.306)', () => {
  assert.equal(ARENA_ONE_SCALE, 0.36);
  assert.notEqual(ARENA_ONE_SCALE, 0.306);
  assert.ok(Math.abs(0.36 * 0.85 - 0.306) < 1e-9, 'the rejected number is exactly 15 % under 0.36');
  for (const opponent of ['veteran', 'pitborn']) assert.equal(playScaleFor(opponent, RECORD_VERSION), 0.36, `${opponent}: the live circle is 0.36`);
  setPlayScale(ARENA_ONE_SCALE); assert.ok(Math.abs(RADIUS - (WALL_INNER * 0.36 - BODY_RADIUS)) < 1e-9, 'the radius the fight runs in is the 0.36 one'); setPlayScale(1);
});

// Dom 2026-10-06 (docs/state/lead.md, Arenas): "every arena = Arena 1 byte-for-byte + ONE painting" (memory feedback_arena_only_backdrop): arenas 2 to 11 are Arena 1 with only the
// painted far world swapped, so a theme may differ from Arena 1 in its id, its name and its backdrop and in nothing else. The generated looks a-d are a different (older) set and stay out.
test('every rotation arena is Arena 1 with only the backdrop swapped', () => {
  const rest = (t: object) => { const { id: _i, name: _n, backdrop: _b, ...others } = t as Record<string, unknown>; return others; };
  const one = ARENA_THEMES['1'];
  const backdrops = new Set<string | undefined>([one.backdrop]);
  for (const key of ARENA_ROTATION.filter((k) => k !== '1')) {
    const theme = ARENA_THEMES[key];
    assert.deepEqual(rest(theme), rest(one), `Arena ${key} differs from Arena 1 in more than its painting`);
    assert.equal(theme.backdrop, `/arena/backdrop-${key}.webp`, `Arena ${key}: one painting, named for it`);
    assert.ok(!backdrops.has(theme.backdrop), `Arena ${key}: its painting is its own`);
    backdrops.add(theme.backdrop);
  }
  assert.equal(backdrops.size, ARENA_ROTATION.length, 'one painting per rotation arena');
});
