// Offline appearance data only. Geometry, weapon recipes and combat stay independent.
const base = {
  steel: { color: '#767a7c', metalness: 0.85, roughness: 0.55 },
  leather: '#4a3527', heraldry: '#6e2622', bronze: '#ffffff', matteIron: false,
};
const palettes = {
  hero: {},
  veteran: { heraldry: '#3f2e22' },
  pitborn: { steel: { color: '#2f2b28', metalness: 0.85, roughness: 0.78 }, heraldry: '#4d463c' },
  nightborn: { steel: { color: '#3b3b3f', metalness: 0.7, roughness: 0.72 }, leather: '#2b2320', heraldry: '#17151a' },
  goblin: { steel: { color: '#4a3a2c', metalness: 0.6, roughness: 0.9 }, heraldry: '#3a3229' },
  // Blackened mask and greaves retain their matte scalar finish over authored maps.
  executioner: { steel: { color: '#33302e', metalness: 0.8, roughness: 0.7 }, leather: '#2b231c', heraldry: '#171310', bronze: '#4a4239', matteIron: true },
};

export function warriorAppearance(fighter = 'hero') {
  if (!Object.hasOwn(palettes, fighter)) throw new Error(`Unknown appearance: ${fighter}`);
  const appearance = { ...base, ...palettes[fighter] };
  return { ...appearance, steel: { ...appearance.steel } };
}
