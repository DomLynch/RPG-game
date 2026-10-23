// Inkverse comic framing (Dom 2026-10-23, a look test beside inkverse.ts): the 2D layer a comic page has and the 3D pass cannot give: an ink splatter vignette at the screen edges, a light halftone dot screen, and a panel border that drops in when a fight starts.
// `?ink=<row id>` only: main.ts imports this file when the flag is present, so flag absent = nothing is fetched, no node is added and the page is today's. Every number is a row of inkverse-comic.json (loaded through the registry like inkverse.json).
// DOM over the canvas, under the HUD (the HUD is z-index 1, this layer 0), pointer-events none, so the HUD and the tap targets are never touched and the ink pass never sees it. The vignette and the border are drawn ONCE into canvases (and again on a resize): no per-frame work. The halftone is one static CSS layer.
// Not drawn yet: `hitSplash` (the ink flash on a hit) is a wired row with `on` 0.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './inkverse-comic.manifest.json' with { type: 'json' };
import ROWS from './inkverse-comic.json' with { type: 'json' };

type Rgb = readonly [number, number, number];
export type InkComic = {
  readonly id: string;
  readonly layerZ: number;
  readonly vignette: { readonly on: number; readonly bandPct: number; readonly gradientAlpha: number; readonly blobs: number; readonly blobMinPct: number; readonly blobMaxPct: number; readonly spikes: number; readonly jitter: number; readonly seed: number; readonly opacity: number; readonly texturePx: number; readonly ink: Rgb };
  readonly halftone: { readonly on: number; readonly cellPx: number; readonly dotPct: number; readonly angleDeg: number; readonly opacity: number; readonly blend: string; readonly ink: Rgb };
  readonly panel: { readonly on: number; readonly thicknessPx: number; readonly raggedPx: number; readonly steps: number; readonly seed: number; readonly fadeInMs: number; readonly fadeOutMs: number; readonly opacity: number; readonly fightClass: string; readonly ink: Rgb };
  readonly hitSplash: { readonly on: number; readonly count: number; readonly sizePct: number; readonly holdMs: number; readonly seed: number; readonly ink: Rgb };
};

const num = (id: string, what: string, v: unknown): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`ink comic "${id}": ${what} is a number`); return v; };
const rgb = (id: string, what: string, v: unknown): Rgb => { if (!Array.isArray(v) || v.length !== 3) throw new Error(`ink comic "${id}": ${what} is [r, g, b]`); return [num(id, what, v[0]), num(id, what, v[1]), num(id, what, v[2])]; };
const group = (id: string, what: string, v: unknown, keys: readonly string[]): Record<string, number> => {
  const g = v as Record<string, unknown> | undefined; if (!g || typeof g !== 'object') throw new Error(`ink comic "${id}": ${what} is an object`);
  return Object.fromEntries(keys.map((k) => [k, num(id, `${what}.${k}`, g[k])]));
};

/** The one loader: the registry's duplicate / missing checks, then the row rules the manifest cannot say (every number a number, every colour three channels, the blend and the fight class named). */
export function loadInkComics(raw: unknown): ReadonlyMap<string, InkComic> {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'inkverse-comic.json');
  loadRegistry([table]);
  const out = new Map<string, InkComic>();
  for (const { id, fields } of table.rows as unknown as { id: string; fields: Record<string, unknown> }[]) {
    const vig = fields.vignette as Record<string, unknown> | undefined, ht = fields.halftone as Record<string, unknown> | undefined, pn = fields.panel as Record<string, unknown> | undefined, hs = fields.hitSplash as Record<string, unknown> | undefined;
    const numbers = <K extends string>(what: string, v: unknown, keys: readonly K[]) => group(id, what, v, keys) as Record<K, number>;
    const vignette = { ...numbers('vignette', vig, ['on', 'bandPct', 'gradientAlpha', 'blobs', 'blobMinPct', 'blobMaxPct', 'spikes', 'jitter', 'seed', 'opacity', 'texturePx']), ink: rgb(id, 'vignette.ink', vig?.ink) };
    const halftone = { ...numbers('halftone', ht, ['on', 'cellPx', 'dotPct', 'angleDeg', 'opacity']), blend: ht?.blend, ink: rgb(id, 'halftone.ink', ht?.ink) };
    const panel = { ...numbers('panel', pn, ['on', 'thicknessPx', 'raggedPx', 'steps', 'seed', 'fadeInMs', 'fadeOutMs', 'opacity']), fightClass: pn?.fightClass, ink: rgb(id, 'panel.ink', pn?.ink) };
    const hitSplash = { ...numbers('hitSplash', hs, ['on', 'count', 'sizePct', 'holdMs', 'seed']), ink: rgb(id, 'hitSplash.ink', hs?.ink) };
    if (typeof halftone.blend !== 'string' || !halftone.blend) throw new Error(`ink comic "${id}": halftone.blend names a CSS blend mode`);
    if (typeof panel.fightClass !== 'string' || !panel.fightClass) throw new Error(`ink comic "${id}": panel.fightClass names the body class`);
    if (vignette.blobMinPct > vignette.blobMaxPct) throw new Error(`ink comic "${id}": vignette.blobMinPct is at most blobMaxPct`);
    out.set(id, { id, layerZ: num(id, 'layerZ', fields.layerZ), vignette: vignette as InkComic['vignette'], halftone: halftone as InkComic['halftone'], panel: panel as InkComic['panel'], hitSplash: hitSplash as InkComic['hitSplash'] });
  }
  return out;
}

const COMICS = loadInkComics(ROWS);
export const inkComic = (id: string | null): InkComic | null => (id ? COMICS.get(id) ?? null : null);

type Pt = readonly [number, number];
/** A seeded stream (mulberry32): the same row draws the same ink every time, so a still is repeatable. */
export function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The vignette's blots: centres inside the edge band only, each a ragged star polygon, in canvas pixels. */
export function vignetteBlobs(v: InkComic['vignette'], w: number, h: number): { cx: number; cy: number; pts: Pt[] }[] {
  const rnd = stream(v.seed), short = Math.min(w, h), band = (v.bandPct / 100) * short, out: { cx: number; cy: number; pts: Pt[] }[] = [];
  for (let i = 0; i < v.blobs; i++) {
    const edge = Math.floor(rnd() * 4), along = rnd(), depth = rnd() * band;
    const cx = edge === 0 ? along * w : edge === 1 ? w - depth : edge === 2 ? along * w : depth;
    const cy = edge === 0 ? depth : edge === 1 ? along * h : edge === 2 ? h - depth : along * h;
    const r = ((v.blobMinPct + rnd() * (v.blobMaxPct - v.blobMinPct)) / 100) * short, pts: Pt[] = [];
    for (let k = 0; k < v.spikes; k++) { const ang = (k / v.spikes) * Math.PI * 2, rr = r * (1 + (rnd() - 0.5) * 2 * v.jitter); pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]); }
    out.push({ cx, cy, pts });
  }
  return out;
}

/** The panel border's inner edge: a closed ragged loop inset by the thickness, `steps` points around the rectangle, in canvas pixels. */
export function panelInner(p: InkComic['panel'], w: number, h: number): Pt[] {
  const rnd = stream(p.seed), t = p.thicknessPx, iw = w - 2 * t, ih = h - 2 * t, perim = 2 * (iw + ih), pts: Pt[] = [];
  for (let i = 0; i < p.steps; i++) {
    let d = (i / p.steps) * perim; const inset = t + rnd() * p.raggedPx;   // along the inner rectangle (the thickness in from every side), each point pushed a random extra distance inward
    if (d < iw) { pts.push([t + d, inset]); continue; }
    d -= iw; if (d < ih) { pts.push([w - inset, t + d]); continue; }
    d -= ih; if (d < iw) { pts.push([w - t - d, h - inset]); continue; }
    d -= iw; pts.push([inset, h - t - d]);
  }
  return pts;
}

const css = (c: Rgb, a = 1): string => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const sizeCanvas = (cv: HTMLCanvasElement, texW: number): { w: number; h: number } => { const w = Math.max(1, Math.round(texW)), h = Math.max(1, Math.round((texW * innerHeight) / Math.max(1, innerWidth))); cv.width = w; cv.height = h; return { w, h }; };

function drawVignette(cv: HTMLCanvasElement, v: InkComic['vignette']): void {
  const { w, h } = sizeCanvas(cv, v.texturePx), g = cv.getContext('2d'); if (!g) return;
  g.clearRect(0, 0, w, h);
  const band = (v.bandPct / 100) * Math.min(w, h), edges: [number, number, number, number][] = [[0, 0, 0, band], [w, 0, w - band, 0], [0, h, 0, h - band], [0, 0, band, 0]];
  for (const [x0, y0, x1, y1] of edges) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, css(v.ink, v.gradientAlpha)); gr.addColorStop(1, css(v.ink, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.fillStyle = css(v.ink, 1);
  for (const b of vignetteBlobs(v, w, h)) { g.beginPath(); b.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
}

function drawPanel(cv: HTMLCanvasElement, p: InkComic['panel']): void {
  const { w, h } = sizeCanvas(cv, innerWidth), g = cv.getContext('2d'); if (!g) return;
  g.clearRect(0, 0, w, h); g.fillStyle = css(p.ink, 1); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); panelInner(p, w, h).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over';
}

/** Mounts the layer for row `id` (null or unknown = nothing). Returns the unmount. */
export function mountComic(id: string | null): (() => void) | null {
  const row = inkComic(id); if (!row || typeof document === 'undefined') return null;
  const root = document.createElement('div'); root.id = 'ink-comic'; root.setAttribute('aria-hidden', 'true');
  root.style.cssText = `position:fixed;inset:0;z-index:${row.layerZ};pointer-events:none;overflow:hidden`;
  const layer = (el: HTMLElement, extra: string): HTMLElement => { el.style.cssText = `position:absolute;${extra}`; root.append(el); return el; };
  let vig: HTMLCanvasElement | null = null, pan: HTMLCanvasElement | null = null;
  if (row.vignette.on) { vig = document.createElement('canvas'); layer(vig, `inset:0;width:100%;height:100%;opacity:${row.vignette.opacity}`); }
  if (row.halftone.on) { const h = row.halftone; layer(document.createElement('div'), `inset:-50%;transform:rotate(${h.angleDeg}deg);opacity:${h.opacity};mix-blend-mode:${h.blend};background-image:radial-gradient(circle at center,${css(h.ink)} ${h.dotPct}%,transparent ${h.dotPct + 1}%);background-size:${h.cellPx}px ${h.cellPx}px`); }
  if (row.panel.on) { pan = document.createElement('canvas'); layer(pan, `inset:0;width:100%;height:100%;opacity:0;transition:opacity ${row.panel.fadeOutMs}ms ease-out`); }
  const redraw = (): void => { if (vig) drawVignette(vig, row.vignette); if (pan) drawPanel(pan, row.panel); };
  redraw();
  let timer = 0; const onResize = (): void => { clearTimeout(timer); timer = window.setTimeout(redraw, 150); }; addEventListener('resize', onResize);
  const fight = (): void => { if (!pan) return; const on = document.body.classList.contains(row.panel.fightClass); pan.style.transition = `opacity ${on ? row.panel.fadeInMs : row.panel.fadeOutMs}ms ease-out`; pan.style.opacity = on ? `${row.panel.opacity}` : '0'; };
  const mo = new MutationObserver(fight); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); fight();
  (document.getElementById('view') ?? document.body.firstChild)?.after(root);
  return () => { mo.disconnect(); removeEventListener('resize', onResize); clearTimeout(timer); root.remove(); };
}
