// Tick-time statistics for the presence load test (docs/specs/origins/s1-load-test.md §4: longest tick < 50 ms AND p99 < 25 ms). Pure, so the test can pin the rank rule.
// Nearest rank: the p-th percentile of n samples is the sample at rank ceil(p/100 * n) of the ascending order. Null for no samples.
export function percentile(samples: readonly number[], p: number): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(p / 100 * sorted.length))) - 1]!;
}
export const tickStats = (samples: readonly number[]): { n: number; p50: number | null; p99: number | null; max: number | null } =>
  ({ n: samples.length, p50: percentile(samples, 50), p99: percentile(samples, 99), max: samples.length ? Math.max(...samples) : null });
