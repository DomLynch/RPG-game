import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_TESTS, type SpecialTest } from '../src/special-look.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { SPECIAL_LABELS, SPECIAL_BANDS, specialBand, sparringSpecialOptions, defaultSparringSpecial, resolveSparringPreview, playerSparringChoice } from '../src/sparring-specials.ts';
import { sparringLink } from '../src/sparring.ts';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES, opponentAt, SKILL_MOVE } from '../src/moves.ts';
import { skillOf } from '../src/loot.ts';
import { specialOf } from '../src/moves.ts';
import { idleIntent } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';

const matrix = {
  veteran: [null, 'standfast', 'shield', 'centurion', 'tithe'], nightborn: [null, 'cuts', 'set', 'hades', 'nyx'],
  witch: ['wake', 'stirring', 'mist', 'echo', 'price'], plaguedoctor: ['tempo', 'pulse', 'flies', 'stain', 'breath'],
  knight: ['drag', 'swing', 'sling', 'haze', 'storm'], goblin: [null, 'ratrun', 'reynard', 'hermes', 'loki'],
  executioner: [null, 'blackfurrow', 'arawn', 'thanatos', 'reaper'], pitborn: [null, 'earthfold', 'antaeus', 'surtr', 'typhon'],
  dwarf: [null, 'ironsettle', 'dwarf8', 'dwarf9', 'dwarf10'], shieldmaiden: [null, 'gatherededge', 'shield8', 'shield9', 'shield10'],
} as const;
test('every registered preview appears only under its authoritative class/band; missing slots stay missing', () => {
  const seen: string[] = []; let missing = 0;
  for (const [opponent, expected] of Object.entries(matrix)) {
    const groups = sparringSpecialOptions(opponent);
    assert.deepEqual(groups.map(g => g.band), [...SPECIAL_BANDS]);
    assert.deepEqual(groups.map(g => g.ids[0] ?? null), expected);
    for (const group of groups) {
      missing += Number(!group.ids.length);
      for (const id of group.ids) { seen.push(id); assert.equal(SPECIAL_TESTS[id].opponent, opponent); assert.ok(SPECIAL_LABELS[id]); assert.ok(id === 'hades' || SPECIAL_MODES[id], `${id}: explicit mode, no accidental Hades fallback`); }
    }
    for (const [level, band] of [[1, 0], [15, 0], [16, 1], [35, 1], [36, 2], [40, 2], [41, 3], [45, 3], [46, 4]]) {
      assert.equal(specialBand(level), band);
      assert.equal(defaultSparringSpecial(opponent, level), expected[band]);
    }
    assert.equal(defaultSparringSpecial(opponent, 'dummy'), null);
  }
  assert.equal(missing, 7);
  assert.equal(seen.length, 43);
  assert.deepEqual(seen.sort(), Object.keys(SPECIAL_TESTS).sort());
  assert.match(sparringSpecialOptions('nightborn')[0].unavailable, /Pale Lunge held/);
  for (const bad of [0, 47, 1.5, NaN]) assert.equal(specialBand(bad), null);
  assert.equal(defaultSparringSpecial('nightborn', 46), 'nyx', 'visible rank10 is simulation level46');
});

test('combined links retain explicit player kit/difficulty; wrong class/unknown/bad kit cannot dispatch a preview', () => {
  for (const id of Object.keys(SPECIAL_TESTS) as SpecialTest[]) {
    const kit = { weapon: 'estoc' as const, difficulty: 6, skill: 'miasma' as const };
    const search = sparringLink(SPECIAL_TESTS[id].opponent, kit, id).slice(1);
    assert.deepEqual(resolveSparringPreview(search), { special: id, kit, invalid: false, off: false, yourSpecial: null });
    const legacy = resolveSparringPreview(`?opponent=goblin&special=${id}`);
    assert.deepEqual(legacy, { special: id, kit: null, invalid: false, off: false, yourSpecial: null }, 'standalone preview still owns its opponent/kit');
  }
  const valid = '?spar=1&opponent=nightborn&weapon=estoc&difficulty=46&skill=miasma&special=nyx';
  for (const search of [valid.replace('nightborn', 'witch'), valid.replace('nyx', 'fake'), valid.replace('nyx', 'nyx!'), valid.replace('estoc', 'fake'), valid.replace('46', '47'), valid.replace('46', 'dummy'), valid.replace('miasma', 'fake')]) {
    assert.deepEqual(resolveSparringPreview(search), { special: null, kit: null, invalid: true, off: false, yourSpecial: null }, search);
  }
  assert.equal(resolveSparringPreview(valid, ['knife']).invalid, true, 'un-carried weapon refused by both main and scene');
});

test('explicit none is valid only in a checked Sparring kit; omitted special keeps legacy semantics', () => {
  const kit = { weapon: 'estoc' as const, difficulty: 20, skill: 'miasma' as const };
  const none = resolveSparringPreview(sparringLink('executioner', kit, null).slice(1));
  assert.deepEqual(none, { special: null, kit, invalid: false, off: true, yourSpecial: null });
  assert.equal(resolveSparringPreview(sparringLink('executioner', kit).slice(1)).off, false);
  assert.equal(resolveSparringPreview('?special=none').off, false);
  assert.equal(resolveSparringPreview('?spar=1&special=none').invalid, true);
  assert.equal(resolveSparringPreview(sparringLink('unknown', kit, null).slice(1)).invalid, true);
  assert.equal(resolveSparringPreview(sparringLink('dwarf', { ...kit, difficulty: 'dummy' }, null).slice(1)).off, true);
});

const make = (opponent: keyof typeof matrix) => {
  const writes: string[] = [], data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { writes.push(key); data.set(key, value); } };
  const ports = { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) };
  const m = new Match(OPPONENTS[opponent], 'test', ports, 731, 'longsword', null, 6);
  return { m, writes, snapshot: () => JSON.stringify({ profile: ports.profile, trial: ports.trial, scorecard: ports.scorecard, data: [...data] }) };
};
test('real Match cross-band previews retain body/AI level and player MOVE, use selected event identity/share, and write nothing', () => {
  for (const [id, difficulty] of [['nyx', 6], ['drag', 46], ['standfast', 6], ['ratrun', 46]] as const) {
    const preview = SPECIAL_TESTS[id], { m, writes, snapshot } = make(preview.opponent);
    const before = snapshot(), count = writes.length;
    m.startSparring({ weapon: 'estoc', skill: 'miasma', difficulty }, { first: preview.first, level: preview.level });
    const check = () => {
      assert.deepEqual([m.mode, m.level, m.weapon, m.skill, m.recorder], ['sparring', difficulty, 'estoc', 'miasma', null]);
      assert.deepEqual(m.specialIdentity, { opponent: preview.opponent, level: difficulty });
      const [player, foe] = m.practice.duel.fighters, body = opponentAt(OPPONENTS[preview.opponent], difficulty);
      assert.deepEqual([foe.maxHealth, foe.scale, foe.poise, foe.weapon], [body.health, body.scale, body.poise, body.weapon]);
      assert.equal(player.skill, 'miasma'); assert.equal(foe.skill, skillOf(preview.opponent));
      assert.equal(foe.specialName ?? null, specialOf(preview.opponent, preview.level));
      assert.equal(foe.specialShare, preview.level >= 36 ? RULES.special.bossDamage : RULES.special.damage);
      assert.deepEqual(m.practice.duel.fighters.map(f => f.skillCooldown), [preview.first, preview.first]);
    };
    check(); m.rematch(); check();
    assert.ok(m.rearm('knife')); assert.equal(m.level, difficulty); assert.equal(m.skill, 'miasma');
    assert.equal(m.practice.duel.fighters[1].specialShare, preview.level >= 36 ? RULES.special.bossDamage : RULES.special.damage);
    // Actual draw and real AI stepping, no fabricated SpecialStarted event.
    m.step(() => ({ ...idleIntent(), action: 'light' }));
    for (let tick = 0; tick < 1800 && !m.frameEvents.some(e => e.type === 'SpecialStarted' && e.actor === 1) && !m.practice.finish; tick++) m.step(idleIntent);
    const started = m.frameEvents.find(e => e.type === 'SpecialStarted' && e.actor === 1);
    assert.ok(started, `${id}: real AI accepted cast`);
    assert.equal(started.move, SKILL_MOVE[skillOf(preview.opponent)!]);
    assert.equal(started.name ?? null, specialOf(preview.opponent, preview.level));
    if (m.practice.finish) { const ended = m.end(false); assert.equal(ended.rewarded, false); assert.equal(ended.record, null); }
    assert.equal(writes.length, count); assert.equal(snapshot(), before);
    m.playNow();
    assert.equal(m.practice.duel.fighters[1].specialShare, difficulty < 16 ? undefined : difficulty >= 36 ? RULES.special.bossDamage : RULES.special.damage, 'ordinary PvE drops preview level override');
    assert.equal(m.practice.duel.fighters[1].specialName ?? null, specialOf(preview.opponent, difficulty));
  }
});
test('explicit unavailable OFF persists across Sparring rematch but never changes ordinary live B', () => {
  const { m } = make('executioner'), kit = { weapon: 'estoc' as const, difficulty: 20, skill: 'miasma' as const };
  m.startSparring(kit, { first: 0, enabled: false });
  for (let i = 0; i < 2; i++) { assert.equal(m.specials, false); assert.deepEqual(m.practice.duel.fighters.map(f => f.specialShare), [undefined, undefined]); assert.equal(m.recorder, null); m.rematch(); }
  m.startSparring(kit); assert.equal(m.specials, true, 'omitted legacy parameter unchanged');
  m.startSparring(kit, { first: 0, enabled: false }); m.playNow(); assert.equal(m.specials, true, 'ordinary PvE drops explicit test OFF');
});


test('independent registered player choice is unrestricted by foe class and preserves explicit foe off or choice', () => {
  const kit = { weapon: 'estoc' as const, difficulty: 6, skill: null };
  for (const id of Object.keys(SPECIAL_TESTS) as SpecialTest[]) {
    assert.deepEqual(playerSparringChoice(`special:${id}`), { skill: null, special: id });
    for (const foe of [null, 'nyx'] as const) {
      const resolved = resolveSparringPreview(sparringLink('nightborn', kit, foe, id).slice(1));
      assert.equal(resolved.invalid, false, id);
      assert.deepEqual(resolved.selection, { player: id, opponent: foe });
      assert.equal(resolved.yourSpecial, id); assert.deepEqual(resolved.kit, kit);
    }
  }
  const dummy = resolveSparringPreview(sparringLink('dwarf', { ...kit, difficulty: 'dummy' }, null, 'price').slice(1));
  assert.equal(dummy.invalid, false); assert.deepEqual(dummy.selection, { player: 'price', opponent: null });
});
test('player preset omission preserves native foe semantics; explicit none permits the legacy player skill', () => {
  const old = '?spar=1&opponent=nightborn&weapon=estoc&difficulty=20&skill=miasma&special=nyx';
  assert.equal(resolveSparringPreview(old).selection, undefined);
  const explicit = resolveSparringPreview(`${old}&yourSpecial=none`);
  assert.deepEqual(explicit.selection, { player: null, opponent: 'nyx' }); assert.equal(explicit.kit?.skill, 'miasma');
  const omitted = resolveSparringPreview(old.replace('skill=miasma&special=nyx', 'skill=none&yourSpecial=price'));
  assert.deepEqual(omitted.selection, { player: 'price' }); assert.equal(omitted.off, false);
  assert.equal(Object.hasOwn(omitted.selection!, 'opponent'), false, 'undefined must not become explicit foe off');
});
test('malformed, conflicting, duplicated and non-Spar player presets refuse instead of falling through to career or None', () => {
  const valid = '?spar=1&opponent=nightborn&weapon=estoc&difficulty=6&skill=none&special=none&yourSpecial=price';
  const bad = [valid.replace('price', 'fake'), valid.replace('price', 'price!'), valid.replace('price', 'special:price'), valid.replace('skill=none', 'skill=miasma'), valid.replace('spar=1', 'spar=0'), valid.replace('estoc', 'fake'), valid.replace('difficulty=6', 'difficulty=47'), valid.replace('nightborn', 'unknown'), `${valid}&yourSpecial=none`, `${valid}&skill=none`, `${valid}&special=nyx`, valid.replace('special=none', 'special=nyx').replace('difficulty=6', 'difficulty=dummy')];
  for (const search of bad) { const r = resolveSparringPreview(search); assert.equal(r.invalid, true, search); assert.equal(r.kit, null); assert.equal(r.selection, undefined); }
  for (const value of ['special:fake', 'special:price!', 'price', 'skill:miasma', 'unavailable:witch:0', '']) assert.equal(playerSparringChoice(value), null, value);
});
