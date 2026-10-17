// TEST ONLY: previewRule reads globalThis.__rules first (the crowd page check sets it from env RULES), so one build can show the crowd with a different full count.
const fs = require('fs');
let p = fs.readFileSync('origins/preview/preview-rules.ts', 'utf8');
p = p.replace('export const previewRule = (id: (typeof NAMED)[number]): number => PREVIEW_RULES.find((r) => r.id === id)!.value;', 'export const previewRule = (id: (typeof NAMED)[number]): number => ((globalThis as unknown as { __rules?: Record<string, number> }).__rules?.[id]) ?? PREVIEW_RULES.find((r) => r.id === id)!.value;');
if (!p.includes('__rules')) throw Error('previewRule anchor missing');
fs.writeFileSync('origins/preview/preview-rules.ts', p);
let h = fs.readFileSync('scripts/origins-crowd-page-check.mjs', 'utf8');
h = h.replace("page.on('pageerror'", "if (process.env.RULES) await page.addInitScript((x) => { window.__rules = x; }, JSON.parse(process.env.RULES)); page.on('pageerror'");
if (!h.includes('process.env.RULES')) throw Error('crowd page anchor missing');
fs.writeFileSync('scripts/origins-crowd-page-check.mjs', h);
