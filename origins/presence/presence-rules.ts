// The presence server's limits as data (World, Dom's data-layer day 2026-10-14): layers and interest management, the per-socket and per-IP limits, the tick history, the town square's side and
// where a rejoin from a trade area lands, one row each (id, value, unit) through the shared loader (src/core/registry.ts). Every default equals the literal it replaced (tests/presence-rules.test.ts
// pins them). Presence is a node server: no sim file reads this, so it is NOT part of the world digest. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './presence-rules-defs.json' with { type: 'json' };
import MANIFEST from './presence-rules-defs.manifest.json' with { type: 'json' };

export type PresenceRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['cellCm', 'radiusCm', 'nearCap', 'tier1Cm', 'tier1Every', 'tier2Cm', 'tier2Every', 'tier3Cm', 'tier3Every', 'tickMs', 'softCap', 'hardCap', 'maxSpeedCmS', 'speedSlack', 'strikesToDrop', 'strikeWindowMs', 'emptyLayerMs', 'memoryMs', 'memoryMax', 'maxMessage', 'perSecond', 'idleMs', 'ipSockets', 'ipJoinsPerMinute', 'beatMs', 'tickRing', 'townSideCm', 'rejoinPastGateCm', 'warpPerMin', 'guestIpSockets', 'guestCeiling', 'wornEveryMs', 'closeGraceMs', 'wornPokeGapMs'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every rule the server reads by name must exist, with a positive value. */
export function loadPresenceRules(raw: { rules?: readonly unknown[] }): readonly PresenceRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'presence-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly PresenceRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`presence-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`presence-rules: the server reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const PRESENCE_RULES: readonly PresenceRule[] = loadPresenceRules(DEFS);
export const presenceRule = (id: (typeof NAMED)[number]): number => PRESENCE_RULES.find((r) => r.id === id)!.value;
/** The interest-management rules, one row each (the per-line notes are the planning figures from docs/specs/origins/one-shard.md). */
export const interestRules = () => {
  const r = presenceRule;
  return {
    cellCm: r('cellCm'),                  // 16 m grid cells
    radiusCm: r('radiusCm'),                // visual radius 40 m
    nearCap: r('nearCap'),                   // nearest-first cap on other characters drawn at once
    tiers: [[r('tier1Cm'), r('tier1Every')], [r('tier2Cm'), r('tier2Every')], [r('tier3Cm'), r('tier3Every')]] as const,   // [distance cm, send every N ticks]: 10 Hz under 12 m, 5 Hz to 25 m, 2 Hz to 40 m
    tickMs: r('tickMs'),
    softCap: r('softCap'),                   // a layer accepts joins until here, then arrivals go to another layer
    hardCap: r('hardCap'),                  // the rare friend-join may fill to here
    maxSpeedCmS: r('maxSpeedCmS'),                // about 7 m/s, set from the sprint speed
    speedSlack: r('speedSlack'),
    strikesToDrop: r('strikesToDrop'),
    strikeWindowMs: r('strikeWindowMs'),
    emptyLayerMs: r('emptyLayerMs'),
    memoryMs: r('memoryMs'),         // a leaver's last server-observed position is kept this long for a reconnect (X2 stage 1; the saved location of stage 2 supersedes it)
    memoryMax: r('memoryMax'),             // accounts remembered at once, oldest dropped first
  };
};
