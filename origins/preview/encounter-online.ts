// Origins: a world creature fight played on the SERVER's seed and settled with its record (origins/preview/encounter-net.ts over #1688's encounter_start/touch/settle).
// On by default but additive: only a page with a live Supabase session asks the writer at all (`?online=0` turns it off). Signed out, no character yet, the flag off (the writer answers 503), a
// foe the server resolved differently from the page, or any failure all return null and the page plays exactly as it did: its own seed, nothing settled. No DOM, storage or clock read here.
import { STEP } from '../../src/sim.ts';
import type { FightRecord } from '../../src/record.ts';
import type { FightSetup } from '../encounters/encounters.ts';
import { isOffline } from './save.ts';
import { settleFight, startFight, touchFight, type Fight } from './encounter-net.ts';

export const onlineWanted = (search: string): boolean => !/[?&]online=0(?:&|$)/.test(search);   // on by default for a signed-in player; ?online=0 is the off switch (QA and offline play)
export const RETRY_AFTER_MS = [5_000, 15_000];   // a settle that could not reach the server (network, timeout, 5xx) is retried after these waits: the token's grace (120 s from the last touch) outlasts them
// The engage waits on encounter_start (and a resume touch) before the fight can begin on the server's seed: a slow or down writer must not stall the tap, so the start gets
// a short budget of its own and falls back to an offline (unpaid) fight. Touches during the fight and the settle keep the normal 4 s budget (the settle re-simulates the whole fight).
export const START_TIMEOUT_MS = 1_500;
export const TOUCH_EVERY_MS = 30_000;   // the writer's reconnect grace is 120 s: a fight that outlasts it without a touch would settle as abandoned
export type Ended = { result: 'won' | 'lost'; record?: FightRecord | null };   // EncounterEnd (encounter-duel.ts) carries `record` once Expansion's #1708 is on trunk
export type SettleOutcome = 'settled' | 'already' | 'unverified' | 'no-record' | 'offline';

export type Online = {
  seed: number;
  // The fight is over: post its record. A 409 means the server already settled this token (a retry after a client timeout): that is done, not an error. A failed post (offline) may be retried.
  settle(end: Ended): Promise<SettleOutcome>;
  played(): void;   // the fight's first tick has run: from now on a 409 never resumes this token (a loser must not replay the same seed), and the server hears it (touch at tick 1)
  stop(): void;   // the player left: stop touching (an unsettled token expires on the server as a loss by abandonment)
};
export type HeldFight = { token: string; played: boolean };
export type Held = { get(): HeldFight | null; set(fight: HeldFight | null): void };   // where the page remembers its open fight's token, and whether its first tick has played (sessionStorage); injected so this file stays DOM-free
type Deps = { held?: Held; token: string | null; character: string | null; fight: string; setup: Pick<FightSetup, 'opponent'>; fetch?: typeof fetch; base?: string; timeoutMs?: number; startTimeoutMs?: number; now?: () => number; every?: typeof setInterval; clear?: typeof clearInterval; warn?: (message: string) => void; wait?: (ms: number) => Promise<void> };

export async function beginOnline(d: Deps): Promise<Online | null> {
  if (!d.token || !d.character) return null;
  const opts = { fetch: d.fetch, base: d.base, timeoutMs: d.timeoutMs };
  const startOpts = { ...opts, timeoutMs: d.startTimeoutMs ?? START_TIMEOUT_MS };
  let got = await startFight(d.token, d.character, d.fight, startOpts);
  if (isOffline(got as never) && (got as { offline: string }).offline === 'http-409' && d.held) {   // "a fight is already open for this account: resume it": the 409 names no token, so resume the one this page remembers
    const open = d.held.get();
    if (open?.played) d.held.set(null);   // it was played: forget it, play offline, and do not touch (a touch would only extend its grace)
    else if (open) { got = await touchFight(d.token, open.token, 0, startOpts); if (isOffline(got as never) || (got as Fight).lastTick !== 0) { d.held.set(null); if (!isOffline(got as never)) got = { offline: 'played' }; } }   // resume only a fight nothing has played of (lastTick 0): resuming a played one would let a loser replay it from tick 0 on the same seed. A dead or played token is forgotten and the page plays offline
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
    seed: run.seed, stop, played: () => { d.held?.set({ token: run.token, played: true }); void touchFight(d.token, run.token, 1, opts); },   // and tell the server the fight began (lastTick 1): a backstop for a client that skips the mark
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

// The engage never awaits the writer (Strategy 2026-10-08): the server's seed drives the fight from tick 0 and cannot join mid-fight, so the session is PREFETCHED
// when a creature turns hostile (`want`), one at a time. At the tap `take` hands it over only if it is THIS creature's and already here; otherwise null: the fight starts at
// once on the local seed, unpaid (no settle), and a session that arrives late is stopped (its token stays open: the next engage resumes it, else the writer sweeps it after 120 s).
export function createPrefetch(begin: (id: string) => Promise<Online | null>) {
  let slot: { id: string; ready: Online | null; gone: boolean } | null = null;
  return {
    want(id: string): void {
      if (slot?.id === id) return;
      slot?.ready?.stop();
      const mine = slot = { id, ready: null as Online | null, gone: false };
      void begin(id).then((o) => { if (mine.gone || slot !== mine) o?.stop(); else mine.ready = o; });
    },
    take(id: string): Online | null {
      const got = slot; slot = null;
      if (got && got.id === id && got.ready) return got.ready;
      if (got) got.gone = true;
      return null;
    },
  };
}
