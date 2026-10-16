// Authors sandbox/spell-looks.json: one `spellLook` row per catalogue spell { id, tint, size, pulse }, read by missile-fx.ts's cast burst through sandbox-rules.ts spellLookOf.
//   tint  the spell's school colour (school-defs.json) nudged in hue / lightness by the spell's own id and level, so two spells of one school still differ
//   size  per-mille of the burst's base size (1000 = as before): grows with level
//   pulse ticks the burst swells and fades over (the old fixed length was 42)
// Re-run to re-author from the catalogue (node sandbox/spell-looks-gen.mjs); hand edits to a row survive in the Sandbox panel (rows.json overrides) and are never overwritten by hand.
import { writeFileSync } from 'node:fs';
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const toHsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
};
const toHex = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const rows = Object.entries(SPELL_INFO).sort(([a], [b]) => a.localeCompare(b)).map(([id, i]) => {
  const h = hash(id), [bh] = toHsl(i.color || '#b070ff');
  // A wide hue spread round the school's colour and a floor on saturation: on the additive halo a pale tint reads as white, so same-school spells must still be told apart on a phone.
  const hue = (bh + ((h % 121) - 60) + 360) % 360, sat = clamp(0.6 + ((h >>> 8) % 40) / 100, 0.6, 1), light = clamp(0.5 + i.level * 0.012 + (((h >>> 16) % 13) - 6) / 100, 0.46, 0.68);
  return { id, tint: toHex(hue, sat, light), size: 750 + i.level * 55 + ((h >>> 4) % 150), pulse: 30 + ((h >>> 12) % 28) };
});
writeFileSync(new URL('./spell-looks.json', import.meta.url), '{"spellLook":[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n');
console.log(rows.length, 'spell look rows; distinct tints', new Set(rows.map((r) => r.tint)).size);
