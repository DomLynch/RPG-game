import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { EDGE, EDGE_MS, HEAD_ON, PEAK, SPAN, STRIPS, WIDTH_VW, createBloodEdge, edgesOf, type Page } from '../src/blood-edge.ts';
import { weaponOf, type MoveId } from '../src/moves.ts';
import type { CombatEvent, Duel } from '../src/duel.ts';

// A stand-in page: records every element the overlay makes, in order, with its style, src and animations.
type Frames = { opacity: number; offset?: number; easing?: string }[];
type Fake = { tag: string; src: string; style: Record<string, string>; anims: { frames: Frames; opts: { duration: number; easing?: string } }[] };
function fakePage() {
  const els: Fake[] = [], placed: string[] = [];
  const element = (tag: string) => {
    const el = { tag, src: '', alt: '', decoding: '', draggable: true, style: {} as Record<string, string>, anims: [] as Fake['anims'], id: '', append() {}, after: () => { placed.push('placed'); },
      animate(frames: Frames, opts: { duration: number; easing?: string }) { el.anims.push({ frames, opts }); } };
    els.push(el); return el;
  };
  const page = { document: { createElement: element } } as unknown as Page;
  return { page, els, placed, canvas: element('canvas') as unknown as HTMLElement, imgs: () => els.filter((e) => e.tag === 'img') };
}
const weapon = weaponOf('longsword'), moveFrom = (direction: string) => (Object.keys(weapon.moves) as MoveId[]).find((m) => weapon.moves[m]?.direction === direction);
const duel = { fighters: [{ weapon: 'longsword' }, { weapon: 'longsword' }] } as unknown as Duel;
const hit = (e: Partial<CombatEvent>) => ({ tick: 100, type: 'Hit', actor: 1, target: 0, move: moveFrom('right'), ...e }) as CombatEvent;
const lit = (f: ReturnType<typeof fakePage>) => f.imgs().map((i, n) => ({ n, i })).filter(({ i }) => i.anims.length).map(({ n }) => n);   // img order: left x3, right x3

test('left and right only: a blow from the right lights the left edge, from the left the right edge, head-on blows both', () => {
  assert.deepEqual(EDGE, { right: 'left', left: 'right', overhead: 'both', thrust: 'both', low: 'both' });
  assert.deepEqual(edgesOf(hit({ move: moveFrom('right') }), duel), ['left']);
  assert.deepEqual(edgesOf(hit({ move: moveFrom('left') }), duel), ['right']);
  for (const d of ['overhead', 'thrust', 'low']) { const move = moveFrom(d); if (move) assert.deepEqual(edgesOf(hit({ move }), duel), ['left', 'right'], d); }
  assert.ok(moveFrom('right') && moveFrom('left') && moveFrom('overhead') && moveFrom('thrust'), 'the starting weapon throws from every side the test maps');
});

test('only a hit on the player draws: his own hits, blocks and misses add nothing to the page', () => {
  const f = fakePage(), before = f.els.length, edge = createBloodEdge(f.canvas, f.page);
  edge.render([hit({ actor: 0, target: 1 }), hit({ type: 'Blocked' }), hit({ type: 'AttackMissed', target: undefined })], duel);
  assert.equal(f.els.length, before);
  edge.render([hit({})], duel);
  assert.ok(f.placed.length === 1 && f.els.some((e) => e.tag === 'div'));
});

// Owner ruling 2026-09-29, always on: hit feedback ignores prefers-reduced-motion, so a browser that asks for reduced motion still sees it.
test('reduced motion: a hit on the player still draws and animates the edge', () => {
  const f = fakePage(), g = globalThis as { matchMedia?: unknown }, saved = g.matchMedia;
  g.matchMedia = () => ({ matches: true });
  try {
    createBloodEdge(f.canvas, f.page).render([hit({}), hit({ move: moveFrom('overhead') })], duel);
    assert.equal(f.imgs().reduce((n, i) => n + i.anims.length, 0), 3);
  } finally { g.matchMedia = saved; }
});

test('sequential rotation: smear, bleed, streak, smear; head-on blows advance it once and show the same strip on both edges', () => {
  const f = fakePage(), edge = createBloodEdge(f.canvas, f.page), order: number[][] = [];
  for (const move of [moveFrom('right'), moveFrom('right'), moveFrom('right'), moveFrom('overhead'), moveFrom('left')]) { edge.render([hit({ move, tick: 100 + order.length })], duel); order.push(lit(f)); f.imgs().forEach((i) => { i.anims.length = 0; }); }
  assert.deepEqual(order, [[0], [1], [2], [0, 3], [4]]);
  assert.deepEqual(f.imgs().slice(0, 3).map((i) => i.src), STRIPS.map((s) => `/game/img/blood/${s}.webp`));
});

test('a replay (the tick goes backwards) starts the rotation over, so it shows the same strips', () => {
  const f = fakePage(), edge = createBloodEdge(f.canvas, f.page);
  edge.render([hit({ tick: 500 }), hit({ tick: 600 })], duel);
  f.imgs().forEach((i) => { i.anims.length = 0; });
  edge.render([hit({ tick: 50 })], duel);
  assert.deepEqual(lit(f), [0]);
});

test('a new fight starts the rotation over even when its ticks do not go backwards: reset() on fight start (the replay shows the same strips)', () => {
  const f = fakePage(), edge = createBloodEdge(f.canvas, f.page);
  edge.render([hit({ tick: 500 }), hit({ tick: 600 })], duel);   // fight one: smear, bleed; the next pick would be the streak
  f.imgs().forEach((i) => { i.anims.length = 0; });
  edge.render([hit({ tick: 700 })], duel);                      // without a reset the rotation runs on across fights (no tick went backwards)
  assert.deepEqual(lit(f), [2], 'the rotation carries over without a reset');
  f.imgs().forEach((i) => { i.anims.length = 0; });
  edge.reset();                                                  // fight two begins
  edge.render([hit({ tick: 800 }), hit({ tick: 900 })], duel);
  assert.deepEqual(lit(f), [0, 1], 'after reset() the rotation starts at the smear again');
});

test('scene.ts calls bloodEdge.reset() where it clears the previous fight (both health bars full again)', () => {
  const scene = readFileSync('src/scene.ts', 'utf8');
  assert.match(scene, /finisherBlood\.reset\(\);\s*bloodEdge\.reset\(\);/);
});

test('placement: 6 % of the width, the middle 68 % of the height, inside the safe area; the right edge is the mirror; no top or bottom', () => {
  const f = fakePage();
  createBloodEdge(f.canvas, f.page).render([hit({})], duel);
  const [left, right] = [f.imgs()[0].style, f.imgs()[3].style];
  assert.equal(WIDTH_VW, 6); assert.equal(SPAN, 68);
  for (const s of [left, right]) { assert.equal(s.width, '6vw'); assert.equal(s.height, '68%'); assert.equal(s.top, '16%'); assert.equal(s.bottom, undefined); }
  assert.equal(left.left, 'env(safe-area-inset-left)'); assert.equal(right.right, 'env(safe-area-inset-right)');
  assert.equal(left.transform, undefined); assert.equal(right.transform, 'scaleX(-1)');
  assert.equal(f.imgs().length, 6);
});

test('no strip is fetched or placed before the first hit on the player', () => {
  const f = fakePage(), edge = createBloodEdge(f.canvas, f.page);
  edge.render([hit({ actor: 0, target: 1 })], duel);
  assert.equal(f.imgs().length, 0);
});

test('the three painted strips ship as webp, each at most 60 KB', () => {
  for (const s of STRIPS) {
    const file = new URL(`../public/game/img/blood/${s}.webp`, import.meta.url);
    assert.ok(existsSync(file), s);
    assert.ok(statSync(file).size <= 60 * 1024, `${s}: ${statSync(file).size} bytes`);
  }
});

test('timing: 450-500 ms, peak held ~150 ms; one blow from a side is full strength, a head-on blow is HEAD_ON on each edge', () => {
  const f = fakePage(), edge = createBloodEdge(f.canvas, f.page);
  edge.render([hit({})], duel);
  const { frames, opts } = f.imgs()[0].anims[0];
  assert.ok(EDGE_MS >= 450 && EDGE_MS <= 500 && opts.duration === EDGE_MS);
  assert.deepEqual(frames.map((x) => x.opacity), [0, 1, 1, 0]);
  assert.ok(Math.abs((PEAK[1] - PEAK[0]) * EDGE_MS - 150) <= 10);
  edge.render([hit({ move: moveFrom('overhead'), tick: 101 })], duel);
  assert.deepEqual(f.imgs()[1].anims[0].frames.map((x) => x.opacity), [0, HEAD_ON, HEAD_ON, 0]);
});

// Auditer P2 on 7be23668: an effect-level 'ease-out' warps the whole timeline, so the hold ran ~84 ms, not the pinned length.
test('the effect easing is linear; ease-out is on the fade keyframe only', () => {
  const f = fakePage();
  createBloodEdge(f.canvas, f.page).render([hit({})], duel);
  const { frames, opts } = f.imgs()[0].anims[0];
  assert.equal(opts.easing, 'linear');
  assert.equal(frames[2].easing, 'ease-out');
  assert.equal(frames[1].offset, PEAK[0]); assert.equal(frames[2].offset, PEAK[1]);
});

test('the overlay box never takes a tap: pointer-events none', () => {
  const f = fakePage();
  createBloodEdge(f.canvas, f.page).render([hit({})], duel);
  assert.equal(f.els.find((e) => e.tag === 'div')!.style.pointerEvents, 'none');
});
