// The /game/legends/ roster page (scripts/game-roster.mjs): exactly the legends the Pit keeps and lets you challenge, each with a line, each at its ladder rank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT, RANKS, parseCsv, render, roster } from '../scripts/game-roster.mjs';

const csv = (p: string) => parseCsv(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('the roster page is exactly what the data says today (run node scripts/game-roster.mjs after editing the ladder csv or the lines)', () => {
  assert.equal(readFileSync(OUT, 'utf8'), render());
});

test('the roster is the Pit-kept, challengeable set: no parked, blocked or removed legend, no duplicates, every one has a line and a rank 1-10', () => {
  const ladder = csv('docs/research/legends-600-ladder.csv'), kept = ladder.filter((r: Record<string, string>) => r.pit_status === 'keep' && r.challengeable === 'yes');
  const list = roster();
  assert.equal(list.length, kept.length);
  assert.ok(list.length > 700, `the roster shrank to ${list.length}`);
  assert.equal(new Set(list.map((l: { id: string }) => l.id)).size, list.length, 'duplicate id');
  const out = new Set(ladder.filter((r: Record<string, string>) => !kept.includes(r)).map((r: Record<string, string>) => r.id));
  for (const l of list) { assert.ok(!out.has(l.id), `${l.id} is parked or blocked in the ladder csv`); assert.ok(l.line.length > 10, `${l.name} has no line`); assert.ok(l.rank >= 1 && l.rank <= 10, `${l.name} rank ${l.rank}`); }
  const html = readFileSync(OUT, 'utf8');
  assert.equal((html.match(/<li>/g) ?? []).length, list.length);
  assert.match(html, new RegExp(`<h1[^>]*>${list.length} legends</h1>`));
});

test('the roster page names the ladder\'s own ten rank titles, and carries no script (the site CSP is script-src self)', async () => {
  const { rankFor } = await import('../src/career.ts');
  const first = new Map<string, number>();
  for (let m = 0; m <= 1000 && first.size < 10; m++) if (!first.has(rankFor(m).title)) first.set(rankFor(m).title, m);
  assert.deepEqual([...first.keys()], RANKS);
  assert.doesNotMatch(readFileSync(OUT, 'utf8'), /<script/i);
});

test('the /game page links the roster and states the fifty-step ladder', () => {
  const html = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
  assert.match(html, /href="\/game\/legends\/"/);
  assert.match(html, /Fifty steps: ten ranks of five/);
});
