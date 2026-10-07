import * as THREE from 'three';
import type { ArenaMaterials } from '../../src/arena.ts';
import { meshPieces } from './exchange.ts';
import type { Board, Build } from './frontier-plan.ts';
import type { Dress } from './frontier-dress.ts';

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

export function buildFrontier(scene: THREE.Scene, m: ArenaMaterials, b: Build, dress?: Dress): THREE.Group {
  const group = new THREE.Group(); group.name = 'ash-frontier'; scene.add(group);
  meshPieces(group, b.pieces, m, 'frontier');
  if (dress) { meshPieces(group, dress.ground, m, 'frontier-ground', { stone: dirtMaterial() }); meshPieces(group, dress.pieces, m, 'frontier-dress'); }   // frontier-dress.ts: the dirt and roads, then rocks, ruins, burnt posts
  for (const f of b.people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.95 }));
    body.position.set(f.x, 0.87, f.z); body.castShadow = true; group.add(body);
  }
  for (const board of b.boards) group.add(boardMesh(board));
  return group;
}
