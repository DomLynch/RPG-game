import OFF from '../fixtures/sandbox-rules-defs.off.json' with { type: 'json' };

// The sandbox's tests were written against rows that ship OFF (every rule 0, every table empty) and turn a rule on by patching the imported defs before the sim loads. BULK-CS ships the sandbox rows ON
// (sandbox-rules-defs.json), so each of those tests calls this first: it puts the imported defs object back to the OFF baseline (tests/fixtures/sandbox-rules-defs.off.json) in place, and the test then patches
// exactly what it always did. A test of the SHIPPED rows reads the defs file itself (tests/sandbox-rows-on.test.ts). Never imported by the game.
export function offDefs(defs: object): void {
  const d = defs as Record<string, unknown>, off = OFF as unknown as Record<string, unknown[]>;
  for (const k of Object.keys(d)) if (!(k in off)) delete d[k];
  for (const k of Object.keys(off)) {
    if (!Array.isArray(d[k])) d[k] = [];
    const arr = d[k] as unknown[]; arr.length = 0;
    arr.push(...off[k]!.map((r) => JSON.parse(JSON.stringify(r))));
  }
}
