// Zone 1's own combat loop (Strategy/Dom 2026-10-08: the wild is continuous and open; no ring, no fight start or end, no FightRecord/seed/replay). PURE: no DOM, no THREE, no
// Match/duel/record. S0 STAND-IN written by World so the mount could integrate tonight: Combat owns this file and overwrites it with the same exports (zone1.test.ts pins the
// contract the mount relies on). Numbers marked S0 are placeholders until Combat's rows (MOVES/WEAPONS/RULES) replace them.
// The page owns the HERO's position and facing (it walks him); it writes fighters[0].x/z/facing before each step. Creatures are owned here: chase, telegraph, strike, leash.
export type Phase = 'idle' | 'windup' | 'strike' | 'recover' | 'stagger' | 'dead';
export type Fighter = { id: string; kind: string; x: number; z: number; facing: number; radius: number; health: number; maxHealth: number; stamina: number; phase: Phase; phaseT: number; level: number; home?: { x: number; z: number }; lostFor?: number; evading?: boolean; hit?: boolean };
export type World = { fighters: Fighter[] };
export type HeroInput = { attack: 'light' | null; run?: boolean };
export type Ev = { type: 'Swing' | 'Telegraph' | 'HitTaken' | 'Died' | 'Evaded'; id: string; target?: string; amount?: number; ms?: number };

export const HERO_ID = 'hero';
export const ROW = {   // S0 placeholders (Combat replaces)
  hero: { reach: 2.0, arcDeg: 70, damage: 14, windup: 0.12, active: 0.08, recover: 0.4, maxHealth: 100 },
  creature: { reach: 1.5, damage: (level: number) => 5 + level * 0.8, windup: 0.4, active: 0.1, recover: 0.9, health: (level: number) => 24 + level * 6 },   // windup 0.4 s = the telegraph
  chase: 4.5, wolfChase: 6.0, leash: 30, giveUpS: 10, wolfLeash: 15, wolfGiveUpS: 6, amble: 0.9, regenAfter: 6, regen: 4,
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export const newFighter = (s: { id: string; kind: string; x: number; z: number; facing: number; radius: number; level: number }): Fighter => {
  const hero = s.id === HERO_ID, maxHealth = hero ? ROW.hero.maxHealth : ROW.creature.health(s.level);
  return { ...s, health: maxHealth, maxHealth, stamina: 100, phase: 'idle', phaseT: 0, home: hero ? undefined : { x: s.x, z: s.z }, lostFor: 0 };
};
export const newWorld = (hero: { x: number; z: number; facing: number }): World => ({ fighters: [newFighter({ id: HERO_ID, kind: 'hero', ...hero, radius: 0.42, level: 1 })] });

const towardStep = (f: Fighter, to: { x: number; z: number }, speed: number, dt: number) => {
  const d = dist(f, to); if (d < 1e-6) return;
  const k = Math.min(1, (speed * dt) / d); f.facing = Math.atan2(to.x - f.x, to.z - f.z); f.x += (to.x - f.x) * k; f.z += (to.z - f.z) * k;
};

/** One step of dt seconds. Pure: returns a fresh world and the events the page plays (anim, audio, bars). */
export function stepCombat(world: World, input: HeroInput, dt: number, rand: () => number = Math.random): { world: World; events: Ev[] } {
  const fs = world.fighters.map((f) => ({ ...f })), hero = fs[0]!, events: Ev[] = [];
  const advance = (f: Fighter) => { f.phaseT += dt; };
  // --- hero
  advance(hero);
  if (hero.phase !== 'dead') {
    if (hero.phase === 'idle' && input.attack === 'light') { hero.phase = 'windup'; hero.phaseT = 0; events.push({ type: 'Swing', id: HERO_ID }); }
    else if (hero.phase === 'windup' && hero.phaseT >= ROW.hero.windup) { hero.phase = 'strike'; hero.phaseT = 0; hero.hit = false; }
    if (hero.phase === 'strike' && !hero.hit) {
      hero.hit = true;
      const half = (ROW.hero.arcDeg * Math.PI) / 360;
      let target: Fighter | null = null;
      for (const c of fs) { if (c === hero || c.phase === 'dead') continue; const d = dist(hero, c) - c.radius; if (d > ROW.hero.reach || Math.abs(wrap(Math.atan2(c.x - hero.x, c.z - hero.z) - hero.facing)) > half) continue; if (!target || dist(hero, c) < dist(hero, target)) target = c; }
      if (target) { target.health = Math.max(0, target.health - ROW.hero.damage); events.push({ type: 'HitTaken', id: target.id, target: HERO_ID, amount: ROW.hero.damage });
        if (target.health <= 0) { target.phase = 'dead'; target.phaseT = 0; events.push({ type: 'Died', id: target.id }); } else if (target.phase === 'windup') { target.phase = 'recover'; target.phaseT = 0; } }   // a clean hit interrupts the telegraph
    }
    if (hero.phase === 'strike' && hero.phaseT >= ROW.hero.active) { hero.phase = 'recover'; hero.phaseT = 0; }
    else if (hero.phase === 'recover' && hero.phaseT >= ROW.hero.recover) { hero.phase = 'idle'; hero.phaseT = 0; }
  }
  // --- creatures
  let inCombat = false;
  for (const c of fs) {
    if (c === hero) continue;
    advance(c);
    if (c.phase === 'dead') continue;
    const wolf = c.kind === 'wolf', chase = wolf ? ROW.wolfChase : ROW.chase, leash = wolf ? ROW.wolfLeash : ROW.leash, giveUp = wolf ? ROW.wolfGiveUpS : ROW.giveUpS;
    const d = dist(c, hero), fromHome = c.home ? dist(c, c.home) : 0;
    if (c.evading) { towardStep(c, c.home!, chase * 0.7, dt); if (dist(c, c.home!) < 0.3) { c.health = c.maxHealth; c.evading = false; c.phase = 'idle'; events.push({ type: 'Evaded', id: c.id }); } continue; }
    c.lostFor = d > 20 ? (c.lostFor ?? 0) + dt : 0;
    if (hero.phase === 'dead' || fromHome > leash || (c.lostFor ?? 0) >= giveUp) { c.evading = true; c.phase = 'idle'; c.lostFor = 0; continue; }   // evade: walk home and heal, no event until it arrives, no loss
    inCombat = true;
    const reach = ROW.creature.reach + hero.radius + c.radius * 0.5;
    if (c.phase === 'idle') {
      if (d > reach) towardStep(c, hero, chase, dt);
      else { c.facing = Math.atan2(hero.x - c.x, hero.z - c.z); c.phase = 'windup'; c.phaseT = 0; events.push({ type: 'Telegraph', id: c.id, ms: Math.round(ROW.creature.windup * 1000) }); }
    } else if (c.phase === 'windup' && c.phaseT >= ROW.creature.windup) { c.phase = 'strike'; c.phaseT = 0; c.hit = false; }
    if (c.phase === 'strike' && !c.hit) {
      c.hit = true;
      if (d <= reach + 0.35 && hero.phase !== 'dead') {
        const dmg = Math.round(ROW.creature.damage(c.level) * (0.9 + rand() * 0.2)); hero.health = Math.max(0, hero.health - dmg); events.push({ type: 'HitTaken', id: HERO_ID, target: c.id, amount: dmg });
        if (hero.health <= 0) { hero.phase = 'dead'; hero.phaseT = 0; events.push({ type: 'Died', id: HERO_ID }); }
      }
    }
    if (c.phase === 'strike' && c.phaseT >= ROW.creature.active) { c.phase = 'recover'; c.phaseT = 0; }
    else if (c.phase === 'recover' && c.phaseT >= ROW.creature.recover) { c.phase = 'idle'; c.phaseT = 0; }
  }
  // --- the hero heals when nothing has hurt him for a while (out of combat; no timer on screen)
  if (!inCombat && hero.phase !== 'dead') hero.health = Math.min(hero.maxHealth, hero.health + ROW.regen * dt);
  return { world: { fighters: fs }, events };
}
