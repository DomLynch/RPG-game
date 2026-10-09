// The engine's gear screen in Zone 1: the SAME sheet the Pit mounts (src/gear-sheet.ts), over Zone 1's cut of the Pit's ☰ menu (index.html carries the whole #journal dialog and
// its Profile pane; only the page's hide rule keeps the pane away until `gearing`), with the hero dressed in-zone (gear-stage.ts) and the server's ledger behind it (gear-server.ts).
// A guest keeps the device's own profile ledger, exactly as the Pit does.
import type * as THREE from 'three';
import { createGearSheet } from '../../src/gear-sheet.ts';
import { loadProfile, saveProfile } from '../../src/profile.ts';
import { createServerGear } from './gear-server.ts';
import { createZone1GearStage } from './gear-stage.ts';

type Deps = { renderer: THREE.WebGLRenderer; menu: HTMLDialogElement; layer: HTMLElement; storage: Storage; search: string };
export function mountGear(d: Deps) {
  const profile = loadProfile(d.storage, () => crypto.randomUUID()).profile, zone = createZone1GearStage(d.renderer);
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  let server: ReturnType<typeof createServerGear> | undefined;
  const sheet = createGearSheet({
    element, journal: d.menu, canvas: d.renderer.domElement, profile: () => server?.profileFor(profile) ?? profile, persist: () => { saveProfile(d.storage, profile); },
    view: () => ({ wear: zone.wear, gearStage: () => zone.stage }), weapon: () => 'longsword', act: (op) => server?.act(op) ?? false,
  });
  server = createServerGear({ storage: d.storage, search: d.search, now: () => Date.now(), getLoot: () => profile.loot, show: sheet.showLoot });
  const leave = () => { sheet.leaveGear(); d.layer.classList.remove('gearing'); };
  d.menu.addEventListener('close', leave);
  addEventListener('resize', () => sheet.gear()?.fit()); d.menu.addEventListener('scroll', () => sheet.gear()?.fit());
  return {
    gear: sheet.gear,
    // The ☰'s Gear chip: the menu opens on the Profile pane with the mannequin up; the server's ledger replaces the device's the moment it answers.
    open() {
      d.layer.classList.add('gearing'); element<HTMLInputElement>('journal-tab-profile').checked = true;
      sheet.renderLoot(); if (!d.menu.open) d.menu.showModal();
      sheet.enterGear(); zone.load(); void server?.refresh();
    },
  };
}
