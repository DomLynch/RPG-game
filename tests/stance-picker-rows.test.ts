// The stance picker's rows (Dom 2026-10-19, option B): one row per record pick, in PICKS order, a label, a colour, an icon path; the layout numbers are rows too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKS } from '../src/fight/stance.ts';
import { STANCE_PICK_ROWS, stanceMenuText, stancePickRow, stancePickerDial } from '../src/fight/stance-picker-rows.ts';

test('the picker has one row per stance pick, in the record\'s PICKS order, each with a label, a hex colour and an icon path', () => {
  assert.deepEqual(STANCE_PICK_ROWS.map((r) => r.pick), [...PICKS]);
  for (const r of STANCE_PICK_ROWS) {
    assert.match(r.colour, /^#[0-9a-f]{6}$/i, r.id);
    assert.ok(r.label.length > 0 && r.icon.startsWith('M'), r.id);
  }
  assert.equal(stancePickRow('neutral').label, 'Balanced', 'the fourth stance is shown as Balanced; its id stays neutral');
  assert.equal(new Set(STANCE_PICK_ROWS.map((r) => r.colour)).size, PICKS.length, 'four distinct colours');
  assert.throws(() => stancePickRow('nope'), /no stancePick/);
});

test('every pick row carries its one-line effect (the menu shows it under the row)', () => {
  const effects = Object.fromEntries(STANCE_PICK_ROWS.map((r) => [r.pick, r.effect]));
  assert.deepEqual(effects, {
    neutral: 'No bonus, no weakness',
    aggressive: 'Hit 10% harder, break guards faster. Blocking costs more',
    defensive: 'Take 20% less, cheap blocks, fast recovery. Hit softer',
    trickster: 'Cheap feints, kicks break guards. Weaker heavies',
  });
  for (const r of STANCE_PICK_ROWS) assert.ok(r.effect.length > 0 && !r.effect.includes('\n'), r.id);
});

test('the button dials and the menu texts are rows and the button is a real touch target', () => {
  for (const id of ['buttonPx', 'iconPx']) assert.ok(stancePickerDial(id) > 0, id);
  assert.ok(stancePickerDial('buttonPx') >= 36, 'a finger-sized button');
  assert.throws(() => stancePickerDial('nope'), /no stancePickerDial/);
  assert.equal(stanceMenuText('text.locked'), 'Locked in a fight');
  assert.throws(() => stanceMenuText('nope'), /no stanceMenuText/);
});
