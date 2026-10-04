// Direct-engine diagnostics. Reuse the live Match/Sparring path; never emulate combat rules.
import { Match } from '../../src/match.ts';
import { OPPONENTS, PLAYER_WEAPONS, profileAt, LEVEL_ANCHORS } from '../../src/moves.ts';
import { LADDER } from '../../src/ladder.ts';
import { rungOf } from '../../src/legends.ts';
import { resolveSparringPreview, specialBand } from '../../src/sparring-specials.ts';
import { SPECIAL_TESTS } from '../../src/special-look.ts';
import { loadProfile } from '../../src/profile.ts';
import { loadTrial } from '../../src/trial.ts';
import { loadScorecard } from '../../src/scorecard.ts';
import { struck } from '../../src/events.ts';
import { STRATEGIES, act, k, kt, skillUses, batteryContacts } from '../../tests/strategies.ts';

export const playableOpponents = LADDER.map(o => o.id);
export const strategyNames = [...Object.keys(STRATEGIES), 'skill then light'];
export function createSparring(search, seed) {
  const params = new URL(search, 'https://frankendom.com/').searchParams;
  const opponent = params.get('opponent');
  if (!playableOpponents.includes(opponent)) throw new Error('Choose a current playable opponent');
  for (const key of ['spar', 'opponent', 'difficulty', 'weapon', 'skill', 'special', 'yourSpecial']) {
    if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key}`);
  }
  const preview = resolveSparringPreview(`?${params}`, PLAYER_WEAPONS);
  if (preview.invalid || !preview.kit) throw new Error('Invalid Sparring URL; use its actual difficulty value (engine level 1–46), weapon and skill');
  const level = typeof preview.kit.difficulty === 'number' ? preview.kit.difficulty : LEVEL_ANCHORS[preview.kit.difficulty === 'dummy' ? 'easy' : preview.kit.difficulty];
  for (const [side, preset] of [['player', preview.yourSpecial], ['opponent', preview.special]]) {
    if (preset && specialBand(SPECIAL_TESTS[preset].level) !== specialBand(level)) throw new Error(`${side} special ${preset} does not belong to engine level ${level}'s band`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer');
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
  const ports = { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'sim-bot').profile };
  const match = new Match(OPPONENTS[opponent], 'direct-engine-test', ports, seed);
  const special = preview.special ? SPECIAL_TESTS[preview.special] : null;
  match.startSparring(preview.kit, special ? { first: special.first, level: special.level } : preview.off ? { first: 0, enabled: false } : null, preview.selection);
  return { match, config: { opponent, requestedDifficulty: preview.kit.difficulty, engineLevel: match.level, displayRank: rungOf(match.level),
    dummy: match.dummy, weapon: match.weapon, skill: preview.kit.skill, opponentSpecial: preview.special ?? (preview.off ? 'none' : 'native'),
    playerSpecial: preview.yourSpecial, specialIdentity: match.specialIdentity, aiProfile: match.dummy ? 'sparring-dummy' : profileAt(OPPONENTS[opponent], match.level),
    initialFighters: structuredClone(match.practice.duel.fighters) } };
}

// Existing single-tactic probes start sheathed at the real opening distance. Walk into range; don't teleport into the battery arena.
export function probeIntent(duel, strategy) {
  const p = duel.fighters[0], enemy = duel.fighters[1];
  if (p.phase === 'sheathed') return act('light');
  const intent = strategy === 'skill then light' ? skillUses(p.skill)[`${p.skill} then light`](duel) : STRATEGIES[strategy](duel);
  const dx = enemy.body.x - p.body.x, dz = enemy.body.z - p.body.z, distance = Math.hypot(dx, dz);
  if (strategy === 'thrust from range' && distance > 0 && distance < 1.5 * kt(duel) && !intent.action && (p.phase === 'ready' || p.phase === 'guard')) {
    return { ...intent, move: { x: -dx / distance, z: -dz / distance, yaw: 0, run: false } };
  }
  if (distance > 1.2 * k(duel) && !intent.action && (p.phase === 'ready' || p.phase === 'guard')) {
    return { ...intent, move: { x: dx / distance, z: dz / distance, yaw: 0, run: false } };
  }
  return intent;
}

export const damagingContacts = (events, side) => batteryContacts(events, side) + events.filter(e => e.type === 'SpecialLanded' && e.target === side && (e.damage ?? 0) > 0).length;

export function eventDamage(log, side) {
  return log.filter(e => e.type === 'SpecialLanded' ? e.target === side : ['Hit', 'GuardBroken', 'Blocked', 'Whipped'].includes(e.type) && struck(e) === side)
    .reduce((n, e) => n + (e.damage ?? 0), 0);
}

export function runFight(search, seed, strategy = 'light spam', ticks = 7200) {
  if (!strategyNames.includes(strategy)) throw new Error('Unknown strategy');
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 36000) throw new Error('Ticks must be 1–36000');
  const { match, config } = createSparring(search, seed);
  if (strategy === 'skill then light' && !match.practice.duel.fighters[0].skill) throw new Error('skill then light requires an equipped skill or registered special');
  const intents = [];
  for (let i = 0; i < ticks; i++) {
    const intent = probeIntent(match.practice.duel, strategy);
    intents.push(intent);
    const state = match.step(() => intent);
    match.frameEvents = []; // Only the renderer consumes this queue; fightLog retains every event.
    if (state !== 'stepped') break;
  }
  const log = match.fightLog, finish = match.practice.finish;
  const attacks = log.filter(e => e.type === 'AttackStarted' && e.actor === 0);
  const heavies = attacks.filter(e => ['heavy_overhead', 'heavy_counter', 'heavy_riposte'].includes(e.move));
  // Event damage may include overkill; keep net HP loss separate. Do not count Killed a second time.
  const specialStarts = log.filter(e => e.type === 'SpecialStarted' && e.actor === 0).length;
  return { evidenceTier: 'direct-engine-no-browser', observation: 'perfect-state scripted exploit probe; not a human or varied-player acceptance run',
    seed, strategy, config, outcome: !finish ? 'timeout' : finish.draw ? 'draw' : finish.victim === 1 ? 'win' : 'loss',
    ticks: match.practice.duel.tick, simulatedSeconds: match.practice.duel.tick / 60,
    finalHealth: match.practice.duel.fighters.map(f => f.health),
    netHpLost: match.practice.duel.fighters.map((f, i) => config.initialFighters[i].health - f.health),
    contactsTaken: damagingContacts(log, 0), contactsLanded: damagingContacts(log, 1),
    damageTaken: eventDamage(log, 0), damageDealt: eventDamage(log, 1), attacks: attacks.length + specialStarts, weaponAttackStarts: attacks.length, specialStarts, heavyAttacks: heavies.length,
    heavyShare: attacks.length + specialStarts ? heavies.length / (attacks.length + specialStarts) : 0, intents, events: log };
}
