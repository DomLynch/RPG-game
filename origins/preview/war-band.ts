// The goblin war band with a rally horn (zone sandbox, Strategy's #1 test for Zone 1, 2026-10-18). A captain and a horn-blower live in the fort. One hit on ANY goblin sounds the alarm: the horn-blower runs for the
// horn; if he reaches it the horn is blown and `rallyCount` goblins (the ones nearest the captain) turn on the hero with an enlarged notice radius for `rallySeconds`; if he is killed first the horn is never blown and
// the camp fights as singles. The captain drops `captainDrops` of the pieces he wears. Donors: EverQuest and Gothic social aggro (a hit calls the neighbours), Ultima Online's guard-call. Pure and DOM-free: the page
// feeds it hits and falls and positions, it answers with where the horn-blower should walk and when to rally. Every number is a row (fx-rows.json warband.*). The sim and src/fight/ are untouched.
export type WarBandRows = { readonly hornRunSpeed: number; readonly hornReach: number; readonly rallyCount: number; readonly rallySeconds: number };
export type WarBandPhase = 'idle' | 'alarm' | 'rallied' | 'silenced';
export type WarBandStep = { walk: { x: number; z: number; facing: number } | null; rally: readonly string[] | null };

export type Goblin = { readonly id: string; readonly loadout: string | undefined; readonly x: number; readonly z: number };

/** Pick the captain (the heaviest loadout: the one wearing the most pieces; ties by id) and the horn-blower (the lightest, a different one; ties by id) from the zone's goblins. */
export function pickRoles(goblins: readonly Goblin[], pieces: (loadout: string | undefined) => number): { captain: string | null; blower: string | null } {
  const sorted = [...goblins].sort((a, b) => pieces(b.loadout) - pieces(a.loadout) || a.id.localeCompare(b.id));
  const captain = sorted[0]?.id ?? null, rest = sorted.slice(1).sort((a, b) => pieces(a.loadout) - pieces(b.loadout) || a.id.localeCompare(b.id));
  return { captain, blower: rest[0]?.id ?? null };
}

export function createWarBand(rows: WarBandRows) {
  let phase: WarBandPhase = 'idle', blower: string | null = null, captain: string | null = null, horn = { x: 0, z: 0 }, rallyLeft = 0; const down = new Set<string>();
  return {
    /** Set the roles and where the horn hangs. Resets the band (a new zone page, or a respawned camp). */
    assign(roles: { captain: string | null; blower: string | null }, hornAt: { x: number; z: number }): void { blower = roles.blower; captain = roles.captain; horn = { ...hornAt }; phase = 'idle'; rallyLeft = 0; down.clear(); },
    /** A goblin was hit: the first hit on any goblin while the horn-blower lives sounds the alarm. */
    hit(id: string): void { if (phase === 'idle' && blower && !down.has(blower) && id.length > 0) phase = 'alarm'; },
    /** A goblin fell: if it was the horn-blower during the alarm, the horn is never blown. */
    fell(id: string): void { down.add(id); if (id === blower && (phase === 'alarm' || phase === 'idle')) phase = 'silenced'; },
    /** Each frame: where the horn-blower walks (null = nowhere) and, once, the rally. `at`: a goblin's position by id. `near(x, z, n)`: the n living goblins nearest that point, captain first. */
    update(dt: number, at: (id: string) => { x: number; z: number } | null, near: (x: number, z: number, n: number) => readonly string[]): WarBandStep {
      if (phase === 'rallied') { rallyLeft = Math.max(0, rallyLeft - dt); return { walk: null, rally: null }; }
      if (phase !== 'alarm' || !blower) return { walk: null, rally: null };
      const p = at(blower); if (!p) return { walk: null, rally: null };
      const dx = horn.x - p.x, dz = horn.z - p.z, d = Math.hypot(dx, dz);
      if (d <= rows.hornReach) { phase = 'rallied'; rallyLeft = rows.rallySeconds; return { walk: null, rally: near(captain ? (at(captain)?.x ?? horn.x) : horn.x, captain ? (at(captain)?.z ?? horn.z) : horn.z, rows.rallyCount) }; }
      const step = Math.min(rows.hornRunSpeed * dt, d);
      return { walk: { x: p.x + (dx / d) * step, z: p.z + (dz / d) * step, facing: Math.atan2(dx, dz) }, rally: null };
    },
    phase: (): WarBandPhase => phase, blower: (): string | null => blower, captain: (): string | null => captain, rallyLeft: (): number => rallyLeft, hornAt: () => horn,
  };
}
