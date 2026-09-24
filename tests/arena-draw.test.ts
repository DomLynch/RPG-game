// The Arena Draw (src/arena-draw.ts, Dom 2026-09-24, #642 direction A): the ladder picks first and the board only animates to the pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DRAW_HOLD_MS, DRAW_RUN_MS, createArenaDraw, drawStrip } from '../src/arena-draw.ts';
import { LADDER } from '../src/ladder.ts';

const ids = LADDER.map((rung) => rung.id);

test('arena draw: the strip always stops on the ladder\'s pick, after whole laps, with a neighbour under it', () => {
  for (const id of ids) {
    const { strip, stop } = drawStrip(ids, id);
    assert.equal(strip[stop], id, `stops on ${id}`);
    assert.equal(stop, 2 * ids.length + ids.indexOf(id), 'two whole laps, then up to the pick: never a reroll or a near-miss past it');
    assert.equal(strip.length, stop + 2, 'one slot after the stop');
  }
  assert.deepEqual(drawStrip(ids, 'minotaur'), { strip: ['minotaur'], stop: 0 }, 'an id off the ladder lands at once');
});

test('arena draw: at most 1.5 s, every live rung has its thumbnail, and the run in the CSS is DRAW_RUN_MS', () => {
  assert.ok(DRAW_RUN_MS + DRAW_HOLD_MS <= 1500);
  for (const id of ids) assert.ok(existsSync(`public/game/img/draw/${id}.webp`), `draw/${id}.webp (node scripts/draw-thumbs.mjs)`);
  assert.match(readFileSync('src/style.css', 'utf8'), new RegExp(`\\.arena-draw\\[data-run='1'\\] \\.draw-strip \\{ transition: transform ${DRAW_RUN_MS}ms`));
});

class El extends EventTarget {
  hidden = true; className = ''; textContent = ''; alt = ''; decoding = ''; src = ''; offsetHeight = 0; dataset: Record<string, string> = {}; children: El[] = [];
  style = { props: new Map<string, string>(), setProperty(k: string, v: string) { this.props.set(k, v); } };
  append(...n: El[]) { this.children.push(...n); } replaceChildren(...n: El[]) { this.children = n; }
}
const doc = { createElement: () => new El() } as unknown as Document;
const find = (el: El, cls: string): El | undefined => el.className.split(' ').includes(cls) ? el : el.children.map((c) => find(c, cls)).find(Boolean);

test('arena draw: runs, slams onto the pick with its name and weapon, holds, and hides; a tap skips straight to the end', async () => {
  const host = new El(), draw = createArenaDraw(host as unknown as HTMLElement, doc);
  const waits: { ms: number; go: () => void }[] = [];
  const wait = (ms: number) => new Promise<void>((go) => waits.push({ ms, go }));
  const played = draw.play(ids, 'nightborn', { name: 'the Nightborn', weapon: 'estoc' }, wait);
  assert.equal(host.hidden, false); assert.equal(host.dataset.run, '1'); assert.equal(host.dataset.slam, '');
  const strip = find(host, 'draw-strip')!, stop = drawStrip(ids, 'nightborn').stop;
  assert.equal(strip.style.props.get('--draw-to'), String(stop));
  assert.equal(strip.children[stop]!.dataset.hit, '1'); assert.equal(strip.children[stop]!.children[0]!.src, '/game/img/draw/nightborn.webp');
  assert.equal(find(host, 'draw-name')!.textContent, 'the Nightborn'); assert.equal(find(host, 'draw-weapon')!.textContent, 'estoc');
  assert.equal(waits[0]!.ms, DRAW_RUN_MS); waits[0]!.go(); await new Promise((r) => setTimeout(r));
  assert.equal(host.dataset.slam, '1', 'the slam after the run');
  assert.equal(waits[1]!.ms, DRAW_HOLD_MS); waits[1]!.go(); await played;
  assert.equal(host.hidden, true, 'gone after the hold: the fight opens on the plain still');

  const tapped = draw.play(ids, 'knight', { name: 'the Knight', weapon: 'maul' }, () => new Promise(() => {}));   // timers that never fire
  host.dispatchEvent(new Event('pointerdown')); await tapped;
  assert.equal(host.dataset.slam, '1'); assert.equal(host.hidden, true, 'a tap ends it at once');
});

test('arena draw: reduced motion shows the end state for the hold, with no run', async () => {
  const host = new El(), draw = createArenaDraw(host as unknown as HTMLElement, doc), asked: number[] = [];
  await draw.play(ids, 'goblin', { name: 'the Goblin', weapon: 'knife' }, async (ms) => { asked.push(ms); }, true);
  assert.deepEqual(asked, [DRAW_HOLD_MS]); assert.notEqual(host.dataset.run, '1');
});
