// The first-visit intro (brief #2772): the four cards are rows, fade/hold maths, and the once-per-device rule.
import assert from 'node:assert/strict';
import test from 'node:test';
import { INTRO, cardAlpha, cardAt, introEnd, loadIntro, shouldShowIntro } from '../src/intro.ts';
import DEFS from '../src/intro-defs.json' with { type: 'json' };

test('four caption cards load from rows, in time order', () => {
  assert.equal(INTRO.cards.length, 4);
  assert.deepEqual(INTRO.cards.map((c) => c.id), ['wake', 'frankendom', 'win', 'centurion']);
  assert.ok(INTRO.cards.every((c, i) => i === 0 || c.start >= INTRO.cards[i - 1]!.start + INTRO.cards[i - 1]!.fade * 2 + INTRO.cards[i - 1]!.hold));
});
test('a card fades in, holds, fades out, and is 0 outside', () => {
  const c = INTRO.cards[0]!;
  assert.equal(cardAlpha(c, c.start - 1), 0); assert.equal(cardAlpha(c, c.start), 0);
  assert.equal(cardAlpha(c, c.start + c.fade / 2), 0.5); assert.equal(cardAlpha(c, c.start + c.fade), 1);
  assert.equal(cardAlpha(c, c.start + c.fade + c.hold - 1), 1); assert.equal(cardAlpha(c, c.start + c.fade + c.hold + c.fade / 2), 0.5);
  assert.equal(cardAlpha(c, c.start + c.fade * 2 + c.hold), 0);
  assert.equal(cardAt(c.start + c.fade)!.id, 'wake'); assert.equal(cardAt(0), null);
  assert.ok(introEnd() > INTRO.cards.at(-1)!.start);
});
test('every caption fits the character budget measured for two lines at a 320 phone (so Dom\'s final copy is checked by CI, not by eye)', () => {
  for (const c of INTRO.cards) assert.ok(c.text.length <= INTRO.maxChars, `${c.id}: ${c.text.length} > ${INTRO.maxChars}`);
  const over = JSON.parse(JSON.stringify(DEFS)); over.cards[0].text = 'x'.repeat(INTRO.maxChars + 1);
  assert.throws(() => loadIntro(over), /characters, over the/);
});
test('the loader refuses a bad row', () => {
  const ok = JSON.parse(JSON.stringify(DEFS));
  const bad = (f: (d: typeof ok) => void) => { const d = JSON.parse(JSON.stringify(ok)); f(d); return d; };
  assert.throws(() => loadIntro(bad((d) => { d.cards[1].start = 0; })), /starts before/);
  assert.throws(() => loadIntro(bad((d) => { d.cards[0].text = ' '; })), /text is not empty/);
  assert.throws(() => loadIntro(bad((d) => { d.cards[0].hold = 1.5; })), /whole ticks/);
  assert.throws(() => loadIntro(bad((d) => { d.cards[2].id = d.cards[0].id; })), /uplicate|id/);
  assert.throws(() => loadIntro(bad((d) => { d.rules = []; })), /seenKey/);
});
test('the intro shows once, only to a fresh guest', () => {
  assert.equal(shouldShowIntro({ seen: false, returning: false, link: false }), true);
  for (const v of [{ seen: true, returning: false, link: false }, { seen: false, returning: true, link: false }, { seen: false, returning: false, link: true }]) assert.equal(shouldShowIntro(v), false);
});

// The page layer, against tiny fakes (no jsdom in this repo).
import { createIntro } from '../src/intro-ui.ts';
class Strip { className = ''; textContent = ''; style: Record<string, string> = {}; attrs: Record<string, string> = {}; removed = false; setAttribute(k: string, v: string) { this.attrs[k] = v; } remove() { this.removed = true; } }
const world = (over: { seen?: boolean; returning?: boolean; link?: boolean } = {}) => {
  const strips: Strip[] = [], listeners = new Map<string, () => void>(), calls: string[] = [], mem = new Map<string, string>(); if (over.seen) mem.set(INTRO.seenKey, '1');
  const doc = { createElement: () => { const s = new Strip(); strips.push(s); return s; }, addEventListener: (t: string, f: () => void) => listeners.set(t, f), removeEventListener: (t: string) => listeners.delete(t) };
  const parent = { ownerDocument: { ...doc, documentElement: { clientHeight: 812 } }, append() {} };
  const intro = createIntro({ doc: doc as never, parent: parent as never, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } }, controlsTop: () => 600, returning: !!over.returning, link: !!over.link, tour: { start: () => calls.push('start'), stop: () => calls.push('stop') } });
  return { intro, strips, listeners, calls, mem };
};
test('a fresh guest: the tour starts, the flag is set at once, the strip paints each card and a tap ends it (stop once)', () => {
  const w = world(); assert.equal(w.intro.active, true); assert.deepEqual(w.calls, ['start']); assert.equal(w.mem.get(INTRO.seenKey), '1');
  w.intro.update(INTRO.cards[0]!.start / 60 + 0.6); assert.equal(w.strips[0]!.textContent, INTRO.cards[0]!.text); assert.equal(w.strips[0]!.style.opacity, '1');
  assert.equal(w.strips[0]!.style.bottom, `${812 - 600 + INTRO.stripGap}px`, 'the strip bottom sits stripGap above the top of the controls (row, from the cluster rect)');
  w.listeners.get('pointerdown')!(); assert.equal(w.intro.active, false); assert.equal(w.strips[0]!.removed, true); assert.equal(w.listeners.has('pointerdown'), false);
  w.intro.skip(); assert.deepEqual(w.calls, ['start', 'stop'], 'ending twice stops the tour once');
});
test('it ends itself after the last card and never shows to a seen, returning or kill-link visit', () => {
  const w = world(); w.intro.update(introEnd() / 60 + 1); assert.equal(w.intro.active, false); assert.deepEqual(w.calls, ['start', 'stop']);
  for (const over of [{ seen: true }, { returning: true }, { link: true }]) { const x = world(over); assert.equal(x.intro.active, false); assert.equal(x.strips.length, 0); assert.deepEqual(x.calls, []); }
});
