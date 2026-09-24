// Constrain what the bot sees; the browser still records exact state for later review.
export function limitedObservation(raw, memory, delayTicks) {
  memory.snapshots ??= [];
  memory.pendingEvents ??= [];
  memory.snapshots.push({ tick: raw.tick, gap: raw.gap, radius: raw.radius, enemyPhase: raw.enemyPhase });
  memory.pendingEvents.push(...raw.events);
  const cutoff = raw.tick - delayTicks;
  while (memory.snapshots.length > 1 && memory.snapshots[1].tick <= cutoff) memory.snapshots.shift();
  const seen = memory.snapshots[0];
  const events = memory.pendingEvents.filter(e => e.tick <= cutoff);
  memory.pendingEvents = memory.pendingEvents.filter(e => e.tick > cutoff);
  return { ...raw, gap: Math.round(seen.gap * 2) / 2, radius: Math.round(seen.radius * 2) / 2,
    enemyPhase: seen.tick <= cutoff ? seen.enemyPhase : 'other', events };
}
