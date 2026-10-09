// Imported FIRST by main.ts: a page address that names no zone (/zone/99/, ?zone=x) gets a plain message instead of a blank page, before any module reads the zone package.
import { pageZoneId, zoneIds } from '../zones/loader.ts';
const id = pageZoneId();
if (!zoneIds().includes(id)) {
  document.body.textContent = `There is no zone "${id}". Zones: ${zoneIds().join(', ')}.`;
  throw new Error(`no zone ${id}`);
}
