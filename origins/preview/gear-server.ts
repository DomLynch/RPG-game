// When a signed-in character opens the engine's gear screen it shows the SERVER's ledger (origins/inventory through gear_open), and every wear / stow goes to the server (gear_equip /
// gear_unequip); a guest, a failed sign-in or a writer that does not answer keeps the local ledger exactly as before. No DOM here: the page hands in storage, the clock and two callbacks.
import { emptyLoot, type Loot } from '../../src/loot.ts';
import { lootOfView, type GearOp, type GearView } from '../../src/gear-ledger.ts';
import { isOffline as offlineGear, openGear, runOp } from './gear-net.ts';
import { fetchOpen, isOffline, storedToken, writerBase } from './save.ts';

type Deps = { storage: { getItem(key: string): string | null } | null; search: string; now: () => number; fetch?: typeof fetch; getLoot: () => Loot | undefined; show: (loot: Loot) => void; refused?: () => void };
export function createServerGear(d: Deps) {
  let character: string | null = null, view: GearView | null = null, busy = false;
  const opts = () => ({ base: writerBase(d.search), ...(d.fetch ? { fetch: d.fetch } : {}) });
  // The server owns owned / worn / pack / tiers; the move, declines and skull wall stay the local profile's.
  const apply = (v: GearView) => { view = v; const s = lootOfView(v); d.show({ ...(d.getLoot() ?? emptyLoot()), owned: s.owned, equipped: s.equipped, pack: s.pack, taken: s.taken }); };
  async function who(): Promise<string | null> {
    if (character) return character;
    const token = storedToken(d.storage, d.now()); if (!token) return null;
    const opened = await fetchOpen(token, opts()); if (isOffline(opened)) return null;
    return (character = opened.characters[0]?.id ?? null);
  }
  return {
    // Called whenever the sheet opens: read the ledger; nothing changes on any failure (the local ledger stays on screen).
    async refresh(): Promise<boolean> {
      const id = await who(), token = storedToken(d.storage, d.now()); if (!id || !token) return false;
      const got = await openGear(token, id, opts()); if (offlineGear(got)) return false;
      apply(got); return true;
    },
    // The sheet's one decision point: handled (true) once the server's view is known, so the local ledger never decides for a signed-in character.
    act(op: GearOp): boolean {
      const token = storedToken(d.storage, d.now()); if (!view || !character || !token) return false;
      if (busy) return true;   // one op at a time: the next tap after the answer
      busy = true; const v = view, id = character;
      void runOp(token, id, v, op, opts()).then((out) => { if (!offlineGear(out.view)) apply(out.view); if (out.refused) d.refused?.(); }).finally(() => { busy = false; });
      return true;
    },
  };
}
