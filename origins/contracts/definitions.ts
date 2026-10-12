// The contract vocabularies that are DATA, as rows (origins/contracts/definitions.json, manifest beside it, loaded and checked by the shared registry loader): the gates, the character relations, the quest roles,
// the attitudes and the quest scopes. A new one is a row. Ids are strings checked against the rows (an unknown id still rejects in readEnum), never a TypeScript union. What stays CODE is every list whose value
// selects its own code path: ENCOUNTER_SCOPES (world.ts), STAGE_KINDS, CONDITION_KINDS and QUEST_STATUSES (story.ts).
import defs from './definitions.json' with { type: 'json' };

export type GateRow = { order: number; tier: string; open?: boolean; membership?: boolean };   // open: no standing is asked; membership: the realm needs a paid membership
export type AttitudeRow = { order: number; atOrBelow?: number; atOrAbove?: number; expelledCeiling?: boolean };   // a band: standing at or below / at or above; neither = the default between the bands; expelledCeiling: the best an expelled member can be
export const DEFINITIONS = defs as unknown as { gates: Readonly<Record<string, GateRow>>; relations: Readonly<Record<string, object>>; questRoles: Readonly<Record<string, object>>; attitudes: Readonly<Record<string, AttitudeRow>>; questScopes: Readonly<Record<string, object>> };
export const ids = (table: Readonly<Record<string, { order?: number }>>): string[] => Object.entries(table).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)).map(([id]) => id);   // by `order` when the rows have one, else file order
