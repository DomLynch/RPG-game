// SPECIAL 1 / SPECIAL 2 in the open world (the specials PR, RV75 / WSV52): the hero's two class skills ride the world hero (Fighter.skill, Fighter.skill2), the record header carries them (RecordHero.skill / skill2),
// the cast / cast2 presses fire the skills' own move rows, and the replay reaches the same fight. A hero with no pick is the hero he was.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { replayWorldRecord, unpackWorldRecord, packWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import type { SkillId } from '../src/fight/moves.ts';
import type { Event } from '../src/fight/world.ts';

const mob = (id: string, body: string, level: number): FightMob => ({ id, body, level, name: id });
function fight(pick: { special?: SkillId; special2?: SkillId } | null, seconds = 40) {
  const list = [{ spec: mob('wolf-1', 'wolf', 1), x: 0, z: 1.2 }]; const fell: string[] = [], events: Event[] = []; let rec: WorldRecord | null = null;
  const mobs = { within: (x: number, z: number, r: number) => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: () => {} } as never;
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {}, onEvent: (e) => events.push(e), ...(pick ? { hero: () => ({ level: 1, ...pick }) } : {}) });
  for (let i = 0; i < 30 * seconds && !fell.length; i++) {
    if (i % 20 === 0) { if (pick?.special2 && i % 120 === 80) wc.cast2(); else if (pick?.special && i % 120 === 20) wc.cast(); else wc.press(); }   // RV87: the wolf is 45 hp and dies at tick ~117 on the old 0 / 60 cadence before a special lands; 20 / 80 lets both skills fire (a Pit event) before the kill }
    const w = wc.debug().find((x) => x.id === 'wolf-1');
    wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 });
  }
  return { rec: rec as WorldRecord | null, fell, events };
}

test('a picked hero fights, kills and records both picks in his header', () => {
  const { rec, events } = fight({ special: 'lunge', special2: 'stomp' });
  assert.ok(rec, 'a kill is recorded'); assert.equal(rec!.hero.skill, 'lunge'); assert.equal(rec!.hero.skill2, 'stomp');
  assert.ok(events.some((e) => e.type === 'Pit'), 'the fight produced Pit events (the specials fired as skill moves, not as spells)');
});

test('the header carries both picks through pack and unpack, and a replay reaches the same kill', () => {
  const live = fight({ special: 'lunge', special2: 'stomp' }); assert.ok(live.rec && live.fell.length === 1, 'the picked hero kills the level-1 wolf');   // a fixed-cadence script: lunge + stomp kills it (a seeded result, stable until the next sim change)
  const back = unpackWorldRecord(packWorldRecord(live.rec!));
  assert.equal(back.hero.skill, 'lunge'); assert.equal(back.hero.skill2, 'stomp');
  const r = replayWorldRecord(back);
  assert.equal(r.ok, true, JSON.stringify(r)); if (r.ok) assert.deepEqual(r.kills, ['wolf-1']);
});

test('a record naming an unknown skill, or the same skill twice, is refused; no pick is the record it was', () => {
  const live = fight({ special: 'lunge', special2: 'stomp' }).rec!;
  assert.equal(replayWorldRecord({ ...live, hero: { ...live.hero, skill2: 'not-a-skill' as SkillId } }).ok, false);
  assert.equal(replayWorldRecord({ ...live, hero: { ...live.hero, skill2: 'lunge' } }).ok, false, 'two different specials');
  const plain = fight(null); assert.ok(plain.rec);
  assert.ok(!('skill' in plain.rec!.hero) && !('skill2' in plain.rec!.hero), 'a hero with no pick has neither field');
});
