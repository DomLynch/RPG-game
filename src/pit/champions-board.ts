// The wall of champions (Dom 2026-10-04, docs/briefs/pit-walls/BRIEF.md section 4): a wooden board hung on the BACK fence, behind the arrival point, its face
// toward the gate. Dark timber planks, iron nails and the day's five headline lines burned in (feat, name, value), never emissive: a canvas painted with
// plank grain, seams, knots and charred bold serif, on a plain rough standard material so the torches light it. One box, one draw. Today's data is
// skulls.ts's Champion lines; an empty day (or a guest) reads "No champions yet today."
import * as THREE from 'three';
import type { PickTarget } from './picker.ts';
import { NO_CHAMPIONS, type Champion } from './skulls.ts';

export const CHAMPIONS = { w: 3.0, h: 1.5, y0: 1.0, d: 0.05, x: 0 };   // the board: 3.0 m wide, 1.5 m tall, hung on the fence's inside, its centre on the yard's axis
const W = 1024, H = 512, PLANKS = 5;
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Paints the board onto a 2D context (1024 x 512): pure drawing, deterministic for one set of lines.
export function paintChampions(ctx: CanvasRenderingContext2D, champions: readonly Champion[]): void {
  const rand = rng(11), plank = H / PLANKS;
  // Planks: a base tone each, long grain strokes that wander, a few knots, a dark seam between them.
  for (let p = 0; p < PLANKS; p++) {
    const y0 = p * plank, tone = 0.8 + rand() * 0.4;
    ctx.fillStyle = `rgb(${Math.round(58 * tone)},${Math.round(40 * tone)},${Math.round(26 * tone)})`; ctx.fillRect(0, y0, W, plank);
    for (let i = 0; i < 34; i++) {
      const y = y0 + 4 + rand() * (plank - 8), x0 = rand() * W, len = 140 + rand() * 420, bend = (rand() - 0.5) * 6;
      ctx.strokeStyle = rand() < 0.6 ? `rgba(18,11,6,${0.12 + rand() * 0.18})` : `rgba(150,105,66,${0.05 + rand() * 0.08})`; ctx.lineWidth = 0.6 + rand() * 1.6;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + len * 0.3, y + bend, x0 + len * 0.7, y - bend, x0 + len, y + bend * 0.4); ctx.stroke();
    }
    for (let k = 0; k < 2; k++) if (rand() < 0.6) {
      const x = 40 + rand() * (W - 80), y = y0 + plank * (0.3 + rand() * 0.4), r = 7 + rand() * 9;
      ctx.fillStyle = 'rgba(14,8,4,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(14,8,4,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * 2.4, r * 1.7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(6,3,1,0.85)'; ctx.fillRect(0, y0, W, 3);
    ctx.fillStyle = 'rgba(190,140,90,0.14)'; ctx.fillRect(0, y0 + 3, W, 1.5);
  }
  // A darker frame round the edge, so the board reads as hung, not painted on the fence.
  ctx.fillStyle = 'rgba(8,4,2,0.55)'; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H - 10, W, 10); ctx.fillRect(0, 0, 10, H); ctx.fillRect(W - 10, 0, 10, H);
  // Burned text: a soft char halo, then the dark burn; letter-spaced by hand so every browser agrees.
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const burn = (s: string, x: number, y: number, size: number, space: number, align: 'left' | 'center' | 'right' = 'left', fit = Infinity): number => {
    let px = size;
    const measure = () => { ctx.font = `bold ${px}px Georgia, 'Times New Roman', serif`; const w = [...s].map((c) => ctx.measureText(c).width + space); return { w, total: w.reduce((a, b) => a + b, 0) - space }; };
    let m = measure();
    while (m.total > fit && px > 14) { px -= 2; m = measure(); }
    const at = align === 'center' ? x - m.total / 2 : align === 'right' ? x - m.total : x;
    for (const [dx, dy, fill] of [[1.2, 1.4, 'rgba(210,150,90,0.16)'], [0, 0, '#140b05']] as const) {
      ctx.fillStyle = fill; ctx.shadowColor = dy === 0 ? 'rgba(0,0,0,0.55)' : 'transparent'; ctx.shadowBlur = dy === 0 ? 3 : 0;
      let cx = at; [...s].forEach((c, i) => { ctx.fillText(c, cx + dx, y + dy); cx += m.w[i]!; });
    }
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    return m.total;
  };
  burn("TODAY'S CHAMPIONS", W / 2, 88, 58, 8, 'center');
  ctx.fillStyle = '#140b05'; ctx.fillRect(90, 108, W - 180, 4);
  if (!champions.length) burn(NO_CHAMPIONS.toUpperCase(), W / 2, 300, 40, 5, 'center', W - 160);
  champions.slice(0, 5).forEach((c, i) => {
    const y = 172 + i * 70;
    burn(c.label.toUpperCase(), 70, y, 24, 3, 'left', 270);
    if (c.name) burn(c.name, 370, y + 2, 38, 2, 'left', 380);
    burn(c.value, W - 70, y + 2, 36, 1, 'right', 240);
  });
  // Iron nails: a dark head with a small lit lip and a drip of rust, at the corners and on every plank's end.
  const nail = (x: number, y: number) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2927'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,185,175,0.35)'; ctx.beginPath(); ctx.arc(x - 1.8, y - 1.8, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(110,52,24,0.45)'; ctx.fillRect(x - 1, y + 5, 2, 8 + rand() * 12);
  };
  for (let p = 0; p < PLANKS; p++) { const y = p * plank + plank / 2; nail(26, y); nail(W - 26, y); }
}

// The texture. Needs a 2D canvas: with none (a test, a page that cannot make one) it is an empty stand-in and the board stays plain timber.
export function championsTexture(champions: readonly Champion[]): THREE.CanvasTexture {
  const canvas = typeof document !== 'undefined' ? (document.createElement('canvas') as HTMLCanvasElement | undefined) : undefined;
  const usable = !!canvas && typeof canvas.getContext === 'function';
  if (usable) { canvas.width = W; canvas.height = H; }
  const texture = new THREE.CanvasTexture((usable ? canvas : { width: W, height: H }) as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  if (usable) { const ctx = canvas.getContext('2d'); if (ctx) paintChampions(ctx, champions); }
  texture.userData.paint = (next: readonly Champion[]) => { const ctx = usable ? canvas.getContext('2d') : null; if (ctx) { paintChampions(ctx, next); texture.needsUpdate = true; } };
  return texture;
}

export type Champions = { targets: PickTarget<'champions'>[]; restock(champions: readonly Champion[] | undefined): void; dispose(): void };

// `backZ`: the back fence's line (z, the yard's far side from the gate). The board hangs on its inside and faces −z, toward the gate and the arrival point.
export function buildChampions(group: THREE.Group, backZ: number): Champions {
  const texture = championsTexture([]);
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  const geometry = new THREE.BoxGeometry(CHAMPIONS.w, CHAMPIONS.h, CHAMPIONS.d);
  const slab = new THREE.Mesh(geometry, face);   // one draw: the painted face is the box's +z side, turned to face −z
  slab.name = 'champions-board'; slab.receiveShadow = true;
  slab.rotation.y = Math.PI;
  slab.position.set(CHAMPIONS.x, CHAMPIONS.y0 + CHAMPIONS.h / 2, backZ - 0.03 - CHAMPIONS.d / 2);   // its back a hair inside the fence's bars
  group.add(slab);
  let disposed = false;
  return {
    targets: [{ id: 'champions', box: new THREE.Box3(new THREE.Vector3(CHAMPIONS.x - CHAMPIONS.w / 2, CHAMPIONS.y0, backZ - 0.12), new THREE.Vector3(CHAMPIONS.x + CHAMPIONS.w / 2, CHAMPIONS.y0 + CHAMPIONS.h, backZ + 0.05)) }],
    restock(champions) { if (!disposed) (texture.userData.paint as (c: readonly Champion[]) => void)(champions ?? []); },
    dispose() { if (disposed) return; disposed = true; group.remove(slab); geometry.dispose(); face.dispose(); texture.dispose(); },
  };
}
