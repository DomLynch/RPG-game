// Constrain what the bot sees; the browser still records exact state for later review.
// What a player can perceive of each combat event: the fields the screen or a sound carries, nothing the sim alone knows (damage,
// stamina costs, charge flags on a hit). An event type missing here is not perceived at all: Charging (the chamber has not yet told
// anything a heavy windup doesn't), AttackActive, the opponent's StaminaExhausted, feint/guard/parry presses.
const PERCEIVED = {
  AttackStarted: ['move', 'direction'],   // the windup on screen (its side, heavy vs light vs thrust vs kick) + the whoosh
  Charged: ['move'],                      // the held chamber + the 'charge' cue (audio/cues.ts)
  AttackMissed: ['move'], Hit: ['target', 'move'], GuardBroken: ['target', 'move'], Parried: ['target', 'move'],
  Blocked: ['target', 'move', 'perfect'], // block vs block_perfect are different sounds
  Dodged: ['target'], Staggered: [], Killed: ['target'], PostureBroken: ['target'], WhipRaised: ['target'], Whipped: ['target'],
};
const SEEN_ACTIONS = new Set(['draw', 'roll', 'backstep']);
export function perceivable(events) {
  return events.flatMap(e => {
    if (e.type === 'ActionStarted') return SEEN_ACTIONS.has(e.action) ? [{ tick: e.tick, type: e.type, actor: e.actor, action: e.action }] : [];
    const fields = PERCEIVED[e.type];
    if (!fields) return [];
    const seen = { tick: e.tick, type: e.type, actor: e.actor };
    for (const f of fields) if (e[f] !== undefined) seen[f] = e[f];
    return [seen];
  });
}

// Limited observation, the standard run: the HUD threat flag (#combat-status data-threat) for the opponent's phase, the stamina meter,
// perceivable events only, all opponent-side information delayed by the reaction time; distance rounded to half-metre steps (the camera
// shows the gap, not a number). Own health, stamina and action phase stay current so death and input cancellation are immediate.
export function limitedObservation(raw, memory, delayTicks) {
  memory.snapshots ??= [];
  memory.pendingEvents ??= [];
  memory.snapshots.push({ tick: raw.tick, gap: raw.gap, radius: raw.radius, threat: raw.threat });
  memory.pendingEvents.push(...perceivable(raw.events));
  const cutoff = raw.tick - delayTicks;
  while (memory.snapshots.length > 1 && memory.snapshots[1].tick <= cutoff) memory.snapshots.shift();
  const seen = memory.snapshots[0], ripe = seen.tick <= cutoff;
  const events = memory.pendingEvents.filter(e => e.tick <= cutoff);
  memory.pendingEvents = memory.pendingEvents.filter(e => e.tick > cutoff);
  const enemyPhase = ripe && seen.threat ? 'attack' : 'other';
  return { ...raw, gap: Math.round(seen.gap * 2) / 2, radius: Math.round(seen.radius * 2) / 2, stamina: raw.meterStamina ?? raw.stamina,
    enemyPhase, enemyState: enemyPhase, events };
}
