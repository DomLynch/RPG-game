// The one-health-bar pool of a world fight: the foe starts with the whole pool as his bar (v1 stub; src/twist.ts oneBarHealth sums it). ONE definition, used by the preview host that plays the
// fight (origins/preview) and by the server verifier that re-simulates it (origins/server/encounter-verify.ts): they cannot drift. No src/ file changes.
import { project, type Practice } from '../../src/fight/index.ts';

export const withBar = (p: Practice, bar: number): Practice => {
  const [me, foe] = p.duel.fighters;
  return project({ ...p.duel, fighters: [me, { ...foe, health: bar, maxHealth: bar }] }, p.ai);
};
