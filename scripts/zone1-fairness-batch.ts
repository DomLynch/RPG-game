// Zone 1 creature fairness batch (Lead 2026-10-21, Strategy's bands): the default new player against ONE creature, headless, through createWorldCombat (the live world loop), no GPU, no page.
//   node scripts/zone1-fairness-batch.ts [--seeds=48] [--seconds=90] [--gap=6] [--kinds=goblin:1:1,giant-salamander:1:1,cave-troll:3:3] [--policies=brain,normal,mash] [--verbose]
// kind:creatureLevel:heroLevel triples (scavenger = the `goblin` body, zone row opponent goblin; its level is 1-2, the salamander's 1-2, the troll's 3). Seeds n = 1..N: the creature id `<kind>-<n>` seeds the bout.
// The hero is the world's bare default body (150 hp, DEFAULT_WEAPON, no sheet): a Recruit kit is rung 1, so the gear term (rung - 1) / 9 is 0 and it changes nothing; the hero's level only drops the low-level shield
// (PROTECT_LEVEL), it never changes his numbers. That is the same hero as the 10-16 troll batch ("the 150 hp default body"). Policies:
//   script = the 10-16 receipt's hero (PR #2875): light every 34 ticks, guard held while the foe's windup/active was seen 12 ticks ago (calibration: that receipt read "troll alone win 80%, 65 s");
//   brain  = the Pit's own warden brain (ai.ts decide, PROFILES.normal) reading the hero's duel every sim tick; its actions and guard are pressed, its movement is dropped (the hero stands where the page leaves him);
//   normal = swings when free, holds guard while the foe is in windup/active (seen 0.25 s late);
//   mash   = swings whenever free, never guards.
// Prints win rate and median fight length (seconds, all fights and wins only) per row and policy, plus the hero's median health left on a win.
import { createWorldCombat } from '../src/fight/index.ts';
import { decide, initialAi } from '../src/fight/ai.ts';
import { PROFILES } from '../src/fight/moves.ts';
import type { MobDrive, MobPick } from '../origins/preview/mobs-view.ts';
import type { MobSpec } from '../origins/preview/mobs.ts';

const args = process.argv.slice(2), opt = (k: string, d: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const SEEDS = Number(opt('seeds', '48')), SECONDS = Number(opt('seconds', '90')), GAP = Number(opt('gap', '6')), VERBOSE = args.includes('--verbose'), DT = 1 / 60, LAG = Math.round(0.25 / DT);
const KINDS = opt('kinds', 'goblin:1:1,goblin:2:2,giant-salamander:1:1,giant-salamander:2:2,cave-troll:3:3').split(',').map((s) => { const [body, level, hero] = s.split(':'); return { body: body!, level: Number(level), hero: Number(hero ?? level) }; });
const CLOSE = Number(opt('close', '1.3')), WALK = 3.5;   // swinging distance in metres (honest() in world-verify.test.ts uses 1.2-1.4) and his walk speed
type Policy = 'script' | 'brain' | 'normal' | 'mash';
const POLICIES = opt('policies', 'script,brain,normal,mash').split(',') as Policy[];

type Out = { won: boolean; seconds: number; hpLeft: number };
function one(body: string, level: number, heroLevel: number, n: number, policy: Policy): Out {
  const spec = { id: `${body}-${n}`, body, name: body, level, named: false } as unknown as MobSpec;
  const list = [{ spec, x: 0, z: GAP }], driven = new Map<string, MobDrive>(); let won = false, ai = initialAi((n * 2654435761) >>> 0);
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !won && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (id: string, p: MobDrive | null) => { if (p) { driven.set(id, p); const m = list.find((q) => q.spec.id === id); if (m) { m.x = p.x; m.z = p.z; } } } };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: () => { won = true; }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, hero: () => ({ level: heroLevel }) } as never);
  const hero = { x: 0, z: 0, facing: 0 }, seen: string[] = []; let t = 0;
  for (; t < SECONDS && !won; t += DT) {
    const d = driven.get(spec.id);
    if (d) {   // the hero faces his foe and walks up to swinging distance (the page owns his walk; a creature stops at 0.85 of its own reach and stands, so a hero left at his spot whiffs from outside it)
      hero.facing = Math.atan2(d.x - hero.x, d.z - hero.z);
      const gap = Math.hypot(d.x - hero.x, d.z - hero.z);
      if (gap > CLOSE) { const s = Math.min(WALK * DT, gap - CLOSE); hero.x += (d.x - hero.x) / gap * s; hero.z += (d.z - hero.z) / gap * s; }
    }
    const foe = wc.debug().find((q) => q.id === spec.id), me = wc.hero();
    if (me.dead) break;
    seen.push(foe?.phase ?? 'none');   // a creature's attack runs windup, active, recover
    if (policy === 'brain') {
      const duel = wc.heroDuel();
      if (duel && foe?.hunting) {
        const r = decide(duel, 0, ai, PROFILES.normal); ai = r.ai;
        const a = r.intent.action; wc.guard(r.intent.guard || a === 'parry', null);
        if (a === 'light' || a === 'light_left' || a === 'light_right') wc.press('light'); else if (a === 'heavy' || a === 'thrust' || a === 'kick') wc.press(a); else if (a === 'dodge') wc.roll({ x: 0, z: 0 });
      }
    } else if (policy === 'script') {   // #2875's receipt hero ("guard R=12 ticks after a windup, light every 34 ticks"): the calibration against its 80% troll-alone line
      const lagged = seen.length > 12 ? seen[seen.length - 13]! : 'none';
      wc.guard(lagged === 'windup' || lagged === 'active', null);
      if (Math.round(t / DT) % 34 === 0 && foe?.hunting) wc.press('light');
    } else {
      const lagged = seen.length > LAG ? seen[seen.length - 1 - LAG]! : 'none', sawAttack = lagged === 'windup' || lagged === 'active';
      if (policy === 'normal') wc.guard(sawAttack, null);
      if (!sawAttack && me.phase === 'ready' && me.stamina > 0.25 * me.maxStamina && foe && foe.hunting) wc.press('light');
    }
    wc.update(DT, hero);
  }
  const me = wc.hero();
  return { won, seconds: t, hpLeft: won ? me.health / me.max : 0 };
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN; };
const f = (x: number, d = 1) => (Number.isNaN(x) ? 'n/a' : x.toFixed(d));
console.log(`seeds ${SEEDS}, bare 150 hp default hero (Recruit kit = no sheet), gap ${GAP} m, cap ${SECONDS} s, sim step 1/60`);
for (const { body, level, hero } of KINDS) for (const policy of POLICIES) {
  const runs = Array.from({ length: SEEDS }, (_, i) => one(body, level, hero, i + 1, policy)), wins = runs.filter((r) => r.won);
  console.log(`${body.padEnd(17)} L${level} (hero L${hero}) ${policy.padEnd(6)} win ${f(100 * wins.length / runs.length, 0).padStart(3)}% (${wins.length}/${runs.length})  median fight ${f(median(runs.map((r) => r.seconds)))} s (wins ${f(median(wins.map((r) => r.seconds)))} s)  median hp left on a win ${f(100 * median(wins.map((r) => r.hpLeft)), 0)}%`);
  if (VERBOSE) runs.forEach((r, i) => console.log(`  seed ${i + 1}: ${r.won ? 'WIN ' : 'loss'} ${f(r.seconds)} s hp ${f(100 * r.hpLeft, 0)}%`));
}
