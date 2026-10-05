// WCAG relative luminance and contrast ratio of two sRGB colours (#rrggbb or [r,g,b] 0-255): the painted walls' text is pinned to a floor against its ground.
export type Rgb = readonly [number, number, number];
export const rgbOf = (c: string | Rgb): Rgb => (typeof c === 'string' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as unknown as Rgb : c);
export const luminance = (c: string | Rgb): number => { const [r, g, b] = rgbOf(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }) as [number, number, number]; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string | Rgb, b: string | Rgb): number => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
