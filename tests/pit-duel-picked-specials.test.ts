import './lib/era-off.ts';
// The Pit duel opened from Zone 1 carries the player's SPECIAL picks (Dom 2026-10-20: "the specials are not actually there in the Gladiator Pit"): a sparring fight that asks for the picks (startSparring's
// `picked`) fights with SPECIAL 1 = kit.skill and SPECIAL 2 = ports.skill2 and specials on, like a career / practice fight; every other sparring fight (no `picked`) is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryMatch } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { recordWorldFight, worldRecord } from '../origins/preview/world-record.ts';
import { decodeRecord } from '../src/fight/record.ts';

const kit = (skill: 'cleave' | null) => ({ weapon: 'longsword', difficulty: 16, skill }) as const;
const picks = { skill2: () => 'reaping' as const };

test('a sparring fight that asks for the picks carries SPECIAL 1 and 2 and fights with specials on', () => {
  const m = memoryMatch(OPPONENTS.veteran, 'test', 731, 16, picks);
  m.startSparring(kit('cleave'), null, undefined, true);
  const me = m.practice.duel.fighters[0];
  assert.equal(m.specials, true); assert.equal(me.skill, 'cleave'); assert.equal(me.skill2, 'reaping');
});

test('a sparring fight that does not ask is unchanged: no skill, no slot b, specials as before', () => {
  const plain = memoryMatch(OPPONENTS.veteran, 'test', 731, 16), withPorts = memoryMatch(OPPONENTS.veteran, 'test', 731, 16, picks);
  plain.startSparring(kit(null)); withPorts.startSparring(kit(null));   // the port is there but the fight did not ask for it
  for (const m of [plain, withPorts]) { const me = m.practice.duel.fighters[0]; assert.equal(me.skill ?? null, null); assert.equal(me.skill2, undefined); }
  assert.equal(withPorts.specials, plain.specials);
});

test('a recorded Pit duel names the picks (record.skill / record.skill2), the fields the encounter verifier judges', () => {
  const m = memoryMatch(OPPONENTS.veteran, 'test', 731, 16, picks);
  m.startSparring(kit('cleave'), null, undefined, true);
  recordWorldFight(m, 'veteran', 16, 731, 'longsword');
  const rec = worldRecord(m, null), decoded = rec ? decodeRecord(rec as never) : null;
  assert.ok(rec, 'a record was kept');
  const hero = (decoded as unknown as { skill?: string; skill2?: string } | null) ?? (rec as unknown as { skill?: string; skill2?: string });
  assert.equal(hero.skill, 'cleave'); assert.equal(hero.skill2, 'reaping');
});
