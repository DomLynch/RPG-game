// sandbox specialSound rows: a melee special's own sounds. `on: start` rows play when it is committed (the swing's whoosh), the rest when it lands on the foe; a spell, a self-heal and a skill with no rows add nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import { offDefs } from './lib/sandbox-defs-off.ts';
offDefs(DEFS);   // the sandbox tests patch from the OFF baseline; the shipped rows are ON (tests/lib/sandbox-defs-off.ts)

const rows = (DEFS as unknown as { specialSound: object[] }).specialSound;
const { cuesFor } = await import('../src/fight/sound/cues.ts');
const started = (extra: object = {}) => ({ tick: 1, type: 'SpecialStarted', actor: 0, move: 'skill_reaping', ...extra }) as never;
const landed = (extra: object = {}) => ({ tick: 2, type: 'SpecialLanded', actor: 0, target: 1, move: 'skill_reaping', damage: 10, ...extra }) as never;
const names = (events: never[]) => cuesFor(events).map((c) => c.name);

test('with no rows (trunk) a special adds no sound', () => {
  assert.deepEqual(names([started(), landed()]), []);
});

test('start rows whoosh when the special is committed; land rows sound when it lands', () => {
  rows.push({ id: 'reaping-1', skill: 'reaping', cue: 'whoosh_heavy', gain: 600, room: 200, delay: 120, on: 'start' }, { id: 'reaping-2', skill: 'reaping', cue: 'whoosh_heavy', gain: 750, room: 200, delay: 300, on: 'start' }, { id: 'reaping-3', skill: 'reaping', cue: 'hit_heavy', gain: 750, room: 300, delay: 0 }, { id: 'reaping-4', skill: 'reaping', cue: 'flesh_cut', gain: 550, room: 200, delay: 0 });
  const swing = cuesFor([started()]), hit = cuesFor([landed()]);
  assert.deepEqual(swing.map((c) => c.name), ['whoosh_heavy', 'whoosh_heavy']);
  assert.deepEqual(swing.map((c) => c.delay), [0.12, 0.3]);
  assert.deepEqual(hit.map((c) => c.name), ['hit_heavy', 'flesh_cut']);
  assert.deepEqual(names([started({ spell: 'x' })]), [], 'a spell is not a melee special');
  assert.deepEqual(names([landed({ target: 0 })]), [], 'a heal on yourself makes no impact sound');
  rows.length = 0;
});

// Zone 1 (live, #3324): a hero with a melee skill and no spell has no `specialShare`, so duel.ts does not take its special branch (line ~361) and the press is an ordinary attack carrying the
// skill's move row: AttackStarted / AttackActive / Hit with move 'skill_<id>', never SpecialStarted / SpecialLanded. Measured in a real Zone 1 page: only whoosh_light + hit_flesh played.
test('a hero melee skill that the engine plays as an ordinary attack (Zone 1) sounds its own rows, not the generic whoosh and hit', () => {
  rows.push({ id: 'reaping-1', skill: 'reaping', cue: 'whoosh_heavy', gain: 600, room: 200, delay: 120, on: 'start' }, { id: 'reaping-3', skill: 'reaping', cue: 'hit_heavy', gain: 750, room: 300, delay: 0 }, { id: 'reaping-4', skill: 'reaping', cue: 'flesh_cut', gain: 550, room: 200, delay: 0 });
  const swing = (extra: object = {}) => ({ tick: 1, type: 'AttackStarted', actor: 0, move: 'skill_reaping', ...extra }) as never;
  const hit = (extra: object = {}) => ({ tick: 2, type: 'Hit', actor: 0, target: 1, move: 'skill_reaping', damage: 10, ...extra }) as never;
  assert.deepEqual(names([swing()]), ['whoosh_heavy'], 'the swing plays the start rows only');
  assert.deepEqual(cuesFor([swing()]).map((c) => c.delay), [0.12]);
  assert.deepEqual(names([hit()]), ['hit_heavy', 'flesh_cut'], 'the landing plays the land rows instead of hit_flesh');
  assert.deepEqual(names([swing({ actor: 1 })]), ['whoosh_light'], 'a foe\'s attack that happens to use a skill move keeps the generic whoosh');
  assert.deepEqual(names([hit({ actor: 1, target: 0 })]), ['hit_flesh'], 'a blow ON the hero keeps the generic hit');
  assert.deepEqual(names([swing({ move: 'skill_lunge' })]), ['whoosh_light'], 'a skill with no rows keeps the generic whoosh');
  assert.deepEqual(names([hit({ move: 'skill_lunge' })]), ['hit_flesh'], 'a skill with no rows keeps the generic hit');
  assert.deepEqual(names([{ tick: 1, type: 'AttackStarted', actor: 0, move: 'light_left' } as never]), ['whoosh_light'], 'a plain cut is untouched');
  assert.deepEqual(names([started(), landed()]).length, 3, 'the Pit special path (SpecialStarted + SpecialLanded) still plays its rows once');
  rows.length = 0;
});

// #3324 follow-up (Auditor's nit): the skill's land rows replace the generic Hit cue, which also carried the guarded scrape and the glance attenuation. A skill blow must keep both.
test('a guarded or glancing skill blow keeps its guarded scrape and glance attenuation', async () => {
  const { GLANCE_GAIN, GLANCE_RATE } = await import('../src/fight/sandbox-rules.ts');
  rows.push({ id: 'reaping-3', skill: 'reaping', cue: 'hit_heavy', gain: 750, room: 300, delay: 0 });
  const hit = (extra: object = {}) => ({ tick: 2, type: 'Hit', actor: 0, target: 1, move: 'skill_reaping', damage: 10, ...extra }) as never;
  assert.deepEqual(names([hit({ guarded: true })]), ['hit_heavy', 'block'], 'a guarded skill blow lands with the glancing scrape under it');
  assert.deepEqual(names([hit({ guarded: false })]), ['hit_heavy'], 'an unguarded one has no scrape');
  const clean = cuesFor([hit()])[0]!, glanced = cuesFor([hit({ glance: true })])[0]!;
  assert.equal(glanced.gain, GLANCE_GAIN ? clean.gain * GLANCE_GAIN / 1000 : clean.gain, 'a glancing skill blow is as quiet as a glancing plain hit');
  assert.equal(glanced.rate, GLANCE_GAIN ? GLANCE_RATE / 1000 : clean.rate);
  rows.length = 0;
});
