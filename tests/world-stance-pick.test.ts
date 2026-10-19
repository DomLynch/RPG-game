// The world duel's starting stance: the stance menu's stored pick reaches the world fight (Lead 2026-10-19). Presentation input only: Match.stancePref is all it fills, so no record version moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PICKS } from '../src/fight/stance.ts';
import { STANCE_KEY, saveStancePref } from '../src/fight/stance-panel.ts';
import { worldStancePick } from '../src/fight/world-stance.ts';
import { FIGHTER_KEY } from '../src/core/profile.ts';

const store = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const withProfile = (id: string) => store({ [FIGHTER_KEY]: JSON.stringify({ version: 1, id, name: 'Dom' }) });

test('the menu\'s stored pick for this device\'s profile is the world fight\'s stance', () => {
  for (const p of PICKS) { const s = withProfile('hero-1'); saveStancePref(s, 'hero-1', p); assert.equal(worldStancePick('', s), p, `${p} reaches the world duel`); }
});

test('?stances=<pick> overrides the stored pick, ?stances=off is no stances, an unrecognised value keeps the stored pick', () => {
  const s = withProfile('hero-1'); saveStancePref(s, 'hero-1', 'aggressive');
  assert.equal(worldStancePick('?stances=trickster', s), 'trickster');
  assert.equal(worldStancePick('?x=1&stances=defensive', s), 'defensive');
  assert.equal(worldStancePick('?stances=off', s), undefined);
  assert.equal(worldStancePick('?stances=on', s), 'aggressive');
});

test('nothing stored, another character\'s pick, no profile, blocked or corrupt storage: Balanced (and the flag still wins)', () => {
  const other = withProfile('hero-1'); saveStancePref(other, 'hero-2', 'defensive');
  assert.equal(worldStancePick('', other), 'neutral', 'another character\'s pick is not this one\'s');
  const noProfile = store(); saveStancePref(noProfile, 'hero-1', 'aggressive');
  assert.equal(worldStancePick('', noProfile), 'neutral', 'no profile id on the device: Balanced');
  assert.equal(worldStancePick('', null), 'neutral', 'no storage');
  assert.equal(worldStancePick('', { getItem: () => { throw Error('blocked'); }, setItem: () => undefined }), 'neutral', 'blocked storage');
  assert.equal(worldStancePick('', store({ [FIGHTER_KEY]: '{', [STANCE_KEY]: '{' })), 'neutral', 'corrupt values');
  assert.equal(worldStancePick('?stances=defensive', null), 'defensive', 'the look-test flag does not need storage');
});

test('the world duel host feeds the stance pick from the page storage, ?stances= over it (pit-duel.ts)', () => {
  const src = readFileSync(new URL('../origins/preview/pit-duel.ts', import.meta.url), 'utf8');
  assert.match(src, /asked\.stance \?\? \(asked\.record \? worldStancePick\(location\.search, pageStorage\(\)\) : undefined\)/);
  assert.match(src, /const pageStorage = \(\): Storage \| null => \{ try \{ return localStorage; \} catch \{ return null; \} \}/);
});
