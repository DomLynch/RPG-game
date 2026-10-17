// The engine's gear screen in Zone 1: the SAME sheet the Pit mounts (src/core/gear-sheet.ts), over Zone 1's cut of the Pit's ☰ menu (index.html carries the whole #journal dialog and
// its Profile pane; only the page's hide rule keeps the pane away until `gearing`), with the hero dressed in-zone (gear-stage.ts) and the server's ledger behind it (gear-server.ts).
// A guest keeps the device's own profile ledger, exactly as the Pit does.
import type * as THREE from 'three';
import { createGearSheet, wornIdsOf, wornTiersOf, type Tier } from '../../src/core/index.ts';
import { loadProfile, saveProfile } from '../../src/core/index.ts';
import { createServerGear } from '../../src/core/index.ts';
import { createGearStage } from './gear-stage.ts';
import { fightSheet, gearNumbers, weightClassOf } from '../../src/fight/index.ts';

// `onWorn`: the worn set changed (the server's ledger answered, or a wear / stow in the sheet), and once at mount for the device's own: main.ts dresses the walking hero with it (the sheet's wear is the one place every change passes).
type Deps = { renderer: THREE.WebGLRenderer; menu: HTMLDialogElement; layer: HTMLElement; storage: Storage; search: string; bodyUrl: string; onWorn?: (ids: readonly string[], tiers: Record<string, Tier>) => void };
export function mountGear(d: Deps) {
  const profile = loadProfile(d.storage, () => crypto.randomUUID()).profile, zone = createGearStage(d.renderer, d.bodyUrl);
  const wear = (ids: readonly string[], tiers: Record<string, Tier>) => { zone.wear(ids, tiers); d.onWorn?.(ids, tiers); };
  d.onWorn?.(wornIdsOf(profile.loot), wornTiersOf(profile.loot));
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  let server: ReturnType<typeof createServerGear> | undefined;
  const sheet = createGearSheet({
    element, journal: d.menu, canvas: d.renderer.domElement, profile: () => server?.profileFor(profile) ?? profile, persist: () => { saveProfile(d.storage, profile); },
    view: () => ({ wear, gearStage: () => zone.stage }), weapon: () => 'longsword', numbers: gearNumbers, weightOf: weightClassOf, emptyPack: 'Nothing stored. Creatures drop gear.', act: (op) => server?.act(op) ?? false,
  });
  server = createServerGear({ storage: d.storage, search: d.search, now: () => Date.now(), getLoot: () => profile.loot, show: sheet.showLoot });
  const leave = () => { sheet.leaveGear(); d.layer.classList.remove('gearing'); };
  d.menu.addEventListener('close', leave);
  addEventListener('resize', () => sheet.gear()?.fit()); d.menu.addEventListener('scroll', () => sheet.gear()?.fit());
  return {
    gear: sheet.gear,
    ready: (): boolean => server?.ready() ?? false,
    // After [zone ready], on the kit warm's queue: the mannequin dressed with the worn set the sheet would show (the server's view once it answered, else the device's), built off the main thread, so opening Gear links no program (signedin-gear row).
    release: zone.release,
    hold: zone.hold,   // from the moment the warm is queued the sheet shows its empty stage until the warm ends (gear-stage.ts)
    warm: async () => { const loot = (server?.profileFor(profile) ?? profile).loot; zone.wear(wornIdsOf(loot), wornTiersOf(loot)); return zone.warm(); },
    refresh: (): Promise<boolean> => server?.refresh() ?? Promise.resolve(false),   // read the server's worn-gear view now (at load, not only when the Gear screen opens)   // the server's view of the character's worn set has answered (the loadout gate in main.ts reads it)
    // What the hero fights on: the stored build (none = level 0, as the server's heroLimitOf reads it) with the worn set's deltas, from the server's view of the character; the server holds a world record's sheet EQUAL to the books' own.
    sheet: (own: { level: number; placed: Record<string, number> } | undefined): ReturnType<typeof fightSheet> => fightSheet(profile, own ?? { level: 0, placed: {} }, server),   // nothing until the SERVER's view has answered (a guest or an unanswered writer fights bare)
    // The ☰'s Gear chip: the menu opens on the Profile pane with the mannequin up; the server's ledger replaces the device's the moment it answers.
    open() {
      d.layer.classList.add('gearing'); element<HTMLInputElement>('journal-tab-profile').checked = true;
      sheet.renderLoot(); if (!d.menu.open) d.menu.showModal();
      sheet.enterGear(); zone.load(); void server?.refresh();
    },
  };
}
