// The creature info card (Top-10 #9, mobs.md section 1: the tap card): how dangerous a creature is to YOU, how common its kind is, how many travel
// together. Everything is derived: danger from the level gap through the progression model's own payout ladder (so the colour and the payout can
// never disagree), commonness from the row's weight against the rows of its zone, the group from the row's camp size. Nothing here is hand-authored
// per creature. Pure: no DOM, no clock. The card is a view of this (origins/preview/creature-card.ts).
import { falloffPermille } from '../career-model.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../registry.ts';
import { DEFAULTS, type MobRow } from './row.ts';
import ROWS from './info-bands.json' with { type: 'json' };
import MANIFEST from './info-bands.manifest.json' with { type: 'json' };

export type Band = { id: string; permille: number; label: string; color: string };
// The seven bands in order, one per distinct falloffPermille value (mobs.md 1.2); index = the con ring's dash count (grey 0 ... red 6).
// The bands and the commonness steps are rows (info-bands.json + manifest; Dom's data-layer rule 2026-10-13; tests/info-bands-rows.test.ts pins them to the literals they replaced).
loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, ROWS, 'info-bands.json'), tableFromFile(MANIFEST.tables[1] as unknown as Manifest, ROWS, 'info-bands.json')]);
export const BANDS: readonly Band[] = ROWS.bands;
// An unknown permille rounds down to the nearest listed band (a retuned ladder moves the colours with it, never a copied gap table).
export const conBand = (permille: number): number => BANDS.reduce((best, b, i) => (permille >= b.permille ? i : best), 0);
export const bandOf = (creatureLevel: number, heroLevel: number): number => conBand(falloffPermille(creatureLevel - heroLevel));

// How common a kind is: its weight's share of the weights of the zone's generated kinds. [min share, label], highest first.
export const COMMON_STEPS: readonly (readonly [number, string])[] = ROWS.commonSteps.map((s) => [s.min, s.label] as const);
export function commonOf(row: MobRow | undefined, rows: readonly MobRow[]): string {
  if (!row || row.named) return 'Unique';
  const pool = rows.filter((r) => !r.named && !r.later), total = pool.reduce((n, r) => n + (r.weight ?? DEFAULTS.weight), 0);
  const share = total > 0 ? (row.weight ?? DEFAULTS.weight) / total : 0;
  return COMMON_STEPS.find(([min]) => share >= min)![1];
}

// The group: the row's camp size (min..max members), never a constant (the cap is the validator's: row.ts CAMP_MAX).
export function groupOf(row: MobRow | undefined): string {
  if (!row || row.named) return 'Alone';
  const [lo, hi] = row.behaviour.campSize ?? DEFAULTS.campSize;
  return hi <= 1 ? 'Alone' : lo === hi ? `Packs of ${hi}` : `Packs of ${lo} to ${hi}`;
}

export type CreatureInfo = { name: string; level: number; band: number; color: string; danger: string; common: string; group: string };
export function creatureInfo(spec: { name: string; level: number }, row: MobRow | undefined, heroLevel: number, rows: readonly MobRow[]): CreatureInfo {
  const band = bandOf(spec.level, heroLevel), b = BANDS[band]!;
  return { name: spec.name, level: spec.level, band, color: b.color, danger: b.label, common: commonOf(row, rows), group: groupOf(row) };
}
