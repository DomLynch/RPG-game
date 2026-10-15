// sandbox-mech spell slot 2 (Dom 2026-10-15: both SPELL buttons real, a spell in either): the second spell the sandbox equips (sandbox/entry.ts sets `globalThis.__SANDBOX_SPELL2__` from ?spell2= / ?cast2= before the page boots).
// Absent on every other build, so nothing changes there. Read at fight start only, never mid-fight.
export const slot2Pick = (): { id: string; skill: number } | undefined => (globalThis as { __SANDBOX_SPELL2__?: { id: string; skill: number } }).__SANDBOX_SPELL2__;
