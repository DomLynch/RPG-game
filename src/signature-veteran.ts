import * as THREE from 'three';
import { isHeavy, OPPONENT_SIDE, registerSignature } from './signature.ts';
import { type WoundHit } from './gore.ts';
import { weaponOf } from './moves.ts';
import type { CombatEvent } from './duel.ts';

// The Veteran's signature (brief row 1, variant A): Battle Scars. A heavy (or any cut past the light cut's 14) landed ON him scores a fresh
// gouge across his armour at the site the sim named: bright metal through the bronze patina, laid along the line the blade travelled
// (an overhead runs down across him on the diagonal, a cut from either side flatter). It stays for the fight in the body pool (6, oldest reused,
// cleared with the wounds). Cosmetic: no stat, no sim. Sized to read at 375x812 from the default camera.
const SUBSTANTIAL = 16;

let gougeTexture: THREE.CanvasTexture | null = null;
// A gouge, drawn once along the texture's long axis: a dark torn edge each side, a bright scored core, burr flecks, tapering at both ends.
function gouge(): THREE.CanvasTexture {
  if (gougeTexture) return gougeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const g = canvas.getContext('2d')!;
  const stroke = (half: number, color: string, wobble: number) => {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i <= 64; i++) { const t = i / 64, x = 16 + 480 * t, w = half * Math.sin(Math.PI * t) ** 0.6; g.lineTo(x, 48 - w + wobble * Math.sin(t * 23)); }
    for (let i = 64; i >= 0; i--) { const t = i / 64, x = 16 + 480 * t, w = half * Math.sin(Math.PI * t) ** 0.6; g.lineTo(x, 48 + w + wobble * Math.sin(t * 19 + 1)); }
    g.fill();
  };
  stroke(30, 'rgba(20,14,8,0.85)', 2.5);     // the torn, darkened lip of the patina
  stroke(18, 'rgba(196,170,112,1)', 1.5);    // bright bronze bared under the patina
  stroke(8, 'rgba(255,246,214,1)', 0.8);     // the freshly scored floor of the cut
  for (let i = 0; i < 28; i++) {             // burrs thrown off the edges
    const x = 40 + ((i * 97) % 430), y = 48 + (i % 2 ? 1 : -1) * (20 + ((i * 13) % 12));
    g.fillStyle = i % 3 ? 'rgba(230,210,160,0.9)' : 'rgba(30,22,12,0.8)';
    g.fillRect(x, y, 3 + (i % 3), 2);
  }
  gougeTexture = new THREE.CanvasTexture(canvas);
  gougeTexture.colorSpace = THREE.SRGBColorSpace;
  return gougeTexture;
}

const struck = (event: CombatEvent) => event.type === 'Hit' && event.target === OPPONENT_SIDE && event.move !== 'kick' && (isHeavy(event) || (event.damage ?? 0) >= SUBSTANTIAL);
let scars = 0;

registerSignature({
  opponent: 'veteran', variant: 'A', name: 'Battle Scars',
  when: struck,
  fire(event, frame) {
    const root = frame.roots[OPPONENT_SIDE], veteran = frame.fighters[OPPONENT_SIDE], attacker = frame.fighters[event.actor];
    if (!root || !event.move) return;
    const direction = weaponOf(attacker.weapon).moves[event.move]?.direction ?? 'center';
    const hit: WoundHit = { location: event.location ?? 'torso', heading: veteran.body.heading, direction };
    // The line the blade travelled, about the surface normal (0 = across him): an overhead runs down, a side cut on the diagonal.
    const tilt = (direction === 'left' ? -0.4 : direction === 'right' ? 0.4 : 0.75) + 0.15 * Math.sin(++scars * 2.3);
    const scale = frame.scale[OPPONENT_SIDE];
    frame.marks.body(OPPONENT_SIDE, root, hit, { width: 0.3 * scale, height: 0.09 * scale, map: gouge(), metalness: 0.9, roughness: 0.25, tilt, fadeIn: 0.03 }, scale);
  },
  clear() { scars = 0; },
});
