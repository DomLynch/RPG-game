// The HUD's career line (origins/preview/career-text.ts): Zone 1 labels the level as the career's while the world fight is a bare body (Strategy 2026-10-16); everywhere else it is the line it always was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerHud } from '../origins/preview/career-text.ts';
import TEXT from '../origins/preview/career-text.json' with { type: 'json' };

const mid = { level: 16, top: false, credit: 8625, into: 125, need: 900 }, top = { level: 30, top: true, credit: 99999, into: 0, need: 0 };

test('outside Zone 1 the line is exactly what it was', () => {
  assert.equal(careerHud(mid, 0, false), 'Level 16 · 125 / 900 CP');
  assert.equal(careerHud(mid, 40, false), 'Level 16 · 125 / 900 CP · +40 CP (preview)');
  assert.equal(careerHud(top, 0, false), 'Level 30 · 99999 CP');
});
test('in Zone 1 the level is the career\'s, and only the label changes', () => {
  assert.equal(careerHud(mid, 0, true), 'Career Level 16 · 125 / 900 CP');
  assert.equal(careerHud(mid, 40, true), 'Career Level 16 · 125 / 900 CP · +40 CP (preview)');
  assert.equal(careerHud(top, 0, true), 'Career Level 30 · 99999 CP');
  assert.equal(careerHud(mid, 0, true).replace(TEXT.line.levelWorld.replace('{level}', '16'), TEXT.line.level.replace('{level}', '16')), careerHud(mid, 0, false), 'nothing but the label differs');
});
test('both labels name the {level} and the world one says it is the career\'s', () => {
  assert.ok(TEXT.line.level.includes('{level}') && TEXT.line.levelWorld.includes('{level}'));
  assert.match(TEXT.line.levelWorld, /career/i);
});
