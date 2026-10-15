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
