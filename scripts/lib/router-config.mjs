// The work waterfall's numbers, in ONE place so Dom can change them (Lead 2026-10-12, Dom's direct word): every job goes Mac -> VPS -> Hugging Face.
//   Mac gate: 5-MINUTE load average below macMaxLoad5 (a short spike must not skip the Mac), plus one job at a time, nice 15, 30-min cap and not while
//             a release Mac row runs (the Mac wrapper scripts/lanejob/lanejob-mac.sh enforces those; this file owns the load number).
//   VPS gate: 1-minute load below vpsMaxLoad1 (16 = the box's cores); scripts/lanejob/lanejob.sh mirrors it as LANEJOB_MAX_LOAD1 (tests/waterfall.test.ts pins both).
//   HF last: the T4 only for graphics (browser/GPU rows, stills), the CPU tier for the rest.
export const ROUTER = Object.freeze({
  macMaxLoad5: 6,
  vpsMaxLoad1: 16,
});
