// Dom's legend rulings pinned (Lead's sweep, #1750; Characters, 2026-10-07):
// (a) NO FRANCHISE LOOKS: Thor, Loki, Heracles, Hippolyta, Pazuzu, Imhotep, Paimon, Sun Wukong, Cthulhu, Ragnar, Lagertha and Henry Morgan
//     carry no franchise branding in any part, prop or kit name (docs/research/legends-risk-audit.md).
//     REVIEWER CHECKLIST: a PR that adds a legend body, loot part or prop for one of those names shows its stills; block any red cape,
//     winged or horned helm, square hammer or green-and-gold look, and add the new marker to FRANCHISE_MARKERS below.
// (b) REMOVED / RENAMED legends stay out of the roster and the legends data: West Witches (now The Moorland Coven), Count Orlok, Hua Mulan.
// The legends-500 spec CSV is a frozen stage document (it still lists hua-mulan) and is not scanned; the live ladder is legends-600-ladder.csv.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEGEND_OPPONENTS, LEGENDS } from '../src/legends.ts';
import { SKILLS } from '../src/loot.ts';
import { ROSTER } from '../src/roster.ts';

const FRANCHISE_LEGENDS = ['thor', 'loki', 'heracles', 'hippolyta', 'pazuzu', 'imhotep', 'paimon', 'sun-wukong', 'cthulhu', 'ragnar-lothbrok', 'lagertha', 'henry-morgan'];
const FRANCHISE_MARKERS = ['mjolnir', 'winged helm', 'winged helmet', 'horned helm', 'golden helm', 'red cape', 'green and gold', 'green-and-gold', 'square hammer', 'marvel', 'disney', 'avenger'];
const REMOVED = ['west witches', 'the west witches', 'wicked witch', 'count orlok', 'orlok', 'hua mulan', 'hua-mulan'];

const csv = (text: string): Record<string, string>[] => {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head!.length).map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i]!])));
};
const audit = readFileSync(new URL('../docs/research/legends-risk-audit.md', import.meta.url), 'utf8').toLowerCase();
const ladder = csv(readFileSync(new URL('../docs/research/legends-600-ladder.csv', import.meta.url), 'utf8'));

test('no franchise looks: the twelve flagged legends exist in the ladder and are named without a franchise marker and are on the risk audit', () => {
  assert.ok(ladder.length > 500, 'the ladder CSV parses');
  for (const id of FRANCHISE_LEGENDS) {
    const row = ladder.find((r) => r.id === id);
    assert.ok(audit.includes(row?.name?.toLowerCase() ?? id), `${id} is listed in docs/research/legends-risk-audit.md`);
    assert.ok(row, `${id} is a ladder row (rename the list here if Dom renamed him)`);
    for (const marker of FRANCHISE_MARKERS) assert.ok(!row.name!.toLowerCase().includes(marker), `${id}: "${marker}" is a franchise marker (docs/research/legends-risk-audit.md)`);
  }
});

test('no franchise looks: loot part, skill and prop names carry no franchise marker', () => {
  const names = [...Object.values(SKILLS).map((s) => s.name), ...Object.keys(ROSTER)];
  const glbNames = (path: string): string[] => {
    const b = readFileSync(new URL(path, import.meta.url)), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    return [...(json.nodes ?? []), ...(json.materials ?? []), ...(json.meshes ?? [])].map((n: { name?: string }) => n.name ?? '');
  };
  names.push(...glbNames('../src/assets/loot.glb'));
  for (const name of names) for (const marker of FRANCHISE_MARKERS) assert.ok(!name.toLowerCase().includes(marker), `"${name}" contains the franchise marker "${marker}"`);
});

test('removed or renamed legends (West Witches, Count Orlok, Hua Mulan) are absent from the roster, src/legends.ts and the live ladder', () => {
  const haystacks: [string, string[]][] = [
    ['ROSTER ids', Object.keys(ROSTER)],
    ['src/legends.ts names', LEGEND_OPPONENTS.flatMap((id) => LEGENDS[id].map((l) => l.name))],
    ['ladder ids and names', ladder.flatMap((r) => [r.id!, r.name!])],
  ];
  for (const [where, list] of haystacks) for (const item of list) assert.ok(!REMOVED.includes(item.toLowerCase()), `${where} lists the removed legend "${item}"`);
  assert.ok(ladder.some((r) => r.id === 'the-moorland-coven'), 'the West Witches live on as The Moorland Coven');
});
