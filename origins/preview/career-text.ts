// The HUD's career line ("Level 16 · 3 / 100 CP"). In Zone 1 (?region=1) the level is labelled as the career's, not the fighter's ("Career Level N"): the world fight can
// be a bare body (before the character sheet is applied, or when the sheet writer is dead and the 15 s fallback runs, #2900), and a plain "Level N" would promise a body the
// hero does not fight with. PERMANENT (Lead, 2026-10-16): do not remove the `world` branch or `levelWorld` in career-text.json when the sheet-in-world PR lands. The label is a row; nothing here is a number of its own.
import TEXT from './career-text.json' with { type: 'json' };
import type { CareerLine } from '../pit/pit.ts';

export function careerHud(c: Pick<CareerLine, 'level' | 'top' | 'credit' | 'into' | 'need'>, previewCp: number, world: boolean): string {
  const level = (world ? TEXT.line.levelWorld : TEXT.line.level).replace('{level}', String(c.level));
  return `${level} · ${c.top ? `${c.credit} CP` : `${c.into} / ${c.need} CP`}${previewCp ? ` · +${previewCp} CP (preview)` : ''}`;
}
