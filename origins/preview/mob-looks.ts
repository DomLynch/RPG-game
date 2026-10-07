// ?region=1: how each Frontier foe LOOKS, keyed by character id (origins/region1/content.ts FOES). Preview only, presentation only: the body is the roster
// `opponent` in content.ts; this table only says how that body is dressed so two figures on one body (the two witches, the three goblin mobs) read as
// different people at 375 wide. Pure data: no three.js, no DOM. The mob view reads it; Characters owns it (Expansion owns content.ts, which is not edited).
//   tint     the colour the body's CLOTH is multiplied toward (0xRRGGBB, 0xffffff = untouched); metal keeps its grade
//   scale    the body's height multiplier on top of the roster's own (1 = the roster body as it is)
//   gear     the weapon the figure carries when it is not the body's own (a roster weapon id from src/moves.ts); absent = the body's own
//   dressing the Ash Frontier on him: soot = dark ash worked into the cloth and low on the body, 0..1; burnt = scorched, ragged cloth edges, 0..1
import type { WeaponId } from '../../src/moves.ts';

export type MobLook = { opponent: string; tint: number; scale: number; gear?: WeaponId; dressing: { soot: number; burnt: number }; later?: true };

export const MOB_LOOKS: Readonly<Record<string, MobLook>> = {
  // The matriarch: the Witch grown huge, mere-green and drowned, long wet rags.
  'character:mere-mother': { opponent: 'witch', tint: 0x4f6b5a, scale: 1.35, dressing: { soot: .15, burnt: .1 } },
  // The giant of the Cinder Fields: the Knight scaled up, stone and ash grey, the maul he already carries.
  'character:hrungnir': { opponent: 'knight', tint: 0x8a867f, scale: 1.5, dressing: { soot: .6, burnt: .2 } },
  // The river hag: lean (smaller than the matriarch), green-grey and wet, the trident for a reed-spear.
  'character:peg-powler': { opponent: 'witch', tint: 0x6f8577, scale: .95, gear: 'trident', dressing: { soot: .05, burnt: 0 } },
  // The Blood Court's bonded brawler: Blood Court red rags, scorched, the cleaver.
  'character:court-thrall': { opponent: 'pitborn', tint: 0x8c2f2f, scale: 1, dressing: { soot: .35, burnt: .5 } },
  // Small, quick, iron bits: the Goblin in ash brown, its own knife.
  'character:cinder-scavenger': { opponent: 'goblin', tint: 0x6b5a48, scale: .9, dressing: { soot: .7, burnt: .3 } },
  // The mere's spawn: smaller still, reed green, no soot (it is wet, not burnt).
  'character:mere-brood': { opponent: 'goblin', tint: 0x6e8a4e, scale: .75, dressing: { soot: 0, burnt: 0 } },
  // Starved servant of the ruin: tall for a goblin, grey and ragged.
  'character:ruin-ghoul': { opponent: 'goblin', tint: 0x77767a, scale: 1.1, dressing: { soot: .5, burnt: .6 } },
  // Later (held bodies / rift): kept in the table so the ids stay complete; not drawn in this sprint.
  'character:lambton-worm': { opponent: 'minotaur', tint: 0x5a4a3a, scale: 1.2, dressing: { soot: .8, burnt: .4 }, later: true },
  'character:rift-spawn': { opponent: 'goblin', tint: 0x7a5f8c, scale: 1, dressing: { soot: .2, burnt: .1 }, later: true },
};

/** The look for a character id, or null for a figure with no entry (a friendly NPC): the caller draws the roster body as it is. */
export const mobLook = (id: string): MobLook | null => MOB_LOOKS[id] ?? null;
