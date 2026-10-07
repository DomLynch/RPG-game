import { mirror, type Fighter } from './duel.ts';
import type { Direction } from './moves.ts';
// `?look=guard-cue` (a look test, presentation only; Brief C12 from docs/research/origins-best-in-class.md): while the opponent holds a guard, a small tick by his health bar names the
// ATTACK side that guard meets (directional guard: his `left` guard meets your `right` cut, duel.ts mirror), so the five sides can be learned without the debug overlay. It reads
// `Fighter.phase` and `guardDirection` and nothing else: no rule, no sim state, no table. Absent = today's HUD.
export const guardCueFrom = (search: string): boolean => (new URLSearchParams(search).get('look') ?? '').split(',').includes('guard-cue');
const MARK: Record<Direction, string> = { right: '\u25B6 right cut', left: '\u25C0 left cut', overhead: '\u25B2 overhead', low: '\u25BC low', thrust: '\u25CF thrust' };
/** The tick's text while he guards (the straight guard, no side chosen, covers a thrust), '' otherwise. */
export const guardCue = (f: Pick<Fighter, 'phase' | 'guardDirection'> | undefined): string => f?.phase === 'guard' ? `GUARD ${MARK[mirror(f.guardDirection ?? 'thrust')]}` : '';
