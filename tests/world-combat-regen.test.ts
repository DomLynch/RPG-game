import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat } from '../src/fight/index.ts';
import { regenRules } from '../src/fight/hero-regen.ts';
import { OUT_OF_COMBAT_S } from '../src/fight/speeds.ts';
import type { MobDrive, MobPick } from '../origins/preview/mobs-view.ts';
import type { MobSpec } from '../origins/preview/mobs.ts';

// The hero's out-of-combat regeneration through the REAL world loop (no debug helper): a goblin hurts him, he walks away until nothing hunts him, and the hook (hero-regen.ts, the `regen` dep) must give nothing while any fight or notice is
// live and nothing inside the out-of-combat window, then refill by the regen.* rows. With the hook absent his health never moves. A recorded fight window cannot see a regen tick: it needs `fought` / `noticed` false, i.e. no window open.
const DT = 1 / 60;
function world(regen: boolean) {
  const spec = { id: 'goblin-1', body: 'goblin', name: 'goblin', level: 1, named: false } as unknown as MobSpec;
  const at = { x: 0, z: 1 }, driven = new Map<string, MobDrive>(); let rises = 0;
  const port = { within: (x: number, z: number, r: number): MobPick[] => (Math.hypot(at.x - x, at.z - z) <= r ? [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }] : []), drive: (id: string, p: MobDrive | null) => { if (p) { driven.set(id, p); at.x = p.x; at.z = p.z; } else driven.delete(id); }, fell: () => {} };
  const wc = createWorldCombat({ mobs: () => port, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, ...(regen ? { regen: () => regenRules() } : {}) } as never);
  const hero = { x: 0, z: 0, facing: 0 };
  const step = (seconds: number, until?: () => boolean) => { for (let t = 0; t < seconds / DT; t++) { const before = wc.hero().health; if (driven.size) hero.facing = Math.atan2(at.x - hero.x, at.z - hero.z); wc.update(DT, hero); if (wc.hero().health > before + 1e-9 && wc.inCombat()) rises++; if (until?.()) return t * DT; } return seconds; };
  return { wc, hero, step, rises: () => rises, driven };
}

const hurtAndEscape = (regen: boolean) => {
  const w = world(regen), max = w.wc.hero().max;
  w.step(40, () => w.wc.hero().health < max);   // stand still until the goblin lands a blow
  const hurt = w.wc.hero().health;
  w.hero.x = 900; w.hero.z = 900;   // far away: the creature gives up and goes home, nothing hunts him
  w.step(60, () => !w.wc.inCombat());   // the first frame nothing is hunting him: the out-of-combat window starts here
  return { w, max, hurt };
};

test('with the hook ON: no health comes back while a fight is live; none inside the out-of-combat window; then it refills by the rows', () => {
  const { w, max, hurt } = hurtAndEscape(true);
  assert.ok(hurt < max, `the goblin landed a blow (${hurt}/${max})`);
  assert.equal(w.rises(), 0, 'health never rose while a creature was hunting him');
  const quietBefore = w.wc.hero().health, rows = regenRules(), perSecond = max / rows.healthFullS;
  w.step(OUT_OF_COMBAT_S - 1.5);
  assert.equal(w.wc.hero().health, quietBefore, 'nothing comes back inside the out-of-combat window');
  w.step(1.5 + 1.5);   // the window ends, then about a second and a half of regeneration at the standing-still rate
  const gained = w.wc.hero().health - quietBefore;
  assert.ok(gained > perSecond * 0.5 && gained <= perSecond * 2, `it refills at max / healthFullS = ${perSecond.toFixed(2)} per second once the window has passed (gained ${gained.toFixed(2)})`);
  w.step(rows.healthFullS * 2);
  assert.equal(w.wc.hero().health, max, 'never above the max');
});

test('with the hook ABSENT (the Pit, every listed zone) his health never moves out of combat', () => {
  const { w } = hurtAndEscape(false), after = w.wc.hero().health;
  w.step(OUT_OF_COMBAT_S + 30);
  assert.equal(w.wc.hero().health, after);
});
