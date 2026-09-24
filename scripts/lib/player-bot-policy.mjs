// Test player's one tactic. Observations are current debug state and events, never future simulation state.
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
    if (e.type === 'Charged' && e.actor === 0) state.charged = true;
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
  for (const e of obs.events) {
    if (e.type === 'AttackStarted' && e.actor === 1) state.tell = { tick: e.tick, move: e.move, direction: e.direction };
    if (e.type === 'AttackMissed' && e.actor === 1) state.miss = { tick: e.tick, ready: e.tick + reactionTicks, until: e.tick + 30 };
    if ((e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0) state.defence = { tick: e.tick, ready: e.tick + reactionTicks, until: e.tick + 20 };
    if (e.type === 'Charged' && e.actor === 0) state.charged = true;
  }
  const eligible = [];
  const choice = (keys, press, reason) => ({ keys, press, reason, eligible: [...eligible] });
  if (!obs.hp || !obs.enemyHp) return choice([], null, 'fight ended');
  const own = obs.ownState ?? obs.phase, nearWall = obs.radius >= config.wallRadius;
  if (['hurt', 'roll', 'backstep'].includes(own)) return choice([], null, 'recover action');
  if (own === 'attack' || obs.phase === 'attack') return choice(state.charging && !state.charged ? ['KeyG'] : [], null, 'finish committed attack');
  state.charging = false; state.charged = false;
  const counterReady = state.defence && obs.tick >= state.defence.ready && obs.tick <= state.defence.until && obs.heavy && obs.stamina >= 30 && obs.gap <= 1.9;
  const quickReady = state.miss && obs.tick >= state.miss.ready && obs.tick <= state.miss.until && obs.stamina >= 20 && obs.gap <= config.thrustRange && (own === 'ready' || own === 'guard');
  if (counterReady) eligible.push({ kind: 'guard counter', tick: state.defence.tick });
  if (quickReady) eligible.push({ kind: 'quick punish', tick: state.miss.tick });
  if (counterReady) {
    state.defence = null;
    return choice([], 'KeyG', 'confirmed guard counter');
  }
  if (state.miss && obs.tick < state.miss.ready && obs.tick <= state.miss.until)
    return choice(obs.gap > config.thrustRange ? ['KeyW'] : [], null, 'wait for missed-swing punish');
  if (quickReady) {
    state.miss = null;
    if (obs.gap <= 1.55 && obs.light && obs.stamina >= 25) return choice(['KeyW'], 'KeyF', 'quick slash after miss');
    if (obs.thrust) return choice(['KeyW'], 'KeyT', 'reachable thrust after miss');
  }
  const tell = state.tell, age = tell ? obs.tick - tell.tick : 0;
  if (tell && obs.enemyPhase === 'attack' && age >= reactionTicks && state.answeredTell !== tell.tick && (own === 'ready' || own === 'guard')) {
    if (tell.move === 'heavy_overhead' && obs.stamina >= 30) {
      state.answeredTell = tell.tick;
      eligible.push({ kind: 'evade tell', tick: tell.tick });
      return choice([nearWall ? 'KeyW' : 'KeyA'], 'KeyE', 'lateral evade to keep reach');
    }
  }
  if (obs.stamina < 35) return choice(nearWall && obs.gap > 1.2 ? ['KeyW'] : [], null, 'recover stamina');
  if (obs.gap > (nearWall ? 1.2 : config.range)) return choice(['KeyW'], null, 'close distance');
  if ((own === 'ready' || own === 'guard') && obs.enemyPhase === 'ready' && obs.stamina < 55 && obs.stamina >= 35) {
    if (obs.gap <= 1.55 && obs.light) { eligible.push({ kind: 'quick pressure', tick: obs.tick }); return choice([], 'KeyF', 'quick slash while stamina is low'); }
    if (obs.gap <= config.thrustRange && obs.thrust) { eligible.push({ kind: 'quick pressure', tick: obs.tick }); return choice([], 'KeyT', 'fast thrust while stamina is low'); }
  }
  if (obs.heavy && (own === 'ready' || own === 'guard')) { state.charging = true; return choice(['KeyG'], null, 'charged heavy at reach'); }
  return choice([], null, 'wait for legal opening');
}
