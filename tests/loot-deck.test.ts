// Loot deck with pity: the rows load with their refs checked, the draw obeys the rows, and a dry streak never passes the deck's hard pity.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOT_DECKS, LOOT_DECK_RESETS, applyReset, deckById, dropChance, drawCard, freshDeck, loadLootDecks, type DeckState } from '../src/fight/loot-deck.ts';
import { makeRng } from '../src/fight/blood-style.ts';
import DATA from '../src/fight/loot-deck.json' with { type: 'json' };

test('loot decks: rows load through the shared loader; every deck is sane', () => {
  assert.deepEqual(LOOT_DECKS.map((d) => d.id).sort(), ['boss', 'ranked', 'wild']);
  for (const d of LOOT_DECKS) {
    assert.ok(d.deckSize >= 1 && d.hits >= 1 && d.hits <= d.deckSize, `${d.id} cards`);
    assert.ok(d.softPityFrom >= 1 && d.softPityFrom <= d.hardPity, `${d.id} soft pity comes before hard pity`);
    assert.ok(d.pityStep > 0 && d.pityStep <= 100, `${d.id} step`);
    assert.equal(d.scope, 'account');
    assert.ok(d.resets.includes('drop') && d.resets.includes('deck-empty'), `${d.id} resets on a drop and a reshuffle`);
  }
});

test('loot decks: a bad ref is refused at load (unknown reset, unknown roll point)', () => {
  const badReset = structuredClone(DATA); badReset.decks[0]!.resets = ['nope'];
  assert.throws(() => loadLootDecks(badReset));
  const badPoint = structuredClone(DATA); badPoint.decks[0]!.rolledAt = 'nope';
  assert.throws(() => loadLootDecks(badPoint));
});

test('loot decks: the odds are the deck\'s own, climb past soft pity, and are certain at hard pity', () => {
  const d = deckById('ranked')!;
  assert.equal(dropChance(d, { left: 4, hitsLeft: 1, misses: 0 }), 0.25);
  assert.equal(dropChance(d, { left: 3, hitsLeft: 1, misses: 2 }), 1 / 3);
  assert.equal(dropChance(d, { left: 2, hitsLeft: 1, misses: d.softPityFrom }), 0.5 + 0.25);
  assert.equal(dropChance(d, { left: 4, hitsLeft: 1, misses: d.hardPity }), 1);
});

test('loot decks: the last card of a deck still holding its hit always drops, and the deck reshuffles when empty', () => {
  const d = deckById('ranked')!;
  const out = drawCard(d, { left: 1, hitsLeft: 1, misses: 0 }, 0.999);
  assert.equal(out.dropped, true);
  assert.deepEqual(out.state, freshDeck(d));
  const miss = drawCard(d, { left: 1, hitsLeft: 0, misses: 2 }, 0.999);
  assert.equal(miss.dropped, false);
  assert.deepEqual(miss.state, { ...freshDeck(d), misses: 3 }, 'deck-empty reshuffles but keeps the streak');
});

test('loot decks: over 20,000 seeded draws no dry streak passes hard pity and the hit rate is at least the deck\'s', () => {
  for (const d of LOOT_DECKS) {
    const rng = makeRng(0xdec0 ^ d.deckSize);
    let state: DeckState = freshDeck(d), run = 0, longest = 0, hits = 0;
    for (let i = 0; i < 20000; i++) {
      const out = drawCard(d, state, rng()); state = out.state;
      if (out.dropped) { hits++; run = 0; } else { run++; longest = Math.max(longest, run); }
    }
    assert.ok(longest <= d.hardPity, `${d.id}: longest dry streak ${longest} <= ${d.hardPity}`);
    assert.ok(hits / 20000 >= d.hits / d.deckSize, `${d.id}: hit rate ${hits / 20000}`);
  }
});

test('loot decks: a reset acts only on decks that list it (rank-up on ranked, not on wild)', () => {
  const ranked = deckById('ranked')!, wild = deckById('wild')!;
  const dry: DeckState = { left: 2, hitsLeft: 1, misses: 5 };
  assert.deepEqual(applyReset(ranked, dry, 'rank-up'), freshDeck(ranked));
  assert.deepEqual(applyReset(wild, dry, 'rank-up'), dry);
  assert.ok(LOOT_DECK_RESETS.every((r) => typeof r.clearsPity === 'boolean'));
});
