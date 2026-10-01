// Special Moves on the SKILL slot (RULES.special, duel.ts withSpecials; Dom 2026-09-29 via Strategy / Lead). Constructed states and scripted
// intents, no AI: deterministic. A fight without withSpecials is the fight it always was (tests/fixtures/fight-records.json, v20, still replays).
import test from 'node:test';
import assert from 'node:assert/strict';
import { legal, stepDuel, withSpecials, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, RULES, opponentAt, profileAt, specialOf } from '../src/moves.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';
import { recordSpecials, verifyRecord } from '../src/replay.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';

const S = RULES.special;
const ready = (level = 6): Duel => { const d = withSpecials(arena(OPPONENTS.veteran), level, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0; return d; };
const run = (d: Duel, ticks: number, intents: (d: Duel) => [Intent, Intent]) => { const events: Duel['events'] = []; for (let i = 0; i < ticks && !d.finish; i++) { d = stepDuel(d, intents(d)); events.push(...d.events); } return { d, events }; };

test('specials: both sides carry the share, the boss share from rank 8, and nothing fires in the first 20 s', () => {
  const d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'), boss = withSpecials(arena(OPPONENTS.veteran), S.bossFrom, 'shove');
  assert.deepEqual([d.fighters[0].specialShare, d.fighters[1].specialShare, boss.fighters[0].specialShare, boss.fighters[1].specialShare], [S.damage, S.damage, S.damage, S.bossDamage]);
  assert.deepEqual([d.fighters[0].skillCooldown, d.fighters[1].skillCooldown, d.fighters[1].skill], [S.first, S.first, 'shove']);
  assert.equal(legal(d.fighters[0], 'skill'), false, 'the first cast waits RULES.special.first');
  assert.equal(arena(OPPONENTS.veteran).fighters[0].specialShare, undefined, 'a fight without withSpecials has no special');
});

test('specials: the cast commits the caster; guard, roll and parry are ignored until the release', () => {
  let d = stepDuel(ready(), [act('skill'), idle()]);
  const caster = d.fighters[0];
  assert.deepEqual([caster.special, caster.skillCooldown], [S.windup - 1, S.cooldown]);
  assert.ok(d.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  assert.equal(legal(caster, 'dodge'), false);
  for (const press of [act('dodge'), act('parry'), { ...idle(), guard: true }, act('light')]) {
    d = stepDuel(d, [press, idle()]);
    assert.equal(d.fighters[0].phase, 'ready', `a ${press.action ?? 'guard'} press during the windup does nothing`);
  }
});

test('specials: unblockable and undodgeable, landing the share of max health on the release tick', () => {
  const start = ready(), max = start.fighters[1].maxHealth;
  const d = stepDuel(start, [act('skill'), idle()]), cast = d.tick;
  // The target holds a guard throughout, and rolls into the release: neither matters.
  const out = run(d, S.windup + 5, x => [idle(), x.fighters[0].special === 3 ? act('dodge') : { ...idle(), guard: true }]);
  const landed = out.events.filter(e => e.type === 'SpecialLanded');
  assert.equal(landed.length, 1);
  assert.equal(landed[0].tick, cast + S.windup - 1, 'the windup is RULES.special.windup ticks, the cast tick included');
  assert.equal(out.d.fighters[1].health, max - Math.round(S.damage * max));
});

test('specials: a caster who falls during his windup fizzles (no damage)', () => {
  const d = ready(S.bossFrom);
  d.fighters[0].special = 50; d.fighters[0].health = 5;   // the player is winding up, nearly dead
  d.fighters[1].special = 1; d.fighters[1].specialShare = S.bossDamage;   // the boss releases this tick
  const hp = d.fighters[1].health, next = stepDuel(d, [idle(), idle()]);
  assert.ok(next.events.some(e => e.type === 'SpecialFizzled' && e.actor === 0));
  assert.ok(!next.events.some(e => e.type === 'SpecialLanded' && e.actor === 0));
  assert.equal(next.fighters[1].health, hp);
  assert.deepEqual([next.finish?.victim, !!next.finish?.draw], [0, false]);
});

test('specials: a release on the tick its caster falls still lands; lethal both ways it is a double kill (Finish.draw)', () => {
  const d = ready();
  for (const f of d.fighters) { f.special = 1; f.health = 5; }
  const next = stepDuel(d, [idle(), idle()]);
  assert.equal(next.events.filter(e => e.type === 'SpecialLanded').length, 2);
  assert.deepEqual([next.fighters[0].health, next.fighters[1].health, next.finish?.draw], [0, 0, true]);
});

test('specials: a fight with them records the flag (v21), and the replay builds the same fight from it', async () => {
  const specials = { level: 12, aiSkill: 'shove' as const };
  const profile = profileAt(OPPONENTS.veteran, 12);
  let p = initialPractice(9, opponentAt(OPPONENTS.veteran, 12), 'longsword', 'pommel', specials);   // the level's body and profile, as verifyRecord builds it
  const rec = createRecorder({ build: 'specials', opponent: 'veteran', weapon: 'longsword', skill: 'pommel', level: 12, seed: 9, specials: true });
  let landed = 0;
  for (let i = 0; i < 7200 && !p.finish; i++) {
    const f = p.duel.fighters[0], intent = rec.push(legal(f, 'skill') ? act('skill') : f.phase === 'sheathed' ? act('light') : STRATEGIES['light spam'](p.duel));   // the special whenever it is ready, else the battery's light spam
    p = stepPractice(p, intent, profile); landed += p.duel.events.filter(e => e.type === 'SpecialLanded').length;
  }
  assert.ok(landed > 0, 'a special landed in the fight');
  const record = rec.finish(p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
  const back = await decodeRecord(await encodeRecord(record));
  assert.deepEqual([back.v, back.specials, recordSpecials(back)], [21, true, { level: 12, aiSkill: 'shove' }]);
  const v = verifyRecord(back); assert.equal(v.ok, true, `the replay reaches the same finish: ${v.ok ? '' : v.reason}`);
  assert.equal(verifyRecord({ ...back, specials: undefined }).ok, false, 'the same intents without specials are another fight');
});

// The Centurion's named specials (Strategy 2026-10-01): rank 8 Shield Quake (L36), rank 9 The Charge (L41), rank 10 Blood Tithe (L46). Identity only: the rule is RULES.special.
const CENTURION: Array<[number, string | undefined]> = [[35, undefined], [36, 'quake'], [40, 'quake'], [41, 'charge'], [45, 'charge'], [46, 'tithe']];
for (const [level, name] of CENTURION) {
  test(`specials: the Centurion at level ${level} casts ${name ?? 'his class skill'}, named in SpecialStarted and SpecialLanded, on the shared rule`, () => {
    const spec = recordSpecials({ specials: true, level, opponent: 'veteran' })!;
    assert.equal(spec.name, name);
    const d = withSpecials(arena(OPPONENTS.veteran), level, spec.aiSkill, undefined, spec.name);
    assert.equal(d.fighters[1].specialName, name);
    d.fighters[1].skillCooldown = 0;
    const out = run(d, S.windup + 5, () => [idle(), act('skill')]);
    const named = out.events.filter(e => e.type === 'SpecialStarted' || e.type === 'SpecialLanded');
    assert.equal(named.length, 2, 'cast and release');
    for (const e of named) assert.equal(e.name, name);
    assert.equal(named[1].damage, Math.round((level >= S.bossFrom ? S.bossDamage : S.damage) * out.d.fighters[0].maxHealth), 'same share as every other special');
  });
}
test('specials: only the Centurion has named specials, and the player never does', () => {
  assert.equal(specialOf('goblin', 46), null);
  assert.equal(withSpecials(arena(OPPONENTS.veteran), 46, 'shove', undefined, 'tithe').fighters[0].specialName, undefined);
});
