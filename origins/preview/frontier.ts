import * as THREE from 'three';
import type { ArenaMaterials } from '../../src/arena.ts';
import { meshPieces } from './exchange.ts';
import type { Board, Build } from './frontier-plan.ts';
import type { Dress } from './frontier-dress.ts';
import type { Camp } from './frontier-camp.ts';
import { toWorld } from '../world/derive.ts';
import { zoneHeight, type ReliefZone } from './frontier-relief.ts';

// ?region=1: the Ash Frontier greybox from frontier-plan.ts (blocks, the west road, signposts, townsfolk). Massing and signage only; no
// light, fog or sky here (the World lane's look.ts reads each zone's ambience.preset).

// A signboard's face: its lines painted on a timber-coloured canvas (greybox signage, not final art).
function boardMesh(b: Board): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64 + 80 * b.lines.length;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a4430'; g.fillRect(0, 0, c.width, c.height);
  g.font = '600 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f0e2c4';
  const fit = (t: string) => { let s = 46; while (s > 20 && g.measureText(t).width > c.width - 24) { s -= 2; g.font = `600 ${s}px Georgia, serif`; } };
  b.lines.forEach((t, i) => { g.font = '600 46px Georgia, serif'; fit(t); g.fillText(t, c.width / 2, 72 + i * 80); });
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const h = 0.18 + 0.32 * b.lines.length, mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, h - 0.04), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
  mesh.position.set(b.x, b.y, b.z); mesh.rotation.y = b.facing;
  return mesh;
}

// The Frontier's dirt: a seamless ash-and-earth canvas (speckle, soft blotches, hairline cracks), tiling every 8 m, so the ground stops reading as the arena's paving.
function dirtMaterial(): THREE.MeshStandardMaterial {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!; let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = '#6a6056'; g.fillRect(0, 0, N, N);
  const wrapped = (draw: (ox: number, oy: number) => void) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) draw(ox, oy); };
  for (let i = 0; i < 70; i++) { const x = rnd() * N, y = rnd() * N, r = 30 + rnd() * 90, dark = rnd() < 0.5; wrapped((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, dark ? 'rgba(40,34,30,0.35)' : 'rgba(150,140,128,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }); }
  for (let i = 0; i < 9000; i++) { const v = 70 + Math.floor(rnd() * 90); g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.25 + rnd() * 0.4})`; g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(30,26,22,0.55)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) { let x = rnd() * N, y = rnd() * N; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(0.25, 0.25); map.anisotropy = 8;   // piece() UVs are metres / 2: 0.25 = one tile per 8 m
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}

// A camp's night light on the ground: one additive radial disc (no light object, no shadow), soft at the rim.
function campGlow(c: Camp): THREE.Mesh {
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d')!, gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, c.glow.color); gr.addColorStop(0.45, `${c.glow.color}55`); gr.addColorStop(1, `${c.glow.color}00`); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.glow.radius * 2, c.glow.radius * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: c.glow.opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(c.glow.x, 0.12, c.glow.z); mesh.name = 'camp-glow'; return mesh;
}

// The ground of a relieved zone (frontier-relief.ts): a 41 x 41 grid over its footprint, heights from the same function the walker's feet use, vertex colour dirt to grass by height, a curtain of rock round the rim
// down to the lowered plane. The dirt canvas tiles every 8 m through the UVs.
const DIRT: Record<string, [number, number, number]> = { ash: [0.62, 0.58, 0.54], paving: [0.86, 0.83, 0.78], sand: [0.95, 0.82, 0.62] }, GRASS: [number, number, number] = [0.34, 0.42, 0.24], ROCK: [number, number, number] = [0.28, 0.26, 0.25];
function reliefMesh(rz: ReliefZone, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const { zone: z } = rz, N = 41, drop = z.relief.relief + 0.3, dirt = DIRT[z.ground] ?? DIRT.ash!;
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const at = (u: number, v: number) => toWorld({ x: (u - 0.5) * z.width, d: v * z.depth }, z.mount);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const w = at(i / (N - 1), j / (N - 1)), h = zoneHeight(rz, w.x, w.z), t = Math.min(1, Math.max(0, 0.5 + h / (2 * z.relief.relief))), g = (1 - t) * 0.55;
    pos.push(w.x, h, w.z); uv.push(w.x / 2, w.z / 2);   // the arena's UV rule (exchange.ts piece): metres / 2, the dirt canvas then tiles every 8 m
    const k = 0.82 + 0.3 * t;
    col.push(dirt[0] * k * (1 - g) + GRASS[0] * g, dirt[1] * k * (1 - g) + GRASS[1] * g, dirt[2] * k * (1 - g) + GRASS[2] * g);
  }
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i; idx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1); }
  const rim = (list: number[]) => {   // a curtain from the edge vertices (they sit at 0) down to the plane
    const start = pos.length / 3;
    for (const v of list) { pos.push(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!, pos[v * 3]!, -drop, pos[v * 3 + 2]!); col.push(...ROCK, ...ROCK); uv.push(0, 0, 0, 0); }
    for (let s = 0; s < list.length - 1; s++) { const a = start + s * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a, a + 2, a + 1, a + 1, a + 2, a + 3); }   // both faces: the rim is seen from outside
  };
  rim(Array.from({ length: N }, (_, i) => i)); rim(Array.from({ length: N }, (_, i) => (N - 1) * N + i)); rim(Array.from({ length: N }, (_, j) => j * N)); rim(Array.from({ length: N }, (_, j) => j * N + N - 1));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; mesh.name = `frontier-relief:${z.zone}`; return mesh;
}

export function buildFrontier(scene: THREE.Scene, m: ArenaMaterials, b: Build, dress?: Dress, camps: readonly Camp[] = [], relief: readonly ReliefZone[] = []): THREE.Group {
  const group = new THREE.Group(); group.name = 'ash-frontier'; scene.add(group);
  if (relief.length) { const mat = dirtMaterial().clone(); mat.vertexColors = true; mat.color.set(0xffffff); for (const rz of relief) group.add(reliefMesh(rz, mat)); }
  meshPieces(group, b.pieces, m, 'frontier');
  if (dress) { meshPieces(group, dress.ground, m, 'frontier-ground', { stone: dirtMaterial() }); meshPieces(group, dress.pieces, m, 'frontier-dress'); }   // frontier-dress.ts: the dirt and roads, then rocks, ruins, burnt posts
  if (camps.length) { meshPieces(group, camps.flatMap((c) => c.pieces), m, 'camp'); for (const c of camps) group.add(campGlow(c)); }   // frontier-camp.ts: fire, seats, bedrolls, crates and the soft ground glow
  for (const f of b.people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.95 }));
    body.position.set(f.x, 0.87, f.z); body.castShadow = true; group.add(body);
  }
  for (const board of b.boards) group.add(boardMesh(board));
  return group;
}
