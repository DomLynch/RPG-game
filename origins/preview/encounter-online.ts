// Origins: a world creature fight played on the SERVER's seed and settled with its record (origins/preview/encounter-net.ts over #1688's encounter_start/touch/settle).
// Opt-in and additive: only `?online=1` on a page with a live Supabase session asks the writer at all. Signed out, no character yet, the flag off (the writer answers 503), a
// foe the server resolved differently from the page, or any failure all return null and the page plays exactly as it did: its own seed, nothing settled. No DOM, storage or clock read here.
import { STEP } from '../../src/sim.ts';
import type { FightRecord } from '../../src/record.ts';
import type { FightSetup } from '../encounters/encounters.ts';
import { isOffline } from './save.ts';
import { settleFight, startFight, touchFight, type Fight } from './encounter-net.ts';

export const onlineWanted = (search: string): boolean => /[?&]online=1(?:&|$)/.test(search);
export const RETRY_AFTER_MS = [5_000, 15_000];   // a settle that could not reach the server (network, timeout, 5xx) is retried after these waits: the token's grace (120 s from the last touch) outlasts them
export const TOUCH_EVERY_MS = 30_000;   // the writer's reconnect grace is 120 s: a fight that outlasts it without a touch would settle as abandoned
export type Ended = { result: 'won' | 'lost'; record?: FightRecord | null };   // EncounterEnd (encounter-duel.ts) carries `record` once Expansion's #1708 is on trunk
export type SettleOutcome = 'settled' | 'already' | 'unverified' | 'no-record' | 'offline';

export type Online = {
  seed: number;
  // The fight is over: post its record. A 409 means the server already settled this token (a retry after a client timeout): that is done, not an error. A failed post (offline) may be retried.
  settle(end: Ended): Promise<SettleOutcome>;
  played(): void;   // the fight's first tick has run: from now on a 409 never resumes this token (a loser must not replay the same seed)
  stop(): void;   // the player left: stop touching (an unsettled token expires on the server as a loss by abandonment)
};
export type HeldFight = { token: string; played: boolean };
export type Held = { get(): HeldFight | null; set(fight: HeldFight | null): void };   // where the page remembers its open fight's token, and whether its first tick has played (sessionStorage); injected so this file stays DOM-free
type Deps = { held?: Held; token: string | null; character: string | null; fight: string; setup: Pick<FightSetup, 'opponent'>; fetch?: typeof fetch; base?: string; timeoutMs?: number; now?: () => number; every?: typeof setInterval; clear?: typeof clearInterval; warn?: (message: string) => void; wait?: (ms: number) => Promise<void> };

export async function beginOnline(d: Deps): Promise<Online | null> {
  if (!d.token || !d.character) return null;
  const opts = { fetch: d.fetch, base: d.base, timeoutMs: d.timeoutMs };
  let got = await startFight(d.token, d.character, d.fight, opts);
  if (isOffline(got as never) && (got as { offline: string }).offline === 'http-409' && d.held) {   // "a fight is already open for this account: resume it": the 409 names no token, so resume the one this page remembers
    const open = d.held.get();
    if (open?.played) d.held.set(null);   // it was played: forget it, play offline, and do not touch (a touch would only extend its grace)
    else if (open) { got = await touchFight(d.token, open.token, 0, opts); if (isOffline(got as never) || (got as Fight).lastTick !== 0) { d.held.set(null); if (!isOffline(got as never)) got = { offline: 'played' }; } }   // resume only a fight nothing has played of (lastTick 0): resuming a played one would let a loser replay it from tick 0 on the same seed. A dead or played token is forgotten and the page plays offline
  }
  if (isOffline(got as never)) return null;
  const run = got as Fight;
  if (run.enemy !== d.setup.opponent.body || run.level !== d.setup.opponent.level) {   // the server and the page disagree about the foe: play offline rather than settle another fight
    (d.warn ?? console.warn)(`encounter online: the server resolved ${run.enemy} L${run.level}, the page ${d.setup.opponent.body} L${d.setup.opponent.level}; playing offline. The server's token ${run.token.slice(0, 6)}… stays open until its grace runs out (about 2 min, then a loss by abandonment): the next ?online start is refused until then.`);
    return null;
  }
  d.held?.set({ token: run.token, played: false });
  const now = d.now ?? Date.now, began = now(), tickNow = () => Math.max(0, Math.round((now() - began) / (STEP * 1000)));
  const every = d.every ?? setInterval, clear = d.clear ?? clearInterval;
  let timer: ReturnType<typeof setInterval> | undefined = every(() => { void touchFight(d.token, run.token, tickNow(), opts); }, TOUCH_EVERY_MS), done = false;
  const stop = () => { if (timer !== undefined) { clear(timer); timer = undefined; } };
  return {
    seed: run.seed, stop, played: () => { d.held?.set({ token: run.token, played: true }); },
    async settle(end) {
      stop(); d.held?.set(null);   // settled or not, this token is spent as far as the page is concerned
      if (done) return 'already';
      if (!end.record) { done = true; return 'no-record'; }
      const wait = d.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
      let out = await settleFight(d.token, run.token, end.record, opts);
      for (const ms of RETRY_AFTER_MS) {   // the reply may have been lost after the server settled: the retry then answers 409, which is "already settled"
        if (!(isOffline(out as never) && /^(timeout|network|http-5\d\d)$/.test((out as { offline: string }).offline))) break;
        await wait(ms);
        out = await settleFight(d.token, run.token, end.record, opts);
      }
      if (isOffline(out as never)) { const why = (out as { offline: string }).offline; if (why === 'http-409') { done = true; return 'already'; } return 'offline'; }
      done = true;
      return (out as { verified: boolean }).verified ? 'settled' : 'unverified';
    },
  };
}
