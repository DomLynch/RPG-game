// Dynamic respawn inside a layer (docs/specs/origins/per-layer-spawns.md section 4c, 6 step 5; Dom 2026-10-19: about 30 kills an hour per hunter). A layer with more than `playersFull` players respawns its
// creatures faster, in proportion, so per-player supply stays flat as a layer fills; never below `floorS` (about one fight) and never above the creature's own row. Rows: server-rules.json `dynamicRespawn`.
// Pure: the writer asks presence how many players the layer holds (GET /internal/layers) and passes the count; no count (presence unreachable, an older presence, an unknown layer) is the row's own respawn.
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const RULE = SERVER_RULES.dynamicRespawn[0]!;
export type DynamicRespawnRule = { playersFull: number; floorS: number };

/** The respawn, in seconds, of a creature whose row says `baseS`, in a layer holding `players` right now. */
export function dynamicRespawnS(baseS: number, players: number | undefined, rule: DynamicRespawnRule = RULE): number {
  if (players === undefined || !Number.isFinite(players) || players <= rule.playersFull) return baseS;
  const scaled = Math.round(baseS * rule.playersFull / players);
  return Math.min(baseS, Math.max(rule.floorS, scaled));
}
