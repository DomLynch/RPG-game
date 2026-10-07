// The browser-vs-Node replay row's fixture (tests/fixtures/browser-replay-records.json) stays true to this tree without a browser:
// one record per playable roster opponent, each decodes at the current record version, and the page's own construction of it (match.ts
// startReplay: initialPractice(seed, opponentAt, weapon, skill) + stepPractice) reaches the pinned victim, draw flag and end tick, with
// Combat's sampled state hashes. A record bump or a rules change that moves a fight fails here first, in test:all, with the regenerate
// command; the release row (scripts/browser-replay-check.mjs) then compares the browser against the same Node leg.
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRecord, RECORD_VERSION } from '../src/record.ts';
import { fixtureShapeError, loadFixture, REPROS, replayInNode, stateHash } from '../scripts/browser-replay-check.mjs';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent } from '../src/duel.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';

const fixture = loadFixture() as { generated: { recordVersion: number }; records: { opponent: string; seed: number; level: number; encoded: string; label?: string; expect: { victim: number; draw: boolean; tick: number; killedTick: number }; hashes: Record<string, string> }[] };

test('browser-replay fixture: one record per playable roster opponent in roster order, every known-divergent repro after them, at the current record version', () => {
  assert.equal(fixtureShapeError(fixture.records), null, 'the roster or REPROS moved: node scripts/browser-replay-check.mjs --write');
  assert.equal(fixture.generated.recordVersion, RECORD_VERSION, `the fixture was generated at record version ${fixture.generated.recordVersion}, the writer is ${RECORD_VERSION}: node scripts/browser-replay-check.mjs --write`);
  // The 2026-09-29 repro (Finishers): Node's hero win at 2,248 on seed 828 v the Dwarf is the number the browser disagreed with.
  const repro = fixture.records.find((r) => r.label && r.opponent === 'dwarf' && r.seed === 828)!;
  assert.ok(repro && REPROS.some((r) => r.opponent === 'dwarf' && r.seed === 828), 'the seed-828 Dwarf repro is pinned');
  assert.deepEqual({ victim: repro.expect.victim, draw: repro.expect.draw, tick: repro.expect.tick }, { victim: 0, draw: false, tick: 1926 }, 'Node: the hero loses at 1,926 (RV29 re-pin, 2026-10-07: was a hero win at 2,248; the fixed sim must keep this number)');
});

test('browser-replay fixture: every record decodes and the page-path Node replay reaches its pinned outcome, hash for hash', async () => {
  for (const f of fixture.records) {
    const record = await decodeRecord(f.encoded);
    assert.equal(record.opponent, f.opponent); assert.equal(record.seed, f.seed); assert.equal(record.level, f.level);
    const node = replayInNode(record);
    assert.ok(node.finished, `${f.opponent}: the replay finishes`);
    assert.deepEqual({ victim: node.victim, draw: node.draw, tick: node.tick }, { victim: f.expect.victim, draw: f.expect.draw, tick: f.expect.tick }, `${f.opponent}: a rules change moved this fight; re-pin deliberately with --write`);
    assert.deepEqual(node.hashes, f.hashes, `${f.opponent}: the sampled state hashes (Combat's bisect ladder) differ`);
  }
});

test('stateHash is Combat\'s expression: sha256 of {d: duel, f: finish}, 12 hex, and moves with the state', () => {
  const goblin = opponentAt(OPPONENTS.goblin, 18), a = initialPractice(1, goblin), b = stepPractice(a, { ...idleIntent(), action: 'light' }, profileAt(OPPONENTS.goblin, 18));
  assert.match(stateHash(a), /^[0-9a-f]{12}$/);
  assert.notEqual(stateHash(a), stateHash(b), 'one stepped tick changes the hash');
});
