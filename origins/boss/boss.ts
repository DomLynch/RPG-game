// Origins O2: the world boss event — a staged encounter as a pure state machine (roadmap stage 1, the last rules module before the
// greybox). Clean room: written from docs/specs/origins/modernuo-champion-spawns.md (kill bar → boss → stop → restart delay) and the
// progression proposal's boss rule (each eligible member is paid on their own, ≥ 10% of the fight). No donor code.
//
//   dormant ──wake──▶ gathering (wave i: kills / killsToAdvance) ──last wave full──▶ boss ──health 0──▶ defeated ──reset, cooldown──▶ dormant
//                     gathering / boss ──abandon (caller: everyone left)──▶ dormant
//
// The step function never reads a clock, a random number or the DOM: time is the server's `at` (whole seconds), the state is never
// mutated, and a refused action returns the contracts' Result with the issues and nothing else. On defeat it emits one progression
// event per eligible character (the `Kill` the progression model settles; first-win-only is the MODEL's rule, not this module's) and
// one loot request per eligible character (the server rolls the table after verifying; nothing is rolled here). Both carry the same
// deterministic key, so a retried settlement is caught by the server's unique index.
import { MAX_LEVEL, MAX_PARTY, MIN_CONTRIBUTION_PERMILLE, type Kill } from '../progression/model.ts';
import { Issues, fail, ok, type Result } from '../contracts/core.ts';
import { parseId, type CharacterInstanceId, type EncounterId, type LootTableId } from '../contracts/ids.ts';
import { parseEncounterDefinition, type EncounterDefinition } from '../contracts/world.ts';

// The contract's own type with the boss's optional level and health proven present (not a second content type).
export type BossEncounter = EncounterDefinition & { boss: Required<EncounterDefinition['boss']> };

// Every emitted key is `<encounter>:<defeat #>:<pc>`. With up to 6 defeat digits and the longest pc id ("pc:" + a 96-character local
// part, contracts/ids.ts), the encounter id has this many characters left inside MINT_KEY_PATTERN's 128.
const MINT_KEY_MAX = 128, LONGEST_PC_ID = 'pc:'.length + 96, DEFEAT_DIGITS = 6;
export const MAX_BOSS_ID_LENGTH = MINT_KEY_MAX - LONGEST_PC_ID - DEFEAT_DIGITS - 2;

// Parse an encounter and check it can run as a world boss: level and health present, the contract's percent equal to the progression
// model's threshold, and an id short enough that no defeat can emit an unmintable key.
export function parseBossDefinition(raw: unknown, path = ''): Result<BossEncounter> {
  const r = parseEncounterDefinition(raw, path);
  if (!r.ok) return r;
  const def = r.value, issues = new Issues(), at = (key: string): string => (path ? `${path}.${key}` : key);
  if (def.boss.level === undefined) issues.add('missing-field', at('boss.level'), 'a world boss needs its level (the event\'s targetLevel)');
  if (def.boss.health === undefined) issues.add('missing-field', at('boss.health'), 'a world boss needs its health (the contribution denominator)');
  // One threshold: the contract's percent must say what the progression model enforces, or the two would disagree about who is paid.
  if (def.rewards.minContributionPercent * 10 !== MIN_CONTRIBUTION_PERMILLE) {
    issues.add('rule-violation', at('rewards.minContributionPercent'), `a world boss pays at ${MIN_CONTRIBUTION_PERMILLE / 10}% of its health`);
  }
  if (def.id.length > MAX_BOSS_ID_LENGTH) issues.add('out-of-range', at('id'), `a world boss id is at most ${MAX_BOSS_ID_LENGTH} characters, so its mint keys fit`);
  return issues.finish(def as BossEncounter);
}

export type Stage = 'dormant' | 'gathering' | 'boss' | 'defeated';
export type Contributor = { dealt: number; level: number; party: string | null }; // level and party as at the first hit (engage)
export type BossState = {
  stage: Stage;
  wave: number; // index into encounter.stages while gathering
  kills: number; // kills toward the current wave
  health: number; // the boss's remaining health
  since: number; // server seconds of the last stage change (the cooldown starts at the defeat)
  defeats: number; // completed kills of this boss, part of every emitted key
  contributors: ReadonlyMap<CharacterInstanceId, Contributor>;
};

export type Action =
  | { kind: 'wake'; at: number }
  | { kind: 'foe-killed'; at: number }
  | { kind: 'damage'; at: number; character: string; amount: number; level: number; party: string | null }
  | { kind: 'abandon'; at: number }
  | { kind: 'reset'; at: number };

export type LootRequest = { encounter: EncounterId; lootTable: LootTableId; character: CharacterInstanceId; mintKey: string };
export type Step = { state: BossState; events: Kill[]; loot: LootRequest[] };

export const dormant = (def: BossEncounter, at = 0): BossState =>
  ({ stage: 'dormant', wave: 0, kills: 0, health: def.boss.health, since: at, defeats: 0, contributors: new Map() });

export const sharePermille = (def: BossEncounter, c: Contributor): number => Math.floor((c.dealt * 1000) / def.boss.health);
export const isEligible = (def: BossEncounter, c: Contributor): boolean => sharePermille(def, c) >= MIN_CONTRIBUTION_PERMILLE;

const refuse = (path: string, message: string): Result<Step> => fail('rule-violation', path, message);
const moved = (state: BossState): Result<Step> => ok({ state, events: [], loot: [] });

export function step(def: BossEncounter, state: BossState, action: Action): Result<Step> {
  const at: unknown = action.at;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < state.since) return refuse('at', 'a server time in whole seconds, never before the last stage change');
  const off = (): Result<Step> => refuse('kind', `"${String(action.kind)}" is not legal while ${state.stage}`);
  const fresh = dormant(def, at);

  switch (action.kind) {
    case 'wake':
      return state.stage === 'dormant' ? moved({ ...fresh, stage: 'gathering', defeats: state.defeats }) : off();

    case 'foe-killed': {
      if (state.stage !== 'gathering') return off(); // a minion killed beside the boss counts for nothing (spec §6)
      const kills = state.kills + 1;
      if (kills < def.stages[state.wave]!.killsToAdvance) return moved({ ...state, kills });
      const wave = state.wave + 1;
      return wave < def.stages.length ? moved({ ...state, wave, kills: 0, since: at }) : moved({ ...state, stage: 'boss', kills: 0, since: at });
    }

    case 'abandon':
      return state.stage === 'gathering' || state.stage === 'boss' ? moved({ ...fresh, defeats: state.defeats }) : off();

    case 'reset': {
      if (state.stage !== 'defeated') return off();
      if (at - state.since < def.restartSeconds) return refuse('at', `the boss returns ${def.restartSeconds}s after its defeat`);
      return moved({ ...fresh, defeats: state.defeats });
    }

    case 'damage': {
      if (state.stage === 'defeated') return moved(state); // late hits after the kill change nothing and pay nothing
      if (state.stage !== 'boss') return off();
      const issues = new Issues();
      const character = issues.absorb(parseId(action.character, 'pc', 'character'));
      const { amount, level, party } = action;
      if (!Number.isSafeInteger(amount) || amount < 1) issues.add('out-of-range', 'amount', 'damage is a whole number above 0');
      if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) issues.add('out-of-range', 'level', `a career level is 1..${MAX_LEVEL}`);
      if (party !== null && (typeof party !== 'string' || party.length < 1 || party.length > 64)) issues.add('wrong-type', 'party', 'a party key is 1..64 characters, or null');
      if (!character || !issues.empty) return issues.finish(undefined as never);
      const prior = state.contributors.get(character);
      if (!prior && party !== null && [...state.contributors.values()].filter(c => c.party === party).length >= MAX_PARTY) {
        return refuse('party', `a party is at most ${MAX_PARTY}`);
      }
      const dealt = Math.min(amount, state.health); // overkill is not contribution, so the shares never pass 100%
      const contributors = new Map(state.contributors).set(character, prior ? { ...prior, dealt: prior.dealt + dealt } : { dealt, level, party });
      const health = state.health - dealt;
      if (health > 0) return moved({ ...state, health, contributors });
      return ok(defeat(def, { ...state, stage: 'defeated', health, since: at, defeats: state.defeats + 1, contributors }, at));
    }
  }
  return refuse('kind', 'unknown action');
}

// The kill: one progression event and one loot request per eligible character, in engage order. Called once per defeat, from the
// transition into 'defeated', so a replayed killing blow lands on a defeated boss and emits nothing.
function defeat(def: BossEncounter, state: BossState, at: number): Step {
  const { id, boss } = def;
  const events: Kill[] = [], loot: LootRequest[] = [];
  for (const [character, c] of state.contributors) {
    if (!isEligible(def, c)) continue;
    const key = `${id}:${state.defeats}:${character}`;
    const partyLevels = c.party === null ? [] : [...state.contributors].filter(([o, m]) => o !== character && m.party === c.party).map(([, m]) => m.level);
    events.push({
      kind: 'kill', id: key, at, type: 'world-boss', target: id, targetLevel: def.boss.level, contributionPermille: sharePermille(def, c),
      ...(partyLevels.length ? { partyLevels } : {}),
    });
    loot.push({ encounter: id, lootTable: boss.loot, character, mintKey: key });
  }
  return { state, events, loot };
}
