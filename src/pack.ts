// Packs and the threat list (Combat, docs/specs/combat/threat-list.md and docs/specs/origins/mob-fights-proposal.md (b); Dom: "nothing less, nothing more", ONE engine).
// Two pure pieces, both OUTSIDE SIM_FILES like src/mobkit.ts and src/twist.ts: they read a Duel and build the next one from existing exports, they write nothing back into the sim, so no RECORD_VERSION.
//  1. A camp is a SEQUENCE of ordinary Pit bouts against the same player (`startPack`, `nextBout`): the player's fighter (health, stamina, posture, wound, cooldowns) carries over untouched, the next member walks in
//     from the play circle's far edge, the leader enters last. Waiting members are presentation only, not in the sim.
//  2. The creature's THREAT LIST (`ThreatList`): who the creature turns on when several players hit it. Donor: AzerothCore ThreatManager (damage adds threat; the current victim changes only when another beats it
//     by 110 %, casters 130 %; a list cap of 7; suppressed targets are used only when no online one is left). Deterministic: a pure function of the join order and the damage stream, ties go to the earlier joiner.
import { opponentFighter, type Duel } from './duel.ts';
import { M } from './detmath.ts';
import type { Opponent } from './moves.ts';
import { RADIUS, type State } from './sim.ts';

export const THREAT_MAX = 7;
export const SWITCH_MELEE = 1.1, SWITCH_CASTER = 1.3;

export type ThreatState = 'online' | 'suppressed' | 'offline';
export type ThreatRef = { id: string; join: number; threat: number; state: ThreatState };
export type ThreatList = { refs: readonly ThreatRef[]; victim: string | null; joins: number };
export const emptyThreat = (): ThreatList => ({ refs: [], victim: null, joins: 0 });

const rank = (r: ThreatRef): number => (r.state === 'online' ? 2 : r.state === 'suppressed' ? 1 : 0);
// The best candidate: the most available state first, then the most threat, then the earlier joiner.
const best = (refs: readonly ThreatRef[]): ThreatRef | null => refs.reduce<ThreatRef | null>((b, r) => (r.state === 'offline' ? b : !b || rank(r) > rank(b) || (rank(r) === rank(b) && (r.threat > b.threat || (r.threat === b.threat && r.join < b.join))) ? r : b), null);
// ReselectVictim: keep the current victim while it is available and nobody beats it by the margin; otherwise the best candidate.
const reselect = (list: ThreatList, caster: boolean): ThreatList => {
  const top = best(list.refs), cur = list.refs.find((r) => r.id === list.victim);
  if (!top) return { ...list, victim: null };
  if (!cur || cur.state === 'offline' || rank(top) > rank(cur)) return { ...list, victim: top.id };
  return top.id !== cur.id && top.threat > cur.threat * (caster ? SWITCH_CASTER : SWITCH_MELEE) ? { ...list, victim: top.id } : list;
};

// Join the list (aggro, or the player's engage tap). A repeat join changes nothing; the 8th is ignored until a slot frees. The first joiner is the victim until someone beats it.
export const joinThreat = (list: ThreatList, id: string, caster = false): ThreatList => {
  if (list.refs.some((r) => r.id === id) || list.refs.length >= THREAT_MAX) return list;
  return reselect({ ...list, refs: [...list.refs, { id, join: list.joins, threat: 0, state: 'online' }], joins: list.joins + 1 }, caster);
};
// Damage dealt adds threat (a hit by a non-member joins first, so a hit from a player who never tapped still counts).
export const addThreat = (list: ThreatList, id: string, amount: number, caster = false): ThreatList => {
  const joined = joinThreat(list, id, caster);
  if (!joined.refs.some((r) => r.id === id) || !(amount > 0)) return joined;
  return reselect({ ...joined, refs: joined.refs.map((r) => (r.id === id ? { ...r, threat: r.threat + amount } : r)) }, caster);
};
export const setThreatState = (list: ThreatList, id: string, state: ThreatState, caster = false): ThreatList =>
  reselect({ ...list, refs: list.refs.map((r) => (r.id === id ? { ...r, state } : r)) }, caster);
// Death, leaving the leash/aggro, the creature evading: the entry goes, its join slot is not reused (the join order of the others is what anti-gank reads).
export const dropThreat = (list: ThreatList, id: string, caster = false): ThreatList => reselect({ ...list, refs: list.refs.filter((r) => r.id !== id) }, caster);

// ---- a pack is a sequence of bouts -------------------------------------------------------------------------------------------------
export type Pack = { members: readonly Opponent[]; index: number };
// Camp order is data; the leader (last in `members`) enters when no follower is left.
export const startPack = (members: readonly Opponent[]): Pack => {
  if (!members.length) throw RangeError('Pack: a camp has at least one member');
  return { members, index: 0 };
};
export const packFoe = (pack: Pack): Opponent => pack.members[pack.index]!;
export const packLeft = (pack: Pack): number => pack.members.length - pack.index - 1;

// Where the next member walks in from: the play circle's far edge from the player (its own approach phase does the rest), facing the player. Deterministic (detmath), no RNG.
export const walkInBody = (duel: Duel, inset = 0.6): State => {
  const hero = duel.fighters[0].body, len = M.hypot(hero.x, hero.z), ux = len > 1e-6 ? -hero.x / len : 0, uz = len > 1e-6 ? -hero.z / len : 1, r = Math.max(RADIUS - inset, 0);
  const x = ux * r, z = uz * r;
  return { x, z, heading: M.atan2(hero.x - x, hero.z - z), distance: 0 };
};

// The next bout, or null while the engaged member is still standing / the player fell / nobody is left. `fled`: the member ran (twist FoeFled) and does not need to die. The player's fighter is carried over as is.
export function nextBout(pack: Pack, duel: Duel, fled = false): { pack: Pack; duel: Duel } | null {
  const memberDown = fled || (duel.finish !== null && !duel.finish.draw && duel.finish.victim === 1);
  if (!memberDown || packLeft(pack) <= 0) return null;
  const next = pack.members[pack.index + 1]!;
  return { pack: { ...pack, index: pack.index + 1 }, duel: { ...duel, fighters: [duel.fighters[0], opponentFighter(next, walkInBody(duel))], finish: null } };
}
