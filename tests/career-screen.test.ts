import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { boardViews, ladderView, recordLine, nameKey, pencilFor, recordView, renameDevice, scoreLines } from '../src/core/career-screen.ts';

test('the ladder is ten titles of five rungs, with the rank\'s rung marked and every lower rung done', () => {
  const view = ladderView(0);
  assert.equal(view.length, 10); assert.ok(view.every((s) => s.rungs.length === 5));
  assert.deepEqual(view[0]!.rungs.map((r) => r.state), ['now', 'next', 'next', 'next', 'next']);
  const mid = ladderView(7);   // level = 1 + wins: 8 = Legionary III
  const flat = mid.flatMap((s) => s.rungs), now = flat.filter((r) => r.state === 'now');
  assert.equal(now.length, 1); assert.equal(now[0]!.label, 'Legionary III');
  assert.ok(flat.slice(0, 7).every((r) => r.state === 'done') && flat.slice(8).every((r) => r.state === 'next'));
  const top = ladderView(1000).flatMap((s) => s.rungs); assert.equal(top.at(-1)!.state, 'now'); assert.equal(top.at(-1)!.label, 'Origin V');
});

test('the scorecard lines are most-fought first, losses read "n (k left)" only after a walk-away, and the total closes the table', () => {
  const rows = [{ opponent: 'a', fights: 1, wins: 1, losses: 0, draws: 0, left: 0, last: [] }, { opponent: 'b', fights: 4, wins: 1, losses: 3, draws: 0, left: 1, last: [] }];
  const lines = scoreLines(rows, (o) => o.toUpperCase());
  assert.deepEqual(lines.map((l) => l.name), ['B', 'A', 'All fights']);
  assert.deepEqual(lines[0], { name: 'B', fights: 4, wins: 1, losses: '3 (1 left)' });
  assert.deepEqual(lines[2], { name: 'All fights', fights: 5, wins: 2, losses: '3 (1 left)' });
  assert.deepEqual(scoreLines([]), [{ name: 'All fights', fights: 0, wins: 0, losses: '0' }], 'a new fighter: just the total');
});

test('the boards are one list per board in place order, the name rendered as the server gave it, an empty board left out', () => {
  const rows = [{ board: 'duel_wins', place: 2, who: 'Fighter #12', fighterId: 12, score: 3 }, { board: 'duel_wins', place: 1, who: 'Fighter #7', fighterId: 7, score: 9 }, { board: 'duel_rating', place: 1, who: 'Fighter #7', fighterId: 7, score: 1500 }] as const;
  const views = boardViews(rows);
  assert.deepEqual(views.map((v) => v.title), ['Duel rating', 'Duel wins']);
  assert.deepEqual(views[1]!.lines, [{ place: 1, who: 'Fighter #7', score: 9 }, { place: 2, who: 'Fighter #12', score: 3 }]);
  assert.deepEqual(boardViews([rows[2]]).map((v) => v.title), ['Duel rating'], 'a board with no rows is not drawn');
  assert.deepEqual(boardViews([]), []);
});

test('the profile record is the account\'s totals (with draws) when its scorecard answers, else the device\'s own, and the line says which figures it has', () => {
  const rows = [{ opponent: 'a', fights: 3, wins: 2, losses: 0, draws: 1, left: 0, last: [] }, { opponent: 'b', fights: 2, wins: 0, losses: 2, draws: 0, left: 1, last: [] }];
  const account = recordView(rows, { fights: 99, wins: 99, losses: 99 });
  assert.deepEqual(account, { fights: 5, wins: 2, losses: 2, draws: 1, source: 'account' });
  assert.equal(recordLine(account), '5 fights · 2 wins · 2 losses · 1 draws');
  const device = recordView(null, { fights: 4, wins: 1, losses: 3 });
  assert.deepEqual(device, { fights: 4, wins: 1, losses: 3, draws: null, source: 'device' });
  assert.equal(recordLine(device), '4 fights · 1 wins · 3 losses', 'the device keeps no draw count: none is claimed');
  assert.deepEqual(recordView([], { fights: 4, wins: 1, losses: 3 }), { fights: 0, wins: 0, losses: 0, draws: 0, source: 'account' }, 'a signed-in fighter with no fights yet has an empty account record, not the device\'s');
});

test('a guest\'s pencil keeps the cleaned name in the device profile (24 characters, blank becomes Wanderer, the id is kept)', () => {
  const data = new Map<string, string>(), storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  assert.equal(renameDevice(storage, '  Ada  ', () => 'guest-0001'), 'Ada');
  assert.equal(renameDevice(storage, 'x'.repeat(40), () => 'guest-0002').length, 24);
  assert.equal(renameDevice(storage, '   ', () => 'guest-0003'), 'Wanderer');
  const saved = JSON.parse([...data.values()][0]!);
  assert.equal(saved.id, 'guest-0001');
});

test('the name pencil: the Pit\'s own rename is the account\'s, a guest elsewhere edits the device name, a signed-in player in the zone gets none', () => {
  assert.equal(pencilFor({ rename: true, signedIn: true }), 'account');
  assert.equal(pencilFor({ rename: true, signedIn: false }), 'account');
  assert.equal(pencilFor({ rename: false, signedIn: false }), 'device');
  assert.equal(pencilFor({ rename: false, signedIn: true }), null);
});
test('in the name field Enter keeps the typed name, Escape drops it, other keys do nothing', () => {
  assert.equal(nameKey('Enter'), 'keep'); assert.equal(nameKey('Escape'), 'drop'); assert.equal(nameKey('a'), null);
});
test('the render takes the pencil from pencilFor with the real signed-in state, and both Gear links open the one gear sheet', () => {
  const screen = readFileSync('src/core/career-screen.ts', 'utf8'), main = readFileSync('src/main.ts', 'utf8'), zone = readFileSync('origins/preview/pit-duel.ts', 'utf8');
  assert.match(screen, /pencilFor\(\{ rename: !!o\.rename, signedIn: !!db \}\)/, 'the pencil follows the account state');
  assert.match(screen, /const k = nameKey\(e\.key\); if \(k\) finish\(k === 'keep'\)/, 'the field takes its keys from nameKey');
  assert.match(main, /label: 'Gear', go: \(\) => \{ enterGear\(\); element<HTMLInputElement>\('journal-tab-profile'\)\.checked = true/, 'the Pit\'s Gear link enters the gear sheet before it shows the tab');
  assert.match(zone, /label: 'Gear', go: \(\) => document\.getElementById\('menu-gear'\)\?\.click\(\)/, 'the zone\'s Gear link is the menu-gear entry (createGearSheet via gear-mount)');
});
