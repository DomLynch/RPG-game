import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Strategy: the loadout opened from the Pit rack frames the hero standing in the room in the sheet's stage window (no separate arena mannequin).
test('the loadout sheet over the Pit frames the standing hero through Pit.fitting, and leaving the sheet releases it', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), pit = readFileSync(new URL('../src/pit/pit.ts', import.meta.url), 'utf8');
  assert.match(main, /if \(pit && !gear\) \{[^\n]*\n\s+pit\.fitting\(element\('gear-window'\), .*journal\.dataset\.gear = 'live'/, 'enterGear over the Pit hands the stage window to the room');
  assert.match(main, /pit\?\.fitting\(null\);/, 'closing the sheet gives the camera back');
  assert.match(pit, /stopFitting\(\);\n/, 'leaving the Pit also drops the view offset');
  assert.match(pit, /else if \(game\) \{/, 'the walk and the taps are skipped while the sheet is up');
  assert.match(pit, /scene\.remove\(fitting\.light\); walker = \{ \.\.\.walker, heading: fitting\.was \}/, 'the key lamp goes and he turns back to his old facing');
  assert.match(pit, /scene\.add\(f\.light\)/, 'a warm key lamp stands on him while the sheet is up (the night room is torch-lit)');
});
