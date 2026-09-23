// Test player's one tactic. Observations are current debug state and events, never future simulation state.
const MIRROR = { right: 'ArrowLeft', left: 'ArrowRight', overhead: 'ArrowUp', low: 'ArrowDown' };

export function chooseGuardCounter(obs, state, reactionTicks) {
  for (const e of obs.events) {
    if (e.type === 'AttackStarted' && e.actor === 1) state.tell = { tick: e.tick, direction: e.direction, move: e.move };
    if (e.type === 'AttackMissed' && e.actor === 1) { state.missReady = e.tick + reactionTicks; state.missUntil = e.tick + 30; }
    if ((e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0) { state.counterReady = e.tick + reactionTicks; state.counterUntil = e.tick + 20; }
    if (e.type === 'AttackStarted' && e.actor === 0) state.counterUntil = 0;
  }
  if (!obs.hp || !obs.enemyHp) return { keys: [], press: null };
  if (state.counterUntil >= obs.tick && obs.tick >= state.counterReady && obs.heavy && obs.stamina >= 35 && obs.phase !== 'attack') {
    state.counterUntil = 0;
    return { keys: [], press: 'KeyG' };
  }
  if (obs.phase === 'attack' || obs.phase === 'hurt' || obs.phase === 'roll') return { keys: [], press: null };
  if (state.missUntil >= obs.tick && obs.tick >= state.missReady && obs.gap < 3.4 && obs.stamina >= 30 && obs.phase === 'ready') {
    state.missUntil = 0;
    return { keys: ['KeyW'], press: 'KeyT' };
  }
  if (state.tell?.move === 'heavy_overhead' && obs.enemyPhase === 'attack' && obs.tick - state.tell.tick >= reactionTicks
      && state.dodgedTell !== state.tell.tick && obs.stamina >= 30) {
    state.dodgedTell = state.tell.tick;
    return { keys: ['KeyS'], press: 'KeyE' }; // movement is held on the press, so Step becomes a real roll
  }
  // Recover without backing all the way to the arena wall and inviting repeated lashes.
  if (obs.stamina < 45) return { keys: obs.gap < 1.25 ? ['KeyS'] : [], press: null };
  const keys = [];
  if (obs.gap > 1.65) keys.push('KeyW');
  if (obs.gap < 2.6) {
    keys.push('KeyQ');
    if (state.tell && obs.tick - state.tell.tick >= reactionTicks && obs.enemyPhase === 'attack') {
      const side = MIRROR[state.tell.direction];
      if (side) keys.push(side);
    }
  }
  return { keys, press: null };
}
