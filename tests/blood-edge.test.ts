import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH_VW, EDGE, EDGE_MS, PEAK, createBloodEdge, edgeOf, streak, type Page } from '../src/blood-edge.ts';
import { weaponOf, type MoveId } from '../src/moves.ts';
import type { CombatEvent, Duel } from '../src/duel.ts';

// A stand-in page: counts what the overlay adds and animates. Elements only need style, attributes, children, innerHTML, querySelector and animate.
function fakePage() {
  const made: string[] = [], animated: string[] = [], animations: { frames: { opacity: number }[]; opts: { duration: number } }[] = [];
  const element = (tag: string) => {
    const el = { tag, style: {} as Record<string, string>, children: [] as unknown[], innerHTML: '', id: '', setAttribute() {}, append(c: unknown) { this.children.push(c); },
      querySelector: () => ({ innerHTML: '' }), animate: (frames: { opacity: number }[], opts: { duration: number }) => { animated.push(tag); animations.push({ frames, opts }); }, after: () => { made.push('placed'); } };
    made.push(tag); return el;
  };
  const page = { document: { createElement: element, createElementNS: (_: string, tag: string) => element(tag) } } as unknown as Page;
  return { page, made, animated, animations, canvas: element('canvas') as unknown as HTMLElement };
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

// Dom could not see the streak on his iPhone (live 1be74bb3: painted band 8-9 px). The pins are the PAINTED depth in px at 375 wide, not the strip box.
const px = (units: number) => (units / 100) * (DEPTH_VW / 100) * 375;
const painted = (seed: number) => {
  const svg = streak(seed);
  const line = /^<path d="M0,0 L([^"]*?) L0,1000Z"\/>/.exec(svg)![1].split(' L').map((p) => +p.split(',')[0]);
  const cracks = [...svg.matchAll(/<path d="M[^"]*" fill="none"/g)].flatMap((m) => [...m[0].matchAll(/[ML](\d+(?:\.\d+)?),/g)].map((c) => +c[1]));
  return { band: Math.min(...line), reach: Math.max(...cracks) };
};

test('the painted band is at least 7 % of the screen width deep at peak, cracks reach ~12 %, at 375 wide', () => {
  for (let seed = 0; seed < 400; seed++) {
    const { band, reach } = painted(seed);
    assert.ok(px(band) >= 0.07 * 375, `seed ${seed}: band ${px(band).toFixed(1)} px`);
    assert.ok(px(reach) >= 0.1 * 375 && px(reach) <= DEPTH_VW / 100 * 375, `seed ${seed}: cracks reach ${px(reach).toFixed(1)} px`);
  }
});

test('timing: 450-500 ms, opacity held at 1 for ~120 ms', () => {
  const { page, animations, canvas } = fakePage();
  createBloodEdge(canvas, page).render([hit({})], duel);
  const { frames, opts } = animations[0];
  assert.ok(EDGE_MS >= 450 && EDGE_MS <= 500 && opts.duration === EDGE_MS);
  assert.deepEqual(frames.map((f) => f.opacity), [0, 1, 1, 0]);
  assert.ok(Math.abs((PEAK[1] - PEAK[0]) * EDGE_MS - 120) <= 15);
});

test('the strips sit inside the safe area (rounded corners, notch)', () => {
  const { page, canvas } = fakePage(), styles: Record<string, string>[] = [];
  const doc = page.document as unknown as { createElementNS: (ns: string, tag: string) => { style: Record<string, string> } }, make = doc.createElementNS;
  doc.createElementNS = (ns, tag) => { const el = make(ns, tag); styles.push(el.style); return el; };
  createBloodEdge(canvas, page).render([hit({})], duel);
  for (const [i, edge] of (['left', 'right', 'top', 'bottom'] as const).entries()) assert.equal(styles[i][edge], `env(safe-area-inset-${edge})`);
});
