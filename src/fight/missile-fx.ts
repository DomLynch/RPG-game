import * as THREE from 'three';
import type { Fighter } from './duel.ts';
import { healOf, missileOf, spellLookOf, spellRangeOf, SPELL_FX } from './sandbox-rules.ts';   // SPELL_FX on: the designed special effect lands the spell (special-presentation.ts), so no plain landing burst over it
import { spellRoot } from './spell-cast.ts';

// sandbox-mech: missiles, the bolt in flight. A small cold core with a soft halo and a short fading trail, drawn from the fighter's `missile` state (position by tick along its line), so it always matches the sim's arrival. Presentation only:
// it reads the duel, never changes it, allocates once, draws nothing while no missile is in flight (so with no missile rows this file draws nothing).
const HEIGHT = 1.2, TRAIL = 3, TRAIL_GAP = 0.22;   // metres
export function createMissileFx(scene: THREE.Scene) {
  const n = 64, pixels = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x - (n - 1) / 2, y - (n - 1) / 2) / ((n - 1) / 2); pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 2], (y * n + x) * 4); }
  const glow = new THREE.DataTexture(pixels, n, n); glow.needsUpdate = true; glow.magFilter = glow.minFilter = THREE.LinearFilter;
  const sprite = (size: number, color: string, opacity: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); s.visible = false; s.frustumCulled = false; scene.add(s); return s; };
  const bolts = [0, 1].map(() => ({ core: sprite(0.2, '#e8f3ff', 1), halo: sprite(0.65, '#6aa8ff', 0.55), trail: Array.from({ length: TRAIL }, (_, k) => sprite(0.4 - k * 0.08, '#6aa8ff', 0.4 - k * 0.1)) }));
  // Bow arrow / crossbow bolt: a simple shaft + head + fins mesh (staff keeps the white orb). One per fighter, pointing along the flight line; shapes are rows-free presentation only.
  const SHAPE = { bow: { len: 0.95, r: 0.011, shaft: '#8a6a43', head: '#8d9399', fin: '#c9c0a8' }, crossbow: { len: 0.42, r: 0.014, shaft: '#4a3a2c', head: '#8d9399', fin: '#3a2e24' } } as const;
  const shafts = [0, 1].map(() => {
    const g = new THREE.Group(), mat = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat('#fff')), head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), mat('#fff')), fins = [0, 1].map(() => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })));
    fins[1]!.rotation.x = Math.PI / 2;   // two crossed fins at the tail
    g.add(shaft, head, ...fins); g.visible = false; scene.add(g); return { g, shaft, head, fins };
  });
  const dress = (s: (typeof shafts)[number], kind: 'bow' | 'crossbow') => {
    const k = SHAPE[kind], headLen = k.r * 6;
    s.shaft.scale.set(k.r, k.len, k.r); s.shaft.rotation.z = Math.PI / 2; (s.shaft.material as THREE.MeshBasicMaterial).color.set(k.shaft);   // lies along +x
    s.head.scale.set(k.r * 2, headLen, k.r * 2); s.head.rotation.z = -Math.PI / 2; s.head.position.x = k.len / 2 + headLen / 2; (s.head.material as THREE.MeshBasicMaterial).color.set(k.head);
    s.fins.forEach((f) => { f.scale.set(k.r * 9, k.r * 9, 1); f.position.x = -k.len / 2 + k.r * 5; (f.material as THREE.MeshBasicMaterial).color.set(k.fin); });
  };
  const dressed = [undefined, undefined] as (string | undefined)[];
  // Spell bursts (Dom 2026-10-16: a cast must be clearly visible): a flash + swelling halo on the foe where a spell lands (colour from its range row, else violet) and a small flash on the caster when the cast starts. Fed from the tick's events.
  const bursts = Array.from({ length: 6 }, () => ({ core: sprite(1, '#ffffff', 1), halo: sprite(1, '#b070ff', 0.8), at: -1, x: 0, z: 0, big: 1, life: 42 })); let next = 0;   // life: ticks the burst lasts (a spellLook row's pulse; 42 without one)
  const BURST_TICKS = 42;
  // Heal (Dom 2026-10-17: the first heal look, faint blue speckles, was weak): on a heal's release, over the healed fighter, a ground ring that swells and fades, a pale pillar that rises and thins, and a spiral of motes that climb and fade. Shape from World of Claudecraft's `heal` archetype (MIT: pillar + ring + burst) and
  // Duelyst's heal (CC0: rising green dots, about 2 s); the code is our own, tick-driven so a replay draws the same frames. Colours are muted greens, normal blending on the ring and pillar so it reads on sand (no additive blob).
  const HEAL_TICKS = 84, MOTES = 16;
  const heals = [0, 1].map(() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const mat = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), mat('#a8e070')), pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 28, 1, true), mat('#cfeea0'));
    ring.position.y = 0.05; pillar.position.y = 1.5; g.add(ring, pillar);
    return { g, ring, pillar, motes: Array.from({ length: MOTES }, () => sprite(0.16, '#c8f58a', 0)), at: -1, x: 0, z: 0 };
  });
  let nextHeal = 0;
  return {
    burst(events: readonly { type: string; actor: number; target?: number; spell?: string; tick: number; heal?: number }[], fighters: readonly Pick<Fighter, 'body'>[]): void {
      for (const e of events) {
        if (e.type === 'SpecialLanded' && e.heal !== undefined) { const h = heals[nextHeal++ % heals.length]!, who = fighters[e.actor]; if (who) { h.at = e.tick; h.x = who.body.x; h.z = who.body.z; } continue; }
        const isHeal = e.spell !== undefined && healOf(e.spell) !== undefined;   // a heal has its own look: no violet flash at the cast or the landing
        const land = !SPELL_FX && !isHeal && e.type === 'SpecialLanded' && e.spell && e.target !== undefined, start = !isHeal && e.type === 'SpecialStarted' && e.spell;
        if (!land && !start) continue;
        const who = fighters[land ? e.target! : e.actor]; if (!who) continue;
        const b = bursts[next++ % bursts.length]!, root = e.spell ? spellRoot(e.spell) : undefined, look = e.spell ? spellLookOf(e.spell) : undefined, tint = look?.tint || (root && spellRangeOf(root)?.tint) || '#b070ff';   // the spell's own look row first, then its root's range tint
        (b.halo.material as THREE.SpriteMaterial).color.set(tint); b.at = e.tick; b.x = who.body.x; b.z = who.body.z; b.big = (land ? 1 : 0.4) * (look?.size ?? 1000) / 1000; b.life = look?.pulse ?? BURST_TICKS;
      }
    },
    update(tick: number, fighters: readonly Pick<Fighter, 'missile' | 'weapon'>[]): void {
      for (const b of bursts) {
        const age = tick - b.at, live = b.at >= 0 && age >= 0 && age < b.life, k = live ? age / b.life : 1;
        b.core.visible = b.halo.visible = live; if (!live) continue;
        b.core.position.set(b.x, HEIGHT, b.z); b.halo.position.copy(b.core.position);
        b.core.scale.setScalar(b.big * (1.1 - k * 0.6)); b.halo.scale.setScalar(b.big * (0.8 + k * 2.6));
        (b.core.material as THREE.SpriteMaterial).opacity = 1 - k; (b.halo.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - k * k);
      }
      for (const h of heals) {
        const age = tick - h.at, live = h.at >= 0 && age >= 0 && age < HEAL_TICKS, k = live ? age / HEAL_TICKS : 1;
        h.g.visible = live; for (const m of h.motes) m.visible = live; if (!live) continue;
        h.g.position.set(h.x, 0, h.z);
        const out = 1 - (1 - k) ** 3;   // ease-out
        h.ring.scale.setScalar(0.4 + 1.1 * out); (h.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
        h.pillar.scale.set(1 + 0.25 * k, Math.min(1, k * 3.5), 1 + 0.25 * k); h.pillar.position.y = 1.5 * Math.min(1, k * 3.5); (h.pillar.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.sin(Math.PI * k);
        h.motes.forEach((m, i) => {
          const t = Math.min(1, Math.max(0, (age - (i / MOTES) * 34) / 50)), a = i * 2.4 + age * 0.12, r = 0.5 * (1 - 0.5 * t);
          m.position.set(h.x + Math.cos(a) * r, 0.1 + t * 2.5, h.z + Math.sin(a) * r); m.scale.setScalar(0.17 * (1 - 0.4 * t)); (m.material as THREE.SpriteMaterial).opacity = 0.95 * Math.sin(Math.PI * t);
        });
      }
      this.fly(tick, fighters);
    },
    fly(tick: number, fighters: readonly Pick<Fighter, 'missile' | 'weapon'>[]): void {
      fighters.forEach((f, i) => {
        const b = bolts[i]!, m = f.missile, live = !!m && tick < m.arrives;
        const kind = missileOf(f.weapon)?.kind, arrow = kind === 'bow' || kind === 'crossbow' ? kind : undefined, sh = shafts[i]!;
        b.core.visible = live && !arrow; b.halo.visible = live && !arrow; for (const t of b.trail) t.visible = live && !arrow; sh.g.visible = live && !!arrow;   // an arrow or bolt is plain wood and iron: no glow, no trail (the staff keeps its white orb)
        if (!m || !live) return;
        if (arrow && dressed[i] !== arrow) { dress(sh, arrow); dressed[i] = arrow; }
        const tint = m.tint ?? missileOf(f.weapon)?.tint;   // a spell's own colour, else the row's colour for this weapon's bolt (staff blue, arrow tan, crossbow bolt amber)
        if (tint) { (b.halo.material as THREE.SpriteMaterial).color.set(tint); for (const t of b.trail) (t.material as THREE.SpriteMaterial).color.set(tint); }
        const along = m.range * Math.min(1, Math.max(0, (tick - m.launched) / Math.max(1, m.arrives - m.launched)));
        b.core.position.set(m.x + m.dx * along, HEIGHT, m.z + m.dz * along); b.halo.position.copy(b.core.position);
        sh.g.position.set(b.core.position.x, HEIGHT, b.core.position.z); sh.g.rotation.y = Math.atan2(-m.dz, m.dx);
        if (arrow) b.halo.scale.setScalar(0.3);
        b.trail.forEach((t, k) => { const back = Math.max(0, along - (k + 1) * TRAIL_GAP); t.position.set(m.x + m.dx * back, HEIGHT, m.z + m.dz * back); });
      });
    },
  };
}
