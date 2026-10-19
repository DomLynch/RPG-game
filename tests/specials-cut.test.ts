// The beta cut on specials (the specials PR): spells are OFF (spellsOff) except the utility spells, and a SPECIAL slot holds one of the six `specialPick` skills. A record that breaks it is judged the way the cut judges a level below the
// floor: refused, no mark, with a text for the player. The same judge serves the Pit claim (scripts/verify-loot.mjs refusal) and the open-world record (origins/server/world-verify.ts).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { BETA_SPECIALS_CUT, specialsRefusal, type SpecialsCut } from '../src/core/career-ladder.ts';
import { specialsRefusal as viaAwards } from '../src/awards.ts';
import { verifyWorldRecord } from '../origins/server/world-verify.ts';
import { createWorldCombat } from '../src/fight/world-combat.ts';
import { decodeWorldRecord, encodeWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import type { SkillId } from '../src/fight/moves.ts';
import type { Event } from '../src/fight/world.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { defaultZoneSpawns, type Spawn } from '../origins/server/world-spawns.ts';

test('the default cut is the betaCut row: spells off, the six picks', () => {
  assert.equal(BETA_SPECIALS_CUT.spellsOff, true); assert.deepEqual([...BETA_SPECIALS_CUT.pick], ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'reaping', 'stomp']);   // RV80: the sandbox's Whirlwind (reaping) joins the pick as SPECIAL 2's alternative
  assert.equal(viaAwards, specialsRefusal, 'awards.ts re-exports the one judge');
});

test('a spell cast is refused while spellsOff, a utility spell is not, and a lifted cut allows both', () => {
  assert.match(String(specialsRefusal({ spell: { id: 'brokkr' } })), /Spells are off in the beta/);
  assert.match(String(specialsRefusal({ spell: { id: 'brokkr' }, spell2: { id: 'puca' } })), /brokkr/);
  const withHeal: SpecialsCut = { ...BETA_SPECIALS_CUT, utilitySpells: new Set(['heal']) };
  assert.equal(specialsRefusal({ spell: { id: 'heal' } }, withHeal), null, 'heal is the one utility pick');
  assert.match(String(specialsRefusal({ spell: { id: 'brokkr' } }, withHeal)), /Spells are off/);
  assert.equal(specialsRefusal({ spell: { id: 'brokkr' } }, { ...BETA_SPECIALS_CUT, spellsOff: false }), null, 'spellsOff 0 puts the spell list back');
});

test('a skill outside the pick is refused in SPECIAL 2 always, and in SPECIAL 1 only where the caller says so', () => {
  assert.equal(specialsRefusal({ skill: 'stomp', skill2: 'lunge' }), null);
  assert.match(String(specialsRefusal({ skill2: 'witchfire' })), /special the beta doesn't offer/);
  assert.match(String(specialsRefusal({ skill2: 'hewer' })), /hewer/, 'the alternate is not on the list');
  assert.match(String(specialsRefusal({ skill: 'witchfire' })), /witchfire/, 'a world hero\'s SPECIAL 1 is always a pick');
  assert.equal(specialsRefusal({ skill: 'witchfire' }, BETA_SPECIALS_CUT, false), null, 'a Pit claim\'s SPECIAL 1 is the older equipped-loot skill');
  assert.equal(specialsRefusal({ skill2: 'witchfire' }, { ...BETA_SPECIALS_CUT, pick: [] }), null, 'an empty pick list lifts the pick');
});

// a real recorded fight, then judged through the world verifier with a hero limit: the cut refuses it before any replay when it breaks the pick
const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const base = [...defaultZoneSpawns(loaded.value).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };   // a level-1 wolf from the real content: the scripted hero kills it
async function recorded(pick: { special?: SkillId; special2?: SkillId }): Promise<string> {
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' }; const fell: string[] = []; let rec: WorldRecord | null = null; const events: Event[] = [];
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} } as never;
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {}, onEvent: (e) => events.push(e), hero: () => ({ level: 1, ...pick }) });
  const hero = { x: at.x, z: at.z - 1.2, facing: 0 };
  for (let i = 0; i < 30 * 40 && !fell.length; i++) { if (i % 20 === 0) { if (pick.special2 && i % 120 === 60) wc.cast2(); else if (pick.special && i % 120 === 0) wc.cast(); else wc.press(); } const w = wc.debug().find((x) => x.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); }
  assert.ok(rec, 'the scripted hero kills the wolf');
  return encodeWorldRecord(rec!);
}

test('a claim is judged by the rules it was made under: the cut does not reach back below the version that introduced it', () => {
  assert.equal(BETA_SPECIALS_CUT.fromVersion, 75, 'the betaCut row names the era (tests/frontier-era.test.ts ties it to FIRST_SKILL2_VERSION)');
  assert.equal(specialsRefusal({ spell: { id: 'brokkr' } }, BETA_SPECIALS_CUT, true, 74), null, 'a v74 spell win (legal when it was fought), settled or rechecked after the deploy, is not refused');
  assert.match(String(specialsRefusal({ spell: { id: 'brokkr' } }, BETA_SPECIALS_CUT, true, 75)), /Spells are off/, 'a v75 spell claim is refused');
  assert.match(String(specialsRefusal({ skill2: 'witchfire' }, BETA_SPECIALS_CUT, true, 75)), /special the beta doesn't offer/, 'a v75 off-pick SPECIAL 2 is refused');
  assert.equal(specialsRefusal({ skill2: 'witchfire' }, BETA_SPECIALS_CUT, true, 74), null, 'and a v74 record cannot name a SPECIAL 2 at all, so nothing is judged');
  assert.match(String(specialsRefusal({ spell: { id: 'brokkr' } })), /Spells are off/, 'no version given: judged by the current rules (a caller with no record version)');
});

test('the world verifier judges by the record\'s own version: a v74 record is not refused as "special", a v75 one is', async () => {
  const good = await recorded({ special: 'lunge', special2: 'stomp' }), narrow = { cut: { ...BETA_SPECIALS_CUT, pick: ['lunge'] } };
  assert.deepEqual(await verifyWorldRecord(good, wolf, 'wolf', narrow), { ok: false, reason: 'special' }, 'a v75 record outside the pick: refused');
  const old = await decodeWorldRecord(good); old.rv = 74;
  const verdict = await verifyWorldRecord(await encodeWorldRecord(old), wolf, 'wolf', narrow);
  assert.ok(verdict.ok === false && verdict.reason !== 'special', `the same record stamped v74 is not judged by the cut (it fails later, on the sim version): ${JSON.stringify(verdict)}`);
});

test('the world verifier refuses a record outside the pick before any replay, and honours the cut\'s own picks', async () => {
  const good = await recorded({ special: 'lunge', special2: 'stomp' });
  const verdict = await verifyWorldRecord(good, wolf, 'wolf', {});
  assert.equal(verdict.ok, true, `two picks inside the row verify: ${JSON.stringify(verdict)}`);
  const off = await verifyWorldRecord(good, wolf, 'wolf', { cut: { ...BETA_SPECIALS_CUT, pick: ['lunge'] } });
  assert.deepEqual(off, { ok: false, reason: 'special' }, 'stomp is outside a narrowed pick: refused as the cut refuses a level');
});
