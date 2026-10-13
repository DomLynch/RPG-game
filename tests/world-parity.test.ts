// Sheet-in-world PR 5 (Combat, 2026-10-13): the world hero is the Pit's hero. A world Fighter's health, and every number a Hit event reports, IS the Pit duel's own: no Loadout multiplier, no
// aMul/bMul pool scaling, no flat 150 health or 0 poise for a hero the sheet sizes. This pins that for sheeted heroes before the world-only path is deleted (it must pass on both sides of the deletion).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFighter, withSheet } from '../src/fight/duel.ts';
import { RULES } from '../src/fight/moves.ts';
import { openBout, stepBout, heroSheeted } from '../src/fight/open-fight.ts';
import { creature, player, type Input } from '../src/fight/world.ts';
import type { Sheet } from '../src/fight/sheet-rows.ts';

const SHEETS: Record<string, Sheet | undefined> = { naked: undefined, geared: { attack: 40, armour: 30, health: 30, poise: 20, recovery: 10 }, glass: { attack: 100, health: 0 } };
const script = (t: number): Input => ({ x: 0, z: 0, ...(t % 70 === 10 ? { attack: 'light' as const } : t % 70 === 40 ? { attack: 'heavy' as const } : {}), guard: t % 140 > 100 });

for (const [name, sheet] of Object.entries(SHEETS)) for (const [kind, level] of [['wolf', 18], ['goblin', 6]] as const) {
  test(`world parity: a ${name} hero against a level-${level} ${kind} fights on the Pit's own numbers (health and damage identical, no world multiplier)`, () => {
    const hero = player('h', 0, 0, 0, undefined, 10, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), foe = creature('c', kind, 0, 1.4, Math.PI, level);
    assert.equal(hero.attack, 1); assert.equal(hero.res, 1); assert.equal(foe.attack, 1); assert.equal(foe.res, 1);
    const pit = heroSheeted(hero), bare = createFighter(pit.body, 'ready', 'longsword');
    assert.equal(hero.maxHealth, pit.maxHealth, 'the bar is the Pit builder\'s');
    if (!sheet) { assert.equal(hero.maxHealth, RULES.health); assert.equal(pit.poise, createFighter(pit.body, 'ready', 'longsword').poise, 'no sheet = the Pit\'s own hero'); }
    else assert.equal(pit.maxHealth, withSheet({ tick: 0, fighters: [bare, bare], finish: null, events: [] }, [sheet, undefined]).fighters[0].maxHealth);
    let bout = openBout(hero, foe), hits = 0;
    for (let t = 0; t < 900 && hero.health > 0 && foe.health > 0; t++) {
      const r = stepBout(bout, hero, foe, script(t), { x: 0, z: 0 }, 1 / 60, t); bout = r.bout;
      const [ph, pf] = bout.duel.fighters;
      assert.equal(hero.health, ph.health, `hero health = the duel's at tick ${t}`); assert.equal(foe.health, pf.health, `foe health = the duel's at tick ${t}`);
      for (const e of r.events) if (e.type === 'Hit' && e.pit) { hits++; assert.equal(e.damage, Math.round(e.pit.damage ?? 0), `Hit damage = the Pit's at tick ${t}`); }
    }
    assert.ok(hits > 0, 'the script lands blows');
  });
}
