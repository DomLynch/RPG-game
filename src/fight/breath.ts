import * as THREE from 'three';
import { fxHas, fxNum } from './fx-rows.ts';

// A creature's fire breath (Dom 2026-10-16, the Test Zone's Giant Salamander). Presentation only: it reads the duel's AttackStarted of the creature's side and draws a
// cone of additive flame puffs from its head to the hero; nothing here reads input or touches the sim, a record or a number the fight uses. Which creatures breathe is
// a row (`breath.<opponent>` in fx-rows.json), and so are the reach, width, life, puff count, size and the two colours (breath.*).
const RANGE = fxNum('breath.range'), RADIUS = fxNum('breath.radius'), LIFE = fxNum('breath.life'), PUFFS = fxNum('breath.puffs'), SIZE = fxNum('breath.size'), OPACITY = fxNum('breath.opacity');
const CORE = new THREE.Color(fxNum('breath.core')), EMBER = new THREE.Color(fxNum('breath.ember'));

export const breathes = (opponent: string): boolean => fxHas(`breath.${opponent}`);

let art: THREE.Texture | null | undefined;
function flameArt(): THREE.Texture | null {
  if (art !== undefined) return art;
  if (typeof document === 'undefined') return (art = null);
  const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return (art = null);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.65)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return (art = texture);
}

type Puff = { sprite: THREE.Sprite; side: number; lift: number; delay: number };
type Jet = { age: number; from: THREE.Vector3; to: THREE.Vector3; puffs: Puff[]; group: THREE.Group };

/** Seeded per jet, so the same breath is drawn the same way every time it is started at the same tick. */
const rand = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

export function createBreath(scene: THREE.Scene) {
  const live = new Map<string, Jet>(), tmp = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const material = () => new THREE.SpriteMaterial({ map: flameArt(), color: CORE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const drop = (id: string) => { const j = live.get(id); if (!j) return; scene.remove(j.group); for (const p of j.puffs) p.sprite.material.dispose(); live.delete(id); };
  return {
    /** The creature `id` breathes from `from` (its head) at `to` (the hero's chest), from now. A breath already going is restarted. */
    start(id: string, from: THREE.Vector3, to: THREE.Vector3, seed: number): void {
      drop(id);
      const next = rand(seed), group = new THREE.Group(), puffs: Puff[] = [];
      for (let k = 0; k < PUFFS; k++) {
        const sprite = new THREE.Sprite(material()); sprite.visible = false; group.add(sprite);
        puffs.push({ sprite, side: next() * 2 - 1, lift: next() * 2 - 1, delay: (k / PUFFS) * 0.45 * LIFE });   // the puffs leave the mouth one after another, a stream, not a burst
      }
      scene.add(group); live.set(id, { age: 0, from: from.clone(), to: to.clone(), puffs, group });
    },
    /** Each frame: every puff runs from the head out along the line to the hero (never past RANGE), widens, goes from the core colour to ember red and fades. */
    update(dt: number): void {
      for (const [id, j] of live) {
        j.age += dt;
        const dir = tmp.copy(j.to).sub(j.from).normalize(), reach = RANGE;   // a stream out of the mouth along the line to the hero, its full reach (it flows past him), not cut at him
        side.crossVectors(dir, up).normalize();
        let alive = false;
        for (const p of j.puffs) {
          const t = (j.age - p.delay) / (LIFE * 0.55);
          if (t < 0 || t > 1) { p.sprite.visible = false; if (t < 0) alive = true; continue; }
          alive = true;
          const spread = RADIUS * t * t, sway = Math.sin((j.age + p.delay) * 4.5 + p.side * 9) * 0.18 * t, m = p.sprite.material as THREE.SpriteMaterial;   // the stream licks side to side as it goes
          p.sprite.visible = true;
          p.sprite.position.copy(j.from).addScaledVector(dir, reach * t).addScaledVector(side, p.side * spread + sway).addScaledVector(up, p.lift * spread * 0.5 + t * 0.5);   // and drifts up as it cools
          p.sprite.scale.setScalar(SIZE * (0.45 + 1.4 * t));
          m.color.copy(CORE).lerp(EMBER, Math.min(1, t * 1.3)); m.opacity = OPACITY * (1 - t) * (t < 0.15 ? t / 0.15 : 1);   // yellow-orange at the mouth, deep red-orange as it thins out
        }
        if (!alive) drop(id);
      }
    },
    active: () => live.size,
    clear(): void { for (const id of [...live.keys()]) drop(id); },
  };
}
