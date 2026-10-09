// What a finisher may cut, and how a creature bleeds: ONE row per roster creature (wolf, boar, bear, goblin), keyed by the ROSTER id. Data only, no per-creature
// code: the finisher path reads a row through creatureGore(id), so a new creature is one row here and one test pass (tests/creature-gore.test.ts). Characters, 2026-10-09,
// for Release K (Combat's S7 wires it). Bones are the skin joints of the shipped GLBs, read from the files (the test re-reads them, so a renamed bone fails here, not in a cut).
// Finishers are picked from the Pit's own set (src/finishers.ts FinisherId). The beasts carry the neck cuts only: the Dwarf rule (src/roster.ts) keeps a finisher off a body until a clip is
// measured on it, and the blade-through ones need a torso a blade can cross; a beast falls back to plainDeath when the picked one is not on its row. Blood colour and amount are a starting point
// for Dom's eye at 375 wide: amount scales the Pit's BLOOD counts (src/blood-style.ts), 1 = a man.
import type { FinisherId } from './finishers.ts';

export type Shape = 'quadruped' | 'biped';
export type CreatureGore = {
  shape: Shape;
  glb: string;                                              // the rig the bones were read from (path from the repo root)
  cut: { head: readonly string[]; neck: readonly string[]; limbs: Readonly<Record<string, readonly string[]>> };   // bone names to sever at, by name; limbs keyed by limb id
  blood: { start: string; end: string; amount: number };   // the colour over a drop's life (as BLOOD start/end) and the multiple of the Pit's particle counts
  finishers: readonly FinisherId[];                         // in preference order; the last is always the safe fallback
};

const BEAST_BONES = {
  head: ['head', 'jaw'], neck: ['neck'],
  limbs: { foreL: ['front_up_L'], foreR: ['front_up_R'], hindL: ['hind_up_L'], hindR: ['hind_up_R'] },
} as const;
const BEAST_BLOOD = { start: '#5a0b0a', end: '#1c0403' };

export const CREATURE_GORE = {
  wolf: { shape: 'quadruped', glb: 'public/world/wolf.glb', cut: BEAST_BONES, blood: { ...BEAST_BLOOD, amount: 0.7 }, finishers: ['decapitation', 'plainDeath'] },
  boar: { shape: 'quadruped', glb: 'public/beasts/boar.glb', cut: BEAST_BONES, blood: { ...BEAST_BLOOD, amount: 1 }, finishers: ['decapitation', 'plainDeath'] },
  bear: { shape: 'quadruped', glb: 'public/beasts/bear.glb', cut: BEAST_BONES, blood: { ...BEAST_BLOOD, amount: 1.4 }, finishers: ['decapitation', 'plainDeath'] },
  goblin: {
    shape: 'biped', glb: 'public/world/goblin.glb',
    cut: { head: ['Head'], neck: ['neck_01'], limbs: { armL: ['upperarm_l'], armR: ['upperarm_r'], legL: ['thigh_l'], legR: ['thigh_r'] } },
    blood: { start: '#5a1410', end: '#1c0604', amount: 0.6 },
    finishers: ['splitCrown', 'decapitation', 'runThrough', 'opened', 'plainDeath'],
  },
} as const satisfies Record<string, CreatureGore>;
export type CreatureId = keyof typeof CREATURE_GORE;

export const creatureGore = (id: string): CreatureGore | null => (CREATURE_GORE as Record<string, CreatureGore>)[id] ?? null;
