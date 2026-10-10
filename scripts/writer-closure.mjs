// The box's node services load only what they import at runtime (no `three` on the box). This walks those runtime imports; shared by
// tests/origins-writer-closure.test.ts (the unit gate) and scripts/release-rows-for.mjs (which release rows a changed file triggers).
import { posix } from 'node:path';

export const WRITER_ENTRY = 'scripts/origins-writer.mjs';
// ExecStart of frankendom-origins-writer, -presence, -duel-relay, -verify-daily, -verify-loot.
export const SERVER_ENTRIES = [WRITER_ENTRY, 'origins/presence/main.ts', 'scripts/duel-relay.mjs', 'scripts/verify-daily.mjs', 'scripts/verify-loot.mjs'];
const TYPE_ONLY = /^\s*(?:import|export)\s+type\b/;
const SPEC = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\(\s*)['"]([^'"]+)['"]/gm;

const resolve = (from, rel, has) => {
  const p = posix.normalize(posix.join(posix.dirname(from), rel));
  return [p, `${p}.ts`, `${p}.mjs`, `${p}.js`, `${p}/index.ts`].find(has) ?? null;
};

/** The runtime import closure of one entry: the files it loads, and every bare package they import (type-only imports are erased by node). */
export function writerClosure(read, has, entry = WRITER_ENTRY) {
  const seen = new Set(), packages = new Set(), todo = [entry];
  while (todo.length) {
    const file = todo.pop(); if (seen.has(file)) continue; seen.add(file);
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(SPEC)) {
      if (TYPE_ONLY.test(text.slice(m.index, m.index + m[0].length))) continue;
      const spec = m[1];
      if (spec.startsWith('.')) { const next = resolve(file, spec, has); if (next) todo.push(next); }
      else if (!spec.startsWith('node:')) packages.add(spec);
    }
  }
  return { files: [...seen].sort(), packages: [...packages].sort() };
}
