// Prints, one per line and repo-relative, every file the presence service loads: origins/presence/main.ts and everything it imports, transitively. ops/install-presence.sh copies
// exactly this list, so the service on the box is the code the repo tests, with no hand-kept file list to rot. A bare import (an npm package) is an error: the box has no node_modules
// (like the duel relay, presence is dependency-free), so one would otherwise fail only after the install.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';

export function presenceFiles(repo = resolve(dirname(fileURLToPath(import.meta.url)), '..'), entry = 'origins/presence/main.ts') {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    if (!existsSync(join(repo, file))) throw new Error(`presence imports ${file}, which does not exist`);
    seen.add(file);
    const source = readFileSync(join(repo, file), 'utf8');
    // The `{ … }` clause of an import/export may span lines (origins/contracts/economy.ts does): a single-line pattern missed items.ts and presence crashed on the box.
    const specs = [...source.matchAll(/^\s*(?:import|export)\b(?:[^'";{}]|\{[^}]*\})*?\bfrom\s*['"]([^'"]+)['"]/gm), ...source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm), ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)];
    for (const [, spec] of specs) {
      if (spec.startsWith('node:')) continue;
      if (!spec.startsWith('.')) throw new Error(`${file} imports the package "${spec}": presence must stay dependency-free (the box has no node_modules)`);
      visit(relative(repo, resolve(repo, dirname(file), spec)));
    }
  };
  visit(entry);
  return [...seen].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(presenceFiles().join('\n')); } catch (e) { console.error(`presence-files: ${e.message}`); process.exit(1); }
}
