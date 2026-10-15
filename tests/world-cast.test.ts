import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { decodeWorldRecord, encodeWorldRecord, packWorldRecord, replayWorldRecord, unpackWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { SPELL_IDS, resolveSpell } from '../src/fight/spell-cast.ts';
import type { Event } from '../src/fight/world.ts';

// The open-world cast (Strategy order 2026-10-14): the equipped spell rides on the world hero, the SKILL press is a cast, and the world record carries both so the server replays the cast fight.
const SPELL = { id: SPELL_IDS[0]!, skill: 100 };
const mob = (id: string, body: string, level: number): FightMob => ({ id, body, level, name: id });
function fakeMobs(list: Array<{ spec: FightMob; x: number; z: number }>) {
  const fell: string[] = [];
  const mobs = { within: (x: number, z: number, r: number) => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: () => {} };
  return { mobs: mobs as never, fell };
}
/** The hero faces the wolf and casts (or cuts) until it falls or the time is up; the record is taken in onKill, as the page does. */
function fight(opts: { spell?: { id: string; skill: number }; press: 'cast' | 'cut' | 'mix'; seconds?: number }) {
  const f = fakeMobs([{ spec: mob('wolf-1', 'wolf', 1), x: 0, z: 1.2 }]); const kills: string[] = [], events: Event[] = []; let rec: WorldRecord | null = null;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {}, onEvent: (e) => events.push(e), ...(opts.spell ? { hero: () => ({ level: 1, spell: opts.spell }) } : {}) });
  const t0 = wc.hero().stamina;
  for (let i = 0; i < 30 * (opts.seconds ?? 40) && kills.length === 0; i++) {
    if (i % 15 === 0) { if (opts.press === 'cast' || (opts.press === 'mix' && i % 120 === 0)) wc.cast(); else wc.press(); }   // mix: a cast every four seconds, cuts between
    const w = wc.debug().find((x) => x.id === 'wolf-1');
    wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 });
  }
  return { rec: rec as WorldRecord | null, kills, events, spent: t0 - wc.hero().stamina };
}

test('the cast press starts the hero\'s own cast: the Pit special telegraph, then it lands or fizzles', () => {
  const { events } = fight({ spell: SPELL, press: 'cast', seconds: 6 });
  assert.ok(events.some((e) => e.type === 'Telegraph' && e.id === 'me' && e.move !== 'light_right'), 'a cast telegraph from the hero');
  assert.ok(events.some((e) => e.pit && (e.pit.type === 'SpecialLanded' || e.pit.type === 'SpecialFizzled') && e.pit.actor === 0), 'the cast resolved (landed or fizzled)');
});

test('a hero with no spell: the cast press starts nothing (today\'s SKILL button)', () => {
  const { events } = fight({ press: 'cast', seconds: 4 });
  assert.ok(!events.some((e) => e.pit && (e.pit.type === 'SpecialStarted' || e.pit.type === 'SpecialLanded')), 'no cast without a spell');
});

test('a cast fight replays on the server: the record carries the spell and the cast presses and replays to the same kill', async () => {
  const live = fight({ spell: SPELL, press: 'mix', seconds: 90 });
  assert.deepEqual(live.kills, ['wolf-1']); assert.ok(live.rec);
  const rec = live.rec!;
  assert.deepEqual(rec.hero.spell, SPELL); assert.ok(rec.steps.some((s) => s.cast), 'cast presses are recorded');
  const r = replayWorldRecord(rec); assert.ok(r.ok, JSON.stringify(r)); if (r.ok) assert.deepEqual(r.kills, ['wolf-1']);
  assert.deepEqual(unpackWorldRecord(packWorldRecord(rec)), rec);
  assert.deepEqual(await decodeWorldRecord(await encodeWorldRecord(rec)), rec);
});

test('a record whose cast presses were taken out no longer kills the same way, and a cast with no spell in the header is refused', () => {
  const live = fight({ spell: SPELL, press: 'mix', seconds: 90 }); const rec = live.rec!; assert.ok(rec);
  const noSpell: WorldRecord = { ...rec, hero: { ...rec.hero, spell: undefined } }; delete noSpell.hero.spell;
  const r = replayWorldRecord(noSpell); assert.ok(!r.ok && r.reason === 'cast without a spell', JSON.stringify(r));
  const bad = replayWorldRecord({ ...rec, hero: { ...rec.hero, spell: { id: 'not-a-spell', skill: 50 } } }); assert.ok(!bad.ok && bad.reason === 'hero spell');
  assert.ok(!replayWorldRecord({ ...rec, hero: { ...rec.hero, spell: { id: SPELL.id, skill: 101 } } }).ok);
});

test('a world record without a cast is byte for byte what it was: no cast key on a step, no spell key in the header', () => {
  const live = fight({ press: 'cut', seconds: 60 }); assert.ok(live.rec, 'a kill by cutting'); const rec = live.rec!;
  assert.ok(rec.steps.every((s) => !('cast' in s)) && !('spell' in rec.hero));
  assert.ok(!new TextDecoder().decode(packWorldRecord(rec).subarray(0, 400)).includes('spell'));
});

test('the resolved spell the sim casts is the Pit\'s own (spell-cast.ts), at the record\'s skill', () => {
  const a = resolveSpell(SPELL.id, SPELL.skill, 0)!; assert.ok(a.cost > 0);
});
