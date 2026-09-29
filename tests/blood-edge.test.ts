import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, createBloodEdge, edgeOf, streak, type Page } from '../src/blood-edge.ts';
import { weaponOf, type MoveId } from '../src/moves.ts';
import type { CombatEvent, Duel } from '../src/duel.ts';

// A stand-in page: counts what the overlay adds and animates. Elements only need style, attributes, children, innerHTML, querySelector and animate.
function fakePage() {
  const made: string[] = [], animated: string[] = [];
  const element = (tag: string) => {
    const el = { tag, style: {} as Record<string, string>, children: [] as unknown[], innerHTML: '', id: '', setAttribute() {}, append(c: unknown) { this.children.push(c); },
      querySelector: () => ({ innerHTML: '' }), animate: () => { animated.push(tag); }, after: () => { made.push('placed'); } };
    made.push(tag); return el;
  };
  const page = { document: { createElement: element, createElementNS: (_: string, tag: string) => element(tag) } } as unknown as Page;
  return { page, made, animated, canvas: element('canvas') as unknown as HTMLElement };
}
const weapon = weaponOf('longsword'), moveFrom = (direction: string) => (Object.keys(weapon.moves) as MoveId[]).find((m) => weapon.moves[m]?.direction === direction);
const duel = { fighters: [{ weapon: 'longsword' }, { weapon: 'longsword' }] } as unknown as Duel;
const hit = (e: Partial<CombatEvent>) => ({ tick: 100, type: 'Hit', actor: 1, target: 0, move: moveFrom('right'), ...e }) as CombatEvent;

test('each blow direction lands on the mirrored screen edge', () => {
  assert.deepEqual(EDGE, { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' });
  for (const [direction, edge] of Object.entries(EDGE)) {
    const move = moveFrom(direction);
    if (move) assert.equal(edgeOf(hit({ move }), duel), edge, direction);
  }
  assert.ok(moveFrom('right') && moveFrom('left') && moveFrom('overhead') && moveFrom('thrust'), 'the starting weapon throws from every side the test maps');
});

test('only a hit on the player draws: his own hits, blocks and misses add nothing to the page', () => {
  const { page, made, canvas } = fakePage(), before = made.length, edge = createBloodEdge(canvas, page);
  edge.render([hit({ actor: 0, target: 1 }), hit({ type: 'Blocked' }), hit({ type: 'AttackMissed', target: undefined })], duel);
  assert.equal(made.length, before);
  edge.render([hit({})], duel);
  assert.ok(made.includes('div') && made.includes('placed'));
});

// Owner ruling 2026-09-29, always on: hit feedback ignores prefers-reduced-motion, so a browser that asks for reduced motion still sees it.
test('reduced motion: a hit on the player still draws and animates the edge', () => {
  const { page, made, animated, canvas } = fakePage(), g = globalThis as { matchMedia?: unknown }, saved = g.matchMedia;
  g.matchMedia = () => ({ matches: true });
  try {
    createBloodEdge(canvas, page).render([hit({}), hit({ move: moveFrom('overhead') })], duel);
    assert.ok(made.includes('div'));
    assert.equal(animated.length, 2);
  } finally { g.matchMedia = saved; }
});

test('the streak is seeded: the same hit draws the same streak, another hit a different one', () => {
  assert.equal(streak(401), streak(401));
  assert.notEqual(streak(401), streak(405));
});
