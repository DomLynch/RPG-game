// The record board (Dom 2026-10-04, docs/briefs/pit-walls/BRIEF.md section 2): a carved stone slab on the gate wall LEFT of the arch, where the
// niches were. It must look CARVED, not like a UI panel (Dom has rejected flat panels over the scene twice): a canvas painted as a darker recessed
// stone with chiselled text (each glyph drawn as a dark shadow top-left, a lit lip bottom-right, then the cut itself) and five-bar tally gates with a
// seeded chisel jitter, on a plain rough standard material so the torch beside it lights it. Unknown values are an em dash.
import * as THREE from 'three';
import type { PickTarget } from './picker.ts';
import { MAX_KILLS, blankRecord, type PitRecord } from './skulls.ts';

export const BOARD = { x0: -4.7, x1: -2.3, y0: 1.0, y1: 3.1, d: 0.04 };   // the slab: 2.4 m wide, 2.1 m tall, flush to the wall, 0.04 m proud
const W = 512, H = 448, DASH = '—';

// Tally gates: kills in fives (four strokes crossed by a diagonal) and the marks left over; at most MAX_KILLS marks are cut, the rest is a "+n".
export function tallyGroups(n: number | null): { fives: number; rest: number; more: number } {
  const total = n !== null && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0, shown = Math.min(total, MAX_KILLS);
  return { fives: Math.floor(shown / 5), rest: shown % 5, more: total - shown };
}
const fmt = (v: number | null): string => (v === null ? DASH : String(v));
// The numbers as lines of the board and of its sheet: label then value.
export function recordLines(r: PitRecord): string[] {
  return [`Kills: ${fmt(r.kills)}`, `Wins: ${fmt(r.wins)} · Losses: ${fmt(r.losses)}`, `Win streak: ${fmt(r.streak)}`, `Highest rank beaten: ${fmt(r.highestRank)}`];
}
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Paints the slab onto a 2D context (512 x 448): pure drawing, deterministic for one record.
export function paintRecord(ctx: CanvasRenderingContext2D, r: PitRecord): void {
  const rand = rng(7);
  ctx.fillStyle = '#524b42'; ctx.fillRect(0, 0, W, H);
  // Stone grain: a few thousand small light and dark flecks, and some long faint cracks.
  for (let i = 0; i < 2600; i++) { const v = rand(); ctx.fillStyle = v < 0.5 ? `rgba(20,16,12,${0.05 + rand() * 0.1})` : `rgba(180,165,140,${0.03 + rand() * 0.07})`; ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 2); }
  // The recessed face: a lit lower-right lip and a shadowed upper-left lip round the cut-in panel.
  ctx.fillStyle = '#3d372f'; ctx.fillRect(22, 22, W - 44, H - 44);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(22, 22, W - 44, 7); ctx.fillRect(22, 22, 7, H - 44);
  ctx.fillStyle = 'rgba(210,190,150,0.22)'; ctx.fillRect(22, H - 29, W - 44, 7); ctx.fillRect(W - 29, 22, 7, H - 44);
  ctx.textBaseline = 'alphabetic';
  // One cut glyph run: lit lip below right, shadow above left, then the dark cut; letter-spaced by hand so every browser agrees.
  const cut = (s: string, x: number, y: number, size: number, space: number, align: 'left' | 'center' = 'left') => {
    ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'left';
    const widths = [...s].map((c) => ctx.measureText(c).width + space), total = widths.reduce((a, b) => a + b, 0) - space;
    for (const [dx, dy, fill] of [[1.6, 1.6, 'rgba(225,205,165,0.38)'], [-1.4, -1.4, 'rgba(0,0,0,0.75)'], [0, 0, '#26221c']] as const) {
      ctx.fillStyle = fill; let at = align === 'center' ? x - total / 2 : x;
      [...s].forEach((c, i) => { ctx.fillText(c, at + dx, y + dy); at += widths[i]!; });
    }
    return total;
  };
  const line = (x0: number, x1: number, y: number, width: number) => {
    for (const [dx, dy, fill] of [[1.5, 1.5, 'rgba(225,205,165,0.38)'], [-1.2, -1.2, 'rgba(0,0,0,0.7)'], [0, 0, '#26221c']] as const) { ctx.fillStyle = fill; ctx.fillRect(x0 + dx, y + dy, x1 - x0, width); }
  };
  cut('THE RECORD', W / 2, 82, 46, 7, 'center');
  line(54, W - 54, 100, 4);
  const pair = (label: string, value: number | null, x: number, y: number): number => { const a = cut(label, x, y, 24, 4); return a + 14 + cut(fmt(value), x + a + 14, y + 4, 38, 2); };
  pair('KILLS', r.kills, 54, 152);
  const w = pair('WINS', r.wins, 54, 208); pair('LOSSES', r.losses, 54 + w + 34, 208);
  pair('STREAK', r.streak, 54, 264);
  pair('HIGHEST RANK', r.highestRank, 54, 320);
  // The tally: strokes with a seeded lean and length jitter, five to a gate (the fifth a diagonal through the four).
  const { fives, rest, more } = tallyGroups(r.kills), top = 346, bottom = 410, pitch = 66;
  const stroke = (x0: number, y0: number, x1: number, y1: number) => {
    for (const [dx, dy, color, wd] of [[1.6, 1.6, 'rgba(225,205,165,0.38)', 5], [-1.3, -1.3, 'rgba(0,0,0,0.7)', 5], [0, 0, '#26221c', 4]] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + dx, y0 + dy); ctx.lineTo(x1 + dx, y1 + dy); ctx.stroke();
    }
  };
  const gate = (i: number, bars: number) => {
    const x0 = 54 + i * pitch, j = () => (rand() - 0.5) * 4;
    for (let b = 0; b < Math.min(bars, 4); b++) { const x = x0 + b * 11; stroke(x + j(), top + 2 + j(), x + 1.5 + j(), bottom + j()); }
    if (bars >= 5) stroke(x0 - 8 + j(), bottom - 10 + j(), x0 + 48 + j(), top + 12 + j());
  };
  for (let g = 0; g < fives; g++) gate(g, 5);
  if (rest) gate(fives, rest);
  if (more > 0) cut(`+${more}`, 54 + (fives + (rest ? 1 : 0)) * pitch + 4, bottom - 8, 26, 2);
}

// The slab's texture. Needs a 2D canvas: with none (a test, a page that cannot make one) the texture is an empty stand-in and the slab stays plain stone.
export function recordTexture(record: PitRecord): THREE.CanvasTexture {
  const canvas = typeof document !== 'undefined' ? (document.createElement('canvas') as HTMLCanvasElement | undefined) : undefined;
  const usable = !!canvas && typeof canvas.getContext === 'function';
  if (usable) { canvas.width = W; canvas.height = H; }
  const texture = new THREE.CanvasTexture((usable ? canvas : { width: W, height: H }) as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  if (usable) { const ctx = canvas.getContext('2d'); if (ctx) paintRecord(ctx, record); }
  texture.userData.paint = (next: PitRecord) => { const ctx = usable ? canvas.getContext('2d') : null; if (ctx) { paintRecord(ctx, next); texture.needsUpdate = true; } };
  return texture;
}

export type Board = { targets: PickTarget<'board'>[]; restock(record: PitRecord | undefined): void; dispose(): void };

export function buildBoard(group: THREE.Group, wallZ: number): Board {
  const texture = recordTexture(blankRecord());
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  const geometry = new THREE.BoxGeometry(BOARD.x1 - BOARD.x0, BOARD.y1 - BOARD.y0, BOARD.d);
  const slab = new THREE.Mesh(geometry, face);   // one draw: the carved face is the box's front; the 4 cm sides just stretch its edge row
  slab.name = 'record-board'; slab.receiveShadow = true;
  slab.position.set((BOARD.x0 + BOARD.x1) / 2, (BOARD.y0 + BOARD.y1) / 2, wallZ + BOARD.d / 2);
  group.add(slab);
  let disposed = false;
  return {
    targets: [{ id: 'board', box: new THREE.Box3(new THREE.Vector3(BOARD.x0, BOARD.y0, wallZ - 0.05), new THREE.Vector3(BOARD.x1, BOARD.y1, wallZ + 0.08)) }],
    restock(record) { if (!disposed) (texture.userData.paint as (r: PitRecord) => void)(record ?? blankRecord()); },
    dispose() { if (disposed) return; disposed = true; group.remove(slab); geometry.dispose(); face.dispose(); texture.dispose(); },
  };
}
