// Zone 1's combat camera (Dom 2026-10-17: in a fight the thumb buttons hide the hero and the foe is too close): the WIDE auto-fit framing, Strategy's pick from the sandbox's three looks (option 2 at rev 48da550): both
// fighters whole, the gaze at the midpoint between them, the picture lifted off the thumb buttons, a speed limit on the fit so a lunging foe does not pump the camera, a floor so the camera never comes into the foe and a cap
// past which it rises instead of backing into the wall. Every number is a row (preview-rules-defs.json, camP* for a phone held upright, camL* held wide, camEase*); this file only reads them into the shape follow-camera.ts takes.
// Walking is untouched: the follow camera eases into this framing when the hero is in a fight and out again, slower, when it ends.
import type { CombatCam, CombatFraming } from '../../src/fight/index.ts';
import { previewRule } from './preview-rules.ts';

const portrait = (): CombatFraming => ({
  back: previewRule('camPBack'), up: previewRule('camPUp'), ahead: previewRule('camPAhead'), lookY: previewRule('camPLookY'), mid: previewRule('camPMid'), perSep: previewRule('camPPerSep'), perSize: previewRule('camPPerSize'),
  sizeFrom: previewRule('camPSizeFrom'), fitRate: previewRule('camPFitRate'), minBack: previewRule('camPMinBack'), maxBack: previewRule('camPMaxBack'), shiftY: previewRule('camPShiftY'),
});
const landscape = (): CombatFraming => ({
  back: previewRule('camLBack'), up: previewRule('camLUp'), ahead: previewRule('camLAhead'), lookY: previewRule('camLLookY'), mid: previewRule('camLMid'), perSep: previewRule('camLPerSep'), perSize: previewRule('camLPerSize'),
  sizeFrom: previewRule('camLSizeFrom'), fitRate: previewRule('camLFitRate'), minBack: previewRule('camLMinBack'), maxBack: previewRule('camLMaxBack'), shiftY: previewRule('camLShiftY'), zoom: previewRule('camLZoom'),
});

/** The wide auto-fit combat camera as the rows say it. */
export const wideCombatCam = (): CombatCam => ({ label: 'Wide auto-fit', ease: { in: previewRule('camEaseIn'), out: previewRule('camEaseOut') }, portrait: portrait(), landscape: landscape() });
