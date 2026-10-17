// Mob behaviour presets and signature moves (Combat, top-10 #5): data on top of MOB_STYLE (styles.ts), consumed by the layer src/fight/mobkit.ts. No new tuning table in a sim file and no new AI:
//  - a KIT is one to three rows of "throw THIS existing attack when THIS holds, at most once per COOLDOWN" (a deterministic trigger and a cooldown, no chance), which makes a kind recognisable
//    and caps how often the hero meets its worst move;
//  - a MODE is a small DELTA on the warden's own AiProfile numbers (shy, bold, ambusher): the fight-side half of Expansion's `mode` preset (the world half, aggro ring and leash, is theirs).
import { profileAt, OPPONENTS, type AiProfile, initialKit, kitIntent, type ChainRow, type KitRow, type Duel, type Intent } from '../../fight/server.ts';
import { MOB_STYLE, type MobStyle } from './styles.ts';
import KIT_DATA from './mob-kits.json' with { type: 'json' };

export const KITS = KIT_DATA.kits as unknown as Readonly<Record<MobStyle, readonly KitRow[]>>;   // rows (mob-kits.json): the data the kit tag hashes
export const CHAINS = KIT_DATA.chains as unknown as Readonly<Record<MobStyle, readonly ChainRow[]>>;

export const MODES = ['shy', 'bold', 'ambusher'] as const;
export type Mode = (typeof MODES)[number];
type Knob = 'aggression' | 'pressure' | 'disengage' | 'dash' | 'lapse' | 'interrupt';
// Deltas on 0..1 knobs, then clamped (rows: mob-kits.json `modes`). shy: hangs back and hops out; bold: presses; ambusher: closes fast and punishes a slow answer.
export const MODE = KIT_DATA.modes as unknown as Readonly<Record<Mode, Partial<Record<Knob, number>>>>;

// The layer a mob of this style fights under (src/fight/combat.ts stepPractice's `layer`, src/fight/match.ts Match.layer): its state resets on tick 0, so a rematch starts clean.
export function mobLayer(style: MobStyle): (duel: Duel, warden: Intent) => Intent {
  const rows = KITS[style], chains = CHAINS[style]; let state = initialKit(rows);
  return (duel, warden) => { if (duel.tick === 0) state = initialKit(rows); const r = kitIntent(duel, 1, warden, rows, state, chains); state = r.state; return r.intent; };
}

// The profile a mob of this style fights with at `level`: the style's own opponent row, then the mode's delta. Everything else is the shared engine's.
export function mobProfile(style: MobStyle, level: number, mode?: Mode): AiProfile {
  const p = profileAt(OPPONENTS[MOB_STYLE[style].opponent], level);
  if (!mode) return p;
  const out: AiProfile = { ...p };
  for (const [k, d] of Object.entries(MODE[mode]) as [Knob, number][]) out[k] = Math.max(0, Math.min(1, (p[k] ?? 0) + d));
  return out;
}
