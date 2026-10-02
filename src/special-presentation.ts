import * as THREE from 'three';
import type { CombatEvent, Fighter, Side } from './duel.ts';
import { bossSpecialId, type BossSpecialId } from './special-identity.ts';
import { SPECIAL_TESTS } from './special-look.ts';
import { SPECIAL_MODES, type Pose, type SpecialFx, type SpecialMode } from './special-modes.ts';

type Pair<T> = readonly [T, T];
type Warriors = Parameters<NonNullable<SpecialMode['extra']>>[0];
export const casterPair = <T>(pair: Pair<T>, actor: Side): Pair<T> => actor === 1 ? pair : [pair[1], pair[0]];
export const casterEvent = (event: CombatEvent, actor: Side): CombatEvent => actor === 1 ? event : { ...event, actor: (1 - event.actor) as Side, ...(event.target === undefined ? {} : { target: (1 - event.target) as Side }) };
type Slot = { id: BossSpecialId; generation: number; group: THREE.Scene; fx?: SpecialFx; events: CombatEvent[]; start: number; ended: boolean };
type Loader = (id: BossSpecialId, group: THREE.Scene) => Promise<SpecialFx>;

// Each effect retains its existing actor-1 contract; only presentation inputs are reordered.
// Epoch/rewind invalidate pending loads. No callback can start a cast or mutate the simulation.
export function createSpecialPresentation(scene: THREE.Scene, exposure: number, camera: THREE.Camera, loader: Loader = (id, group) => {
  const mode = SPECIAL_MODES[id], opponent = SPECIAL_TESTS[id].opponent;
  return mode ? mode.load(group, opponent, exposure, camera) : import('./special-fx.ts').then(({ createSpecialFx }) => createSpecialFx(group, opponent));
}) {
  const slots: [Slot | undefined, Slot | undefined] = [undefined, undefined];
  let epoch: number | undefined, lastTick = -1, generation = 0;
  const releaseGroup = (group: THREE.Scene) => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    group.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) { if (object instanceof THREE.Mesh) geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); } } });
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); for (const texture of textures) texture.dispose();
    group.clear(); group.removeFromParent();
  };
  const discard = (slot: Slot) => {
    slot.generation = ++generation; slot.fx?.clear(); releaseGroup(slot.group);
  };
  const clear = () => { for (const slot of slots) if (slot) discard(slot); slots[0] = slots[1] = undefined; lastTick = -1; };
  const load = (slot: Slot) => {
    const token = slot.generation;
    void loader(slot.id, slot.group).then((fx) => {
      if (slot.generation !== token) { fx.clear(); releaseGroup(slot.group); return; }
      slot.fx = fx;
    }).catch(() => { if (slot.generation === token) slot.ended = true; });
  };
  const select = (side: Side, id: BossSpecialId) => {
    if (slots[side]) discard(slots[side]!);
    const group = new THREE.Scene(); group.name = `special actor ${side}`; scene.add(group);
    const slot: Slot = { id, generation: ++generation, group, events: [], start: -1, ended: false };
    slots[side] = slot; load(slot); return slot;
  };
  return {
    prepare(nextEpoch: number, events: readonly CombatEvent[], fighters: Pair<Fighter>, tick: number, yielding: boolean) {
      if (epoch !== nextEpoch || tick < lastTick) clear(); epoch = nextEpoch; lastTick = tick;
      for (const side of [0, 1] as const) {
        const fighter = fighters[side], id = fighter.specialShare === undefined ? null : bossSpecialId(fighter.specialName ?? null);
        if (!id) { if (slots[side]) discard(slots[side]!); slots[side] = undefined; continue; }
        if (!slots[side] || slots[side]!.id !== id) select(side, id);
      }
      for (const event of events) {
        const side = event.actor;
        let slot = slots[side];
        if (!slot) continue;
        if (event.type === 'SpecialStarted') {
          if (yielding || event.tick <= slot.start) continue;
          const id = bossSpecialId(event.name ?? null);
          if (!id) continue;
          if (slot.id !== id || slot.ended) slot = select(side, id);
          slot.start = event.tick; slot.ended = false; slot.events = [casterEvent(event, side)];
        } else if ((event.type === 'SpecialLanded' || event.type === 'SpecialFizzled') && event.tick >= slot.start && !slot.ended) {
          slot.ended = true;
          if (event.type === 'SpecialFizzled' && !slot.fx) { discard(slot); slot.events = []; }
          else slot.events.push(casterEvent(event, side));
        }
      }
    },
    mode(side: Side) { const id = slots[side]?.id; return id ? SPECIAL_MODES[id] : undefined; },
    held(pose: Pose, side: Side, fighters: Pair<Fighter>) {
      let held: ReturnType<NonNullable<SpecialMode['held']>> | undefined;
      for (const caster of [(1 - side) as Side, side]) {
        const next = this.mode(caster)?.held?.(held?.pose ?? pose, caster === side ? 1 : 0, casterPair(fighters, caster));
        if (next) held = next;
      }
      return held;
    },
    gait<P extends string>(side: Side, fighters: Pair<Fighter>, travel: number, pose: P) {
      for (const caster of [side, (1 - side) as Side]) {
        const speed = this.mode(caster)?.travel?.(caster === side ? 1 : 0, casterPair(fighters, caster));
        if (speed !== undefined) return { travel: speed, pose: 'ready' as const };
      }
      return { travel, pose };
    },
    render(dt: number, fighters: Pair<Fighter>, tick: number, feet: Pair<THREE.Vector3 | null>, heads: Pair<THREE.Vector3 | null>, warriors: Warriors, yielding: boolean) {
      for (const side of [0, 1] as const) {
        const slot = slots[side]; if (!slot?.fx) continue;
        const mode = SPECIAL_MODES[slot.id], normalized = side === 0 && warriors ? { player: warriors.opponent, opponent: warriors.player } : warriors;
        slot.fx.render(dt, slot.events, casterPair(fighters, side), tick, casterPair(mode?.at === 'feet' ? feet : heads, side), yielding, ...(mode?.extra?.(normalized) ?? []));
        slot.events = [];
      }
    },
    get exposure() { return Math.max(0, Math.min(1, ...slots.map(slot => slot?.fx?.exposure ?? 1))); },
    clear,
  };
}
