// The masher gap sweep behind tests/world-combat-era-on.test.ts, per creature and level (live rules): a hero who only presses attack every 0.5 s and never moves, the creature at 0.6..2.6 m (21 gaps, 0.1 m apart);
// a gap PASSES when the creature is cut dead once and the hero is alive. Strategy 2026-10-21: at L1 the first fight must be winnable by a newcomer who only mashes, at whatever distance they stand (>= 80 % of the gaps).
//   node scripts/zone1-fairness-masher-sweep.ts [kind:level ...]   (default wolf:1 wolf:2 goblin:1 goblin:2 giant-salamander:1 cave-troll:3)
import './../tests/lib/era-on.ts';
import { createWorldCombat } from '../src/fight/index.ts';
import type { MobDrive, MobPick } from '../origins/preview/mobs-view.ts';
import type { MobSpec } from '../origins/preview/mobs.ts';

const spec = (id: string, body: string, level: number): MobSpec => ({ id, body, name: id, level, named: false } as unknown as MobSpec);
function fight(body: string, level: number, gap: number, presses = 400): 'pass' | 'died' | 'nokill' {
  const id = `${body}-1`, driven = new Map<string, MobDrive>(), fell: string[] = [], kills: string[] = [], list = [{ spec: spec(id, body, level), x: 0, z: gap }];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (mid: string, p: MobDrive | null) => { if (p) driven.set(mid, p); else driven.delete(mid); } };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s: { id: string }) => { fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} } as never);
  for (let i = 0; i < presses && kills.length === 0 && !wc.hero().dead; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === id); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }
  return kills.length === 1 && !wc.hero().dead ? 'pass' : wc.hero().dead ? 'died' : 'nokill';
}
const gaps = Array.from({ length: 21 }, (_, i) => Math.round((0.6 + i * 0.1) * 10) / 10), pairs = process.argv.slice(2).length ? process.argv.slice(2) : ['wolf:1', 'wolf:2', 'goblin:1', 'goblin:2', 'giant-salamander:1', 'cave-troll:3'];
for (const p of pairs) {
  const [body, level] = p.split(':') as [string, string], res = gaps.map((g) => fight(body, Number(level), g)), pass = res.filter((r) => r === 'pass').length;
  console.log(`${body} L${level}: masher passes ${pass}/${gaps.length} gaps (${Math.round((100 * pass) / gaps.length)} %)  [${gaps.filter((_, i) => res[i] === 'pass').join(' ') || 'none'}]`);
}
