import test from 'node:test';
import assert from 'node:assert/strict';
import LABELS from '../src/fight/special-labels.json' with { type: 'json' };
import SCHOOL_ROWS from '../src/fight/special-schools.json' with { type: 'json' };
import CUES from '../src/fight/special-cues.json' with { type: 'json' };
import { SPECIAL_LABELS } from '../src/fight/sparring-specials.ts';
import { SCHOOL_OF } from '../src/fight/spell-school.ts';
import { SCHOOL_IDS } from '../src/fight/schools.ts';
import { SPECIAL_CUES, SPECIAL_CUE_OF } from '../src/fight/sound/special.ts';
import STEMS from '../src/fight/shield-stems.json' with { type: 'json' };
import OVERRIDES from '../src/fight/shape-overrides.json' with { type: 'json' };
import { SHIELD_STEM, SHIPPING_SHIELDS } from '../src/fight/shields.ts';
import { SHAPE_OVERRIDES } from '../src/fight/weapon-shapes.ts';

const once = (ids: string[]) => new Set(ids).size === ids.length;

test('special-labels.json: one non-empty label per special, and each reaches the sparring picker', () => {
  assert.ok(once(LABELS.rows.map((r) => r.id)), 'a duplicate label row');
  for (const r of LABELS.rows) { assert.ok(r.label.trim().length > 0, r.id); assert.equal(SPECIAL_LABELS[r.id], r.label, r.id); }
});

test('special-schools.json: one row per special, every school a school row, and each reaches the look test', () => {
  assert.ok(once(SCHOOL_ROWS.rows.map((r) => r.id)), 'a duplicate school row');
  for (const r of SCHOOL_ROWS.rows) { assert.ok(SCHOOL_IDS.includes(r.school), `${r.id}: ${r.school} is not a school row`); assert.equal(SCHOOL_OF[r.id], r.school, r.id); }
});

test('special-cues.json: one row per class special, every cue a real audio cue, and each reaches the preview lookup', () => {
  assert.ok(once(CUES.rows.map((r) => r.id)), 'a duplicate cue row');
  for (const r of CUES.rows) { assert.ok((SPECIAL_CUES as readonly string[]).includes(r.cue), `${r.id}: ${r.cue} is not a cue`); assert.equal(SPECIAL_CUE_OF[r.id], r.cue, r.id); }
});

test('shield-stems.json: one row per shield carrier with a file stem, and every row ships', () => {
  assert.ok(once(STEMS.rows.map((r) => r.id)), 'a duplicate carrier row');
  for (const r of STEMS.rows) { assert.ok(r.stem.length > 0, r.id); assert.equal(SHIELD_STEM[r.id], r.stem, r.id); assert.ok(SHIPPING_SHIELDS.has(r.id), r.id); }
});

test('shape-overrides.json: one row per (opponent, weapon), and each reaches the table the renderer reads', () => {
  assert.ok(once(OVERRIDES.rows.map((r) => `${r.opponent}/${r.weapon}`)), 'a duplicate override row');
  for (const r of OVERRIDES.rows) assert.equal((SHAPE_OVERRIDES[r.opponent] as Record<string, string> | undefined)?.[r.weapon], r.shape, `${r.opponent}/${r.weapon}`);
  assert.equal(Object.values(SHAPE_OVERRIDES).reduce((n, o) => n + Object.keys(o).length, 0), OVERRIDES.rows.length, 'no override outside the rows');
});
