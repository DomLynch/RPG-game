// Proof 3, server half (#1936 c): the stack's real stepCombat driving the PAGE's real spawn client (origins/preview/spawn-net.ts, Backend's #1952) against a FAKE writer that only records.
// Three boars engage one player; he kills boar-1 and runs; the other two walk home. Expect: 3 engage, 1 kill_report (boar-1, hits = boar-1's own only), 0 kill_reports for the others, 2 drops (Evaded).
// Run: node scripts/proof3-engage-client.ts
import { creature, newWorld, player, stepCombat, type Event, type Fighter, type Input, type World } from '../origins/combat/zone1.ts';
import { onCombatEvent, spawnTracker } from '../origins/preview/spawn-net.ts';

const DT = 1 / 60, RUN_MS = 5.2, ME = 'hero';
const calls: { t: number; op: string; body: unknown }[] = [];
let ms = 0;
const fakeFetch = (async (url: string, init: { body: string }) => {
  const op = url.split('/').pop()!, body = JSON.parse(init.body) as { instance?: string; token?: string };
  calls.push({ t: +(ms / 1000).toFixed(2), op, body });
  const result = op === 'engage' ? { token: `tok-${body.instance}`, instance: body.instance, generation: 0, kind: 'boar', level: 1, hp: 10, expiresAt: 'x' }
    : op === 'kill_report' ? { result: 'killed', instance: String(body.token).slice(4), respawnAt: null, loot: [], cp: 1, bronze: 1, beta: true } : { expiresAt: 'x' };
  return { status: 200, json: async () => ({ ok: true, result }) };
}) as unknown as typeof fetch;
const tracker = spawnTracker({ token: () => 'session', character: () => 'char-1', now: () => ms, fetch: fakeFetch, base: '/origins' });
const onEvent = onCombatEvent(tracker, ME);
const boost = (f: Fighter): Fighter => { f.health = f.maxHealth = 1e6; return f; };

let w: World = newWorld([boost(player(ME, 0, 0, 0, undefined, 10)), creature('boar-1', 'boar', 0, 1.6), creature('boar-2', 'boar', 1.4, 1.8), creature('boar-3', 'boar', -1.4, 1.8)]);
let phase: 'fight' | 'run' = 'fight';
const heroHits: Record<string, number> = {}, log: string[] = [];
for (let k = 0; k < 60 * 120; k++) {
  ms = Math.round(k * DT * 1000);
  const hero = w.fighters.find((f) => f.id === ME)!;
  const input: Input = phase === 'fight' ? { x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null } : { x: 0, z: 0 };
  if (phase === 'run') hero.x -= RUN_MS * DT;
  const r = stepCombat(w, { [ME]: input }, DT); w = r.world;
  for (const e of r.events as Event[]) {
    if (e.type === 'Hit' && e.attacker === ME) heroHits[e.victim] = (heroHits[e.victim] ?? 0) + 1;
    onEvent(e as never);
    if (e.type === 'Died' && e.by === ME) { phase = 'run'; log.push(`${(ms / 1000).toFixed(2)}s onKill ${e.id}`); void tracker.killed(e.id); }   // the page's onKill
    if (e.type === 'FightStarted' || e.type === 'Died' || e.type === 'Evaded') log.push(`${(ms / 1000).toFixed(2)}s event ${JSON.stringify(e)}`);
  }
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  if (phase === 'run' && tracker.open().length === 0) break;
}
await new Promise((res) => setTimeout(res, 10));
for (const l of log) console.log(l);
for (const c of calls) console.log(`${c.t.toFixed(2)}s POST ${c.op} ${JSON.stringify(c.body)}`);
const n = (op: string) => calls.filter((c) => c.op === op).length;
const kill = calls.find((c) => c.op === 'kill_report')?.body as { token?: string; hits?: number } | undefined;
console.log(`SUMMARY engage=${n('engage')} kill_report=${n('kill_report')} (token ${kill?.token}, hits ${kill?.hits}; boar-1 landed ${heroHits['boar-1']} blows, total on all creatures ${Object.values(heroHits).reduce((a, b) => a + b, 0)}) drops(Evaded)=${log.filter((l) => l.includes('"Evaded"')).length} open-tokens-left=${tracker.open().length}`);
