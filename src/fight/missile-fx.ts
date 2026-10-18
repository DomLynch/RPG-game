import * as THREE from 'three';
import type { Fighter } from './duel.ts';
import { missileOf } from './sandbox-rules.ts';

// Donor: the combat sandbox (sandbox/page @93b1138c7, missile-fx.ts, the bow's arrow). Sandbox missiles (RV79), the arrow in flight: a plain shaft, head and two crossed fins (wood and iron, no glow, no trail), drawn from the fighter's `missile`
// state (position by tick along its line), so it always matches the sim's arrival; a volley (bow special lanes) draws its outer arrows bowed out from the line. Presentation only: it reads the duel, never changes it, allocates once, and draws
// nothing while no arrow is in flight. The scene builds it only when `missile` rows exist, so as shipped (no rows) nothing is built. The staff's orb and the spell bursts of the sandbox ride with mana and spellRange (RV81), not here.
const HEIGHT = 1.2;   // metres: the shaft's height above the sand
const SHAFT_LEN = 0.95, SHAFT_R = 0.014;   // metres; small dark fletching: at 9 radii the pale planes read as white squares at the fight camera
const SHAFT_COLOUR = '#8a6a43', HEAD_COLOUR = '#8d9399', FIN_COLOUR = '#7a6a4c';
const VOLLEY_SPREAD = 0.7;   // metres the outer arrows of a volley bow out from the line at mid-flight

export function createMissileFx(scene: THREE.Scene) {
  const makeShaft = () => {
    const g = new THREE.Group(), mat = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat(SHAFT_COLOUR)), head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), mat(HEAD_COLOUR));
    const fins = [0, 1].map(() => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: FIN_COLOUR, side: THREE.DoubleSide })));
    const headLen = SHAFT_R * 6;
    shaft.scale.set(SHAFT_R, SHAFT_LEN, SHAFT_R); shaft.rotation.z = Math.PI / 2;   // lies along +x
    head.scale.set(SHAFT_R * 2, headLen, SHAFT_R * 2); head.rotation.z = -Math.PI / 2; head.position.x = SHAFT_LEN / 2 + headLen / 2;
    fins.forEach((f) => { f.scale.set(SHAFT_R * 4, SHAFT_R * 4, 1); f.position.x = -SHAFT_LEN / 2 + SHAFT_R * 5; });
    fins[1]!.rotation.x = Math.PI / 2;   // two crossed fins at the tail
    g.add(shaft, head, ...fins); g.visible = false; g.userData.warmHidden = true; scene.add(g); return g;   // warmOwn compiles it shown: the program links at warm-up, never at the first arrow
  };
  const shafts = [0, 1].map(makeShaft), sides = [0, 1].map(() => [makeShaft(), makeShaft()]);   // sides: the two outer arrows of a volley, hidden unless one flies
  return {
    update(tick: number, fighters: readonly Pick<Fighter, 'missile' | 'weapon'>[]): void {
      fighters.forEach((f, i) => {
        const m = f.missile, live = !!m && tick < m.arrives && !!missileOf(f.weapon)?.archer, main = shafts[i]!;
        main.visible = live;
        const outer = (m?.lanes ?? []).filter((l) => l !== 0);
        sides[i]!.forEach((s, k) => { s.visible = live && k < outer.length; });
        if (!m || !live) return;
        const frac = Math.min(1, Math.max(0, (tick - m.launched) / Math.max(1, m.arrives - m.launched))), along = m.range * frac, bow = VOLLEY_SPREAD * Math.sin(Math.PI * frac);
        main.position.set(m.x + m.dx * along, HEIGHT, m.z + m.dz * along); main.rotation.y = Math.atan2(-m.dz, m.dx);
        outer.forEach((l, k) => { const s = sides[i]![k]!; s.position.set(main.position.x + m.dz * l * bow, HEIGHT, main.position.z - m.dx * l * bow); s.rotation.y = main.rotation.y; });
      });
    },
    dispose(): void { for (const g of [...shafts, ...sides.flat()]) g.removeFromParent(); },
  };
}
