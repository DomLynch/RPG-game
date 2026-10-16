// The first-visit intro on the page (brief #2772, Web): the caption strip over the live arena, tap-anywhere-to-skip, the once-per-device flag. Presentation and input only: the cards, timings and the show rule are src/intro.ts (rows), the
// camera tour is World's `introTour` (injected, so this file lands before and without it). No sim file reads anything here. A tap is seen, never swallowed: FIGHT works from second 0 and a press on it also ends the intro.
import { INTRO, cardAlpha, cardAt, introEnd, shouldShowIntro } from './intro.ts';

export type IntroTour = { start(): void; stop(): void };
type Doc = Pick<Document, 'createElement' | 'addEventListener' | 'removeEventListener'>;
export type IntroDeps = { doc: Doc; parent: HTMLElement; storage: { getItem(k: string): string | null; setItem(k: string, v: string): void }; returning: boolean; link: boolean; tour?: IntroTour; ticksPerSecond?: number; controlsTop?: () => number | null };   // controlsTop: the top edge (px from the viewport top) of the touch control cluster, so the strip never covers a button; null when there is none (desktop)

export function createIntro(d: IntroDeps) {
  const flag = () => { try { return d.storage.getItem(INTRO.seenKey) === '1'; } catch { return false; } };
  let strip: HTMLElement | null = null, ticks = 0;
  const tps = d.ticksPerSecond ?? 60;
  const skip = () => end();
  function end() {
    if (!strip) return;
    d.doc.removeEventListener('pointerdown', skip, true); strip.remove(); strip = null; d.tour?.stop();
  }
  if (shouldShowIntro({ seen: flag(), returning: d.returning, link: d.link })) {
    strip = d.parent.ownerDocument.createElement('p'); strip.className = 'intro-caption'; strip.setAttribute('aria-live', 'polite'); strip.style.opacity = '0'; d.parent.append(strip);
    try { d.storage.setItem(INTRO.seenKey, '1'); } catch { /* blocked storage: it shows again next load, once per page at worst */ }   // set at the start: a reload mid-intro does not repeat it
    d.doc.addEventListener('pointerdown', skip, true);   // capture, no stopPropagation: the tap still reaches whatever it hit
    d.tour?.start();
  }
  return {
    get active() { return strip !== null; },
    /** Advance by wall-clock seconds (the intro is presentation: its clock is not the fight tick) and paint the card showing. */
    update(dt: number) {
      if (!strip) return;
      const top = d.controlsTop?.() ?? null; if (top !== null) strip.style.bottom = `${Math.max(0, d.parent.ownerDocument.documentElement.clientHeight - top + INTRO.stripGap)}px`;   // its bottom edge sits stripGap above the controls
      ticks += dt * tps;
      if (ticks >= introEnd()) return end();
      const card = cardAt(ticks); strip.textContent = card?.text ?? ''; strip.style.opacity = card ? String(cardAlpha(card, ticks)) : '0';
    },
    skip,
  };
}
