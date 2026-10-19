import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
const kill = process.env.KILL ?? '';
const d = DEFS as unknown as { rules: { id: string; value: number }[]; [k: string]: unknown };
if (kill.startsWith('ALLBUT:')) {
  const keep = kill.slice(7), keepRule = keep.startsWith('rule:') ? keep.slice(5) : '', keepTable = keep.startsWith('table:') ? keep.slice(6) : '';
  for (const r of d.rules) if (r.id !== keepRule) r.value = 0;
  for (const [k, t] of Object.entries(d)) if (k !== 'rules' && Array.isArray(t) && k !== keepTable) t.length = 0;
} else if (kill === 'ALL') { for (const r of d.rules) r.value = 0; for (const [k, t] of Object.entries(d)) if (k !== 'rules' && Array.isArray(t)) t.length = 0; }
else if (kill.startsWith('rules:')) { for (const id of kill.slice(6).split(',')) { const r = d.rules.find((x) => x.id === id); if (r) r.value = 0; } }
else if (kill.startsWith('rule:')) { const r = d.rules.find((x) => x.id === kill.slice(5)); if (r) r.value = 0; }
else if (kill.startsWith('table:')) { const t = d[kill.slice(6)]; if (Array.isArray(t)) t.length = 0; }
const { setSandbox, underSandbox } = await import('../src/fight/sandbox-era.ts');
const { setStab } = await import('../src/fight/stab-rule.ts');
const { classSpecialBatteryHash } = await import('./lib/class-special-battery.ts');
setStab(true);
setSandbox(true);
const on = classSpecialBatteryHash();
const off = underSandbox(0, () => classSpecialBatteryHash());
console.log('BISECT', kill || 'none', on === off ? 'EQUAL' : 'differs');
