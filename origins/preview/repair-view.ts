// What the smith screen shows, as data (wear & repair part 2, Web): one line per WORN piece the writer lists (gear_wear), with the writer's quote. Pure: no DOM, clock or network. The numbers are the writer's: durability is
// `max - worn` of `max`, the quote is what gear_repair will charge (the same rows, priced server side); nothing here computes a cost. A piece the writer does not list is unworn and has no line. Words are repair-text.json.
import TEXT from './repair-text.json' with { type: 'json' };
import type { WearLine } from './repair-net.ts';

export type RepairLine = { instance: string; slot: string; durabilityText: string; fraction: number; shrunkText: string; quoteText: string; metalItem: string };
const { chrome: CHROME } = TEXT;
const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
export const chromeText = (key: keyof typeof CHROME, values: Record<string, string | number> = {}): string => fill(CHROME[key], values);

export const repairLines = (pieces: readonly WearLine[], nameOf: (item: string) => string): RepairLine[] => pieces.map((p) => ({
  instance: p.instance, slot: p.slot, durabilityText: chromeText('durability', { left: p.max - p.worn, max: p.max }), fraction: p.max > 0 ? Math.min(1, Math.max(0, (p.max - p.worn) / p.max)) : 0,
  shrunkText: p.max < p.baseMax ? chromeText('shrunk', { base: p.baseMax }) : '', quoteText: chromeText('quote', { bronze: p.quote.bronze, qty: p.quote.metal.qty, item: nameOf(p.quote.metal.item) }), metalItem: p.quote.metal.item,
}));
