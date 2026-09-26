// Offline appearance data only. Geometry, weapon recipes and combat stay independent.
const base = {
  steel: { color: '#767a7c', metalness: 0.85, roughness: 0.55 },
  leather: '#4a3527', heraldry: '#6e2622', bronze: '#ffffff', matteIron: false, items: '',
};
const palettes = {
  hero: {},
  veteran: { heraldry: '#3f2e22', items: 'helmet_bronze' },
  pitborn: { steel: { color: '#2f2b28', metalness: 0.85, roughness: 0.78 }, heraldry: '#4d463c' },
  nightborn: { steel: { color: '#3b3b3f', metalness: 0.7, roughness: 0.72 }, leather: '#2b2320', heraldry: '#17151a' },
  goblin: { steel: { color: '#4a3a2c', metalness: 0.6, roughness: 0.9 }, heraldry: '#3a3229', items: 'helmet_scrap' },
  // Blackened mask and greaves retain their matte scalar finish over authored maps.
  // The Shieldmaiden (reference A): dark iron plates and mail, dark brown leather, charcoal wool.
  shieldmaiden: { steel: { color: '#55585b', metalness: 0.85, roughness: 0.62 }, leather: '#3d2b1f', heraldry: '#2c2e33' },
  executioner: { steel: { color: '#33302e', metalness: 0.8, roughness: 0.7 }, leather: '#2b231c', heraldry: '#171310', bronze: '#4a4239', matteIron: true, items: 'mask_iron,hood_rag' },
};

export function warriorAppearance(fighter = 'hero') {
  if (!Object.hasOwn(palettes, fighter)) throw new Error(`Unknown appearance: ${fighter}`);
  const appearance = { ...base, ...palettes[fighter] };
  return { ...appearance, steel: { ...appearance.steel } };
}
