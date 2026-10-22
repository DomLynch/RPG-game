// A Pit legend's words in the world (Strategy's two copy conditions, 2026-10-22): name, rank and title like the ladder, never a creature / mob / monster; "defeated", never "slain", and a "Reward:", never loot or a drop.
// The words are rows (legend-copy.json); a legend is any zone spawn row whose source is `{ legendId }`.
import assert from 'node:assert/strict';
import test from 'node:test';
import COPY from './legend-copy.json' with { type: 'json' };
import { defeatedLine, killCopy, legendCardLines, legendIdOf, legendRankLine, rewardLine, zoneHint } from './legend-copy.ts';
import { cardLines } from './creature-card.ts';
import { killToast } from './kill-apply.ts';
import { creatureInfo } from '../../src/core/index.ts';
import { listedZone } from '../zones/listed.ts';
import type { Killed } from './spawn-net.ts';

const BANNED = /creature|monster|\bmobs?\b|slain|\bloot|\bdrop|\bkill/i;   // the words a legend never shows (Strategy): a creature, a mob, a monster, slain, loot, a drop
const name = (id: string): string => id;
const paid = (cp: number, bronze = 3): Killed => ({ result: 'killed', instance: 'x-1', respawnAt: null, loot: [], cp, bronze, beta: true });

test('the legend copy rows and the zone hint rows say none of the banned words', () => {
  for (const [id, row] of Object.entries(COPY.copy)) assert.ok(!BANNED.test(row.text), `copy "${id}": ${row.text}`);
  for (const [zone, h] of Object.entries(COPY.zoneHints)) for (const [which, t] of Object.entries(h)) assert.ok(!BANNED.test(t), `zone ${zone} hint ${which}: ${t}`);
});

test('a legend is recognised by its zone row\'s source.legendId, and only then: zone 7\'s rows all are, zone 1\'s creatures never are', () => {
  const z7 = listedZone('7').spawns.rows, z1 = listedZone('1').spawns.rows;
  assert.ok(z7.length > 0 && z7.every((r) => legendIdOf(r) !== null), 'every Dungeon 1 roster row is a legend');
  assert.ok(z1.every((r) => legendIdOf(r) === null), 'no Frontier creature row is');
  assert.equal(legendIdOf(undefined), null);
});

test('a legend\'s card: line 2 keeps the con ring and danger word and adds "Rank N · <the ladder title>", line 3 is the ladder\'s kind line, never rarity or pack size', () => {
  const row = listedZone('7').spawns.rows[0]!, info = creatureInfo({ name: 'Pit Thrall', level: 1 }, row, 1, listedZone('7').spawns.rows);
  const base = cardLines(info), card = legendCardLines(base, 1, 'pitborn');
  assert.equal(card[0], base[0], 'the name and level line is unchanged');
  assert.ok(card[1].startsWith(base[1]) && card[1].endsWith('Rank 1 · Recruit'), card[1]);
  assert.equal(card[2], 'the Pitborn');
  assert.ok(!/Rare|Uncommon|Common|Alone|Packs/.test(card.join(' ')), `no rarity or pack copy: ${card.join(' | ')}`);
  assert.ok(base[2]!.includes('Alone') || /Rare|Uncommon|Common/.test(base[2]!), 'a creature card still says it (the base lines carry it)');
  assert.ok(legendCardLines(base, 10, 'knight')[1].endsWith('Rank 10 · Origin'), 'the top rank is the ladder\'s top title');
  assert.equal(legendRankLine(1), 'Rank 1 · Recruit', 'the fight bar reads the same row as the card');
  assert.ok(card[1].endsWith(legendRankLine(1)), 'the card\'s rank line IS legendRankLine');
  assert.ok(!BANNED.test(card.join(' ')));
});

test('a legend\'s kill toast: "<name> is defeated." then the reward on its own line; an ordinary creature keeps its own words', () => {
  const copy = killCopy();
  assert.equal(killToast(paid(20), name, 'Pit Thrall', false, null, false, copy), 'Pit Thrall is defeated.\nReward: +20 CP · +3 bronze.');
  assert.equal(killToast(paid(0, 0), name, 'Pit Thrall', false, null, false, copy), 'Pit Thrall is defeated.\nNo reward.');
  assert.equal(defeatedLine(copy, 'Crixus'), 'Crixus is defeated.');
  assert.equal(rewardLine(copy, ['+1 CP']), 'Reward: +1 CP.');
  assert.equal(killToast(paid(20), name, 'Wolf'), 'Wolf is down. +20 CP · +3 bronze.', 'an ordinary creature is unchanged');
  assert.ok(!BANNED.test(killToast(paid(20), name, 'Pit Thrall', false, null, false, copy)));
});

test('the zone hint rows: zone 7 says "opponent" (walk, watch, arriving); a zone with no row has none (the page keeps its default)', () => {
  assert.match(zoneHint('7', 'walk')!, /Walk up to an opponent and tap STRIKE .* to duel them\./);
  assert.match(zoneHint('7', 'watch')!, /Opponents stop and watch when you come near\./);
  assert.match(zoneHint('7', 'arriving')!, /The opponents are still arriving: try again in a moment\./);
  assert.equal(zoneHint('1', 'walk'), undefined);
});
