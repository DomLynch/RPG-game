// The war band on the page (zone sandbox, Strategy's #1 test for Zone 1): war-band.ts decides, this file feeds it and carries the answer out. A hit on any goblin sends the horn-blower to the horn; if he arrives the nearest goblins turn on the
// hero with an enlarged notice radius for the rally's seconds; if he is killed first the horn is never blown. PRESENTATION and creature-view only: it reads positions and hits, drives the walkers through the creature view's own `drive`, sets a
// notice radius through `setAggro` (and ALWAYS gives it back), and writes nothing into world-combat, duel, ai or any sim file. Nothing is allocated on a quiet frame (the band's answer is one shared object; positions go through one scratch).
import { fxNum } from '../../src/fight/fx-rows.ts';
import { createWarBand, pickRoles, type Goblin } from './war-band.ts';

export type BandPose = { x: number; z: number; facing: number; moving: boolean };
export type BandMobs = { find(id: string): { x: number; z: number } | null; drive(id: string, pose: BandPose | null): void; setAggro(id: string, aggro: number): number | null };
export type BandDeps = {
  mobs: () => BandMobs | undefined;
  band: readonly { id: string; loadout: string | undefined }[];   // the creatures that wear a loadout row, once (not per frame)
  piecesOf: (loadout: string | undefined) => number;
  hero: () => { x: number; z: number };
  engagedId: () => string | undefined;   // the creature the hero has locked on: it is never walked
  toast: (text: string) => void;
  enabled: () => boolean;
};

export function createWarBandRun(d: BandDeps) {
  const band = createWarBand({ hornRunSpeed: fxNum('warband.horn-run-speed'), hornReach: fxNum('warband.horn-reach'), rallyCount: fxNum('warband.rally-count'), rallySeconds: fxNum('warband.rally-seconds') });
  const ids = new Set(d.band.map((g) => g.id)), scratch = { x: 0, z: 0 }, poses = new Map<string, BandPose>();
  const rallyAggro = new Map<string, number>(), handed = new Set<string>();
  let rolesSet = false, alarmed = false;
  const pose = (id: string): BandPose => { let p = poses.get(id); if (!p) poses.set(id, (p = { x: 0, z: 0, facing: 0, moving: true })); return p; };
  const at = (id: string) => { const m = d.mobs()?.find(id); if (!m) return null; scratch.x = m.x; scratch.z = m.z; return scratch; };

  /** Give every creature its own notice radius back and hand it back to its own wander: after the rally, and whenever the page resets the hero. */
  function release(): void {
    const mobs = d.mobs();
    if (mobs) { for (const [id, was] of rallyAggro) mobs.setAggro(id, was); for (const id of handed) mobs.drive(id, null); const b = band.blower(); if (b) mobs.drive(b, null); }
    rallyAggro.clear(); handed.clear();
  }
  return {
    /** Is this creature one of the band (it wears a loadout row)? */
    inBand: (id: string): boolean => ids.has(id),
    /** A creature was hit: the first hit on any of the band while the horn-blower lives sounds the alarm. */
    hit(id: string): void { if (!ids.has(id)) return; band.hit(id); if (!alarmed && band.phase() === 'alarm') { alarmed = true; d.toast('A goblin runs for the horn!'); } },
    /** A creature fell. */
    fell(id: string): void { if (!ids.has(id)) return; band.fell(id); if (band.phase() === 'silenced' && id === band.blower()) d.toast('The horn-blower is down: no horn!'); },
    /** The hero was reset (a respawn in town): nobody stays rallied, the band starts over at its roles. */
    reset(): void { release(); rolesSet = false; alarmed = false; },
    captain: (): string | null => band.captain(),
    /** Once a frame. */
    tick(dt: number): void {
      const mobs = d.mobs(); if (!mobs || !d.enabled()) return;
      if (!rolesSet) {   // the roles are picked once, from where the band stands
        const here: Goblin[] = []; let cx = 0, cz = 0;
        for (const g of d.band) { const m = mobs.find(g.id); if (m) { here.push({ id: g.id, loadout: g.loadout, x: m.x, z: m.z }); cx += m.x; cz += m.z; } }
        if (here.length < 2) return;
        band.assign(pickRoles(here, d.piecesOf), { x: cx / here.length + fxNum('warband.horn-dx'), z: cz / here.length + fxNum('warband.horn-dz') }); rolesSet = true;
      }
      const near = (x: number, z: number, n: number): string[] => d.band.map((g) => ({ g, m: mobs.find(g.id) })).filter((e) => e.m).sort((a, b) => Math.hypot(a.m!.x - x, a.m!.z - z) - Math.hypot(b.m!.x - x, b.m!.z - z)).slice(0, n).map((e) => e.g.id);   // only when the rally is called
      const step = band.update(dt, at, near), blower = band.blower();
      if (step.walk && blower && d.engagedId() !== blower) { const p = pose(blower); p.x = step.walk.x; p.z = step.walk.z; p.facing = step.walk.facing; mobs.drive(blower, p); }
      if (step.rally) {
        if (blower) mobs.drive(blower, null);
        for (const id of new Set([...step.rally, ...(band.captain() ? [band.captain()!] : [])])) { const was = mobs.setAggro(id, fxNum('warband.rally-aggro')); if (was !== null && !rallyAggro.has(id)) rallyAggro.set(id, was); }
        d.toast('A horn sounds! The war band rallies!');
      }
      if (band.phase() === 'rallied' && rallyAggro.size) {   // the rallied goblins run in at the hero until they are in reach, then the combat loop takes them over by its own aggro rules
        if (band.rallyLeft() > 0) {
          const hero = d.hero();
          for (const id of rallyAggro.keys()) {
            if (handed.has(id) || id === blower) continue; const p = at(id); if (!p) continue;
            const dx = hero.x - p.x, dz = hero.z - p.z, dist = Math.hypot(dx, dz);
            if (dist <= fxNum('warband.rally-engage')) { handed.add(id); mobs.drive(id, null); continue; }
            const s = Math.min(fxNum('warband.rally-run-speed') * dt, dist - fxNum('warband.rally-engage')), q = pose(id); q.x = p.x + (dx / dist) * s; q.z = p.z + (dz / dist) * s; q.facing = Math.atan2(dx, dz); mobs.drive(id, q);
          }
        } else release();
      }
    },
  };
}
