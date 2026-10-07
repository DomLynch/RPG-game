import * as THREE from 'three';
import type { ArenaMaterials } from '../../src/arena.ts';
import { meshPieces } from './exchange.ts';
import type { Board, Build } from './frontier-plan.ts';

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

export function buildFrontier(scene: THREE.Scene, m: ArenaMaterials, b: Build): THREE.Group {
  const group = new THREE.Group(); group.name = 'ash-frontier'; scene.add(group);
  meshPieces(group, b.pieces, m, 'frontier');
  for (const f of b.people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.95 }));
    body.position.set(f.x, 0.87, f.z); body.castShadow = true; group.add(body);
  }
  for (const board of b.boards) group.add(boardMesh(board));
  return group;
}
