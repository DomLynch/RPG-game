// The challenge-link lobby (docs/duel-architecture.md §7, stage (a): a friend challenge by link). `?duel=new` mints a room on the relay
// and shows the guest's link; `?duel=<token>` joins that room. Then the transport (direct first, the relay when no direct path opens),
// the handshake and the fight (pvp.ts), and one duel_metrics row per side when the duel ends or the page hides.
// main.ts reaches this file only through a dynamic import behind `?duel=`: a page without it never loads any of src/net.
import { idleIntent } from '../duel.ts';
import { PvpDuel, type DuelResult } from './pvp.ts';
import type { Kit, NetMetrics } from './rollback.ts';
import { connectDuel, mintRoom, sideOf, type Transport } from './transport.ts';

// The guest's link: this page's address with nothing but the guest's token (a sparring or opponent pick never rides along).
export const challengeLink = (token: string, href: string): string => { const u = new URL(href); u.search = ''; u.hash = ''; u.searchParams.set('duel', token); return u.href; };
// The bodies for the duel's database calls (migration 202610050001), all cosmetic: they feed the Pit's skull walls and never awards or rewards.
// `report_duel_start` registers who is in the room (this fighter's name, level and gear as the opponent will see them) once the fight begins;
// `report_duel` gives this page's result: a settled finish with the final checkpoint's fingerprint, or a forfeit-win when the peer left. The
// database writes rows only when the other page agrees (or, for a forfeit, stays silent for 3 minutes). Null while there is nothing to say.
const cleanName = (name: string): string => [...name].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join('').trim().slice(0, 40);
const validRoom = (room: string): boolean => /^[a-z0-9]{8,32}$/.test(room);
export function startBody(driver: PvpDuel, room: string, me: { name: string; level: number } | null | undefined): Record<string, unknown> | null {
  const name = me ? cleanName(me.name) : '';
  if (!driver.session || !name || !validRoom(room)) return null;
  return { p_room: room, p_name: name, p_level: clamp(Math.trunc(me!.level) || 0, 1000), p_gear: { weapon: driver.kit.weapon, skill: driver.kit.skill, gear: driver.kit.gear ?? [] } };
}
export function reportBody(driver: PvpDuel, room: string): Record<string, unknown> | null {
  if (!validRoom(room)) return null;
  if (driver.result === 'forfeit-win') return { p_room: room, p_result: 'forfeit-win', p_hash: null };
  const v = driver.verdict;
  return v ? { p_room: room, p_result: v.won ? 'win' : 'loss', p_hash: v.hash } : null;
}
export const roomOf = (token: string): string => token.split('.')[0];

// One side's row for public.duel_metrics (migration 202609300001), in its column names; null when the duel never played a frame.
export type MetricsRow = {
  revision: string; room: string; side: 0 | 1; path: 'direct' | 'relay'; candidate: string | null; frames: number; rollbacks_per_min: number;
  depth_p95: number; max_depth: number; stalls_per_min: number; delay: number; max_delay: number; rtt_p50_ms: number; rtt_p95_ms: number;
  desyncs: number; corrections_per_min: null; ua: string; result: DuelResult | null; reconnects: number;
};
const clamp = (v: number, hi: number): number => Math.max(0, Math.min(hi, v));
export function metricsRow(m: NetMetrics | null, meta: { revision: string | null; room: string; side: 0 | 1; path: Transport['path']; candidate: Transport['candidate']; ua: string; result?: DuelResult | null; reconnects?: number }): MetricsRow | null {
  if (!m || m.frames < 1 || !meta.revision || !/^[0-9a-f]{7,40}$/.test(meta.revision) || !/^[a-z0-9]{8,32}$/.test(meta.room)) return null;
  const ua = [...meta.ua].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('').slice(0, 300) || 'unknown';
  const p50 = clamp(m.rttP50Ms, 10000);
  return {
    revision: meta.revision, room: meta.room, side: meta.side, path: meta.path, candidate: meta.candidate, frames: Math.min(1_000_000, m.frames),
    rollbacks_per_min: clamp(m.rollbacksPerMin, 3600), depth_p95: clamp(m.depthP95, 60), max_depth: clamp(Math.max(m.maxDepth, m.depthP95), 60),
    stalls_per_min: clamp(m.stallsPerMin, 3600), delay: clamp(m.delay, 60), max_delay: clamp(Math.max(m.maxDelay, m.delay), 60),
    rtt_p50_ms: p50, rtt_p95_ms: Math.max(p50, clamp(m.rttP95Ms, 10000)), desyncs: clamp(m.desyncs, 100000), corrections_per_min: null, ua, result: meta.result ?? null, reconnects: clamp(Math.trunc(meta.reconnects ?? 0), 1000),
  };
}

export type LobbyPage = {
  say(text: string | null, stale?: boolean): void;   // the page's banner line
  link(url: string): void;                            // the challenger's link to send
  start(driver: PvpDuel): void;                       // the Match's 'pvp' mode takes the driver
  ready(): boolean;                                   // the page's rigs are in (the loading card has lifted)
  ended?(result: DuelResult): void;                   // once, when the duel's result is known (the page's end-of-duel cue)
  peerKit(kit: Kit | null): void;                     // the peer's agreed kit once the handshake has it (null: the duel ended first); the page draws him on the hero rig
  me?(): { name: string; level: number } | null;     // this fighter as the opponent will see them (the duel report's name and level)
  api: { url: string; key: string } | null; revision: string | null;
  session(): Promise<string | null>;                  // the signed-in account's access token (minting is admins-only), null for a guest
};

// A finished duel leaves no reason to hold the relay socket: left open, it is closed by the relay's 60 s idle timeout and then retried with
// backoff. The close waits a few seconds so a peer that has not settled yet still gets this side's last acks.
export const RETIRE_MS = 5000;
export function closeLater(transport: { close(): void }, ms: number = RETIRE_MS, later: (fn: () => void, ms: number) => unknown = setTimeout): void { later(() => transport.close(), ms); }

export async function openDuel(param: string, kit: Kit, page: LobbyPage): Promise<void> {
  let token = param;
  try {
    if (param === 'new') {
      const room = await mintRoom(await page.session());
      token = room.tokens[0];
      page.link(challengeLink(room.tokens[1], location.href));
    }
    page.say(param === 'new' ? 'Waiting for your opponent to open the link' : 'Joining the duel');
    const transport = await connectDuel(token), side = sideOf(token);
    const driver = new PvpDuel(side, kit, (m) => transport.send(m), () => performance.now(), roomOf(token));
    driver.setReady(false);   // the rigs load only once the kits are known; the duel starts when both pages say they are in (pvp.ts)
    let peerDown = false;   // the relay says the peer's socket dropped: the banner says so at once; the forfeit waits for the silence rules (pvp.ts SILENCE)
    transport.onPeer = (up) => { peerDown = !up; };
    page.say('Measuring the connection');
    page.start(driver);
    // A signed-in page's calls to the database, fire and forget: a guest (no access token), an offline page or an unapplied migration changes nothing.
    const call = (fn: string, body: Record<string, unknown>): void => {
      const api = page.api;
      if (api) void page.session().then((access) => (access ? fetch(`${api.url}/rest/v1/rpc/${fn}`, { method: 'POST', keepalive: true, headers: { apikey: api.key, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) : null)).catch(() => undefined);
    };
    let retired = false;
    const retire = (): void => { if (!retired) { retired = true; closeLater(transport); } };
    let sent = false, posted = false, registered = false, heardEnd: DuelResult | null = null;
    const report = () => {
      if (driver.result && driver.result !== heardEnd) { heardEnd = driver.result; page.ended?.(driver.result); }
      if (!posted && (driver.result === 'finished' || driver.result === 'forfeit-win')) { const body = reportBody(driver, roomOf(token)); if (body) { posted = true; call('report_duel', body); } }
      if (sent) return;
      const row = metricsRow(driver.metrics(), { revision: page.revision, room: roomOf(token), side, path: transport.path, candidate: transport.candidate, ua: navigator.userAgent, result: driver.result, reconnects: transport.reconnects });
      if (!row || !page.api) return;
      sent = true;
      void fetch(`${page.api.url}/rest/v1/duel_metrics`, {
        method: 'POST', keepalive: true,
        headers: { apikey: page.api.key, Authorization: `Bearer ${page.api.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      }).catch(() => undefined);
    };
    transport.onMessage = (m) => {
      const previous = driver.stage;
      driver.receive(m);
      // A late checkpoint can invalidate a finish after the watch stopped; correct the banner through the receive path.
      if (driver.stage === 'desynced' && previous !== 'desynced') { page.say('Connection disagreement: no contest', true); report(); }
    };
    addEventListener('pagehide', report);
    // The banner follows the duel: refused (a build mismatch), too slow (still played, honestly labelled), or the plain line; the row
    // goes out once the finish is settled.
    let shown = '';
    // `?debug` only: the duel as this side holds it, for the two-page check (scripts/duel-two-page-check.mjs). The finish and the
    // fingerprints are the real duel's (never the guest's flipped view), so the two pages' lines must be equal.
    const probe = /[?&]debug\b/.test(location.search) ? () => {
      const s = driver.session, settled = driver.settled;
      document.documentElement.dataset.duel = JSON.stringify({
        stage: driver.stage, side, path: transport.path, candidate: transport.candidate, link: transport.link(), settled, tick: s?.confirmed ?? 0,
        finish: s?.confirmedDuel().finish ?? null, desyncs: s?.stats.desyncs.length ?? 0, rejected: driver.rejected, delay: driver.metrics()?.delay ?? null,
        hashes: (settled || driver.stage === 'desynced') && s ? [...s.hashes] : [],
      });
    } : null;
    // The loading card pauses the page's fight loop, and the kits are exchanged by that loop's frames: until the duel starts, the handshake
    // is stepped from here, so the rigs can load. Once the session exists the page's own loop takes over.
    const pump = setInterval(() => { if (driver.session || driver.over) clearInterval(pump); else driver.frame(idleIntent()); }, 16);
    let gave = false;   // the peer's kit goes to the page once: the rigs wait for it (main.ts peerKit)
    const watch = setInterval(() => {
      probe?.();
      if (!registered && driver.session) { registered = true; const body = startBody(driver, roomOf(token), page.me?.()); if (body) call('report_duel_start', body); }
      if (!gave && (driver.peer || driver.over)) { gave = true; page.peerKit(driver.peer); }
      if (page.ready()) driver.setReady(true);
      driver.setLink(transport.link());
      const over = driver.over && !driver.refused;
      const line = driver.refused ?? (driver.stage === 'forfeit' ? 'Opponent left: you win by forfeit (no rewards)' : driver.stage === 'left' ? 'You left the duel: forfeit'
        : driver.stage === 'desynced' ? 'Connection disagreement: no contest' : over ? 'Connection lost: no contest' : driver.stage !== 'fighting' ? 'Measuring the connection'
        : transport.link() === false ? 'Reconnecting…' : peerDown || driver.silent ? 'Opponent reconnecting…' : driver.session?.tooSlow ? 'Duel, connection too slow' : 'Duel, no rewards');
      if (line !== shown) { shown = line; page.say(line, line !== 'Duel, no rewards'); }
      if (over) report();
      if (driver.refused || over) { clearInterval(watch); retire(); }
      if (driver.settled && driver.practice.finish) { report(); clearInterval(watch); retire(); }
    }, 250);
  } catch (error) {
    page.say(error instanceof Error ? error.message : 'The duel could not start', true);
  }
}
