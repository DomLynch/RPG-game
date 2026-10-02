import type { OpponentId } from './roster.ts';

// Approved identities only; no activation or fight rules. #1271 assigns Weapons' A/B
// to ranks 1–3/4–7. Seven Cuts is the selected Nightborn B; his A is unresolved.
const CLASS_SPECIALS = {
  witch: ['wake', 'stirring'],
  plaguedoctor: ['tempo', 'pulse'],
  knight: ['drag', 'swing'],
  nightborn: [null, 'cuts'],
} as const satisfies Partial<Record<OpponentId, readonly [string | null, string | null]>>;

export type ClassSpecialId = Exclude<typeof CLASS_SPECIALS[keyof typeof CLASS_SPECIALS][number], null>;

// The supplied fight level belongs to this actor, independently of HUD rank or side.
// Boss ranks (levels 36+) use a separate identity bridge; unknown choices stay unknown.
export function classSpecialFor(opponent: OpponentId, level: number): ClassSpecialId | null {
  if (!Number.isInteger(level) || level < 1 || level >= 36) return null;
  const slots = (CLASS_SPECIALS as Partial<Record<OpponentId, readonly [ClassSpecialId | null, ClassSpecialId | null]>>)[opponent];
  return slots?.[level < 16 ? 0 : 1] ?? null;
}
