export const SHARDS: number;
export type Shard = { shard: number; of: number; pass: number | null; fail: number | null; exit: number; seconds: number; node?: string };
export type CiUnitReceipt = { kind: 'ci-unit-suite'; repo: string; run: string; sha: string; tree: string; shards: number; node: string; pass: number; fail: 0; exit: 0; seconds: number };
export function parseShard(a: { log: string; shard: number; of: number; exit: number; seconds: number }): Shard;
export function buildReceipt(a: { shards: Shard[]; sha: string; tree: string; runId: string | number; node: string; repo: string }): { ok: true; receipt: CiUnitReceipt } | { ok: false; reason: string };
export function ciUnitReceiptOk(receipt: unknown, a: { tree: string; run: { id: string | number; conclusion: string; headSha: string; path: string } | null | undefined; repo?: string }): boolean;
