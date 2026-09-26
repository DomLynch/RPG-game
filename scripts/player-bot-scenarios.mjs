// Headless KICK and ROLL scenarios on the real sim (stepDuel), scripted intents, no sim change.
// Perception: the player bot sees an event DELAY ticks after it happens; it never sees whether a swing is charged.
import { writeFileSync } from 'node:fs';
const W = new URL('../src/', import.meta.url).href;
const { initialPractice, OPPONENTS, RULES, MOVES } = await import(W + 'combat.ts');
const { stepDuel, legal, aim, distance } = await import(W + 'duel.ts');
const { RADIUS } = await import(W + 'sim.ts');
const { ENCOUNTERS } = await import(W + 'roster.ts');
const DELAY = 11, ids = ENCOUNTERS.filter(e => !e.hold).map(e => e.id);
const out = process.argv[2];

const still = { x: 0, z: 0, yaw: 0, run: false };
const idle = () => ({ move: still, action: null, guard: false, held: false, lock: true, cancel: false });
function setup(id, player, foe) {
  const d = structuredClone(initialPractice(731, OPPONENTS[id]).duel);
  const [p, o] = d.fighters;
  Object.assign(p, { phase: 'ready', age: 0 });
  p.body = { ...p.body, x: player.x, z: player.z }; o.body = { ...o.body, x: foe.x, z: foe.z };
  p.body.heading = aim(p.body, o.body); o.body.heading = aim(o.body, p.body);
  return d;
}
// A camera behind the player looking at the foe: z = -1 is toward the foe, +1 away, x = +1 to the right.
const toward = (d, x, z, run = false) => ({ x, z, yaw: aim(d.fighters[0].body, d.fighters[1].body) + Math.PI, run });
const wallGap = b => +(RADIUS - Math.hypot(b.x, b.z)).toFixed(2);
const r2 = v => +v.toFixed(2);

// ---- KICK: close range, the opponent holds a standing guard, the player kicks.
function kick(id, follow) {
  let d = setup(id, { x: 0, z: -0.5 }, { x: 0, z: 0.55 });
  const ev = [];
  let kickAt = 12, stag = null, press = null, landed = null, done = false;
  for (let t = 1; t <= 200 && !done; t++) {
    const pi = idle(), oi = { ...idle(), guard: true };
    if (t === kickAt) pi.action = 'kick';
    if (stag) {
      const seenAt = stag.tick + DELAY, earliest = follow.perceive ? seenAt : stag.tick;
      if (follow.kind === 'reposition' && !press && d.tick + 1 >= earliest && legal(d.fighters[0], follow.action)) {
        pi.action = follow.action; pi.move = follow.move ? toward(d, ...follow.move) : still; press = { tick: d.tick + 1, gap: r2(distance(d.fighters[0].body, d.fighters[1].body)) };
      } else if (follow.kind === 'reposition' && press && follow.move) pi.move = toward(d, ...follow.move);
      if (follow.kind === 'attack' && !press && d.tick + 1 >= earliest) {
        const gap = distance(d.fighters[0].body, d.fighters[1].body), reach = MOVES[follow.action === 'thrust' ? 'thrust' : 'light_right'].reach;
        if (gap > reach - 0.1) pi.move = toward(d, 0, -1);
        else if (legal(d.fighters[0], follow.action)) { pi.action = follow.action; press = { tick: d.tick + 1, gap: r2(gap) }; }
      }
    }
    d = stepDuel(d, [pi, oi]);
    for (const e of d.events) ev.push(e);
    const s = d.events.find(e => e.type === 'Staggered' && e.actor === 1 && !stag);
    if (s) stag = { tick: d.tick, ticks: s.ticks, gap: r2(distance(d.fighters[0].body, d.fighters[1].body)), foePhase: d.fighters[1].phase };
    const h = d.events.find(e => e.type === 'Hit' && e.actor === 0 && e.move !== 'kick');
    if (h && !landed) landed = { tick: d.tick, damage: h.damage, inWindow: stag ? d.tick < stag.tick + stag.ticks : false };
    if (stag && d.tick >= stag.tick + stag.ticks + 2) done = true;
  }
  const f0 = d.fighters[0];
  const first = ev.find(e => e.actor === 0 && e.type === 'AttackStarted');
  return { id, follow: follow.name, kickStarted: first?.tick ?? null, kickEvents: ev.filter(e => e.move === 'kick' || (e.type === 'Staggered' && e.actor === 1)).map(e => `${e.tick}:${e.type}${e.ticks ? '(' + e.ticks + ')' : ''}`).slice(0, 6),
    stagger: stag, seen: stag ? { tick: stag.tick + DELAY, inside: DELAY < stag.ticks, ticksLeft: stag.ticks - DELAY } : null,
    press, landed, end: { gap: r2(distance(f0.body, d.fighters[1].body)), wall: wallGap(f0.body), stamina: Math.round(f0.stamina), foePhase: d.fighters[1].phase } };
}

// ---- ROLL: the opponent swings a heavy (plain, or held to a full charge); the player rolls when it perceives it.
function roll(id, { start, charged, dir, when }) {
  const P = start === 'centre' ? { x: 0, z: -0.8 } : { x: 0, z: -(RADIUS - 1.0) };
  const F = { x: 0, z: P.z + 1.6 };
  let d = setup(id, P, F);
  const heavyAt = 6, ev = [];
  let rollAt = null, rollEnd = null, firstHit = null, hurt = 0, foeStart = null, foeContact = null, foeMove = null;
  const chamber = MOVES.heavy_overhead.chamber ?? 10;   // the hold-time read: a heavy still winding past chamber + 8
  for (let t = 1; t <= 260; t++) {
    const pi = idle(), oi = idle();
    if (t === heavyAt) oi.action = 'heavy';
    if (charged && t >= heavyAt && t < heavyAt + RULES.charge.max + chamber + 2) oi.held = true;
    const trigger = foeStart === null ? null : when === 'seen' ? foeStart + DELAY : foeStart + chamber + 8 + DELAY;
    if (rollAt === null && trigger !== null && d.tick + 1 >= trigger && legal(d.fighters[0], 'dodge')) {
      pi.action = 'dodge'; pi.move = dir === 'back' ? still : toward(d, ...dir); rollAt = d.tick + 1;
    } else if (rollAt !== null && rollEnd === null) pi.move = dir === 'back' ? still : toward(d, ...dir);
    else if (rollEnd !== null && firstHit === null) {
      const gap = distance(d.fighters[0].body, d.fighters[1].body);
      if (gap > 1.5) pi.move = toward(d, 0, -1);
      else if (legal(d.fighters[0], 'light')) pi.action = 'light';
    }
    d = stepDuel(d, [pi, oi]);
    for (const e of d.events) {
      ev.push(e);
      if (e.actor === 1 && e.type === 'AttackStarted' && foeStart === null) { foeStart = e.tick; foeMove = e.move; }
      if (e.actor === 1 && e.type === 'Hit') { hurt += e.damage; foeContact ??= e.tick; }
      if (e.actor === 1 && e.type === 'AttackActive') foeContact ??= e.tick;
      if (e.actor === 0 && e.type === 'Hit' && firstHit === null) firstHit = { tick: e.tick, damage: e.damage };
    }
    if (rollAt !== null && rollEnd === null && d.fighters[0].phase !== 'roll' && d.tick > rollAt) rollEnd = { tick: d.tick, gap: r2(distance(d.fighters[0].body, d.fighters[1].body)), wall: wallGap(d.fighters[0].body) };
    if (firstHit) break;
  }
  const chargedSeen = ev.some(e => e.actor === 1 && e.type === 'Charging');
  return { id, start, charged, chargedActually: chargedSeen, dir: Array.isArray(dir) ? `angled(${dir})` : dir, when, foeMove, foeStart, foeActive: foeContact, rollAt,
    rolledBeforeActive: rollAt !== null && foeContact !== null ? foeContact - rollAt : null, damageTaken: hurt, rollEnd,
    firstUsefulHit: firstHit ? { ...firstHit, ticksAfterRoll: firstHit.tick - rollAt } : null,
    interruptedCharge: foeContact === null && ev.some(e => e.actor === 1 && e.type === 'Staggered'), foeEvents: ev.filter(e => e.actor === 1 || e.target === 1).map(e => `${e.tick}:${e.type}:${e.move ?? e.action ?? ''}`).slice(0, 8) };
}

const kicks = [], rolls = [];
const FOLLOW = [
  { name: 'light@seen', kind: 'attack', action: 'light', perceive: true },
  { name: 'thrust@seen', kind: 'attack', action: 'thrust', perceive: true },
  { name: 'light@earliest(no delay)', kind: 'attack', action: 'light', perceive: false },
  { name: 'backstep@seen', kind: 'reposition', action: 'backstep', perceive: true },
  { name: 'roll-back@seen', kind: 'reposition', action: 'dodge', perceive: true },
  { name: 'roll-angled@seen', kind: 'reposition', action: 'dodge', perceive: true, move: [1, 1] },
];
for (const id of ids) for (const f of FOLLOW) kicks.push(kick(id, f));
for (const id of ids) for (const start of ['centre', 'wall']) for (const charged of [false, true]) for (const dir of ['back', [1, 1], [1, 0]]) for (const when of charged ? ['seen', 'hold-time'] : ['seen'])
  rolls.push(roll(id, { start, charged, dir, when }));
writeFileSync(out, JSON.stringify({ delay: DELAY, radius: RADIUS, rules: { roll: RULES.roll, safeStart: RULES.safeStart, safeEnd: RULES.safeEnd, charge: RULES.charge, kickVsGuard: MOVES.kick.vsGuard }, kicks, rolls }, null, 1));
console.log('kicks', kicks.length, 'rolls', rolls.length);
