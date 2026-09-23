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
