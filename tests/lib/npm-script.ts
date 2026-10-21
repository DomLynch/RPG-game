// What an npm script RUNS, with every `npm run <name>` step replaced by that script's own steps (Dom's repo audit 2026-10-21: the quality*
// scripts compose quality:lint and quality:checks instead of repeating them). Tests that pin a gate's checks read this, not the spelling.
export function steps(scripts: Record<string, string>, name: string, seen: string[] = []): string[] {
  const body = scripts[name];
  if (body === undefined) throw new Error(`package.json has no script ${name}`);
  if (seen.includes(name)) throw new Error(`npm script cycle: ${[...seen, name].join(' -> ')}`);
  return body.split(' && ').flatMap((step) => {
    const m = /^npm run ([\w:-]+)$/.exec(step);
    return m && m[1]! in scripts && isComposite(scripts[m[1]!]!) ? steps(scripts, m[1]!, [...seen, name]) : [step];
  });
}

/** A script that is itself a chain is expanded; a leaf (one command, e.g. `typecheck:origins` = `node scripts/origins-tsc.mjs`) stays as `npm run <leaf>`. */
const isComposite = (body: string) => body.includes(' && ');

export const expanded = (scripts: Record<string, string>, name: string) => steps(scripts, name).join(' && ');
