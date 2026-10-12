// Legends (Dom via Strategy, 2026-09-27): every opponent wears a name at each of the ten rungs, taken from a PUBLIC-DOMAIN source —
// myth, folklore, ancient history, pre-1900 books — and never a figure of a living religion (Strategy, 2026-09-27: dead pantheons,
// folklore, story figures and history only; Yama and Azrael were swapped for Ereshkigal and Arawn). The backstory is original prose in the arena's voice: no quotation, and nothing
// from a film, comic, game or other modern retelling. Text only; no fight number reads this.
//
// Noted exception (Dom 2026-09-28): nightborn 7 is Vlad, the historical Vlad III, over the living-nation-hero standard (.claude/skills/legends-rule).
//
// The rung is the FIGHT's level read through the ladder that already exists (grades.ts tierAt over career.ts rankFor), never a second
// mapping: a fight at level L is the rank a fighter with L − 1 wins holds, so a dial-down fight shows the legend of the level it is
// fought at. Cosmetic like grades.ts, so it stays out of the simulation boundary (roster.ts may not import it).
import { MAX_LEVEL } from './core/career-ladder.ts';
import { levelOf, tierAt } from './core/grades.ts';
import type CATALOGUE_DATA from './fight/catalogue-data.ts';
import { CATALOGUE } from './fight/catalogue-rows.ts';

export type Legend = { name: string; source: string; backstory: string };
// The legends are the catalogue's rows (src/fight/catalogue-data.ts, pure data): a new legend name is one edit there, no code. A row with ranks is a Pit opponent, listed on the Sparring tab in its `sparring.order` (Dom, layout A; not the ladder order).
type LegendRow = Extract<(typeof CATALOGUE_DATA)[number], { ranks: readonly [unknown, ...unknown[]] }>;
export type LegendOpponent = LegendRow['id'];
export const LEGEND_OPPONENTS = CATALOGUE.filter((r) => r.ranks.length > 0).sort((a, b) => a.sparring!.order - b.sparring!.order).map((r) => r.id) as readonly LegendOpponent[];

// Index 0 is tier 1 (Recruit), index 9 is tier 10 (Origin).
export const LEGENDS = Object.fromEntries(LEGEND_OPPONENTS.map((id) => [id, CATALOGUE.find((r) => r.id === id)!.ranks.map(({ name, source, backstory }): Legend => ({ name, source, backstory }))])) as unknown as Record<LegendOpponent, readonly Legend[]>;

// The legend for an opponent at a rung (1..10).
export const legendAt = (id: LegendOpponent, tier: number): Legend => LEGENDS[id][Math.min(10, Math.max(1, Math.floor(tier))) - 1]!;
// The rung (1..10) a fight at `level` (1..50, the dial) is fought at: that level's rank title on the career ladder, the one the HUD reads.
// The one source for "which legend was this": the face, the skull and a kill's Provenance.tier (Lead 2026-09-30: one win, one skull).
export const rungOf = (level: number): number => levelOf(tierAt(level - 1));
// The legend a fight at `level` shows.
export const legendForLevel = (id: LegendOpponent, level: number): Legend => legendAt(id, rungOf(level));
// The highest level (1..50) that reads as a rung, through the same mapping: the Sparring tab's Legend pick fights there (Origin = 50).
export const rungTopLevel = (rung: number): number => Array.from({ length: MAX_LEVEL }, (_, i) => MAX_LEVEL - i).find((level) => rungOf(level) === rung) ?? 1;
// The legend's painted face (Dom via Strategy, 2026-09-28, versus card B4): public/legends/<opponent>-<rung>.webp, the rung legendForLevel reads.
// A missing file is no face: the card keeps today's layout (main.ts).
export const portraitKey = (id: LegendOpponent, level: number): string => `${id}-${rungOf(level)}`;
export const portraitPath = (id: LegendOpponent, level: number): string => `legends/${portraitKey(id, level)}.webp`;
// Every face name, <opponent>-<rung 1..10>: the kill link's `?l=` (share-store shortLink) and the nginx whitelist that turns it into the
// link preview's og:image (deploy/frankendom.com.conf, pinned by tests/legend-og.test.ts). Nothing outside this list reaches the tag.
export const PORTRAIT_KEYS: readonly string[] = LEGEND_OPPONENTS.flatMap((id) => Array.from({ length: 10 }, (_, i) => `${id}-${i + 1}`));
export const isLegendOpponent = (id: string): id is LegendOpponent => (LEGEND_OPPONENTS as readonly string[]).includes(id);
