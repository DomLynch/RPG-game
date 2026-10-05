// Adapted from levy-street/world-of-claudecraft src/net/backoff.ts (MIT; notice in public/licenses/world-of-claudecraft.txt).
// Full-jitter reconnect delay over an exponential schedule: step = min(maxMs, baseMs * 2 ** (attempt - 1)), spread across 0.5x..1.5x and
// clamped to maxMs, so pages dropped by the same relay restart do not all retry on one beat. Strictly positive for attempt >= 1, baseMs > 0.
// `rng` is injected (Math.random in play) so a test can pin the schedule; no clock, no global randomness here.
export function computeBackoffDelay(attempt: number, baseMs: number, maxMs: number, rng: () => number): number {
  return Math.min(maxMs, Math.min(maxMs, baseMs * 2 ** (attempt - 1)) * (0.5 + rng()));
}
