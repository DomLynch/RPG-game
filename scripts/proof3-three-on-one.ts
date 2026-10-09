// Proof 3 evidence (#1936 c): three creatures engage one player in the open world, he kills one, runs, and the other two walk home - no end screen.
// Headless: the real stepCombat (origins/combat/zone1.ts), no browser. Prints the event log, then a 4-frame top-down SVG between SVG-BEGIN / SVG-END.
// Run: node scripts/proof3-three-on-one.ts
import { MAX_ATTACKERS, creature, newWorld, player, stepCombat, type Event, type Fighter, type Input, type World } from '../origins/combat/zone1.ts';

const DT = 1 / 60, STILL: Input = { x: 0, z: 0 };
const boost = (f: Fighter): Fighter => { f.health = f.maxHealth = 1e6; return f; };
let w: World = newWorld([boost(player('hero', 0, 0, 0, undefined, 10)), creature('boar-1', 'boar', 0, 1.6), creature('boar-2', 'boar', 1.4, 1.8), creature('boar-3', 'boar', -1.4, 1.8)]);
const log: { t: number; e: Event }[] = [], frames: { label: string; w: World }[] = [];
let killedAt = -1, phase: 'fight' | 'run' = 'fight';
for (let k = 0; k < 60 * 120; k++) {
  const t = k * DT, hero = w.fighters.find((f) => f.id === 'hero')!;
  const input: Input = phase === 'fight' ? { x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null } : { x: -1, z: 0, run: true };
  if (k === 60) frames.push({ label: `t=${t.toFixed(1)}s three on him`, w });
  const r = stepCombat(w, { hero: input }, DT); w = r.world;
  for (const e of r.events) if (['FightStarted', 'Died', 'Evaded'].includes(e.type)) log.push({ t: +t.toFixed(2), e });
  if (killedAt < 0 && r.events.some((e) => e.type === 'Died' && e.by === 'hero')) { killedAt = k; phase = 'run'; frames.push({ label: `t=${t.toFixed(1)}s one down, he runs`, w }); }
  if (killedAt >= 0 && k === killedAt + 60 * 3) frames.push({ label: `t=${t.toFixed(1)}s running`, w });
  if (killedAt >= 0 && w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead').every((f) => !f.hunting && !f.returning && f.health === f.maxHealth && Math.hypot(f.x - f.homeX, f.z - f.homeZ) < 0.2)) { frames.push({ label: `t=${t.toFixed(1)}s both home`, w }); break; }
  void hero;
}
const count = (type: string) => log.filter((l) => l.e.type === type).length;
console.log(`MAX_ATTACKERS=${MAX_ATTACKERS}`);
for (const l of log) console.log(`${String(l.t).padStart(6)}s ${JSON.stringify(l.e)}`);
console.log(`SUMMARY FightStarted=${count('FightStarted')} Died=${count('Died')} Evaded=${count('Evaded')} hero-alive=${w.fighters.find((f) => f.id === 'hero')!.phase !== 'dead'}`);
const S = 28, W = 200, H = 150, cx = W / 2, cz = 40;
const px = (x: number) => cx + x * S / 2, pz = (z: number) => cz + z * S / 2;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * frames.length}" height="${H}" font-family="monospace" font-size="9">`;
frames.forEach((fr, i) => {
  svg += `<g transform="translate(${i * W},0)"><rect width="${W}" height="${H}" fill="#1a1a1a" stroke="#444"/><text x="4" y="12" fill="#ddd">${fr.label}</text>`;
  for (const f of fr.w.fighters) svg += `<circle cx="${px(f.x)}" cy="${pz(f.z)}" r="${f.side === 'player' ? 5 : 6}" fill="${f.phase === 'dead' ? '#555' : f.side === 'player' ? '#4af' : f.returning ? '#fa4' : '#e55'}"/><text x="${px(f.x) + 7}" y="${pz(f.z) + 3}" fill="#bbb">${f.id.replace('boar-', 'b')}</text>`;
  svg += '</g>';
});
console.log('SVG-BEGIN\n' + svg + '</svg>\nSVG-END');
