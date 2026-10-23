// Alternate backdrop plates (a look test, preview only): a look row may name a plate file to draw in place of another (the Inkverse look's ink-painted plates). Empty unless a look sets it, so the page draws every plate as it does today.
// horizon-dome.ts asks `plateFile(file)` where it loads a plate and falls back to the original file when the alternate cannot be fetched.
const SWAPS = new Map<string, string>();
export const setPlateSwaps = (list: readonly { readonly from: string; readonly to: string }[]): void => { SWAPS.clear(); for (const { from, to } of list) SWAPS.set(from, to); };
/** The file to draw for a plate: its swap, or itself. */
export const plateFile = (file: string): string => SWAPS.get(file) ?? file;
