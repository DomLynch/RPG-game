// Headless replay of a recorded bot fight: the recorded key edges become sim intents the way src/input.ts builds them,
// stepped through the real stepPractice. Per tick: legal (legal(player, action)), requested (a key press), passed (accepts() at
// the press, what the page forwards), accepted (the player's own Started event). Divergence from the recorded events is reported.
import { readFileSync, writeFileSync } from 'node:fs';
const W = new URL('../src/', import.meta.url).href;
const { initialPractice, stepPractice, accepts, OPPONENTS } = await import(W + 'combat.ts');
const { legal, aim, distance } = await import(W + 'duel.ts');
const { RADIUS } = await import(W + 'sim.ts');

const [file, out, offsetArg] = process.argv.slice(2);
const rec = JSON.parse(readFileSync(file, 'utf8'));
const OFFSET = Number(offsetArg ?? 1);    // an edge recorded at tick t reaches the sim at step t + OFFSET
const opp = OPPONENTS[rec.opponent], profile = opp.profiles.easy;
let p = initialPractice(rec.seed >>> 0, opp);
const keys = new Set(), ARROW = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'overhead', ArrowDown: 'low' };
const PRESS = { KeyF: 'light', KeyC: 'kick', KeyG: 'heavy', KeyT: 'thrust' };
const ACTIONS = ['light', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry'];
const byTick = new Map();
for (const e of rec.inputs) { const t = e.tick + OFFSET; if (!byTick.has(t)) byTick.set(t, []); byTick.get(t).push(e); }
const recorded = rec.events.map(e => `${e.tick}:${e.type}:${e.actor}:${e.move ?? e.action ?? ''}`);
const rows = [], mine = [];
for (let tick = 1; tick <= rec.endTick + 30 && !p.duel.finish; tick++) {
  const f0 = p.duel.fighters[0], f1 = p.duel.fighters[1];
  let action = null; const requested = [], passed = [];
  for (const e of byTick.get(tick) ?? []) {
    if (e.edge === 'down') keys.add(e.key);
    if (e.edge === 'up') keys.delete(e.key);
    let want = PRESS[e.key] ?? null;
    if (e.key === 'KeyE' && e.edge === 'press') want = [...keys].some(k => /^Key[WASD]$|^Arrow/.test(k) && !(k.startsWith('Arrow') && keys.has('KeyQ'))) ? 'dodge' : 'backstep';
    if (e.key === 'KeyQ' && e.edge === 'down') want = 'parry';
    if (e.edge === 'up' || !want) continue;
    requested.push(want);
    if (accepts(p, want)) { action = want; passed.push(want); }
  }
  const q = keys.has('KeyQ'), arrow = k => !q && keys.has(k);
  const guardDirection = q ? Object.keys(ARROW).filter(k => keys.has(k)).map(k => ARROW[k])[0] : undefined;
  const x = Number(keys.has('KeyD') || arrow('ArrowRight')) - Number(keys.has('KeyA') || arrow('ArrowLeft'));
  const z = Number(keys.has('KeyS') || arrow('ArrowDown')) - Number(keys.has('KeyW') || arrow('ArrowUp'));
  const yaw = aim(f0.body, f1.body) + Math.PI;   // camera behind the player, looking at the foe
  const intent = { move: { x, z, yaw, run: keys.has('ShiftLeft') }, action, guard: q, guardDirection, held: false, lock: true, cancel: false };
  const legalNow = ACTIONS.filter(a => legal(f0, a));
  p = stepPractice(p, intent, profile);
  const ev = p.duel.events ?? p.events ?? [];
  for (const e of ev) mine.push(`${e.tick}:${e.type}:${e.actor}:${e.move ?? e.action ?? ''}`);
  const started = ev.filter(e => e.actor === 0 && /Started$/.test(e.type)).map(e => e.move ?? e.action);
  const foe = ev.filter(e => e.actor === 1 && /Started$/.test(e.type)).map(e => e.move ?? e.action);
  const hits = ev.filter(e => e.type === 'Hit').map(e => `${e.actor === 0 ? 'P' : 'E'}${e.damage}`);
  const other = ev.filter(e => /Stagger|Posture|Parr|Block|Kill|Exhaust/.test(e.type)).map(e => `${e.type}@${e.actor}`);
  rows.push({ tick, phase: f0.phase, age: f0.age, stamina: Math.round(f0.stamina), hp: p.duel.fighters[0].health, enemyHp: p.duel.fighters[1].health,
    gap: +distance(p.duel.fighters[0].body, p.duel.fighters[1].body).toFixed(2), wall: +(RADIUS - Math.hypot(p.duel.fighters[0].body.x, p.duel.fighters[0].body.z)).toFixed(2),
    legal: legalNow, requested, passed, accepted: started, foe, hits, other, guard: q ? (guardDirection ?? 'straight') : null, move: x || z ? `${x},${z}` : null });
}
// Divergence: first recorded event (up to the end) missing from the replay in order.
const firstDiff = recorded.findIndex((r, k) => r !== mine[k]);
writeFileSync(out, JSON.stringify({ file, offset: OFFSET, recordedEvents: recorded.length, replayEvents: mine.length, firstDiff,
  recordedAt: recorded[firstDiff], replayAt: mine[firstDiff], finish: p.duel.finish, endTick: rows.at(-1)?.tick,
  final: { player: p.duel.fighters[0].health, opponent: p.duel.fighters[1].health }, rows }, null, 0));
console.log(JSON.stringify({ offset: OFFSET, recorded: recorded.length, replay: mine.length, firstDiff, recordedAt: recorded[firstDiff], replayAt: mine[firstDiff], end: rows.at(-1)?.tick, final: { player: p.duel.fighters[0].health, opponent: p.duel.fighters[1].health } }));
