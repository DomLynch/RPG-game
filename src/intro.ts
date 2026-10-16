// The first-visit intro (brief #2772, Web): four caption cards over the live arena while the camera tours the Pit. Presentation only: nothing here reads or writes the sim, the record or a fight number, so it is not part of any digest.
// Cards are rows (src/intro-defs.json: text, start tick, hold ticks, fade ticks), loaded through the shared loader (src/core/registry.ts). A tap anywhere skips; FIGHT works from second 0 (the intro is a layer, not a gate).
import { loadRegistry, tableFromFile, type Manifest } from './core/registry.ts';
import DEFS from './intro-defs.json' with { type: 'json' };
import MANIFEST from './intro-defs.manifest.json' with { type: 'json' };

export type IntroCard = { readonly id: string; readonly text: string; readonly start: number; readonly hold: number; readonly fade: number };
type IntroDefs = { cards?: readonly unknown[]; rules?: readonly { id: string; value: string }[]; layout?: readonly { id: string; value: number }[] };
/** The one loader: cards keyed by id, every field present and typed, ticks whole and the cards in time order without overlap, text non-empty. */
export function loadIntro(raw: IntroDefs): { cards: readonly IntroCard[]; seenKey: string; stripGap: number; maxLines: number; maxChars: number } {
  const tables = MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, raw as Record<string, unknown>, 'intro-defs.json'));
  loadRegistry(tables);
  const list = (raw.cards ?? []) as readonly IntroCard[];
  let end = 0;
  for (const c of list) {
    if (!c.text.trim()) throw Error(`intro card "${c.id}": text is not empty`);
    for (const n of [c.start, c.hold, c.fade]) if (!Number.isInteger(n) || n < 0) throw Error(`intro card "${c.id}": start, hold and fade are whole ticks >= 0`);
    if (c.start < end) throw Error(`intro card "${c.id}": starts before the previous card has faded out`);
    end = c.start + c.fade + c.hold + c.fade;
  }
  const seenKey = (raw.rules ?? []).find((r) => r.id === 'seenKey')?.value;
  const layoutRow = (id: string) => (raw.layout ?? []).find((r) => r.id === id)?.value, stripGap = layoutRow('stripGap'), maxLines = layoutRow('maxLines'), maxChars = layoutRow('maxChars');
  if (!list.length || !seenKey || stripGap === undefined || !(stripGap >= 0) || !Number.isInteger(maxLines) || maxLines! < 1 || !Number.isInteger(maxChars) || maxChars! < 1) throw Error('intro: needs at least one card, the seenKey rule, and the stripGap (>= 0), maxLines and maxChars (whole numbers >= 1) layout rows');
  for (const c of list) if (c.text.length > maxChars!) throw Error(`intro card "${c.id}": ${c.text.length} characters, over the ${maxChars} that fit maxLines (${maxLines}) at a 320 phone (scripts/intro-stills.mjs measures the budget)`);
  return { cards: list, seenKey, stripGap, maxLines: maxLines!, maxChars: maxChars! };
}
export const INTRO = loadIntro(DEFS);
/** Opacity 0..1 of a card at a tick: fade in, hold, fade out. */
export function cardAlpha(c: IntroCard, tick: number): number {
  const t = tick - c.start;
  if (t < 0 || t >= c.fade + c.hold + c.fade) return 0;
  if (t < c.fade) return c.fade ? t / c.fade : 1;
  if (t < c.fade + c.hold) return 1;
  return c.fade ? 1 - (t - c.fade - c.hold) / c.fade : 0;
}
/** The card showing at a tick (the one with any opacity), or null between cards. */
export const cardAt = (tick: number, cards: readonly IntroCard[] = INTRO.cards): IntroCard | null => cards.find((c) => cardAlpha(c, tick) > 0) ?? null;
/** The tick the last card is fully gone: the intro ends itself here. */
export const introEnd = (cards: readonly IntroCard[] = INTRO.cards): number => Math.max(...cards.map((c) => c.start + c.fade + c.hold + c.fade));
/** Once per device, a layer only for a fresh guest: never a return visit (a saved fighter), never a kill-link or replay visit, never once seen. Blocked storage reads as empty, so an unreadable flag shows it (once per page load at worst). */
export function shouldShowIntro(v: { seen: boolean; returning: boolean; link: boolean }): boolean { return !v.seen && !v.returning && !v.link; }
