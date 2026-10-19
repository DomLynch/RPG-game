import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWorldRecord, replayWorldRecord, type WorldRecord } from '../../src/fight/server.ts';
import { createWorldCombat as live } from '../../src/fight/world-combat.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { verifyWorldRecord } from './world-verify.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

// The damage ledger of the replay (Dom 2026-10-19: kill credit by damage): the hero's damage to each creature, from the Hit events of the server's own replay.
const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const base = [...defaultZoneSpawns(loaded.value).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const TICKS = 60, EXPIRY = SERVER_RULES.worldShare[0]!.tagExpiryS;

/** A level-1 wolf spawn under a given id (the scripted hero beats about half of the ids: the id seeds the fight), and the record of the scripted hero fighting it for `swingS` seconds, then walking away for `walkS`. */
function fight(id: string, swingS: number, walkS: number, untilKill: boolean): { wolf: Spawn; rec: WorldRecord | null; killed: boolean } {
  const wolf: Spawn = { ...base, spec: { ...base.spec, id, level: 1 } };
  const fell: string[] = []; let killedRec: WorldRecord | null = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); killedRec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.4, facing: 0 };
  const face = (): void => { const w = wc.debug().find((q) => q.id === id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; };
  for (let i = 0; i * 0.5 < swingS && !(untilKill && fell.length); i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { face(); wc.update(1 / 30, hero); } }
  for (let t = 0; t < walkS; t += 1 / 30) { hero.z -= 7 / 30; wc.update(1 / 30, hero); }
  return { wolf, rec: killedRec ?? wc.record(), killed: fell.length > 0 };
}
/** The first wolf id the scripted hero kills. */
function honest(): { wolf: Spawn; rec: WorldRecord } {
  for (let n = 100; n < 140; n++) { const f = fight(`wolves-${n}`, 200, 0, true); if (f.killed && f.rec) return { wolf: f.wolf, rec: f.rec }; }
  throw new Error('no wolf id the scripted hero kills in 40 tries');
}

test('the replay returns the hero\'s damage to the creature he killed: at least its health', () => {
  const { wolf, rec } = honest();
  const r = replayWorldRecord(rec);
  assert.ok(r.ok && r.kills.includes(wolf.spec.id));
  if (!r.ok) return;
  assert.ok(r.dealt[wolf.spec.id]!.damage >= wolf.hp - 1, `dealt ${r.dealt[wolf.spec.id]?.damage} of ${wolf.hp}`);
});

test('a gap longer than the tag expiry drops the damage that came before it (entries expire after the last hit)', () => {
  const { wolf, rec } = honest();
  const all = replayWorldRecord(rec), cut = replayWorldRecord(rec, { tagExpiryTicks: 1 });
  assert.ok(all.ok && cut.ok);
  if (!all.ok || !cut.ok) return;
  assert.ok(cut.dealt[wolf.spec.id]!.damage < all.dealt[wolf.spec.id]!.damage, 'a one-tick expiry keeps only the last run of hits');
  assert.equal(replayWorldRecord(rec, { tagExpiryTicks: EXPIRY * TICKS }).ok && (replayWorldRecord(rec, { tagExpiryTicks: EXPIRY * TICKS }) as { dealt: Record<string, { damage: number }> }).dealt[wolf.spec.id]!.damage, all.dealt[wolf.spec.id]!.damage, 'the row\'s expiry (120 s) keeps a normal fight whole');
});

test('verifyWorldRecord reports the damage to THIS spawn\'s creature', async () => {
  const { wolf, rec } = honest();
  const v = await verifyWorldRecord(await encodeWorldRecord(rec), wolf, 'wolf', undefined, undefined, undefined);
  assert.ok(v.ok, JSON.stringify(v));
  if (v.ok) assert.ok((v.damage ?? 0) >= wolf.hp - 1);
});

test('heal reset: a creature that gave up, walked home and healed (Evaded) clears the hero\'s damage to it', () => {
  let found = false;
  for (let n = 100; n < 130 && !found; n++) {
    const hit = fight(`wolves-${n}`, 3, 0, false), away = fight(`wolves-${n}`, 3, 60, false);
    const a = hit.rec && replayWorldRecord(hit.rec), b = away.rec && replayWorldRecord(away.rec);
    if (!a || !b || !a.ok || !b.ok || !(a.dealt[hit.wolf.spec.id]?.damage > 0) || b.kills.length > 0) continue;   // this id: no blow landed in 3 s, or the hero killed it
    found = true;
    assert.equal(b.dealt[away.wolf.spec.id], undefined, 'the evaded creature\'s ledger is cleared');
  }
  assert.ok(found, 'a wolf id where a blow lands and the creature then evades');
});
