// Test player's one tactic. Observations are current debug state and events, never future simulation state.
// Fight seeds for a batch: the first as given, then a murmur3 finalizer chain. Not the AI's own lcg: a seed one lcg step after
// another starts the opponent's roll stream one draw later, and such pairs can fall into step and replay the same fight
// (Pitborn in the 2026-09-24 browser gate; Goblin and five others headless), so a 3-fight gate row held 1 or 2 real fights.
// Per opponent: [the range the bot fights at, its defence choice, optional policy flags]. Lives here so a test can pin it.
export const BOT_CONFIG = { veteran: [2.1, 'guard'], pitborn: [2.1, 'dodge'], goblin: [1.8, 'parry'], nightborn: [2.1, 'parry'], executioner: [2.1, 'dodge'], knight: [2.1, 'dodge'], dwarf: [1.8, 'dodge'], plaguedoctor: [1.8, 'parry'], witch: [2.1, 'guard'], shieldmaiden: [1.8, 'dodge', { holdWorn: true }] };   // holdWorn: see player-bot-policy.mjs (worn hysteresis)

export function fightSeeds(first, count) {
  const seeds = [first >>> 0];
  while (seeds.length < count) {
    let s = (seeds.at(-1) ^ 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0; s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
    seeds.push((s ^ (s >>> 16)) >>> 0);
  }
  return seeds;
}

const MIRROR = { right: 'ArrowLeft', left: 'ArrowRight', overhead: 'ArrowUp', low: 'ArrowDown' };

export function chooseGuardCounter(obs, state, reactionTicks, config) {
  for (const e of obs.events) {
    if (e.type === 'AttackStarted' && e.actor === 1) state.tell = { tick: e.tick, direction: e.direction, move: e.move };
    if (e.type === 'AttackMissed' && e.actor === 1) { state.missReady = e.tick + reactionTicks; state.missUntil = e.tick + 30; }
    if ((e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0) { state.counterReady = e.tick + reactionTicks; state.counterUntil = e.tick + 20; }
    if (e.type === 'AttackStarted' && e.actor === 0) state.counterUntil = 0;
  }
  if (!obs.hp || !obs.enemyHp) return { keys: [], press: null };
  const nearWall = obs.radius >= (config?.wallRadius ?? Infinity);
  if (state.counterUntil >= obs.tick && obs.tick >= state.counterReady && obs.heavy && obs.stamina >= 35 && obs.phase !== 'attack') {
    state.counterUntil = 0;
    return { keys: [], press: 'KeyG' };
  }
  if (obs.phase === 'attack' || obs.phase === 'hurt' || obs.phase === 'roll') return { keys: [], press: null };
  if (state.missUntil >= obs.tick && obs.tick >= state.missReady && obs.stamina >= 30 && obs.phase === 'ready') {
    if (obs.gap > (config?.thrustRange ?? 1.9)) return { keys: ['KeyW'], press: null };
    state.missUntil = 0;
    return { keys: ['KeyW'], press: 'KeyT' };
  }
  if (state.tell?.move === 'heavy_overhead' && obs.enemyPhase === 'attack' && obs.tick - state.tell.tick >= reactionTicks
      && state.dodgedTell !== state.tell.tick && obs.stamina >= 30) {
    state.dodgedTell = state.tell.tick;
    return { keys: [nearWall ? 'KeyW' : 'KeyS'], press: 'KeyE' }; // movement is held on the press, so Step becomes a real roll
  }
  if (nearWall && obs.heavy && obs.stamina >= 35 && obs.phase === 'ready' && obs.gap < 1.4) return { keys: [], press: 'KeyG' };
  if (obs.stamina < 45) return { keys: nearWall ? (obs.gap > 1.2 ? ['KeyW'] : []) : (obs.gap < 1.25 ? ['KeyS'] : []), press: null };
  const keys = [];
  if (obs.gap > (nearWall ? 1.2 : 1.65)) keys.push('KeyW');
  if (obs.gap < 2.6) {
    keys.push('KeyQ');
    if (state.tell && obs.tick - state.tell.tick >= reactionTicks && obs.enemyPhase === 'attack') {
      const side = MIRROR[state.tell.direction];
      if (side) keys.push(side);
    }
  }
  return { keys, press: null };
}

// Delayed tell-reading with the same charged-heavy input a player can hold.
export function chooseChargedAttack(obs, state, reactionTicks, config) {
  for (const e of obs.events) {
    if (e.type === 'AttackStarted' && e.actor === 1) state.tell = { tick: e.tick, move: e.move, direction: e.direction };
    if (e.type === 'Charged' && e.actor === 0 || e.type === 'ChargeCue' && state.charging) state.charged = true;
    if ((e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0) { state.counterReady = e.tick + reactionTicks; state.counterUntil = e.tick + 20; }
  }
  if (!obs.hp || !obs.enemyHp) return { keys: [], press: null };
  const nearWall = obs.radius >= config.wallRadius;
  if (obs.phase === 'attack') return { keys: state.charging && !state.charged ? ['KeyG'] : [], press: null };
  state.charging = false;
  state.charged = false;
  if (obs.phase === 'hurt' || obs.phase === 'roll') return { keys: [], press: null };
  if (state.counterUntil >= obs.tick && obs.tick >= state.counterReady && obs.heavy) {
    state.counterUntil = 0;
    return { keys: ['KeyG'], press: null };
  }
  const tell = state.tell, age = tell ? obs.tick - tell.tick : 0;
  if (tell && obs.enemyPhase === 'attack' && age >= reactionTicks && obs.phase === 'ready') {
    if (config.defense === 'dodge' && tell.move === 'heavy_overhead' && state.answeredTell !== tell.tick && obs.stamina >= 30) {
      state.answeredTell = tell.tick;
      return { keys: [nearWall ? 'KeyW' : 'KeyS'], press: 'KeyE' };
    }
    if (config.defense === 'parry' && state.answeredTell !== tell.tick && age >= (config.windup[tell.move] ?? 0) - config.parryTicks + 2) {
      state.answeredTell = tell.tick;
      return { keys: ['KeyQ', ...(MIRROR[tell.direction] ? [MIRROR[tell.direction]] : [])], press: null };
    }
    if (config.defense === 'guard') return { keys: ['KeyQ', ...(MIRROR[tell.direction] ? [MIRROR[tell.direction]] : [])], press: null };
  }
  if (obs.stamina < 35) return { keys: nearWall && obs.gap > 1.2 ? ['KeyW'] : [], press: null };
  if (obs.gap > (nearWall ? 1.2 : config.range)) return { keys: ['KeyW'], press: null };
  if (obs.phase === 'ready' && obs.heavy) { state.charging = true; return { keys: ['KeyG'], press: null }; }
  return { keys: [], press: null };
}

// Review policy: take a reachable punish or earned counter, otherwise create a safe heavy opening.
export function chooseTacticalAttack(obs, state, reactionTicks, config) {
  state.attacks ??= 0;
  state.heavies ??= 0;
  for (const e of obs.events) {
    if (e.type === 'AttackStarted' && e.actor === 1) state.tell = { tick: e.tick, move: e.move, direction: e.direction };
    // A charge is known from the debug event, or (limited) the charge sound while a seen heavy is winding up and we are not holding
    // our own: the cue is one sound for either fighter, so on our own hold it is ours.
    if (e.type === 'Charged' && e.actor === 1 && e.move === 'heavy_overhead') state.chargedThreat = { tick: e.tick, ready: e.tick + reactionTicks, cue: 'event' };
    if (e.type === 'ChargeCue' && !state.charging && state.tell?.move === 'heavy_overhead' && obs.enemyPhase === 'attack')
      state.chargedThreat = { tick: e.tick, ready: e.tick + reactionTicks, cue: 'sound' };
    if (e.type === 'AttackMissed' && e.actor === 1) state.miss = { tick: e.tick, ready: e.tick + reactionTicks, until: e.tick + 30 };
    if ((e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0) state.defence = { tick: e.tick, ready: e.tick + reactionTicks, until: e.tick + 20 };
    if (e.type === 'Blocked' && e.actor === 1) state.enemyBlock = e.tick;
    if (e.type === 'AttackStarted' && e.actor === 0) {
      state.attacks++;
      if (e.move?.startsWith('heavy')) state.heavies++;
      else state.quickRestUntil = e.tick + 70;
      state.heavyPending = 0;
    }
    if (e.type === 'Charged' && e.actor === 0 || e.type === 'ChargeCue' && state.charging) state.charged = true;
  }
  // Hold time: a seen heavy still winding up well past its plain windup is being held for the charge.
  const heldFor = config.windup?.heavy_overhead + (config.holdMargin ?? 8);
  if (state.tell?.move === 'heavy_overhead' && obs.enemyPhase === 'attack' && obs.tick - state.tell.tick >= heldFor
      && (state.chargedThreat?.tick ?? -1) < state.tell.tick) state.chargedThreat = { tick: obs.tick, ready: obs.tick, cue: 'hold time' };
  const eligible = [];
  const choice = (keys, press, reason) => ({ keys, press, reason, eligible: [...eligible] });
  if (!obs.hp || !obs.enemyHp) return choice([], null, 'fight ended');
  const own = obs.ownState ?? obs.phase, nearWall = obs.radius >= config.wallRadius;
  if (['hurt', 'roll', 'backstep'].includes(own)) return choice([], null, 'recover action');
  if (own === 'attack' || obs.phase === 'attack') return choice(state.charging && !state.charged ? ['KeyG'] : [], null, 'finish committed attack');
  state.charging = false; state.charged = false;
  if (state.heavyPending && obs.tick - state.heavyPending > 8) state.heavyPending = 0;
  const heavyAllowed = !state.heavyPending && 5 * (state.heavies + 1) <= state.attacks + 1;
  const threat = state.chargedThreat;
  if (threat && state.rolledCharge !== threat.tick && obs.tick >= threat.ready
      && obs.enemyPhase === 'attack' && (own === 'ready' || own === 'guard') && obs.stamina >= 35) {
    state.rolledCharge = threat.tick;
    eligible.push({ kind: 'evade charged overhead', tick: threat.tick, cue: threat.cue });
    return choice([nearWall ? 'KeyW' : 'KeyA'], 'KeyE', `lateral roll clear of charged overhead (${threat.cue})`);
  }
  const counterReady = state.defence && obs.tick >= state.defence.ready && obs.tick <= state.defence.until && obs.stamina >= 30 && obs.gap <= 1.9;
  const quickReady = state.miss && obs.tick >= state.miss.ready && obs.tick <= state.miss.until && obs.stamina >= 45 && obs.gap <= config.thrustRange && (own === 'ready' || own === 'guard');
  if (counterReady) eligible.push({ kind: 'guard counter', tick: state.defence.tick });
  if (quickReady) eligible.push({ kind: 'quick punish', tick: state.miss.tick });
  if (counterReady) {
    state.defence = null;
    if (heavyAllowed && obs.heavy) { state.heavyPending = obs.tick; return choice([], 'KeyG', 'budgeted heavy after defence'); }
    if (obs.gap <= 1.55 && obs.light && obs.stamina >= 55) return choice([], 'KeyF', 'slash after defence');
    if (obs.thrust && obs.stamina >= 50) return choice([], 'KeyT', 'thrust after defence');
  }
  if (state.miss && obs.tick < state.miss.ready && obs.tick <= state.miss.until)
    return choice(obs.gap > config.thrustRange ? ['KeyW'] : [], null, 'wait for missed-swing punish');
  if (quickReady) {
    state.miss = null;
    if (obs.gap <= 1.55 && obs.light && obs.stamina >= 55) return choice(['KeyW'], 'KeyF', 'quick slash after miss');
    if (obs.thrust && obs.stamina >= 50) return choice(['KeyW'], 'KeyT', 'reachable thrust after miss');
  }
  // Worn down: posture high (the on-screen meter) and stamina low. Another block would feed the posture break, so get out: roll away
  // from a seen swing (sideways at the wall), and between swings walk out of reach until the meter drains.
  // Worn: posture high and stamina low. By default it clears the moment either recovers (03234673). With `holdWorn` (a CONFIG
  // row flag, the Shieldmaiden's only) it stays set until the posture meter has drained: clearing at stamina 50 re-entered one
  // attack from worn onto her gladius thrust (3024046025: 15 back-offs, a loss). Not global: posture < 25 flipped Goblin
  // 3024046025 and Nightborn 1637974753 to losses and < 40 was worse (timeouts), so the tool keeps 03234673 everywhere else.
  const wornNow = obs.posture >= (config.postureOut ?? 50) && obs.stamina < 50;
  if (!config.holdWorn) state.worn = wornNow;
  else if (wornNow) state.worn = true;
  else if (obs.posture < 25 && obs.stamina >= 50) state.worn = false;
  const worn = state.worn, away = nearWall ? 'KeyA' : 'KeyS';
  const tell = state.tell, age = tell ? obs.tick - tell.tick : 0;
  if (tell && obs.enemyPhase === 'attack' && age >= reactionTicks && (own === 'ready' || own === 'guard')) {
    if (worn && obs.dodge !== false && obs.stamina >= 30) { eligible.push({ kind: 'disengage', tick: tell.tick }); return choice([away], 'KeyE', 'roll out: posture high, stamina low'); }
    // A heavy costs more stamina to block than a low bar holds, and an unpaid block is a guard break: roll out, or walk if a roll is unaffordable.
    if (tell.move === 'heavy_overhead' && obs.stamina < (config.heavyBlockCost ?? 45)) {
      eligible.push({ kind: 'disengage', tick: tell.tick });
      return obs.dodge !== false && obs.stamina >= 30 ? choice([away], 'KeyE', 'roll out: heavy, stamina too low to block') : choice([away], null, 'walk out: heavy, stamina too low to block');
    }
    const side = MIRROR[tell.direction];
    if (side) { eligible.push({ kind: 'guard tell', tick: tell.tick }); return choice(['KeyQ', side], null, 'guard the observed attack'); }
  }
  if (obs.enemyPhase === 'attack') return choice([], null, 'wait for attack tell');
  if (worn && (config.holdWorn || obs.gap < (config.disengageGap ?? 3))) return choice(obs.gap < (config.disengageGap ?? 3) ? [away] : [], null, 'back off: posture high, stamina low');
  if (state.quickRestUntil > obs.tick) return choice(obs.gap < 1.25 && !nearWall ? ['KeyS'] : [], null, 'recover after quick attack');
  if (obs.stamina < 50) return choice(nearWall && obs.gap > 1.2 ? ['KeyW'] : [], null, 'recover defensive stamina');
  if (obs.gap > config.thrustRange) return choice(['KeyW'], null, 'close to thrust range');
  if (heavyAllowed && obs.heavy && state.enemyBlock && obs.tick - state.enemyBlock <= 60 && obs.gap <= 1.9) {
    state.heavyPending = obs.tick; state.charging = true;
    return choice(['KeyG'], null, 'budgeted heavy against guard');
  }
  if (obs.gap <= 1.55 && obs.light && obs.stamina >= 55) return choice([], 'KeyF', 'range-aware quick slash');
  if (obs.thrust) return choice([], 'KeyT', 'range-aware thrust');
  return choice([], null, 'wait for legal quick attack');
}
