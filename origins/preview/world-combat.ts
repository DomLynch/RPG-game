// The mount of Zone 1's own combat loop (Combat's pure origins/combat/zone1.ts) in the walk: no duel, no ring, no fight start or end (Dom 2026-10-08). The page walks the hero (collisions,
// relief) and tells this his position; the loop owns hits, creature chase/telegraph/bite/leash. This file: which creatures are in the loop (those that come within the aggro ring, until they are
// home again), the fixed 1/60 accumulator, and turning the events into what the page shows (a procedural lunge / hit pulse / fall on the creature, bars, the hero's clips, kill and death).
import { AGGRO_M, creature, newWorld, player, stepCombat, type Event, type Fighter, type World } from '../combat/zone1.ts';
import { OPPONENTS } from '../../src/moves.ts';
import type { MobSpec } from './mobs.ts';
import type { MobPick, Mobs } from './mobs-view.ts';

export const ME = 'me', STEP = 1 / 60, JOIN_M = AGGRO_M + 3, DROP_M = AGGRO_M + 8, FALL_S = 1.4, PULSE_S = 0.18, MAX_STEPS = 6;
/** The roster kind a Zone 1 body fights as, or null (it cannot be fought yet: it only wanders). */
export const kindOf = (body: string): string | null => (Object.prototype.hasOwnProperty.call(OPPONENTS, body) ? body : null);

export type Deps = {
  mobs: () => Mobs | null;
  onKill(spec: MobSpec): void;      // the creature has fallen: loot, toast, respawn timer
  onHeroDied(): void;               // the 2 s dim and the walk back to town
  onHeroHit(amount: number): void;  // red flash + the Hit clip
  onSwing(): void;                  // the hero's own cut began: the Attack clip
  onTelegraph?(id: string, ms: number): void;
};
type Fx = { hurtT: number; fallT: number; windupT: number; windupMs: number; swingT: number };

export function createWorldCombat(d: Deps) {
  let world: World = newWorld([player(ME, 0, 0, 0)]), acc = 0, pendingAttack = false, heroDead = false;
  const specs = new Map<string, MobSpec>(), fx = new Map<string, Fx>();
  const fxOf = (id: string): Fx => { let f = fx.get(id); if (!f) { f = { hurtT: 0, fallT: 0, windupT: 0, windupMs: 400, swingT: 0 }; fx.set(id, f); } return f; };
  const me = (): Fighter => world.fighters[0]!;
  function release(id: string) { d.mobs()?.drive(id, null); specs.delete(id); fx.delete(id); world = { ...world, fighters: world.fighters.filter((f) => f.id !== id) }; }
  function join(p: MobPick) {
    const kind = kindOf(p.spec.body); if (!kind || specs.has(p.spec.id) || heroDead) return;
    specs.set(p.spec.id, p.spec); world = { ...world, fighters: [...world.fighters, creature(p.spec.id, kind, p.x, p.z, 0)] };
  }
  function handle(ev: Event) {
    if (ev.type === 'Telegraph') { if (ev.id === ME) d.onSwing(); else { const f = fxOf(ev.id); f.windupT = 0.0001; f.windupMs = ev.ms; d.onTelegraph?.(ev.id, ev.ms); } }
    else if (ev.type === 'Swing' && ev.id !== ME) fxOf(ev.id).swingT = 0.0001;
    else if (ev.type === 'Hit') { if (ev.victim === ME) d.onHeroHit(ev.damage); else fxOf(ev.victim).hurtT = PULSE_S; }
    else if (ev.type === 'Evaded') release(ev.id);   // it gave up, walked home and healed: back to its own wander
    else if (ev.type === 'Died') { if (ev.id === ME) { heroDead = true; d.onHeroDied(); } else fxOf(ev.id).fallT = 0.0001; }
  }
  return {
    /** An attack press (STAB / SLASH / a tap on a creature): the cut starts on the next step if he is free. */
    press() { pendingAttack = true; },
    update(dt: number, hero: { x: number; z: number; facing: number }): void {
      const mobs = d.mobs(); if (!mobs) return;
      if (!heroDead) for (const p of mobs.within(hero.x, hero.z, JOIN_M)) join(p);
      acc = Math.min(acc + dt, STEP * MAX_STEPS);
      while (acc >= STEP) {
        acc -= STEP;
        const m = me(); world = { ...world, fighters: [{ ...m, x: hero.x, z: hero.z, facing: hero.facing }, ...world.fighters.slice(1)] };
        const r = stepCombat(world, { [ME]: { x: 0, z: 0, attack: pendingAttack && !heroDead ? 'light' : null } }, STEP); pendingAttack = false;
        world = r.world; for (const ev of r.events) handle(ev);
      }
      pendingAttack = false;
      for (const f of world.fighters.slice(1)) {
        const s = specs.get(f.id); if (!s) continue; const x = fxOf(f.id);
        if (f.phase === 'dead') {
          x.fallT += dt; mobs.drive(f.id, { x: f.x, z: f.z, facing: f.facing, moving: false, fall: Math.min(1, x.fallT / 0.6), pulse: 1 });
          if (x.fallT >= FALL_S) { const done = s; release(f.id); d.onKill(done); }
          continue;
        }
        x.hurtT = Math.max(0, x.hurtT - dt);
        const windup = f.phase === 'windup' ? Math.min(1, f.t / (x.windupMs / 1000)) : 0, strike = f.phase === 'active' ? 1 : 0;
        const lunge = strike ? 0.7 : -0.3 * windup;   // pulls back through the tell, then snaps forward
        mobs.drive(f.id, { x: f.x, z: f.z, facing: f.facing, moving: f.returning || (f.hunting && f.phase === 'ready' && Math.hypot(f.x - hero.x, f.z - hero.z) > 1.6), lunge, pulse: 1 + (x.hurtT > 0 ? 0.14 * (x.hurtT / PULSE_S) : 0) + windup * 0.06, fall: 0 });
        if (!f.hunting && !f.returning && Math.hypot(f.x - hero.x, f.z - hero.z) > DROP_M) release(f.id);
      }
    },
    /** After he died and stood up in town: a fresh body, nothing hunting him. */
    reset(hero: { x: number; z: number; facing: number }): void { for (const id of [...specs.keys()]) release(id); world = newWorld([player(ME, hero.x, hero.z, hero.facing)]); heroDead = false; acc = 0; },
    hero: () => { const m = me(); return { health: m.health, max: m.maxHealth, stamina: m.stamina, maxStamina: m.maxStamina, phase: m.phase, dead: heroDead }; },
    /** The creature he is fighting now (the nearest hunting one), for the target bar. */
    target: () => { let best: Fighter | null = null; for (const f of world.fighters.slice(1)) if (f.phase !== 'dead' && f.hunting && (!best || Math.hypot(f.x - me().x, f.z - me().z) < Math.hypot(best.x - me().x, best.z - me().z))) best = f; const s = best && specs.get(best.id); return best && s ? { name: s.name, health: best.health, max: best.maxHealth } : null; },
    inCombat: () => world.fighters.slice(1).some((f) => f.phase !== 'dead' && f.hunting),
    debug: () => world.fighters.map((f) => ({ id: f.id, phase: f.phase, hp: Math.round(f.health), x: +f.x.toFixed(1), z: +f.z.toFixed(1), hunting: f.hunting, returning: f.returning })),
  };
}
