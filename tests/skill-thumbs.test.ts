// A move has no mesh, so its take tile draws public/game/img/loot/<SkillId>.thumb.svg (main.ts skillThumb). Every SkillId in SKILLS
// must have one, or the tile shows an empty slot; SCOPE 8's nine moves ship as one batch (Lead 2026-09-26), their thumbs ahead of their SKILLS entries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SKILLS } from '../src/loot.ts';

const thumb = (id: string) => new URL(`../public/game/img/loot/${id}.thumb.svg`, import.meta.url);
const SCOPE8 = ['lunge', 'reaping', 'shove', 'jab', 'cleave', 'stomp', 'miasma', 'ironrush', 'hewer'];   // Lead's fixed SkillIds

test('every skill has a take-tile thumb, drawn in the 96 x 96 glyph frame', () => {
  for (const id of [...Object.keys(SKILLS), ...SCOPE8]) {
    assert.ok(existsSync(thumb(id)), `${id}.thumb.svg`);
    const svg = readFileSync(thumb(id), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 96 96" width="96" height="96">/, id);
    assert.ok(svg.length < 2048, `${id} stays a small inline glyph`);
    assert.doesNotMatch(svg, /<(script|image|foreignObject)\b|href=/, `${id} is self-contained`);
  }
});
