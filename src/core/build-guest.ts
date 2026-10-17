// A GUEST's build, session-only (Lead 2026-10-17; Dom's rule: Zone 1 is open to everyone and sign-in is a save, never a gate). The signed-in character's build is the server's copy (build-server.ts) and a guest has none, so every
// newcomer fought on the base sheet (150 hp) whatever the HUD level said. This holds the points a guest places IN MEMORY: nothing is stored, nothing is sent, a reload resets it, exactly like the guest pack (#2975).
// It answers the same three calls the build dialog (build-screen.ts) and the page's fight sheet ask of the server's copy; the level is the local career counter, read live. A guest's world kills stay unverified
// and unpaid (no token: nothing is engaged or reported, tests/guest-build.test.ts), so a stronger guest sheet changes how he fights, never what he is paid. No DOM, network or storage.
import { validateBuild } from '../fight/sheet-rows.ts';
import type { BuildView } from './build-net.ts';
import type { SaveOutcome } from './build-server.ts';

export function createGuestBuild(level: () => number) {
  let placed: Record<string, number> = {}, version = 0;
  const view = (): BuildView => ({ level: level(), placed, respreadRank: 0, version });
  return {
    view,
    /** The same three calls as the server's copy: nothing to read, the memory is the answer. */
    refresh: async (): Promise<BuildView> => view(),
    /** Take the draft if the rows accept it at this level (the budget and every row's room); else say so as the server's refusal does. */
    async save(next: BuildView): Promise<SaveOutcome> {
      if (validateBuild({ level: level(), placed: next.placed }).length > 0) return 'offline';
      placed = { ...next.placed }; version++; return 'saved';
    },
    /** What the fight's sheet takes as the character's own build (fightSheet's `own`). */
    own: (): { level: number; placed: Record<string, number> } => ({ level: level(), placed }),
  };
}
