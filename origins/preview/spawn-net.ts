// Origins: the page's client for the Zone 1 world spawns (origins/server/world-spawns.ts, migration 202610080014). Without it no world kill is ever server-verified (0 engages in prod).
// One tracker per page, in the order a creature fight lives:
//   engaged(instance)  a creature took the player as its foe or joined (Combat's FightStarted, #1943; before it, world-combat.ts join): POST /engage {character, instance} ONCE per creature,
//                      joiners included, so three creatures on one player hold three tokens. The token's time-to-kill floor runs from this call: engaging late (at the kill) answers too-fast.
//   hit(instance)      the player's blow landed on THIS creature (hits are per creature, never the fight total); touches the token at most every TOUCH_EVERY_MS (the writer's grace is 120 s).
//   tick()             touches every open token not touched for TOUCH_EVERY_MS (a long fight with few hits).
//   killed(instance, record?)   the creature fell: POST /kill_report {token, hits, record?} (record = the world fight's packed inputs, src/fight/world-record.ts; the server replays it; with ORIGINS_WORLD_RECORD_SCORECARD_ONLY=1 a kill without a verified one pays scorecard counts only, otherwise it pays as usual); the creature is spent whatever the answer. A report that did not get a settled answer (the socket dropped, a timeout,
//                      a 5xx, a refusal that leaves the token open such as 422 'position not checked') waits in the OUTBOX and tick() re-sends it with the SAME token once its backoff (retryDelay) has passed: the server pays a token once (its
//                      second report is 409 used), so a kill whose reply was lost is paid exactly once. 409 means settled (paid by the lost attempt, or dead/expired): the report is dropped. With a `store`
//                      the outbox outlives the page (saved per account on every change, read back by the next page's first tick()).
//   evaded(instance)   the creature gave up and walked home: drop its token, no report (it expires on the server).
// Same contract as encounter-net.ts: no DOM, storage or clock read here (the store and the clock are handed in); every failure (no session, a refusal, 503 off, the network) is an answer ({ offline }), never a throw. The page's own loot,
// toast and respawn path runs exactly as today whatever the server says; the server's answer is the beta-ledger truth.
import { call } from './encounter-net.ts';
import { DEFAULT_ZONE } from '../zones/loader.ts';
import type { Offline } from './save.ts';
import type { KillReceipt, RefusalKind } from '../../src/core/index.ts';
import type { WorldRecord } from '../../src/fight/index.ts';
import { previewRule } from './preview-rules.ts';

export type Engaged = { token: string; instance: string; generation: number; kind: string; level: number; hp: number; expiresAt: string };
export type Killed = { result: 'killed'; instance: string; respawnAt: string | null; loot: { item: string; quantity: number }[]; cp: number; bronze: number; beta: boolean };
export const TOUCH_EVERY_MS = previewRule('touchEvery');
export const MAX_RECORD_CHARS = previewRule('maxRecordChars');   // the writer's body limit is 64 KB; a longer record is not sent (the kill pays scorecard counts only)
// A killed creature is SPENT this long: a Hit or engage for it arriving after killed() (any event order) opens nothing. The server's shortest respawn is 10 s (migration 0014), so a respawned one is engaged again.
export const SPENT_MS = previewRule('spentWindow');
const isOffline = (r: object): r is Offline => 'offline' in r;
export const OUTBOX_TRIES = previewRule('outboxTries');
// The outbox's time-based backoff (audit 2026-10-18 F3: the retry ran on every frame, so a fast 503 spent all OUTBOX_TRIES in about a second): a failed send waits outboxRetry ms, times outboxRetryGrowth
// each further try, at most outboxRetryMax. With 2 s, x2 and 60 s the tries land within the writer's engage grace (engageTtl, 120 s) first and then spread out, so a short outage is ridden out instead of exhausted.
export const OUTBOX_RETRY_MS = previewRule('outboxRetry'), OUTBOX_RETRY_MAX_MS = previewRule('outboxRetryMax'), OUTBOX_RETRY_GROWTH = previewRule('outboxRetryGrowth');
export const retryDelay = (tries: number): number => Math.min(OUTBOX_RETRY_MS * OUTBOX_RETRY_GROWTH ** Math.max(0, tries - 1), OUTBOX_RETRY_MAX_MS);
// One pending kill report as the outbox keeps it, and the durable store a page may give it (outbox-store.ts: localStorage): the outbox is saved under the account whose session engaged the kill
// and read back on the next page of that account, so a reload, a crash or a closed tab inside the engage grace still reports the kill on its own token (the writer pays a token once). Never sent with
// another account's session: an account switch leaves the old account's reports saved for it.
export type OutboxEntry = { instance: string; token: string; hits: number; record: string | null; tries: number; nextAt: number };
// What a RETRIED report's 409 said (launch gate V5): the outbox entry is settled either way and never re-sent; the page shows the note (kill-apply.ts receiptToast). Not raised for the first send, whose answer goes to killed()'s caller.
export type ReceiptNote = { kind: RefusalKind; instance: string; receipt?: KillReceipt };
export type OutboxStore = { load(account: string): OutboxEntry[]; save(account: string, entries: readonly OutboxEntry[]): void };
const settledOffline = (r: Offline): boolean => r.offline === 'http-409' || r.offline === 'http-400' || r.offline === 'http-404';   // the server answered and will not change its mind

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

type Deps = { token: () => string | null; character: () => string | null | Promise<string | null>; zone?: () => string; now: () => number; encode?: (r: WorldRecord) => Promise<string>; fetch?: typeof fetch; base?: string; timeoutMs?: number; onSettled?: (k: Killed) => void; onReceipt?: (n: ReceiptNote) => void;
  account?: () => string | null; store?: OutboxStore };   // account: the signed-in account the session belongs to (writer-call.ts storedAccount); with `store`, the outbox is durable per account
type Open = { engage: Promise<Engaged | Offline>; hits: number; touchedAt: number; account: string | null };   // account: whose session asked for the engage, so its kill is reported for that account only
export type SpawnTracker = {
  engaged(instance: string): Promise<Engaged | Offline>;
  tokenOf(instance: string): string | null;   // the engage token once the server answered, else null (world-combat's bout seed, bout-seed.ts: no token = no roll)
  hit(instance: string): void;
  tick(): void;
  killed(instance: string, record?: WorldRecord | null): Promise<Killed | Offline>;
  evaded(instance: string): void;
  open(): string[];
  outbox(): string[];
};

export function spawnTracker(d: Deps): SpawnTracker {
  const opts = { fetch: d.fetch, base: d.base, timeoutMs: d.timeoutMs }, live = new Map<string, Open>(), tokens = new Map<string, string>(), spent = new Map<string, number>(), retried = new Set<string>();   // retried: creatures whose refused/offline engage the player's own blow has already asked about once
  type Pending = OutboxEntry & { account: string | null; busy: boolean };
  const pending = new Map<string, Pending>(), loaded = new Set<string>(), done = new Set<string>();   // pending: by engage TOKEN (a respawned creature's next kill is a new token, never this one); loaded: accounts whose saved outbox this page has read; done: tokens this page settled or gave up
  const accountNow = (): string | null => d.account?.() ?? null;
  const loadSaved = (account: string): OutboxEntry[] => { try { return d.store!.load(account); } catch { return []; } };
  const persist = (account: string | null): void => {   // the store's copy of one account's outbox; a store that throws (quota, private mode) leaves the in-memory outbox as it is
    if (!d.store || !account) return;
    restore(account);   // never overwrite reports an earlier page saved and this one has not read yet
    const mine = [...pending.values()].filter((p) => p.account === account).map(({ instance, token, hits, record, tries, nextAt }) => ({ instance, token, hits, record, tries, nextAt }));
    const others = loadSaved(account).filter((s) => !pending.has(s.token) && !done.has(s.token));   // re-read: another tab of this account may have saved a report since (the writer still pays a token once if both send it)
    try { d.store.save(account, [...others, ...mine]); } catch { /* kept in memory */ }
  };
  const restore = (account: string): void => {   // once per account per page: the reports an earlier page of this account left unsent
    if (!d.store || loaded.has(account)) return;
    loaded.add(account);
    const latest = d.now() + OUTBOX_RETRY_MAX_MS;   // a saved nextAt from a clock that has since gone back is held at most one backoff step, never for days
    for (const s of loadSaved(account)) if (!pending.has(s.token) && !done.has(s.token)) pending.set(s.token, { ...s, nextAt: Math.min(s.nextAt, latest), account, busy: false });
  };
  const drop = (token: string): void => { pending.delete(token); done.add(token); };
  const isSpent = (instance: string): boolean => { const at = spent.get(instance); if (at === undefined) return false; if (d.now() - at < SPENT_MS) return true; spent.delete(instance); return false; };
  const touch = (o: Open): void => {
    o.touchedAt = d.now();
    void o.engage.then((e) => (isOffline(e) ? undefined : call('touch', { token: e.token, hits: o.hits }, d.token(), touchedOf, opts)));
  };
  const open = (instance: string): Promise<Engaged | Offline> => {
    const had = live.get(instance);
    if (had) return had.engage;
    if (isSpent(instance)) return Promise.resolve<Offline>({ offline: 'spent' });   // the kill's own late events never open a new token   // FightStarted is once per engage, but a re-fire must never open a second token
    const engage = (async (): Promise<Engaged | Offline> => {
      const character = await d.character();   // a page whose open has not (yet) answered asks the door again here (src/core/open.ts characterFor), so a late character is picked up before the first engage
      return character ? call('engage', { character, instance, zoneId: d.zone?.() ?? DEFAULT_ZONE }, d.token(), engagedOf, opts) : { offline: 'no-character' };
    })();
    live.set(instance, { engage, hits: 0, touchedAt: d.now(), account: accountNow() });
    void engage.then((e) => { if (!isOffline(e) && live.get(instance)?.engage === engage) tokens.set(instance, e.token); });
    void engage.then((e) => { if (isOffline(e) && live.get(instance)?.engage === engage) live.delete(instance); });   // refused (dead, too many) or off: nothing is held, a later FightStarted may ask again
    return engage;
  };
  const send = async (token: string, note = false): Promise<Killed | Offline> => {
    const p = pending.get(token);
    if (!p) return { offline: 'settled' };
    if (p.busy) return { offline: 'busy' };
    if (d.account && p.account !== accountNow()) return { offline: 'other-account' };   // never sent with another account's session: it waits, saved, for its own account
    p.busy = true;
    const r = await call('kill_report', { token: p.token, hits: p.hits, ...(p.record ? { record: p.record } : {}) }, d.token(), killedOf, opts);
    p.busy = false;
    if (!isOffline(r)) { drop(token); d.onSettled?.(r); }
    else if (r.offline === 'no-session') p.nextAt = d.now() + OUTBOX_RETRY_MS;   // nothing was sent (the sign-in expired): not a try, asked again once a session is back
    else { p.tries++; if (settledOffline(r) || p.tries >= OUTBOX_TRIES) drop(token); else p.nextAt = d.now() + retryDelay(p.tries); }
    if (note && isOffline(r) && r.offline === 'http-409' && r.kind) d.onReceipt?.({ kind: r.kind, instance: p.instance, ...(r.receipt ? { receipt: r.receipt } : {}) });
    persist(p.account);
    return r;
  };
  return {
    engaged(instance) { retried.delete(instance); return open(instance); },
    tokenOf: (instance) => tokens.get(instance) ?? null,   // a FightStarted (re)start asks afresh
    hit(instance) {
      if (isSpent(instance)) return;
      // FightStarted is once per engage, so a refused / offline engage (a blip, a 429) is never asked again by the event; the player's own blow lands on it (a real fight), so ask ONCE more, then give up for this fight.
      if (!live.has(instance) && !retried.has(instance)) { retried.add(instance); void open(instance); }
      const o = live.get(instance);
      if (!o) return;
      o.hits++;
      if (d.now() - o.touchedAt >= TOUCH_EVERY_MS) touch(o);
    },
    tick() {
      for (const o of live.values()) if (d.now() - o.touchedAt >= TOUCH_EVERY_MS) touch(o);
      const account = accountNow();
      if (account) restore(account);
      for (const p of [...pending.values()]) if (!p.busy && d.now() >= p.nextAt) void send(p.token, true);   // only once its backoff has passed: never a send per frame
    },
    async killed(instance, record) {
      const o = live.get(instance);
      if (!o) return { offline: 'not-engaged' };
      live.delete(instance); tokens.delete(instance); retried.delete(instance); spent.set(instance, d.now());
      const e = await o.engage;   // a kill can land before the engage answered: report on its token once it has
      if (isOffline(e)) return e;
      const packed = record && d.encode ? await d.encode(record).catch(() => null) : null;   // gzip failing or a record past the limit: the kill is still reported, without it
      const account = o.account;   // the ENGAGE's account (Web's review of #3146): an account switch between engage and kill leaves the report with the account that earned it, held until that account is back
      pending.set(e.token, { instance, token: e.token, hits: o.hits, record: packed && packed.length <= MAX_RECORD_CHARS ? packed : null, tries: 0, nextAt: d.now(), account, busy: false });
      persist(account);   // saved BEFORE the first send: a page closed mid-request still has it
      return send(e.token);
    },
    evaded(instance) { live.delete(instance); tokens.delete(instance); retried.delete(instance); },
    open: () => [...live.keys()],
    outbox: () => [...pending.values()].map((p) => p.instance),
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
