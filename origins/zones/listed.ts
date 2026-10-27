// The server's only door to the zone registry: the LISTED zones, with the unlisted-zone opt-in (VITE_UNLISTED_ZONES) hard-wired off. A sandbox zone such as zone 90 must never load on the server
// whatever its environment says, so origins/server imports these two and never loadZone or zoneIds (tests/unlisted-zones-guard.test.ts fails if a server file imports them directly).
import { loadZone, zoneIds, type Zone } from './loader.ts';

export const listedZone = (id: string): Zone => loadZone(id, false);
export const listedZoneIds = (): string[] => zoneIds(false);
