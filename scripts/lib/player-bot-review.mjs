// Explain a test player's choices without changing the fight or reading future state.
export function intentFor(decision, obs, strategy, recentEvents) {
  if (decision.press === 'KeyT') return 'punish missed swing with thrust';
  if (decision.press === 'KeyE') return 'evade attack';
  if (decision.press === 'KeyG') return recentEvents.some(e => (e.type === 'Blocked' || e.type === 'Parried') && e.actor === 0 && obs.tick - e.tick <= 20)
    ? 'counter after defence' : 'pressure with heavy';
  if (decision.keys.includes('KeyG')) return 'charge heavy';
  if (decision.keys.includes('KeyQ')) return decision.keys.includes('KeyW') ? 'close under guard' : 'guard';
  if (decision.keys.includes('KeyW')) return 'close distance';
  if (decision.keys.includes('KeyS')) return 'recover space';
  return strategy === 'counter' ? 'wait for opening' : 'recover';
}

export function explainDecisions(decisions, events) {
  return decisions.map(d => {
    const after = events.filter(e => e.tick >= d.tick && e.tick <= d.tick + 180);
    if (d.press === 'KeyT' || d.press === 'KeyG') {
      const started = after.find(e => e.type === 'AttackStarted' && e.actor === 0 && e.tick <= d.tick + 8);
      if (!started) return { ...d, outcome: 'no attack started', evidence: d.phase === 'ready' ? 'no matching start event' : `input during ${d.phase}` };
      const result = after.find(e => e.tick >= started.tick && e.actor === 0 && (e.type === 'Hit' || e.type === 'AttackMissed'));
      return { ...d, outcome: result?.type === 'Hit' ? 'hit' : result?.type === 'AttackMissed' ? 'missed' : 'unresolved', evidence: result?.tick ?? started.tick };
    }
    if (d.intent.includes('guard')) {
      const result = after.find(e => (e.actor === 0 && (e.type === 'Blocked' || e.type === 'Parried')) || (e.type === 'Hit' && e.target === 0));
      return { ...d, outcome: result?.type === 'Hit' ? 'got hit' : result ? 'defended' : 'no contact', evidence: result?.tick ?? null };
    }
    if (d.press === 'KeyE') {
      const result = after.find(e => e.type === 'Dodged' && e.actor === 0 || e.type === 'AttackMissed' && e.actor === 1);
      return { ...d, outcome: result ? 'attack avoided' : 'unresolved', evidence: result?.tick ?? null };
    }
    return { ...d, outcome: 'movement or recovery', evidence: null };
  });
}

export function selectMoments(events, decisions, endTick) {
  const picks = [];
  const add = (kind, tick) => { if (picks.length < 4 && !picks.some(p => Math.abs(p.tick - tick) < 120)) picks.push({ kind, tick }); };
  for (const e of events) if (e.type === 'AttackMissed' && e.actor === 0) { add('missed attack', e.tick); break; }
  for (const d of decisions) if (d.intent.includes('guard') && d.outcome === 'got hit') { add('failed guard', d.evidence); break; }
  for (const e of events) if (e.type === 'Whipped' && e.target === 0) { add('wall punishment', e.tick); break; }
  for (const d of decisions) if (d.outcome === 'no attack started') { add('unaccepted attack input', d.tick); break; }
  const contacts = [0, ...events.filter(e => ['Hit', 'Blocked', 'Parried'].includes(e.type)).map(e => e.tick), endTick];
  const gap = contacts.slice(1).map((tick, i) => ({ start: contacts[i], end: tick })).sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  if (gap && gap.end - gap.start >= 600) add('long inactivity', Math.round((gap.start + gap.end) / 2));
  return picks;
}

export function videoSecondAt(tick, samples) {
  const nextIndex = samples.findIndex(s => s.tick >= tick);
  if (nextIndex < 1) return samples[Math.max(0, nextIndex)]?.videoSeconds ?? samples.at(-1)?.videoSeconds ?? 0;
  const a = samples[nextIndex - 1], b = samples[nextIndex];
  return a.videoSeconds + (b.videoSeconds - a.videoSeconds) * (tick - a.tick) / (b.tick - a.tick);
}
