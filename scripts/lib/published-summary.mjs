// The line Lead reads at publish (Lead 2026-10-10, #2059): where the rows ACTUALLY ran, from the release-checks receipt, not the launch plan
// (R planned 8 Mac rows and ran 16). A row a host proved is counted once, under the first of CI, VPS, HF that listed it; a row left to the Mac
// by a refused or failed receipt is a Mac row, because the receipt has seconds for it and no `trusted` mark.
import { readFileSync } from 'node:fs';

const list = text => [...new Set(String(text || '').split(',').map(Number).filter(Number.isInteger))];
export function actualPlacement(detail, { ci = '', vps = '', hf = '' } = {}) {
  const mac = detail.filter(d => !d.trusted && !d.out_of_scope).map(d => d.index);
  const trusted = new Set(detail.filter(d => d.trusted).map(d => d.index));
  const c = list(ci).filter(n => trusted.has(n)), v = list(vps).filter(n => trusted.has(n) && !c.includes(n)), h = list(hf).filter(n => trusted.has(n) && !c.includes(n) && !v.includes(n));
  const other = [...trusted].filter(n => ![...c, ...v, ...h].includes(n));   // ruled-trusted rows (DEPLOY_TRUST_ROWS) and anything unattributed
  return { total: detail.length, mac, ci: c, vps: v, hf: h, other, outOfScope: detail.filter(d => d.out_of_scope).length, retried: detail.filter(d => d.retried).length };
}
export const summaryLine = ({ total, mac, ci, vps, hf, other, outOfScope, retried }, mergeToLive, deployMin) =>
  `Published summary: merge to live ${mergeToLive}; deploy.sh ran ${deployMin} min; rows actually run: ${total} total = ${ci.length} CI + ${vps.length} VPS + ${hf.length} HF/T4 + ${other.length} other trusted + ${outOfScope} out of scope + ${mac.length} on the Mac (${mac.join(',') || 'none'}; includes any receipt fallback), ${retried} retried`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [receipt, ci, vps, hf, mergeToLive, deployMin] = process.argv.slice(2);
  try { console.log(summaryLine(actualPlacement(JSON.parse(readFileSync(receipt, 'utf8')).checks_detail, { ci, vps, hf }), mergeToLive, deployMin)); }
  catch (e) { console.log(`Published summary: merge to live ${mergeToLive}; deploy.sh ran ${deployMin} min; row counts unavailable (${e.message})`); }
}
