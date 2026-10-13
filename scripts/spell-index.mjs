// Writes src/fight/spell-index.json: the spell catalogue's sim projection, one entry per legend id (the spell row id without `spell:`): [brick root, spell level]. The duel resolves a recorded spell id through
// THIS file (src/fight/spell-cast.ts), so the sim and the page need 700 short rows and not the 700 spell records with their stories. tests/spell-cast.test.ts compares it with the catalogue and fails with this command.
//   node scripts/spell-index.mjs --write
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = new URL('../src/fight/', import.meta.url);
export const indexOf = () => {
  const out = {};
  for (const f of readdirSync(DIR).filter((n) => /^spells-[a-z-]+\.json$/.test(n)).sort()) {
    for (const r of JSON.parse(readFileSync(new URL(f, DIR), 'utf8')).spells) if (r.id.startsWith('spell:')) out[r.id.slice('spell:'.length)] = [r.bricks.root, r.level];
  }
  return out;
};
if (process.argv.includes('--write')) writeFileSync(new URL('spell-index.json', DIR), JSON.stringify({ spells: indexOf() }) + '\n');
