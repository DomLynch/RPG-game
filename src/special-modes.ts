import type * as THREE from 'three';
import { RULES } from './moves.ts';
import type { GoblinSpecial } from './special-fx-goblin.ts';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { actorPose, attackSpecs } from './combat.ts';
import { specialStage, SPECIAL_RECOVER, type SpecialTest } from './special-look.ts';
import { SLAM_AT } from './special-timing.ts';
import type { BossKind } from './special-boss-timing.ts';

// The special-effect registry (Strategy 2026-10-01: thirty specials are coming, so a lane adds ONE entry here, not an if-branch in scene.ts). A mode is picked by the
// page's `?special=<id>` (special-look.ts SPECIAL_TESTS) and says everything the scene needs: how to load its effect (a lazy chunk), which bones it reads, how the
// caster is posed, how the struck body moves, and whether the game's pale weapon trail is hidden. A `?special=` with no entry, and every other fight, draws Hades' cloud.
export type Pose = ReturnType<typeof actorPose>;
export type SpecialFx = {
  render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, at: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean, ...extra: any[]): void;   // eslint-disable-line @typescript-eslint/no-explicit-any
  clear(): void;
};
export type SpecialMode = {
  load(scene: THREE.Scene, opponent: OpponentId, exposure: number): Promise<SpecialFx>;
  at: 'feet' | 'head';   // which bone pair `render` gets: the feet (a ground effect) or the heads (a cloud)
  lift: number;          // the struck body's knee-dip, metres: negative drops him (the claw), positive lifts him (a column, a ripple under him)
  held?(pose: Pose, side: 0 | 1, fighters: readonly [Fighter, Fighter]): { pose: Pose; slam?: number };   // how the caster is posed through the cast (in place of Combat's placeholder heavy raise); `slam` is the Centurion's shield arm this frame
  hideTrail?: boolean;   // the game's pale weapon trail streaks above a raised sword through the cast
  travel?(side: 0 | 1, fighters: readonly [Fighter, Fighter]): number | undefined;   // m/s the rig is told this fighter travels while the mode wants him running or backing (his gait plays in a ready stance); undefined = the sim's own pose and speed
  extra?(w: { player: { boneWorld(name: string): THREE.Vector3 | null; anchor: THREE.Object3D }; opponent: { boneWorld(name: string): THREE.Vector3 | null; anchor: THREE.Object3D } } | undefined): unknown[];   // more arguments for `render` (bones, anchors)
};

// The one place the sim's speed and pose give way to a mode's: a mode with no `travel`, or one that answers undefined, leaves both exactly as the sim made them.
export function gait<P extends string>(mode: SpecialMode | undefined, side: 0 | 1, fighters: readonly [Fighter, Fighter], travel: number, pose: P): { travel: number; pose: P | 'ready' } {
  const speed = mode?.travel?.(side, fighters);
  return speed === undefined ? { travel, pose } : { travel: speed, pose: 'ready' };
}

// Blood Tithe's forward pose (Dom, 2026-10-01: the heavy's raise cocks the gladius back like a backhand, and the thrust held short of contact tucks the blade at his chest):
// the thrust clip held AT its contact pose through the gather, drawn back to TITHE_CHAMBER of it by TITHE_STRIKE_FROM, then driven to full contact on the strike tick.
export const TITHE_CHAMBER = 0.55, TITHE_CHAMBER_FROM = 0.84, TITHE_STRIKE_FROM = 0.92;

const ease = (k: number) => k * k * (3 - 2 * k), clamp = (k: number) => Math.min(1, Math.max(0, k));

const loadGoblin = (kind: GoblinSpecial, scene: THREE.Scene, opponent: OpponentId, exposure: number) => import('./special-fx-goblin.ts').then(({ createGoblinSpecial }) => createGoblinSpecial(scene, kind, exposure, opponent));
const goblinExtra: NonNullable<SpecialMode['extra']> = (w) => [w?.opponent.anchor ?? null, w?.player.boneWorld('Head') ?? null];
// A Plague Doctor boss special (Multi Chars, special-fx-boss.ts): a ground-and-air effect that reads both feet and both heads. The struck
// body drops (the claw's dip).
const boss = (kind: BossKind): SpecialMode => ({
  load: (scene, opponent, exposure) => import('./special-fx-boss.ts').then(({ createBossSpecial }) => createBossSpecial(scene, opponent, kind, exposure)),
  at: 'feet', lift: -0.28, hideTrail: true,   // the game's pale weapon-trail ribbon (a flat-edged wedge by the staff tip) shows through every wind-up otherwise
  extra: (w) => [[w?.player.boneWorld('Head') ?? null, w?.opponent.boneWorld('Head') ?? null]],
});

export const SPECIAL_MODES: Partial<Record<SpecialTest, SpecialMode>> = {
  // Rank 8 Red Wind (the Nightborn's Set): he holds his blade out level through the windup (the thrust clip's extended contact pose, held) and eases back to stance as it scours.
  set: {
    load: (scene, opponent, exposure) => import('./special-fx-wind.ts').then(({ createRedWind, sandLook }) => createRedWind(scene, opponent, sandLook(exposure))),
    at: 'feet', lift: 0.12,
    held(pose, side, fighters) {
      const stage = specialStage(fighters[side]);
      if (!stage) return { pose };
      const spec = attackSpecs(fighters[side].weapon).thrust, c = spec.contact / spec.recovery;
      return { pose: { pose: 'attack', attack: 'thrust', contact: c, progress: stage.stage === 'windup' ? c : c + (1 - c) * stage.progress } };
    },
  },
  // Rank 8 Shield Quake (the Centurion's Ajax): the shield goes up over the windup, is driven down at SLAM_AT (the ripple starts there) and stays planted while the sand runs.
  shield: {
    load: (scene, opponent, exposure) => import('./special-fx-quake.ts').then(({ createShieldQuake, quakeLook }) => createShieldQuake(scene, opponent, quakeLook(exposure))),
    at: 'feet', lift: 0.12, hideTrail: true,
    held(pose, side, fighters) {
      const stage = side === 1 ? specialStage(fighters[1]) : null;
      if (!stage) return { pose };
      const age = stage.stage === 'windup' ? stage.progress * RULES.special.windup : RULES.special.windup + stage.progress * SPECIAL_RECOVER;
      return { pose, slam: age < SLAM_AT - 14 ? ease(clamp(age / (SLAM_AT - 14))) : age < SLAM_AT ? 1 + clamp((age - (SLAM_AT - 14)) / 14) : age < RULES.special.windup + 18 ? 2 : 2 * (1 - ease(clamp((age - RULES.special.windup - 18) / 20))) };
    },
  },
  flies: boss('flies'), stain: boss('stain'), breath: boss('breath'),
  // Rank 10 Blood Tithe (the Centurion's Mars): the thrust held at contact (the sword arm extended), a short chamber, then the strike; the effect hides his weapon trail and yaws the arm itself.
  tithe: {
    load: (scene, opponent) => import('./special-tithe.ts').then(({ createBloodTithe }) => createBloodTithe(scene, opponent)),
    at: 'head', lift: -0.28,
    extra: (w) => [[w?.player.boneWorld('hand_r') ?? null, w?.opponent.boneWorld('hand_r') ?? null], [w?.player.anchor ?? null, w?.opponent.anchor ?? null]],
    held(pose, side, fighters) {
      const stage = side === 1 ? specialStage(fighters[1]) : null;
      if (!stage) return { pose };
      const t = attackSpecs(fighters[1].weapon).thrust, c = t.contact / t.recovery, k = stage.progress;
      const windup = c * (1 - (1 - TITHE_CHAMBER) * (ease(clamp((k - TITHE_CHAMBER_FROM) / (TITHE_STRIKE_FROM - TITHE_CHAMBER_FROM))) - ease(clamp((k - TITHE_STRIKE_FROM) / (1 - TITHE_STRIKE_FROM)))));
      return { pose: { pose: 'attack', attack: 'thrust', contact: c, progress: stage.stage === 'windup' ? windup : c + (1 - c) * k } };
    },
  },

  // The Goblin's rank 8, 9, 10 bosses (Reynard the Fox, Hermes, Loki), grey-box (special-fx-goblin.ts): the effect gets the target's feet, then his rig anchor and the
  // target's head; it hides or shifts the caster's anchor itself (Reynard drops to scoop, Hermes vanishes, Loki lunges), so there is nothing in scene.ts.
  reynard: { load: (scene, opponent, exposure) => loadGoblin('reynard', scene, opponent, exposure), at: 'feet', lift: -0.06, hideTrail: true, extra: goblinExtra,
    held: (pose, side, fighters) => (side === 1 && specialStage(fighters[1]) ? { pose: { ...pose, pose: 'ready', progress: 0 } } : { pose }) },   // plain stance, not Combat's blade-raise: the scoop is the tell
  hermes: { load: (scene, opponent, exposure) => loadGoblin('hermes', scene, opponent, exposure), at: 'feet', lift: -0.1, hideTrail: true, extra: goblinExtra },
  loki: { load: (scene, opponent, exposure) => loadGoblin('loki', scene, opponent, exposure), at: 'feet', lift: -0.1, hideTrail: true, extra: goblinExtra },
  // The Goblin's ranks 4-7 class-special OPTIONS (proposal 2026-10-02; Dom picks one): Rat Run (a low scuttling arc round the hero) and Ankle Biter (a flat skid to his feet), same seam as the bosses.
  ratrun: { load: (scene, opponent, exposure) => loadGoblin('ratrun', scene, opponent, exposure), at: 'feet', lift: -0.1, hideTrail: true, extra: goblinExtra },
  skid: { load: (scene, opponent, exposure) => loadGoblin('skid', scene, opponent, exposure), at: 'feet', lift: -0.22, hideTrail: true, extra: goblinExtra },
};
