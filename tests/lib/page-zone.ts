// Import this FIRST (before anything that loads Region 1) in a test that reads an UNLISTED zone's own plan, as that zone's page would: the opt-in is set and `location` names the zone by the address in PAGE_ZONE
// (set by the sibling modules below, one per zone: ES imports run in order, so each sets its address before this file reads it). Beta (Dom 10-22) leaves zones 3-5 unlisted; an unlisted zone's place (loader.ts zonePlaces) is
// seen only by its own page, and a test has no page, so without this a test of Zone 3's wolf or the Bone Hollow's gate sees no such place. Test processes only: nothing the public gets imports it.
import '../../origins/server/zone-package-env.ts';

export const pageAs = (zone: string): void => { (globalThis as { location?: unknown }).location = { pathname: `/zone${zone}/`, search: '' }; };
