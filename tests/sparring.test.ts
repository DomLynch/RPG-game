// Sparring (src/sparring.ts + match.ts 'sparring', Dom 2026-09-26): an admin's test fight with any warden, level, weapon and move.
// The hard gate is Dom's "real save untouched": a sparring fight writes NOTHING to storage — no trial line, scorecard row, career
// mark, record, share or daily post — and the picked kit never reaches the saved profile (equipped weapon, move, loot ledger).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../src/match.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { SPARRING_FOR_ALL, SPARRING_SKILLS, sparringLink, sparringParam, type SparringKit } from '../src/sparring.ts';
import { STRATEGIES, act, idle } from './strategies.ts';
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
