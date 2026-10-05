// Adapted in idea from levy-street/world-of-claudecraft src/net/reconnect_policy.ts (MIT; notice in public/licenses/world-of-claudecraft.txt):
// which relay closes are final and which are a blip worth retrying. The relay (scripts/duel-relay.mjs) closes a socket for good with
// 4001 (token expired), 4008 (message or byte rate), 1002 (malformed frame), 1003 (bad frame type), 1009 (too big). Retrying those only
// burns the reconnect window (a rate-closed page would hammer the relay), so the page's silence rules take over at once. Everything else
// (a network switch, a relay restart, an idle close) is retried with backoff.
const FINAL_CLOSE_CODES: ReadonlySet<number> = new Set([4001, 4008, 1002, 1003, 1009]);
export const isFinalClose = (code: unknown): boolean => typeof code === 'number' && FINAL_CLOSE_CODES.has(code);
