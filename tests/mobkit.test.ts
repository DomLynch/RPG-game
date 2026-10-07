// Mob signature moves and behaviour presets (top-10 #5): the layer swaps WHICH existing attack the warden throws, deterministically, and never anything else. The data (origins/mobs/kits.ts)
// resolves for every style; the battery shows what the kits do to the hero strategies the ladder is held to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { AFTER_HIT_TICKS, initialKit, kitIntent, type KitRow } from '../src/mobkit.ts';
import { OPPONENTS, profileAt } from '../src/moves.ts';
import { KITS, MODE, MODES, mobLayer, mobProfile } from '../origins/mobs/kits.ts';
import { initialPractice, stepPractice, type Practice } from '../src/combat.ts';
import { MOB_STYLES, MOB_STYLE, styleOf } from '../origins/mobs/styles.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';

const at = (d: Duel, tick: number, events: CombatEvent[] = []): Duel => ({ ...d, tick, events });
const swing = act('light');

test('an empty kit changes nothing: the same intent object, the same state', () => {
  const d = arena(), s = initialKit([]), r = kitIntent(at(d, 10), 1, swing, [], s);
  assert.equal(r.intent, swing); assert.deepEqual(r.state, s);
});

test('opener: the first attack is swapped, the second is not (a deterministic trigger, no chance)', () => {
  const kit: KitRow[] = [{ move: 'thrust', trigger: 'opener', cooldown: 1e9 }];
  let s = initialKit(kit);
  const a = kitIntent(at(arena(), 10), 1, swing, kit, s); assert.equal(a.intent.action, 'thrust'); s = a.state;
  const b = kitIntent(at(arena(), 200), 1, swing, kit, s); assert.equal(b.intent.action, 'light'); assert.equal(b.intent, swing);
});

test('heroGuarding and the cooldown: a heavy answers a raised guard, at most once per cooldown', () => {
  const kit: KitRow[] = [{ move: 'heavy', trigger: 'heroGuarding', cooldown: 420 }];
  const guarding = (tick: number): Duel => { const d = at(arena(), tick); return { ...d, fighters: [{ ...d.fighters[0], phase: 'guard' }, d.fighters[1]] }; };
  let s = initialKit(kit);
  assert.equal(kitIntent(at(arena(), 5), 1, swing, kit, s).intent.action, 'light', 'no guard up: no swap');
  const a = kitIntent(guarding(10), 1, swing, kit, s); assert.equal(a.intent.action, 'heavy'); s = a.state;
  assert.equal(kitIntent(guarding(300), 1, swing, kit, s).intent.action, 'light', 'inside the cooldown');
  assert.equal(kitIntent(guarding(430), 1, swing, kit, s).intent.action, 'heavy', 'cooled down');
});

test('heroExhausted: the maul on a winded hero', () => {
  const kit: KitRow[] = [{ move: 'heavy', trigger: 'heroExhausted', cooldown: 600 }];
  const d = at(arena(), 10), winded: Duel = { ...d, fighters: [{ ...d.fighters[0], stamina: 10 }, d.fighters[1]] };
  assert.equal(kitIntent(d, 1, swing, kit, initialKit(kit)).intent.action, 'light');
  assert.equal(kitIntent(winded, 1, swing, kit, initialKit(kit)).intent.action, 'heavy');
});

test('afterHit: the poke follows the mob\'s own landed blow, once, and only for a second and a half', () => {
  const kit: KitRow[] = [{ move: 'thrust', trigger: 'afterHit', cooldown: 240 }];
  const landed: CombatEvent = { tick: 100, type: 'Hit', actor: 1, target: 0 };
  let s = initialKit(kit);
  assert.equal(kitIntent(at(arena(), 90), 1, swing, kit, s).intent.action, 'light', 'nothing landed yet');
  const a = kitIntent(at(arena(), 100, [landed]), 1, idle(), kit, s); s = a.state;   // the blow lands on a tick the mob throws nothing
  const b = kitIntent(at(arena(), 130), 1, swing, kit, s); assert.equal(b.intent.action, 'thrust'); s = b.state;
  assert.equal(kitIntent(at(arena(), 150), 1, swing, kit, s).intent.action, 'light', 'once per landed blow');
  const late = kitIntent(at(arena(), 100 + AFTER_HIT_TICKS + 5), 1, swing, kit, kitIntent(at(arena(), 100, [landed]), 1, idle(), kit, initialKit(kit)).state);
  assert.equal(late.intent.action, 'light', 'the window is over');
});

test('only an attack is swapped, and only to a move that is legal this tick', () => {
  const kit: KitRow[] = [{ move: 'thrust', trigger: 'opener', cooldown: 1e9 }];
  for (const intent of [idle(), act('kick'), act('parry'), act('dodge'), act('backstep')]) assert.equal(kitIntent(at(arena(), 10), 1, intent, kit, initialKit(kit)).intent, intent);
  const d = at(arena(), 10), spent: Duel = { ...d, fighters: [d.fighters[0], { ...d.fighters[1], exhausted: true }] };
  assert.equal(kitIntent(spent, 1, swing, kit, initialKit(kit)).intent, swing, 'an exhausted fighter throws nothing new');
  assert.equal(kitIntent(at(arena(), 10), 1, act('thrust'), kit, initialKit(kit)).intent.action, 'thrust');
});

test('every style has a kit of one to three rows, and a mode is a clamped delta on the style\'s own profile', () => {
  for (const style of MOB_STYLES) {
    assert.ok(KITS[style].length >= 1 && KITS[style].length <= 3, `${style} has ${KITS[style].length} rows`);
    assert.deepEqual(mobProfile(style, 18), profileAt(OPPONENTS[MOB_STYLE[style].opponent], 18), 'no mode: the opponent\'s own profile');
    for (const mode of MODES) {
      const base = mobProfile(style, 18), p = mobProfile(style, 18, mode);
      for (const k of Object.keys(MODE[mode]) as (keyof typeof base)[]) assert.ok((p[k] as number) >= 0 && (p[k] as number) <= 1, `${style} ${mode} ${k}`);
      assert.equal(p.reaction, base.reaction, 'a mode never moves a tick count');
    }
  }
  assert.ok(mobProfile('beast', 18, 'shy').aggression < mobProfile('beast', 18).aggression);
  assert.ok(mobProfile('beast', 18, 'bold').aggression >= mobProfile('beast', 18).aggression);
});

// The battery: nine hero strategies against each style's opponent at L18, with and without the kit, 12 seeded fights each: the player's wins.
function wins(style: (typeof MOB_STYLES)[number], strat: (d: Duel) => Intent, withKit: boolean, seeds = 12): number {
  const o = OPPONENTS[MOB_STYLE[style].opponent], profile = mobProfile(style, 18), kit = withKit ? KITS[style] : [];
  let n = 0;
  for (let s = 1; s <= seeds; s++) {
    let d = arena(o), ai = initialAi((s * 2654435761) >>> 0), ks = initialKit(kit);
    for (let i = 0; i < 6000 && !d.finish; i++) {
      const w = decide(d, 1, ai, profile); ai = w.ai;
      const k = kitIntent(d, 1, w.intent, kit, ks); ks = k.state;
      d = stepDuel(d, [strat(d), k.intent]);
    }
    if (d.finish && d.finish.victim === 1 && !d.finish.draw) n++;
  }
  return n;
}
test('the kits move each strategy\'s win rate by a bounded amount', () => {
  const rows: string[] = []; let worst = 0;
  for (const style of MOB_STYLES) for (const [name, strat] of Object.entries(STRATEGIES)) {
    const without = wins(style, strat, false), withK = wins(style, strat, true);
    worst = Math.max(worst, Math.abs(withK - without));
    rows.push(`${style} / ${name}: ${without} -> ${withK}`);
  }
  console.log(rows.join('\n'));
  assert.ok(worst <= 6, `a kit moved a strategy by ${worst} of 12 fights`);
});

// The wiring: stepPractice's optional `layer` (Match.layer, set by the creature encounter and a ?mob= spar). Absent = today's fight; present = the kit's swaps on the live loop.
const spar = (layer?: ReturnType<typeof mobLayer>): { p: Practice; swapped: number } => {
  let p = initialPractice(731, OPPONENTS.pitborn), swapped = 0;
  for (let i = 0; i < 1500 && !p.duel.finish; i++) {
    const before = p.duel.fighters[1].move;
    p = stepPractice(p, i % 50 === 0 ? act('light') : idle(), profileAt(OPPONENTS.pitborn, 18), layer);
    if (p.duel.events.some(e => e.type === 'AttackStarted' && e.actor === 1 && e.move === 'heavy_overhead') && before !== 'heavy_overhead') swapped++;
  }
  return { p, swapped };
};
test('stepPractice without a layer is today\'s fight; with the brute\'s layer the opener is a heavy', () => {
  const plain = spar(), again = spar(), kit = spar(mobLayer('brute'));
  assert.deepEqual(plain.p.duel.events, again.p.duel.events);
  assert.ok(kit.swapped >= 1, 'the brute opened with the maul');
});
test('the layer resets on tick 0 (a rematch starts clean) and styleOf names the style of a roster body', () => {
  const layer = mobLayer('beast'), d = arena(OPPONENTS.goblin);
  assert.equal(layer(d, swing).action, 'thrust', 'the pounce opens');
  assert.equal(layer({ ...d, tick: 100 }, swing).action, 'light', 'the opener is spent');
  assert.equal(layer(d, swing).action, 'thrust', 'a new fight (tick 0) opens again');
  assert.deepEqual(['pitborn', 'nightborn', 'witch', 'goblin'].map(styleOf), ['brute', 'skirmisher', 'caster', 'beast']);
  assert.equal(styleOf('veteran'), undefined);
});
