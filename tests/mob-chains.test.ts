import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, type Duel } from '../src/duel.ts';
import { CHAIN_CAP, initialKit, kitIntent, validateChains, type ChainRow } from '../src/mobkit.ts';
import { OPPONENTS, profileAt } from '../src/moves.ts';
import { CHAINS, KITS } from '../origins/mobs/kits.ts';
import { MOB_STYLE, MOB_STYLES, type MobStyle } from '../origins/mobs/styles.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { arena, idle } from './strategies.ts';

// C4 opponent chains: authored follow-ups on the engine's own chain window, in the mob layer (src/mobkit.ts). No sim file, no record bump.
const weaponOf = (s: MobStyle) => OPPONENTS[MOB_STYLE[s].opponent].weapon;

test('every shipped chain row sits inside the engine\'s chain window for its weapon; a row that reaches past it is refused', () => {
  for (const s of MOB_STYLES) validateChains(CHAINS[s], weaponOf(s));
  const bad = (r: Partial<ChainRow>): ChainRow => ({ from: 'light_right', to: 'heavy', chance: .5, startsAfter: 3, endsBefore: 12, ...r });
  assert.throws(() => validateChains([bad({ endsBefore: 19 })], 'cleaver'), /inside the engine's 18-tick window/);
  assert.throws(() => validateChains([bad({ startsAfter: 12 })], 'cleaver'), /inside the engine/);
  assert.throws(() => validateChains([bad({ chance: 1.5 })], 'cleaver'), /chance/);
  assert.throws(() => validateChains([bad({ from: 'critical' })], 'cleaver'), /no chain window/);
  assert.equal(CHAIN_CAP, 3);
});

// The hero stands ready and idle in reach (and cannot die); the mob's own decide() plus the layer fight it. Count the swings the engine ran with its chained timing, and the length of each run.
const fight = (style: MobStyle, chains: readonly ChainRow[], ticks = 12000) => {
  const opponent = OPPONENTS[MOB_STYLE[style].opponent], profile = profileAt(opponent, 6), rows = KITS[style];
  let d: Duel = arena(opponent); d = { ...d, fighters: [{ ...d.fighters[0], phase: 'ready', maxHealth: 1e6, health: 1e6 }, d.fighters[1]] };
  let ai = initialAi(7), state = initialKit(rows), chained = 0, plain = 0, run = 0, longest = 0;
  for (let i = 0; i < ticks && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const r = kitIntent(d, 1, w.intent, rows, state, chains); state = r.state;
    d = stepDuel(d, [idle(), r.intent]);
    for (const e of d.events) if (e.type === 'AttackStarted' && e.actor === 1) { if (d.fighters[1].chained) { chained++; run++; } else { plain++; run = 1; } longest = Math.max(longest, run); }
  }
  return { d, chained, plain, longest };
};

test('with chain rows the mob throws more chained follow-ups inside the window than its own warden does (the warden chains on its own now and then)', () => {
  for (const s of ['brute', 'skirmisher', 'beast'] as const) {
    const withRows = fight(s, CHAINS[s]), without = fight(s, []);
    assert.ok(withRows.chained > without.chained, `${s}: the layer chained ${withRows.chained} times against the warden's ${without.chained}`);
    assert.ok(withRows.longest <= CHAIN_CAP, `${s}: a run is never longer than the cap (${withRows.longest})`);
  }
});

test('a chance of 1 chains more than no rows, a chance of 0 changes nothing, and the same duel chains the same way twice', () => {
  const link = (chance: number): ChainRow[] => [{ from: 'light_right', to: 'light', chance, startsAfter: 2, endsBefore: 12 }, { from: 'light_left', to: 'light', chance, startsAfter: 2, endsBefore: 12 }];
  const none = fight('beast', []), zero = fight('beast', link(0)), all = fight('beast', link(1));
  assert.equal(hashDuel(zero.d), hashDuel(none.d), 'a chance of 0 is the layer without rows');
  assert.ok(all.chained > none.chained);
  assert.equal(hashDuel(fight('beast', link(1)).d), hashDuel(all.d));
});

test('the chain window is the engine\'s: a link only starts from ready while the chain window is open', () => {
  const opponent = OPPONENTS.goblin, profile = profileAt(opponent, 6);
  let d: Duel = arena(opponent); d = { ...d, fighters: [{ ...d.fighters[0], phase: 'ready', maxHealth: 1e6, health: 1e6 }, d.fighters[1]] };
  let ai = initialAi(7), state = initialKit(KITS.beast), links = 0;
  for (let i = 0; i < 2400 && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const was = d.fighters[1], r = kitIntent(d, 1, w.intent, KITS.beast, state, CHAINS.beast); state = r.state;
    d = stepDuel(d, [idle(), r.intent]);
    if (d.events.some(e => e.type === 'AttackStarted' && e.actor === 1) && d.fighters[1].chained) { links++; assert.ok(was.chain > 0 && was.phase === 'ready', 'a chained swing starts from ready with the window open'); }
  }
  assert.ok(links > 0);
});
