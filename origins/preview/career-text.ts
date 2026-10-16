// The HUD's career line ("Level 16 · 3 / 100 CP"). In Zone 1 (?region=1) the world fight is a bare body until the character sheet is applied in it (Strategy 2026-10-16), so the
// level there is labelled as the career's, not the fighter's: it must not promise a body the hero does not fight with. Remove the `world` branch (and `levelWorld` in
// career-text.json) when Combat's sheet-in-world PR lands. The label is a row; nothing here is a number of its own.
import TEXT from './career-text.json' with { type: 'json' };
import type { CareerLine } from '../pit/pit.ts';

export function careerHud(c: Pick<CareerLine, 'level' | 'top' | 'credit' | 'into' | 'need'>, previewCp: number, world: boolean): string {
  const level = (world ? TEXT.line.levelWorld : TEXT.line.level).replace('{level}', String(c.level));
  return `${level} · ${c.top ? `${c.credit} CP` : `${c.into} / ${c.need} CP`}${previewCp ? ` · +${previewCp} CP (preview)` : ''}`;
}
