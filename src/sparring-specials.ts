// Admin test selections only: registry IDs are opponent previews, never the player's MOVE.
import { LEVELS, LEVEL_ANCHORS, PLAYER_WEAPONS, type WeaponId } from './moves.ts';
import { SPECIAL_TESTS, specialParam, type SpecialTest } from './special-look.ts';
import { sparringAsked, sparringParam, type SparringKit, type SparringLevel } from './sparring.ts';
import { isOpponentId } from './roster.ts';

export const SPECIAL_LABELS = {
  wake: 'Stone Wake', stirring: 'Stirring', tempo: "Doctor's Tempo", pulse: 'Taking the Pulse', drag: 'Ground Drag', swing: 'Held Swing',
  cuts: 'Seven Cuts', standfast: 'Stand Fast', ratrun: 'Rat Run',
  shield: 'Shield Quake', centurion: 'The Charge', tithe: 'Blood Tithe',
  set: 'Red Wind', hades: "Hades' Shadow", nyx: 'Nyx Nightfall',
  mist: 'Avalon Mist', echo: 'Foretold Step', price: 'The Price', flies: 'Plague Flies', stain: 'Poison Stain', breath: 'Last Breath',
  reynard: 'Dirty Fistful', hermes: 'Gone', loki: 'Three Liars', arawn: 'Baying Circle', thanatos: 'Long Shadow', reaper: 'Harvest Sweep',
  dwarf8: 'The Word', dwarf9: 'Three Blows', dwarf10: 'Rim Shake', shield8: 'Bared Face', shield9: 'The Ring', shield10: 'Aegis Sweep',
  sling: 'The Sling', haze: 'Wrath', storm: 'Storm Follows Him', antaeus: 'Cracking Ground', surtr: 'Ash Fall', typhon: 'Wind Wall',
} as const satisfies Record<SpecialTest, string>;
export const SPECIAL_BANDS = ['L1–3', 'L4–7', 'L8', 'L9', 'L10'] as const;
export function specialBand(level: number): number | null {
  if (!Number.isInteger(level) || level < 1 || level > LEVELS) return null;
  return level < 16 ? 0 : level < 36 ? 1 : level < 41 ? 2 : level < 46 ? 3 : 4;
}
export function sparringSpecialOptions(opponent: string): { band: string; ids: SpecialTest[]; unavailable: string }[] {
  return SPECIAL_BANDS.map((band, i) => ({ band,
    ids: (Object.keys(SPECIAL_TESTS) as SpecialTest[]).filter(id => SPECIAL_TESTS[id].opponent === opponent && specialBand(SPECIAL_TESTS[id].level) === i),
    unavailable: opponent === 'nightborn' && i === 0 ? 'Pale Lunge held · no registered preview' : 'Unavailable · no registered preview',
  }));
}
export function defaultSparringSpecial(opponent: string, difficulty: SparringLevel): SpecialTest | null {
  const level = typeof difficulty === 'number' ? difficulty : difficulty === 'dummy' ? NaN : LEVEL_ANCHORS[difficulty];
  const band = specialBand(level);
  return band === null ? null : sparringSpecialOptions(opponent)[band].ids[0] ?? null;
}
// main and scene must agree. Standalone ?special= links keep their existing harness contract;
// combined links must carry a valid kit and the selected preview's actual opponent.
export function resolveSparringPreview(search: string, carried: readonly WeaponId[] = PLAYER_WEAPONS): { special: SpecialTest | null; kit: SparringKit | null; invalid: boolean; off: boolean } {
  if (!sparringAsked(search)) return { special: specialParam(search), kit: null, invalid: false, off: false };
  const params = new URLSearchParams(search), kit = sparringParam(search, carried);
  if (!params.has('special')) return { special: null, kit, invalid: false, off: false };
  const raw = params.get('special')?.toLowerCase() ?? '';
  if (raw === 'none' && kit && isOpponentId(params.get('opponent') ?? '')) return { special: null, kit, invalid: false, off: true };
  const special = Object.hasOwn(SPECIAL_TESTS, raw) ? raw as SpecialTest : null;
  const valid = kit && kit.difficulty !== 'dummy' && special && params.get('opponent') === SPECIAL_TESTS[special].opponent;
  return valid ? { special, kit, invalid: false, off: false } : { special: null, kit: null, invalid: true, off: false };
}
