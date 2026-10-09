// Origins: the page's client for the Zone 1 world spawns (origins/server/world-spawns.ts, migration 202610080014). Without it no world kill is ever server-verified (0 engages in prod).
// One tracker per page, in the order a creature fight lives:
//   engaged(instance)  a creature took the player as its foe or joined (Combat's FightStarted, #1943; before it, world-combat.ts join): POST /engage {character, instance} ONCE per creature,
//                      joiners included, so three creatures on one player hold three tokens. The token's time-to-kill floor runs from this call: engaging late (at the kill) answers too-fast.
//   hit(instance)      the player's blow landed on THIS creature (hits are per creature, never the fight total); touches the token at most every TOUCH_EVERY_MS (the writer's grace is 120 s).
//   tick()             touches every open token not touched for TOUCH_EVERY_MS (a long fight with few hits).
//   killed(instance)   the creature fell: POST /kill_report {token, hits}; the token is spent whatever the answer.
//   evaded(instance)   the creature gave up and walked home: drop its token, no report (it expires on the server).
// Same contract as encounter-net.ts: no DOM, storage or clock read here; every failure (no session, a refusal, 503 off, the network) is an answer ({ offline }), never a throw. The page's own loot,
// toast and respawn path runs exactly as today whatever the server says; the server's answer is the beta-ledger truth.
import { call } from './encounter-net.ts';
import type { Offline } from './save.ts';

export type Engaged = { token: string; instance: string; generation: number; kind: string; level: number; hp: number; expiresAt: string };
export type Killed = { result: 'killed'; instance: string; respawnAt: string | null; loot: { item: string; quantity: number }[]; cp: number; bronze: number; beta: boolean };
export const TOUCH_EVERY_MS = 30_000;
// A killed creature is SPENT this long: a Hit or engage for it arriving after killed() (any event order) opens nothing. The server's shortest respawn is 10 s (migration 0014), so a respawned one is engaged again.
export const SPENT_MS = 10_000;
const isOffline = (r: object): r is Offline => 'offline' in r;

const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function engagedOf(r: unknown): Engaged | null {
  const e = r as Partial<Engaged> | null;
  if (!e || typeof e !== 'object' || typeof e.token !== 'string' || typeof e.instance !== 'string' || !int(e.generation) || typeof e.kind !== 'string' || !int(e.level) || !int(e.hp) || typeof e.expiresAt !== 'string') return null;
  return { token: e.token, instance: e.instance, generation: e.generation, kind: e.kind, level: e.level, hp: e.hp, expiresAt: e.expiresAt };
}
export function killedOf(r: unknown): Killed | null {
  const k = r as Partial<Killed> | null;
  if (!k || typeof k !== 'object' || k.result !== 'killed' || typeof k.instance !== 'string' || !Array.isArray(k.loot) || !int(k.cp) || !int(k.bronze)) return null;
  return { result: 'killed', instance: k.instance, respawnAt: typeof k.respawnAt === 'string' ? k.respawnAt : null, loot: k.loot, cp: k.cp, bronze: k.bronze, beta: k.beta === true };
}
const touchedOf = (r: unknown): { expiresAt: string } | null => (r && typeof r === 'object' && typeof (r as { expiresAt?: unknown }).expiresAt === 'string' ? { expiresAt: (r as { expiresAt: string }).expiresAt } : null);

type Deps = { token: () => string | null; character: () => string | null; now: () => number; fetch?: typeof fetch; base?: string; timeoutMs?: number };
type Open = { engage: Promise<Engaged | Offline>; hits: number; touchedAt: number };
export type SpawnTracker = {
  engaged(instance: string): Promise<Engaged | Offline>;
  hit(instance: string): void;
  tick(): void;
  killed(instance: string): Promise<Killed | Offline>;
  evaded(instance: string): void;
  open(): string[];
};

export function spawnTracker(d: Deps): SpawnTracker {
  const opts = { fetch: d.fetch, base: d.base, timeoutMs: d.timeoutMs }, live = new Map<string, Open>(), spent = new Map<string, number>();
  const isSpent = (instance: string): boolean => { const at = spent.get(instance); if (at === undefined) return false; if (d.now() - at < SPENT_MS) return true; spent.delete(instance); return false; };
  const touch = (o: Open): void => {
    o.touchedAt = d.now();
    void o.engage.then((e) => (isOffline(e) ? undefined : call('touch', { token: e.token, hits: o.hits }, d.token(), touchedOf, opts)));
  };
  return {
    engaged(instance) {
      const had = live.get(instance);
      if (had) return had.engage;
      if (isSpent(instance)) return Promise.resolve<Offline>({ offline: 'spent' });   // the kill's own late events never open a new token   // FightStarted is once per engage, but a re-fire must never open a second token
      const character = d.character();
      const engage = character ? call('engage', { character, instance }, d.token(), engagedOf, opts) : Promise.resolve<Offline>({ offline: 'no-character' });
      live.set(instance, { engage, hits: 0, touchedAt: d.now() });
      void engage.then((e) => { if (isOffline(e) && live.get(instance)?.engage === engage) live.delete(instance); });   // refused (dead, too many) or off: nothing is held, a later FightStarted may ask again
      return engage;
    },
    hit(instance) {
      const o = live.get(instance);
      if (!o || isSpent(instance)) return;
      o.hits++;
      if (d.now() - o.touchedAt >= TOUCH_EVERY_MS) touch(o);
    },
    tick() { for (const o of live.values()) if (d.now() - o.touchedAt >= TOUCH_EVERY_MS) touch(o); },
    async killed(instance) {
      const o = live.get(instance);
      if (!o) return { offline: 'not-engaged' };
      live.delete(instance); spent.set(instance, d.now());
      const e = await o.engage;   // a kill can land before the engage answered: report on its token once it has
      if (isOffline(e)) return e;
      return call('kill_report', { token: e.token, hits: o.hits }, d.token(), killedOf, opts);
    },
    evaded(instance) { live.delete(instance); },
    open: () => [...live.keys()],
  };
}

// The page's combat events -> the tracker (main.ts passes this as world-combat's onEvent). Engage on Combat's FightStarted (#1943) only, so a creature that merely wanders past or swings at nobody
// is never engaged (engages are capped at 4 open). The kill is reported at onKill (the fall's end).
type CombatEvent = { type: string; id?: string; attacker?: string; victim?: string; creature?: string; player?: string };
export function onCombatEvent(t: SpawnTracker, me: string): (ev: CombatEvent) => void {
  return (ev) => {
    if (ev.type === 'FightStarted') { if (ev.player === me && ev.creature) void t.engaged(ev.creature); }
    else if (ev.type === 'Hit' && ev.attacker === me && ev.victim) t.hit(ev.victim);
    else if (ev.type === 'Evaded' && ev.id) t.evaded(ev.id);
  };
}
