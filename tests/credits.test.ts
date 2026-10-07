import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Credits (Dom GO 2026-10-07, via Lead): the menu names each borrowed asset, its author and its licence. The 0 A.D. row stays hidden until the
// first 0 A.D. model ships, and then carries the download of our edited CC-BY-SA models (docs/research/legends-600-bodies-and-donors.md, AMBER row).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const credits = /<details class="howto credits" id="credits">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? '';

test('the Credits section sits in the Settings tab, before the references row', () => {
  assert.ok(credits.length > 0, 'Credits exists');
  assert.ok(html.indexOf('id="credits"') > html.indexOf('pane-settings') && html.indexOf('id="credits"') < html.indexOf('class="references"'));
});

test('every shipped asset names its author and licence', () => {
  assert.match(credits, /Quaternius[\s\S]*CC0 1\.0/);
  assert.match(credits, /World of ClaudeCraft by Levy Street[\s\S]*MIT licence/);
  assert.match(credits, /Infinite, 3D Head Scan" by Lee Perry-Smith[\s\S]*CC BY 3\.0/, 'the shipped face carries the scan\'s skin grain (src/assets/README.md): CC BY 3.0 needs the line');
  assert.match(credits, /href="\/licenses\/meshoptimizer\.txt"/, 'the code-licence notices stay linked');
});

test('0 A.D. is credited with the edited-model download, hidden until its model ships', () => {
  const row = /<li id="credit-0ad"([^>]*)>([\s\S]*?)<\/li>/.exec(credits);
  assert.ok(row, 'the 0 A.D. row exists');
  assert.match(row![1], /\bhidden\b/, 'not shown while no 0 A.D. model is in the game');
  assert.match(row![2], /Wildfire Games/);
  assert.match(row![2], /CC-BY-SA 3\.0/);
  assert.match(row![2], /href="\/credits\/0ad-models\.zip" download/, 'our edited models are offered under the same licence');
});
