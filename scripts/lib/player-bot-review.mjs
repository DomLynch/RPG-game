// Explain a test player's choices without changing the fight or reading future state.
export function intentFor(decision, obs, strategy, recentEvents) {
  if (decision.reason) return decision.reason;
  if (decision.press === 'KeyF') return 'quick slash';
  if (decision.press === 'KeyC') return 'kick guard';
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
  return decisions.map((d, index) => {
    const after = events.filter(e => e.tick >= d.tick && e.tick <= d.tick + 180);
    if (['KeyF', 'KeyT', 'KeyG', 'KeyC'].includes(d.press) || d.intent === 'charge heavy' || d.intent === 'charged heavy at reach') {
      const started = after.find(e => e.type === 'AttackStarted' && e.actor === 0 && e.tick <= d.tick + 8);
      if (!started) return { ...d, outcome: 'no attack started', evidence: d.phase === 'ready' ? 'no matching start event' : `input during ${d.phase}` };
      const result = after.find(e => e.tick >= started.tick && e.actor === 0 && (e.type === 'Hit' || e.type === 'AttackMissed'));
      return { ...d, outcome: result?.type === 'Hit' ? 'hit' : result?.type === 'AttackMissed' ? 'missed' : 'unresolved', evidence: result?.tick ?? started.tick };
    }
    if (d.intent.includes('guard')) {
      const nextInputTick = decisions[index + 1]?.tick ?? Infinity;
      const result = after.find(e => e.tick <= nextInputTick &&
        ((e.actor === 0 && (e.type === 'Blocked' || e.type === 'Parried')) || (e.type === 'Hit' && e.target === 0)));
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
  events = events.filter(e => e.tick <= endTick);
  decisions = decisions.filter(d => d.tick <= endTick);
  const picks = [];
  const add = (kind, tick) => { if (Number.isFinite(tick) && tick >= 0 && tick <= endTick && picks.length < 4 && !picks.some(p => Math.abs(p.tick - tick) < 120)) picks.push({ kind, tick }); };
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
  if (!samples.length) return 0;
  if (tick <= samples[0].tick) return samples[0].videoSeconds;
  if (tick >= samples.at(-1).tick) return samples.at(-1).videoSeconds;
  const nextIndex = samples.findIndex(s => s.tick >= tick);
  const a = samples[nextIndex - 1], b = samples[nextIndex];
  return b.tick === a.tick ? b.videoSeconds : a.videoSeconds + (b.videoSeconds - a.videoSeconds) * (tick - a.tick) / (b.tick - a.tick);
}

// Raw event damage may exceed remaining health. Arena lashes have their own source.
export function damageSources(events) {
  const breakKeys = new Set(events.filter(e => e.type === 'GuardBroken').map(e => `${e.tick}/${e.actor}/${e.target}/${e.move}`));
  const sum = predicate => events.reduce((total, e) => total + (predicate(e) ? (e.damage ?? 0) : 0), 0);
  const side = actor => {
    const target = 1 - actor;
    const hits = sum(e => e.type === 'Hit' && e.actor === actor && e.target === target && !breakKeys.has(`${e.tick}/${e.actor}/${e.target}/${e.move}`));
    const guardBreaks = sum(e => e.type === 'GuardBroken' && e.actor === actor && e.target === target);
    const blockedChip = sum(e => e.type === 'Blocked' && e.actor === target && e.target === actor);
    return { hits, guardBreaks, blockedChip, total: hits + guardBreaks + blockedChip };
  };
  return { player: side(0), opponent: side(1), arena: {
    toPlayer: sum(e => e.type === 'Whipped' && e.target === 0),
    toOpponent: sum(e => e.type === 'Whipped' && e.target === 1),
  } };
}

// One observed opponent attack through its resolved defence and the next useful player hit.
export function defenceExchanges(events, decisions, samples, endTick) {
  const active = events.filter(e => e.tick <= endTick);
  const tells = active.filter(e => e.type === 'AttackStarted' && e.actor === 1);
  return tells.map((tell, index) => {
    const until = tells[index + 1]?.tick ?? endTick + 1;
    const contact = active.find(e => e.tick >= tell.tick && e.tick < until && (
      (e.actor === 1 && e.type === 'ActionStarted' && e.action === 'feint') ||
      (e.move === tell.move && ((e.actor === 0 && ['Blocked', 'Parried', 'Dodged'].includes(e.type)) ||
        (e.actor === 1 && ['Hit', 'GuardBroken', 'AttackMissed'].includes(e.type))))));
    const interrupt = active.find(e => e.tick >= tell.tick && e.tick < (contact?.tick ?? until) &&
      e.type === 'Hit' && e.actor === 0 && e.target === 1 &&
      (e.stop || active.some(s => s.tick === e.tick && s.type === 'Staggered' && s.actor === 1)));
    const result = interrupt ?? contact;
    const action = result && decisions.filter(d => d.tick >= tell.tick && d.tick <= result.tick &&
      (d.press === 'KeyE' || d.keys?.includes('KeyQ'))).at(-1);
    const before = samples.filter(s => s.tick <= tell.tick).at(-1) ?? samples[0];
    const after = result && (samples.find(s => s.tick >= result.tick) ?? samples.at(-1));
    const nextHit = interrupt ?? (result && active.find(e => e.tick > result.tick && e.type === 'Hit' && e.actor === 0 && e.target === 1));
    const nextEnemyHit = result && active.find(e => e.tick > result.tick && e.type === 'Hit' && e.actor === 1 && e.target === 0);
    return { tell: { tick: tell.tick, move: tell.move, direction: tell.direction },
      choice: action ? { tick: action.tick, intent: action.intent, keys: action.keys, press: action.press } : null,
      result: result ? { tick: result.tick, type: interrupt ? 'Interrupted' : result.action === 'feint' ? 'Feinted' : result.type,
        damageTaken: interrupt ? 0 : result.damage ?? 0,
        demonstratedAvoidance: result.type === 'Dodged' || result.type === 'AttackMissed' } : null,
      nextUsefulHit: nextHit ? { tick: nextHit.tick, move: nextHit.move, damage: nextHit.damage,
        secondsLater: +((nextHit.tick - result.tick) / 60).toFixed(2), beforeNextEnemyHit: !nextEnemyHit || nextHit.tick < nextEnemyHit.tick,
        beforeNextEnemyAttack: nextHit.tick < until } : null,
      spacing: before && after ? { before: { tick: before.tick, gap: before.gap, radius: before.radius },
        after: { tick: after.tick, gap: after.gap, radius: after.radius } } : null };
  });
}
