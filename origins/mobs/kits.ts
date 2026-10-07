// Mob behaviour presets and signature moves (Combat, top-10 #5): data on top of MOB_STYLE (styles.ts), consumed by the layer src/mobkit.ts. No new tuning table in a sim file and no new AI:
//  - a KIT is one to three rows of "throw THIS existing attack when THIS holds, at most once per COOLDOWN" (a deterministic trigger and a cooldown, no chance), which makes a kind recognisable
//    and caps how often the hero meets its worst move;
//  - a MODE is a small DELTA on the warden's own AiProfile numbers (shy, bold, ambusher): the fight-side half of Expansion's `mode` preset (the world half, aggro ring and leash, is theirs).
import { profileAt, OPPONENTS, type AiProfile } from '../../src/moves.ts';
import type { KitRow } from '../../src/mobkit.ts';
import { MOB_STYLE, type MobStyle } from './styles.ts';

export const KITS: Readonly<Record<MobStyle, readonly KitRow[]>> = {
  brute: [{ move: 'heavy', trigger: 'opener', cooldown: 1e9 }, { move: 'heavy', trigger: 'heroGuarding', cooldown: 420 }],   // opens with the maul; breaks a turtle's guard (a heavy breaks a guard), at most every 7 s
  skirmisher: [{ move: 'thrust', trigger: 'afterHit', cooldown: 240 }],   // poke again right after it lands: the second blow of a hit-and-run
  caster: [{ move: 'skill', trigger: 'opener', cooldown: 1e9 }],   // the witchfire opener (only where the fight has specials; legal() refuses it otherwise)
  beast: [{ move: 'thrust', trigger: 'opener', cooldown: 1e9 }, { move: 'heavy', trigger: 'heroExhausted', cooldown: 600 }],   // the pounce to open; the maul on a winded hero
};

export const MODES = ['shy', 'bold', 'ambusher'] as const;
export type Mode = (typeof MODES)[number];
type Knob = 'aggression' | 'pressure' | 'disengage' | 'dash' | 'lapse' | 'interrupt';
// Deltas on 0..1 knobs, then clamped. shy: hangs back and hops out; bold: presses; ambusher: closes fast and punishes a slow answer.
export const MODE: Readonly<Record<Mode, Partial<Record<Knob, number>>>> = {
  shy: { aggression: -0.2, disengage: 0.2, dash: -0.3 },
  bold: { aggression: 0.1, pressure: 0.1, disengage: -0.2 },
  ambusher: { dash: 0.4, lapse: -0.1, interrupt: 0.2 },
};

// The profile a mob of this style fights with at `level`: the style's own opponent row, then the mode's delta. Everything else is the shared engine's.
export function mobProfile(style: MobStyle, level: number, mode?: Mode): AiProfile {
  const p = profileAt(OPPONENTS[MOB_STYLE[style].opponent], level);
  if (!mode) return p;
  const out: AiProfile = { ...p };
  for (const [k, d] of Object.entries(MODE[mode]) as [Knob, number][]) out[k] = Math.max(0, Math.min(1, (p[k] ?? 0) + d));
  return out;
}
