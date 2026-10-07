// RV31 (docs/specs/combat/l6-anti-spam.md): `spamRun` reads a masher early; absent = the old read, byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpponent, initialAi, type Habits } from '../src/ai.ts';
import { OPPONENTS } from '../src/combat.ts';
import { profileAt, type AiProfile } from '../src/moves.ts';
import { STRATEGIES, battery } from './strategies.ts';

const habits = (over: Partial<Habits> = {}): Habits => ({ ...initialAi().habits, ...over });
const gate = (spamRun: number, spamBoth?: number): AiProfile => ({ ...OPPONENTS.veteran.profiles.normal, spamRun, ...(spamBoth ? { spamBoth } : {}) });
const GATED = ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'] as const;

test('the early gate: spamRun consecutive lights before any defence reads a spammer; a defence, or one fewer light, does not', () => {
  const masher = habits({ lights: 5, attacks: 5, run: 5 });
  assert.equal(readOpponent(masher, gate(5)).spammer, true);
  assert.equal(readOpponent(habits({ lights: 4, attacks: 4, run: 4 }), gate(5)).spammer, false, 'one light short');
  for (const defence of [{ guard: 1 }, { parries: 1 }, { rolls: 1 }, { steps: 1 }])
    assert.equal(readOpponent({ ...masher, ...defence }, gate(5)).spammer, false, `${Object.keys(defence)[0]} ends the early read`);
  assert.equal(readOpponent(habits({ lights: 5, heavies: 1, attacks: 6, run: 0 }), gate(5)).spammer, false, 'a heavy resets the run');
});

test('absent spamRun is the old read: 11 swings at 70 % lights, whatever the run', () => {
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 }), OPPONENTS.goblin.profiles.normal).spammer, false, 'five lights are not yet a spammer');
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 })).spammer, false, 'no profile: the old read');
  const old = habits({ lights: 8, heavies: 3, attacks: 11, guard: 4, run: 2 });
  assert.equal(readOpponent(old, OPPONENTS.goblin.profiles.normal).spammer, true);
  assert.equal(readOpponent(old).spammer, true);
});

test('the early gate REPLACES the old read; spamBoth keeps it (the Shieldmaiden)', () => {
  const defended = habits({ lights: 8, heavies: 3, attacks: 11, guard: 4, run: 2 });   // the old read fires, the early gate does not (he has defended)
  assert.equal(readOpponent(defended, gate(5)).spammer, false);
  assert.equal(readOpponent(defended, gate(5, 1)).spammer, true);
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 }), gate(5, 1)).spammer, true, 'the early gate still fires with spamBoth');
});

test('only the five measured opponents carry spamRun, at every tier and level; the rest read as they always did', () => {
  for (const id of GATED) for (const level of [1, 6, 12, 18, 30, 46, 50]) assert.equal(profileAt(OPPONENTS[id], level).spamRun, 5, `${id} L${level}`);
  assert.equal(profileAt(OPPONENTS.shieldmaiden, 6).spamBoth, 1);
  for (const id of GATED.filter(g => g !== 'shieldmaiden')) assert.ok(!profileAt(OPPONENTS[id], 6).spamBoth, `${id} has the early gate alone`);
  for (const id of Object.keys(OPPONENTS).filter(i => !(GATED as readonly string[]).includes(i))) for (const level of [1, 6, 18, 46])
    assert.equal(profileAt(OPPONENTS[id as keyof typeof OPPONENTS], level).spamRun, undefined, `${id} L${level}: absent = today's read`);
});

test('light spam at L6 stays under the 80 % cap against every gated opponent (24 seeds)', () => {
  for (const id of GATED) {
    const r = battery(6, 24, 7200, OPPONENTS[id], { 'light spam': STRATEGIES['light spam'] })['light spam'];
    assert.ok(r.wins / 24 <= .8, `${id}: light spam wins ${r.wins}/24 at L6 (cap 80 %)`);
  }
});
