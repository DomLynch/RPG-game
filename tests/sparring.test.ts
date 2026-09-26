// Sparring (src/sparring.ts + match.ts 'sparring', Dom 2026-09-26): an admin's test fight with any warden, level, weapon and move.
// The hard gate is Dom's "real save untouched": a sparring fight writes NOTHING to storage — no trial line, scorecard row, career
// mark, record, share or daily post — and the picked kit never reaches the saved profile (equipped weapon, move, loot ledger).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initialAi } from '../src/ai.ts';
import { project } from '../src/combat.ts';
import { Match } from '../src/match.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { SPARRING_DUMMY, SPARRING_FOR_ALL, SPARRING_SKILLS, disarm, sparringLink, sparringParam, stepSparring, type SparringKit } from '../src/sparring.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';
import type { Duel } from '../src/duel.ts';

// Storage that counts every write: the gate is "zero writes", not "the same values written back".
const counting = () => { const m = new Map<string, string>(); let writes = 0; return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { writes++; m.set(k, v); }, writes: () => writes, dump: () => JSON.stringify([...m]) }; };
const spam = (d: Duel) => {
  const p = d.fighters[0], w = d.fighters[1].body, dx = w.x - p.body.x, dz = w.z - p.body.z, gap = Math.hypot(dx, dz);
  return p.phase === 'sheathed' ? act('light') : gap > 1.9 ? { ...idle(), move: { x: dx / gap, z: dz / gap, yaw: 0, run: false } } : STRATEGIES['light spam']!(d);
};
function play(match: Match) {
  for (let i = 0; i < 7200; i++) { const r = match.step(() => spam(match.practice.duel)); if (r !== 'stepped') return r; }
  throw new Error('no finish in 7200 ticks');
}
const KITS: SparringKit[] = [
  { weapon: 'longsword', difficulty: 'easy', skill: 'pommel' },   // light spam wins on easy: the table needs a sparring win
  { weapon: 'knife', difficulty: 'easy', skill: 'reaping' },
  { weapon: 'warhammer', difficulty: 'hard', skill: null },
];

test('sparring: a fight, its rematch and a second end write nothing, and the saved kit is untouched', () => {
  let won = false, lost = false;
  for (const kit of KITS) for (let seed = 1; seed <= 12; seed++) {
    const storage = counting(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
    const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed);
    const before = { writes: storage.writes(), dump: storage.dump(), profile: JSON.stringify(profile), trial: JSON.stringify(trial), card: JSON.stringify(scorecard) };
    match.startSparring(kit);
    assert.equal(match.mode, 'sparring');
    assert.deepEqual({ weapon: match.weapon, difficulty: match.difficulty, skill: match.skill }, kit, 'the fight carries the picked kit');
    assert.equal(match.recorder, null, 'no recorder: nothing to share or post');
    assert.equal(play(match), 'ended');
    const ended = match.end(false);
    assert.deepEqual({ record: ended.record, rewarded: ended.rewarded, post: ended.post, lastRecord: match.lastRecord, lastDrop: match.lastDrop }, { record: null, rewarded: false, post: null, lastRecord: null, lastDrop: null });
    if (ended.won) won = true; else lost = true;
    match.rematch();   // Rematch keeps sparring and the kit, and still writes nothing (a career rematch writes the trial line)
    assert.equal(match.mode, 'sparring');
    assert.deepEqual({ weapon: match.weapon, difficulty: match.difficulty, skill: match.skill }, kit);
    assert.equal(play(match), 'ended'); match.end(false); match.end(true);
    assert.equal(storage.writes(), before.writes, `${kit.weapon} seed ${seed}: zero storage writes`);
    assert.equal(storage.dump(), before.dump);
    assert.equal(JSON.stringify(profile), before.profile, 'equipped weapon, equipped move, loot ledger and marks unchanged');
    assert.equal(JSON.stringify(trial), before.trial); assert.equal(JSON.stringify(scorecard), before.card);
  }
  assert.ok(won && lost, `the table covers a sparring win and a loss (won ${won}, lost ${lost})`);
});

test('sparring: the link carries a checked kit; any unknown value refuses it', () => {
  for (const kit of [...KITS, { weapon: 'longsword', difficulty: 'normal', skill: 'pommel' } as SparringKit]) {
    const link = sparringLink('pitborn', kit), search = link.slice(link.indexOf('?'));
    assert.match(search, /opponent=pitborn/);
    assert.deepEqual(sparringParam(search), kit);
  }
  for (const skill of SPARRING_SKILLS) assert.equal(sparringParam(`?spar=1&weapon=longsword&difficulty=easy&skill=${skill}`)?.skill, skill);
  assert.equal(SPARRING_SKILLS.length, 11, 'all eleven moves are pickable');
  assert.equal(sparringParam('?weapon=longsword&difficulty=easy&skill=none'), null, 'no spar=1: not a sparring link');
  assert.equal(sparringParam('?spar=1&weapon=bazooka&difficulty=easy&skill=none'), null);
  assert.equal(sparringParam('?spar=1&weapon=longsword&difficulty=godlike&skill=none'), null);
  assert.equal(sparringParam('?spar=1&weapon=longsword&difficulty=easy&skill=fireball'), null);
  assert.equal(sparringParam('?spar=1&weapon=maul&difficulty=easy&skill=none', PLAYER_WEAPONS.filter(w => w !== 'maul')), null, 'a weapon this build cannot draw is refused');
});

test('sparring: admin-only behind one flag; the Finisher pick sits in the Options tab, gated the same way', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), account = readFileSync(new URL('../src/account.ts', import.meta.url), 'utf8');
  assert.equal(SPARRING_FOR_ALL, false, 'closed to players until the flag flips');
  assert.match(html, /<div id="sparring-row"[^>]* hidden>/, 'the Sparring row ships hidden');
  assert.match(html, /<div id="finisher-row"[^>]* hidden><label class="menu-select">Finisher <select id="finisher-select"/, 'Finisher is its own hidden row');
  const options = html.slice(html.indexOf('class="tab-pane pane-arena"'), html.indexOf('class="tab-pane pane-settings"')), tools = html.slice(html.indexOf('id="test-tools"'));
  assert.ok(options.includes('id="finisher-select"') && options.includes('id="sparring-row"'), 'both live in the Options tab');
  assert.ok(!tools.slice(0, tools.indexOf('</section>')).includes('finisher-select'), 'Finisher left Settings → Test tools');
  assert.match(account, /finisherRow\.hidden = tools\.hidden; sparringRow\.hidden = tools\.hidden && !SPARRING_FOR_ALL;/, 'the admins roster opens both');
});

// The Sparring dummy (Combat, from #816 e7d97ac0): never attacks, guards on a low share, and stays out of the sim files.

// The dummy's own digest, beside the sim's SIM_DIGEST, scoped to the dummy alone (Lead 2026-09-26): SPARRING_DUMMY, disarm and
// stepSparring. The link and picker code in the same file can change without touching it; a change to the dummy is a reviewed decision
// and never moves RECORD_VERSION.
const SPARRING_DIGEST = 'e1ac7cc531efb8f17b5e783b0e16fe6e5d06734a46fb9b96d22f3a1e502aa758';
test('the Sparring dummy is pinned by its own digest (the profile, disarm and stepSparring only)', () => {
  const digest = createHash('sha256').update(JSON.stringify(SPARRING_DUMMY) + disarm.toString() + stepSparring.toString()).digest('hex');
  assert.equal(digest, SPARRING_DIGEST, `the Sparring dummy changed: review it, then set SPARRING_DIGEST = '${digest}'`);
});

test('the Sparring dummy profile: no aggression, no parry, no roll, a low guard share', () => {
  assert.deepEqual([SPARRING_DUMMY.aggression, SPARRING_DUMMY.parry, SPARRING_DUMMY.dodge, SPARRING_DUMMY.guard], [0, 0, 0, .25]);
});

test('disarm strips every attack and keeps guard, parry and footwork', () => {
  for (const a of ['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill'] as const) assert.equal(disarm(act(a, { held: true })).action, null, a);
  for (const a of ['parry', 'dodge', 'backstep'] as const) assert.equal(disarm(act(a)).action, a);
  assert.equal(disarm({ ...idle(), guard: true }).guard, true);
});

test('the Sparring dummy never swings, against any opponent, idle or attacked', () => {
  for (const o of Object.values(OPPONENTS)) for (const strategy of [() => idle(), STRATEGIES['light spam'], STRATEGIES['heavy only']]) for (let s = 1; s <= 2; s++) {
    let p = project(arena(o, 'longsword'), initialAi((s * 2654435761) >>> 0));
    for (let i = 0; i < 900 && !p.duel.finish; i++) {
      p = stepSparring(p, strategy(p.duel));
      assert.notEqual(p.duel.fighters[1].phase, 'attack', `${o.id} seed ${s} tick ${i}`);
      assert.ok(!p.duel.events.some(e => e.type === 'Hit' && e.target === 0), `${o.id} hit the player`);
    }
  }
});

test('sparring the dummy: the link and picker offer it, the match steps it, it never swings, and nothing is written', () => {
  assert.deepEqual(sparringParam('?spar=1&weapon=longsword&difficulty=dummy&skill=none'), { weapon: 'longsword', difficulty: 'dummy', skill: null });
  for (let seed = 1; seed <= 4; seed++) {
    const storage = counting(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
    const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed);
    const writes = storage.writes(), saved = JSON.stringify(profile);
    match.startSparring({ weapon: 'longsword', difficulty: 'dummy', skill: 'pommel' });
    assert.equal(match.dummy, true); assert.equal(match.difficulty, 'easy', 'the dummy stands on easy, outside PROFILES');
    let attackTicks = 0, result: string = 'stepped';
    for (let i = 0; i < 7200 && result === 'stepped'; i++) {
      result = match.step(() => spam(match.practice.duel));
      if (match.practice.duel.fighters[1].phase === 'attack') attackTicks++;
    }
    assert.equal(attackTicks, 0, `seed ${seed}: the dummy never swings`);
    assert.equal(result, 'ended', `seed ${seed}: light spam fells a dummy`);
    assert.ok(match.end(false).won);
    match.rematch(); assert.equal(match.dummy, true, 'Rematch keeps the dummy');
    match.playNow(); assert.equal(match.dummy, false, 'any other start drops it');
    assert.equal(storage.writes(), writes, 'zero storage writes'); assert.equal(JSON.stringify(profile), saved);
  }
});
