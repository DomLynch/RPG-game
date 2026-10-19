// The stance setting's pure parts (Dom 2026-10-19: a character setting in the menu, not a fight-screen panel): the stored pick, the page's starting pick, the lock rule, the effect rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKS } from '../src/fight/stance.ts';
import { STANCE_KEY, isPick, loadStancePref, saveStancePref, stanceEffect, stanceLocked, stanceStart } from '../src/fight/stance-panel.ts';

const store = (initial?: string) => { const m = new Map<string, string>(initial === undefined ? [] : [[STANCE_KEY, initial]]); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('a stored pick is read back for its own character and validated against the record picks', () => {
  const s = store();
  assert.equal(loadStancePref(s, 'hero-1'), 'neutral', 'nothing stored: Balanced');
  for (const p of PICKS) { assert.equal(saveStancePref(s, 'hero-1', p), true); assert.equal(loadStancePref(s, 'hero-1'), p); }
  saveStancePref(s, 'hero-1', 'trickster');
  assert.equal(loadStancePref(s, 'hero-2'), 'neutral', 'another character does not inherit the pick');
  for (const bad of ['', 'null', '{', '[]', '"aggressive"', JSON.stringify({ id: 'hero-1', pick: 'berserk' }), JSON.stringify({ id: 'hero-1', pick: 3 }), JSON.stringify({ pick: 'defensive' })]) assert.equal(loadStancePref(store(bad), 'hero-1'), 'neutral', bad);
  assert.equal(saveStancePref(s, 'hero-1', 'berserk' as never), false, 'a pick outside PICKS is never written');
  assert.equal(loadStancePref({ getItem: () => { throw Error('blocked'); }, setItem: () => undefined }, 'hero-1'), 'neutral', 'blocked storage reads as the default');
  assert.equal(saveStancePref({ getItem: () => null, setItem: () => { throw Error('full'); } }, 'hero-1', 'aggressive'), false);
  assert.ok(isPick('defensive') && !isPick('berserk') && !isPick(undefined));
});

test('the starting pick: ?stances=off is no stances at all, an explicit ?stances=<pick> wins, otherwise the character\'s stored pick', () => {
  assert.equal(stanceStart('?stances=off', 'aggressive'), undefined, 'the kill switch beats a stored pick');
  assert.equal(stanceStart('', 'aggressive'), 'aggressive');
  assert.equal(stanceStart('?stances=1', 'defensive'), 'defensive', 'on/1/junk do not name a pick');
  assert.equal(stanceStart('?stances=bogus', 'trickster'), 'trickster');
  assert.equal(stanceStart('?stances=trickster', 'aggressive'), 'trickster', 'a look-test pick overrides');
  assert.equal(stanceStart('?a=1&stances=neutral', 'aggressive'), 'neutral');
});

test('the lock rule: open while sheathed (before Fight is tapped) and after a result; locked from the draw to the finish', () => {
  assert.equal(stanceLocked('sheathed', false), false);
  for (const phase of ['draw', 'ready', 'attack', 'recover', 'guard']) assert.equal(stanceLocked(phase, false), true, phase);
  for (const phase of ['sheathed', 'ready', 'attack']) assert.equal(stanceLocked(phase, true), false, `${phase} with a finish`);
});

test('each stance has its one-line effect from the rows', () => {
  assert.equal(stanceEffect('neutral'), 'No bonus, no weakness');
  assert.equal(stanceEffect('aggressive'), 'Hit 10% harder, break guards faster. Blocking costs more');
  assert.equal(stanceEffect('defensive'), 'Take 20% less, cheap blocks, fast recovery. Hit softer');
  assert.equal(stanceEffect('trickster'), 'Cheap feints, kicks break guards. Weaker heavies');
});
