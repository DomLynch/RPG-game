import * as THREE from 'three';
import { weaponOf } from './moves.ts';
import { heavyHitBy, registerSignature, type MarkLook, type MarkSite, type SignatureEffect } from './signature.ts';

// The Dwarf's signature, A: Hammer Stamp (docs/briefs/signature-effects.md row 6). A clean heavy that lands stamps the hammer's angular
// maker's mark into the struck armour or skin as a dark dent; the victim carries it for the fight (6 at most, the oldest reused). Only a
// real landed heavy (`Hit`, heavy class, by the Dwarf) stamps, and only where the sim says it landed.
// 12 cm across: 7.5 cm read as ~15 px from the fight camera at 375×812 and the pale halo was all that showed (first strip, 2026-09-24).
export const STAMP = { size: 0.12, opacity: 1, fadeIn: 0.06, tilt: 0.35 } as const;   // metres across; appears on the frame of the blow

// The mark itself: a square hammer face with a bevelled rim, a struck lozenge and a three-stroke rune in the middle, drawn once to a canvas
// (browser only; under node the mark is an untextured dark square). Dark where the steel bit, a lighter crushed rim around it, soft edge.
let art: THREE.Texture | null | undefined;
function stampArt(): THREE.Texture | null {
  if (art !== undefined) return art;
  if (typeof document === 'undefined') return (art = null);
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return (art = null);
  const c = size / 2, face = size * 0.34;
  // The crushed halo round the face: the surface pushed out and scuffed, fading to nothing.
  const halo = g.createRadialGradient(c, c, face * 0.9, c, c, size * 0.5);
  halo.addColorStop(0, 'rgba(40,26,22,0.7)'); halo.addColorStop(1, 'rgba(40,26,22,0)');
  g.fillStyle = halo; g.fillRect(0, 0, size, size);
  // The face: a dark square, its rim lit on the top-left bevel and shadowed on the bottom-right, as a dent reads under the arena sun.
  g.fillStyle = 'rgba(8,6,6,1)'; g.fillRect(c - face, c - face, face * 2, face * 2);
  g.lineWidth = size * 0.05;
  g.strokeStyle = 'rgba(235,222,200,0.95)'; g.beginPath(); g.moveTo(c - face, c + face); g.lineTo(c - face, c - face); g.lineTo(c + face, c - face); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.9)'; g.beginPath(); g.moveTo(c + face, c - face); g.lineTo(c + face, c + face); g.lineTo(c - face, c + face); g.stroke();
  // The maker's mark in raised relief inside the face: a lozenge and a rune (a stave with two angled branches).
  const mark = face * 0.62;
  g.strokeStyle = 'rgba(205,188,165,0.95)'; g.lineWidth = size * 0.045; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(c, c - mark); g.lineTo(c + mark, c); g.lineTo(c, c + mark); g.lineTo(c - mark, c); g.closePath(); g.stroke();
  g.lineWidth = size * 0.04;
  g.beginPath(); g.moveTo(c, c - mark * 0.62); g.lineTo(c, c + mark * 0.62);
  g.moveTo(c, c - mark * 0.1); g.lineTo(c + mark * 0.38, c - mark * 0.46);
  g.moveTo(c, c + mark * 0.22); g.lineTo(c - mark * 0.38, c - mark * 0.14); g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return (art = texture);
}

export const stampLook = (): MarkLook => ({
  width: STAMP.size, height: STAMP.size, map: stampArt(), color: stampArt() ? '#ffffff' : '#1c1614',
  opacity: STAMP.opacity, roughness: 0.55, metalness: 0.15, fadeIn: STAMP.fadeIn,
});

// Where the hammer's face meets him: every Dwarf heavy is an overhead (moves.ts), and an overhead hammer lands on the TOP of a shoulder, not
// the chest the blood table uses for a sword's overhead cut. The top also faces the fight camera, which sits behind and above the player the
// Dwarf is striking; a chest mark faces away from it and the facing rule hides it (first capture, 2026-09-24). The shoulder is picked from
// the tick so a replay stamps the same one. A blow the sim put on the head or legs keeps the table's site.
export function stampSite(tick: number, location: string): MarkSite | undefined {
  if (location !== 'torso') return undefined;
  const side = tick % 2 ? 1 : -1;
  return { bone: side > 0 ? 'upperarm_l' : 'upperarm_r', dir: [side * 0.25, 0.9, -0.35], radius: 0.07 };
}

// Both variants stamp the same way at the same shoulder site; only the mark's art and size differ.
const stamp = (lookOf: () => MarkLook): SignatureEffect['fire'] => (event, { fighters, roots, scale, marks }) => {
  const victim = event.target, root = victim === undefined ? null : roots[victim];
  if (victim === undefined || !root || !event.location || !event.move) return;
  const direction = weaponOf(fighters[event.actor].weapon).moves[event.move].direction;
  // A slight tilt per stamp, seeded from the tick so a replay stamps the same way.
  const look = lookOf(); look.tilt = ((Math.imul(event.tick, 2654435761) >>> 0) / 4294967296 * 2 - 1) * STAMP.tilt;
  marks.body(victim, root, { location: event.location, direction, heading: fighters[victim].body.heading }, look, scale[victim], stampSite(event.tick, event.location));
};

registerSignature({ opponent: 'dwarf', variant: 'A', name: 'Hammer Stamp', when: heavyHitBy, fire: stamp(stampLook) });

// Variant B (Lead's prep for Dom's pick, 2026-09-24, not ruled): the same blow as a bruise, not a brand. About twice A's size, a DARK
// bruised square impression with a slightly lighter crushed rim, and no bright outline and no rune: nothing on it catches the eye as white.
export const STAMP_B = { size: 0.24 } as const;   // metres across
let bruiseArt: THREE.Texture | null | undefined;
function bruiseTexture(): THREE.Texture | null {
  if (bruiseArt !== undefined) return bruiseArt;
  if (typeof document === 'undefined') return (bruiseArt = null);
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return (bruiseArt = null);
  const c = size / 2, face = size * 0.3;
  // The rim: the flesh or leather crushed up round the face, a little lighter than the pit, fading out soft.
  const rim = g.createRadialGradient(c, c, face * 0.95, c, c, size * 0.5);
  rim.addColorStop(0, 'rgba(92,52,50,0.85)'); rim.addColorStop(0.55, 'rgba(70,40,42,0.45)'); rim.addColorStop(1, 'rgba(60,34,36,0)');
  g.fillStyle = rim; g.fillRect(0, 0, size, size);
  // The pit: a dark bruised square, deepest in the middle, its edge softened so it reads as a dent and not a sticker.
  g.filter = 'blur(2px)';
  const pit = g.createRadialGradient(c, c, 0, c, c, face * 1.35);
  pit.addColorStop(0, 'rgba(18,8,12,1)'); pit.addColorStop(0.7, 'rgba(34,16,22,1)'); pit.addColorStop(1, 'rgba(48,24,30,1)');
  g.fillStyle = pit; g.fillRect(c - face, c - face, face * 2, face * 2);
  g.filter = 'none';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return (bruiseArt = texture);
}
export const bruiseLook = (): MarkLook => ({
  width: STAMP_B.size, height: STAMP_B.size, map: bruiseTexture(), color: bruiseTexture() ? '#ffffff' : '#1a0e10',
  opacity: STAMP.opacity, roughness: 0.75, metalness: 0, fadeIn: STAMP.fadeIn,
});
registerSignature({ opponent: 'dwarf', variant: 'B', name: 'Hammer Stamp (bruise)', when: heavyHitBy, fire: stamp(bruiseLook) });

// Variant C (Lead's prep for Dom's pick, 2026-09-24, not ruled; Strategy on B: "reads as a smudge", its first frame "a censor block"): B's
// size and darkness, shaped as the hammer's FACE, an octagonal flat with chamfered corners, deepest along its struck edge, a faint pushed-up
// rim, every edge soft. It rises over a quarter-second instead of popping in, so no frame shows a hard-edged square: struck, not pasted.
export const STAMP_C = { size: STAMP_B.size, fadeIn: 0.25 } as const;
let faceArt: THREE.Texture | null | undefined;
function faceTexture(): THREE.Texture | null {
  if (faceArt !== undefined) return faceArt;
  if (typeof document === 'undefined') return (faceArt = null);
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return (faceArt = null);
  const c = size / 2, face = size * 0.27, cut = face * 0.42;
  const octagon = (r: number, k: number) => {
    g.beginPath();
    g.moveTo(c - r + k, c - r); g.lineTo(c + r - k, c - r); g.lineTo(c + r, c - r + k); g.lineTo(c + r, c + r - k);
    g.lineTo(c + r - k, c + r); g.lineTo(c - r + k, c + r); g.lineTo(c - r, c + r - k); g.lineTo(c - r, c - r + k); g.closePath();
  };
  // The faint rim: the surface pushed up round the face, a thin lighter band, blurred away.
  g.filter = 'blur(2.5px)';
  octagon(face * 1.22, cut * 1.22); g.fillStyle = 'rgba(138,90,78,0.6)'; g.fill();
  // The impression: the octagonal face, dark, with soft edges.
  g.filter = 'blur(1.2px)';   // soft, but the chamfered corners still read at ~25 px on a phone (a 3 px blur rounded it to a blob)
  octagon(face, cut); g.fillStyle = 'rgba(30,14,18,0.95)'; g.fill();
  // The struck edge: the hammer lands a little off flat, so one side of the face bites deeper.
  g.filter = 'blur(2px)';
  const bite = g.createLinearGradient(c - face, c - face, c + face, c + face);
  bite.addColorStop(0, 'rgba(8,3,6,0.9)'); bite.addColorStop(0.6, 'rgba(8,3,6,0)');
  octagon(face * 0.9, cut * 0.9); g.fillStyle = bite; g.fill();
  g.filter = 'none';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return (faceArt = texture);
}
export const faceLook = (): MarkLook => ({
  width: STAMP_C.size, height: STAMP_C.size, map: faceTexture(), color: faceTexture() ? '#ffffff' : '#1a0e10',
  opacity: STAMP.opacity, roughness: 0.7, metalness: 0, fadeIn: STAMP_C.fadeIn,
});
registerSignature({ opponent: 'dwarf', variant: 'C', name: 'Hammer Stamp (struck face)', when: heavyHitBy, fire: stamp(faceLook) });
