// Where a release row runs (Dom 2026-10-09, "the Mac is the exception"): placement is DATA here, not a switch. A row is on the Mac only
// when it is listed below with its reason; a row joins the list only with a reason and, for "slower on HF", a MEASURED number.
// Re-measure monthly. tests/row-placement.test.ts pins this list to what vps-receipts.mjs coverageGaps() computes, so it cannot drift.
export const MAC_MAX = 16;         // the most rows a release may run on the Mac: 8 by nature (MAC_ONLY) + 8 measured slow (SLOW_ON_HF) (Lead, with Dom's T4 approval, 2026-10-09)
export const MAC_ENFORCE = false;  // false: an over-limit release prints the refusal text and runs (Lead 2026-10-09: do not block M or the next release); true in the PR that turns T4_FUNDED on
export const T4_FUNDED = false;    // false: the 24 wall rows still run on the Mac; true (a reviewed PR, after Dom tops up Hugging Face and Lead has the balance) launches them on t4-medium
export const VPS_ROWS = [13];      // account-database-check: initdb refuses root in the HF container, so a non-root VPS box runs it
export const MAC_ONLY = [
  { row: 2, why: 'roster-browser-check hit the 600 s ceiling on HF', hf_s: 600, mac_s: 73, date: '2026-10-09' },
  { row: 4, why: 'WebKit (Linux WebKit is not Mac Safari)' },
  { row: 22, why: 'WebKit' },
  { row: 44, why: 'sparring-browser-check exits 1 on HF', hf_s: null, mac_s: 145, date: '2026-10-09' },
  { row: 45, why: 'WebKit' },
  { row: 48, why: 'WebKit' },
  { row: 49, why: 'WebKit' },
  { row: 52, why: 'WebKit and clock.resume (real clock)' },
];
// Measured on HF cpu-upgrade vs the Mac, J4a/J4b 2026-10-09: all >3x slower, so they stay on the Mac (the t4-medium trial of 5/7/16, HF job
// 6ac7f57efee2c9007016dd66, also hit 600 s: not GPU-bound). Rows 5 and 34 hit the 1500 s ceiling on HF and fail there. Find out WHY (follow-up).
export const SLOW_ON_HF = [
  { row: 5, hf_s: 1500, mac_s: 221, note: 'hit the ceiling on HF' }, { row: 7, hf_s: 784 }, { row: 9, hf_s: 607 }, { row: 16, hf_s: 1155 },
  { row: 21, hf_s: 1168 }, { row: 28, hf_s: 932 }, { row: 34, hf_s: 1500, note: 'hit the ceiling on HF' }, { row: 36, hf_s: 776 },
];
// The first log line of a release: how every row is being handled. ci = trusted from CI, hf = trusted from an HF receipt, vps = trusted from the
// VPS, mac = rows running on the Mac. Over the limit the refusal text names the rows that are not on the Mac list.
export function placementLine({ total, ci, hf, vps = [], mac }) {
  const list = rows => rows.length ? ` (${rows.join(',')})` : '';
  const macOnly = new Set([...MAC_ONLY, ...SLOW_ON_HF].map(entry => entry.row));
  const over = mac.filter(row => !macOnly.has(row));
  const text = `Release rows: ${total} total: ${ci.length + hf.length + vps.length} trusted / ${hf.length} HF${list(hf)} / ${vps.length} VPS${list(vps)} / ${mac.length} Mac${list(mac)}; CI-trusted ${ci.length}${list(ci)}`;
  const refuse = mac.length > MAC_MAX;
  return { text, refuse, enforce: refuse && MAC_ENFORCE, warning: refuse ? `Mac rows ${mac.length} > MAC_MAX ${MAC_MAX}: rows not on the Mac-only list: ${over.join(',') || 'none'}${MAC_ENFORCE ? ' (REFUSED)' : ' (not enforced yet: MAC_ENFORCE=false)'}` : '' };
}
// The wall-clock rows go to t4-medium four to a job (they passed 4-wide before), each job under a hard --timeout. A scoped release sends only its in-scope rows.
export const WALL_JOB_SIZE = 4;
export const wallJobs = rows => Array.from({ length: Math.ceil(rows.length / WALL_JOB_SIZE) }, (_, i) => rows.slice(i * WALL_JOB_SIZE, (i + 1) * WALL_JOB_SIZE));
