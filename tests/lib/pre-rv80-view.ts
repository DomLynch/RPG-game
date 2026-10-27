// Imported FIRST (after ./era-off.ts) by a legacy test file that checks the OLD controls or the hit-stop MECHANISM through the real main.ts (tests/graphics.test.ts): RV80 (Dom 2026-10-19: "turn it on, migrate fully from
// the sandboxes") made the one-button strike the default and set every hit-stop row to 0, so a test of the Light / Thrust / Heavy buttons or of a held contact frame would see neither. This restores the pre-RV80 VIEW rows in the
// loaded JSON objects (shared per test process, evaluated before any module reads them): input.one-button 0, the hit-stop table and the contact tiers as they were. View rows only: the simulation never reads them.
import INPUT from '../../src/fight/input-rows.json' with { type: 'json' };
import STOP_RULES from '../../src/hit-stop-rules.json' with { type: 'json' };
import HIT_STOP from '../../src/fight/hit-stop-defs.json' with { type: 'json' };

const input = INPUT as { inputRows: { id: string; fields: { value: number } }[] };
input.inputRows.find((r) => r.id === 'input.one-button')!.fields.value = 0;
const OLD_STOP: Record<string, number> = { SpecialLanded: 50, Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 150, Killed: 220 }, OLD_HEAVY: Record<string, number> = { Hit: 90, Blocked: 50 };
for (const r of STOP_RULES.stop) r.ms = OLD_STOP[r.id]!;
for (const r of STOP_RULES.heavy) r.ms = OLD_HEAVY[r.id]!;
const contacts = HIT_STOP.contacts as Record<string, { frames: number; knock: number; push: number; sparks?: number }>;
const OLD_CONTACTS: Record<string, [number, number, number]> = { hitLight: [3, 0.02, 0], hitHeavy: [5, 0.04, 0], blockLight: [2, 0.02, 0], blockHeavy: [2, 0.02, 0], parry: [11, 0, 0.07], guardBreak: [5, 0.04, 0], special: [8, 0.05, 0], postureBreak: [0, 0, 0], kill: [0, 0, 0], kick: [2, 0, 0] };
for (const [id, [frames, knock, push]] of Object.entries(OLD_CONTACTS)) { const c = contacts[id]!; c.frames = frames; c.knock = knock; c.push = push; delete c.sparks; }
