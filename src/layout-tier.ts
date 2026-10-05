// The HUD layout tier: compact, standard or tablet, from the viewport alone. Pure; main.ts writes it to <html data-tier> on load, resize and
// rotation so CSS and the checks can key off one word instead of repeating width/height queries. Ported in shape from levy-street/world-of-claudecraft
// src/ui/mobile_hud_layout.ts @f46f30f, MIT (Copyright (c) 2026 Levy Street; same notice as touch-router.ts, full text at
// https://github.com/levy-street/world-of-claudecraft/blob/f46f30f/LICENSE). Thresholds are named, not magic; the numbers are that file's, checked against
// this game's viewports (390x694 Dom's phone, 375x812, 844x390 landscape, 1280x720 laptop, 1024x768 iPad).
export const COMPACT_MAX_HEIGHT_PX = 480;
export const COMPACT_MAX_WIDTH_PX = 700;
export const TABLET_MIN_DIMENSION_PX = 768;
export const TABLET_MIN_WIDTH_PX = 1000;
export const TABLET_MAX_WIDTH_PX = 1024;   // Lead 2026-10-06: a tablet is at most 1024 wide, so a 1366x768 laptop and a desktop stay standard

export type LayoutTier = 'compact' | 'standard' | 'tablet';

/** compact: a narrow window (every portrait phone) or a short one (every landscape phone); tablet: 768+ on the short side and 1000-1024 wide (an iPad landscape); else standard. */
export function layoutTier(width: number, height: number): LayoutTier {
  if (!(width > 0) || !(height > 0)) return 'standard';   // no viewport yet (a headless boot): the baseline
  if (width <= COMPACT_MAX_WIDTH_PX || height <= COMPACT_MAX_HEIGHT_PX) return 'compact';
  if (Math.min(width, height) >= TABLET_MIN_DIMENSION_PX && width >= TABLET_MIN_WIDTH_PX && width <= TABLET_MAX_WIDTH_PX) return 'tablet';
  return 'standard';
}
