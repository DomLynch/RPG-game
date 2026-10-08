// Origins mob rows (docs/specs/origins/mobs.md section 7): ONE content row per kind of creature, and the validator that rejects a bad one before
// it ships. A row holds only what is not already elsewhere: the source, the role (a MobStyle id, Combat's origins/mobs/styles.ts), a behaviour row,
// the camp size, the level band and the loot id. The LOOK is Characters' MobLook (origins/preview/mob-looks.ts), looked up by the row's character
// id through `ctx.look`: a row never carries a look, so there is one look table. The name, body and encounter forms come from the character record.
// Pure: no DOM, no clock, no storage. Not built yet (they need data this branch does not have): tint-contrast, loot-tier, habitat (spec 7.5).
// To extend: add the field to MobRow or Behaviour, one range line in RANGES, and one case in validateMobRow; nothing else reads a row by position.
import { styleOpponent, type MobStyle } from './styles.ts';

export type Source = { kind: 'myth' | 'folklore' | 'history' | 'literature' | 'chronicle'; work: string; author?: string; year?: number; authorDied?: number; locator?: string; scripture?: boolean };
// A complete citation, or a legends-500.csv row, or `pending`: the shipped hand-authored kinds wait for Content/Strategy to cite them. The generator
// refuses a pending row (it would put an uncited creature in a generated zone); the hand data may carry one.
export type SourceRef = Source | { legendId: string } | { pending: string };
export type Behaviour = {
  aggro?: number;                // m: the notice ring (default 7)
  leash?: number;                // m: how far it chases before it goes home (default 26)
  roam?: number;                 // m: how far it wanders from home (never above leash / 3)
  spread?: number;               // m: how far the camp's members scatter round their landmark
  pull?: number;                 // m: the camp's centre is pulled this far toward the zone's middle first (a gate landmark sits on the edge)
  campSize?: readonly [number, number];   // members in one camp, min..max (equal = a fixed group)
};
export type Rarity = 'common' | 'uncommon' | 'rare';
export type MobRow = {
  id: string;                    // a character id: the key into the look table and the character record
  source: SourceRef;
  role: MobStyle | string;       // a MobStyle id; anything else is `bad-role`
  behaviour: Behaviour;
  loot: string;                  // a loot-table id
  level: readonly [number, number];
  weight?: number;               // share in a zone's mix (default 10)
  named?: boolean;               // named creatures stay on their encounter and are never generated
  bossCamp?: boolean;            // this kind's camp is a Region's boss camp: up to BOSS_CAMP_MAX members (ordinary camps are CAMP_MAX: a leader and three)
  rarity?: Rarity;               // how often the kind is drawn on its own (RARITY_WEIGHT); a `rare` is never drawn: it stands in a placeholder's camp
  replaces?: string;             // a rare row: the id of the (common or uncommon) placeholder row whose camp it may take over
  chance?: number;               // a rare row: the chance (RARE_CHANCE range) a camp of its placeholder is the rare's instead, seeded; default RARE_DEFAULT
  ladder?: string;               // a body family's tier ladder (rows sharing it are rungs of one body: a goblin ladder, a witch ladder); set with `rung`
  rung?: number;                 // 1-based tier on the ladder: a higher rung is a harder creature (level band never below the rung under it)
  respawnSeconds?: number;       // seconds until a killed member of this kind stands again (Dom's animal rule: 60-90 s); the server writer reads it per row
  later?: boolean;               // reserved for a later batch: needs no look, source or registered loot table yet, never generated
};

export type RowCode = 'no-source' | 'bad-role' | 'family-no-look' | 'level-band' | 'level-miss' | 'loot-unknown' | 'roam-leash' | 'camp-size' | 'behaviour-range' | 'respawn-range' | 'dup-id' | 'named-generated' | 'rung-ladder' | 'rung-order' | 'dup-rung' | 'ladder-body' | 'rarity-field' | 'rare-placeholder';
export type RowIssue = { code: RowCode; path: string; message: string };
export type RowContext = {
  look: (id: string) => { opponent: string } | null;   // the look table: mobLook
  lootTables: ReadonlySet<string>;
  zone?: { levelMin: number; levelMax: number };       // when a zone is supplied, the band must meet it
  generated?: boolean;                                  // the generator's eligibility check: no pending source, no named row
};

export const DEFAULTS = { aggro: 7, leash: 26, roam: 6, campSize: [2, 3] as const, weight: 10 };
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 0.3, rare: 0 };   // x the row's own weight in a zone's draw
export const RARE_CHANCE: readonly [number, number] = [0.01, 0.25];
export const RARE_DEFAULT = 0.05;
export const RESPAWN_RANGE: readonly [number, number] = [30, 300];   // s: wide enough for the animal rule (60-90) and a slow boss-ish kind; outside is a typo
export const CAMP_MAX = 4;        // Strategy 2026-10-07: an ordinary camp is a leader and three followers
export const BOSS_CAMP_MAX = 6;   // ... and only a row flagged `bossCamp` may go to six
// Each number a behaviour field may take (spec sections 2 and 3, widened to the shipped data): [min, max].
export const RANGES: Record<string, readonly [number, number]> = { aggro: [2, 20], leash: [5, 80], roam: [0, 30], spread: [0, 40], pull: [0, 30] };

const KINDS = ['myth', 'folklore', 'history', 'literature', 'chronicle'];
// What a machine can check of a citation (legends-rule); a human reviews every new row. A literature source must be published by 1928 or its
// author dead since 1955; a scripture flag rejects. It does not judge whose folk hero a figure is.
function sourceIssue(s: SourceRef): string | null {
  if ('pending' in s) return null;
  if ('legendId' in s) return /^[A-Za-z0-9:_-]{2,}$/.test(s.legendId) ? null : 'legendId is not an id';
  if (!KINDS.includes(s.kind)) return `kind "${String(s.kind)}" is not one of ${KINDS.join(', ')}`;
  if (typeof s.work !== 'string' || !s.work.trim()) return 'a citation names its work';
  if (s.scripture) return 'scripture is out (legends-rule)';
  if (s.kind === 'literature' && !((s.year !== undefined && s.year <= 1928) || (s.authorDied !== undefined && s.authorDied <= 1955))) return 'a literature source must be published by 1928 or its author dead since 1955';
  return null;
}

export function validateMobRow(row: MobRow, ctx: RowContext, path = ''): RowIssue[] {
  const out: RowIssue[] = [], at = (k: string) => (path ? `${path}.${k}` : k), add = (code: RowCode, k: string, message: string) => out.push({ code, path: at(k), message });
  if (!row.later) {
    const bad = row.source ? sourceIssue(row.source) : 'no source given';
    if (bad) add('no-source', 'source', `source citation required: ${bad}`);
    else if (ctx.generated && 'pending' in row.source) add('no-source', 'source', 'source citation required: a pending source cannot be generated');
    if (!ctx.look(row.id)) add('family-no-look', 'id', `${row.id} has no look (origins/preview/mob-looks.ts)`);
  }
  if (styleOpponent(row.role) === undefined) add('bad-role', 'role', `role "${row.role}" is not a MobStyle`);
  const [lo, hi] = row.level;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || lo > hi) add('level-band', 'level', 'the level band is whole numbers, 1 or more, low to high');
  else if (ctx.zone && (hi < ctx.zone.levelMin || lo > ctx.zone.levelMax)) add('level-miss', 'level', `band ${lo}..${hi} does not meet the zone's ${ctx.zone.levelMin}..${ctx.zone.levelMax}`);
  if (!row.later && !ctx.lootTables.has(row.loot)) add('loot-unknown', 'loot', `${row.loot} is not a registered loot table`);
  const b = row.behaviour;
  for (const [k, [min, max]] of Object.entries(RANGES)) {
    const v = (b as Record<string, number | undefined>)[k];
    if (v !== undefined && !(Number.isFinite(v) && v >= min && v <= max)) add('behaviour-range', `behaviour.${k}`, `${k} ${v} is outside ${min}..${max}`);
  }
  if ((b.roam ?? DEFAULTS.roam) > (b.leash ?? DEFAULTS.leash) / 3) add('roam-leash', 'behaviour.roam', 'roam is above a third of the leash');
  const [cmin, cmax] = b.campSize ?? DEFAULTS.campSize;
  if (!Number.isInteger(cmin) || !Number.isInteger(cmax) || cmin < 1 || cmax > (row.bossCamp ? BOSS_CAMP_MAX : CAMP_MAX) || cmin > cmax) add('camp-size', 'behaviour.campSize', `a camp is 1..${row.bossCamp ? BOSS_CAMP_MAX : CAMP_MAX} members${row.bossCamp ? '' : ' (6 only on a boss camp)'}, min not above max`);
  if ((row.ladder === undefined) !== (row.rung === undefined) || (row.rung !== undefined && (!Number.isInteger(row.rung) || row.rung < 1))) add('rung-ladder', 'rung', 'ladder and rung come together: a ladder id and a whole rung, 1 or more');
  const rarity = row.rarity ?? 'common';
  if (!(rarity in RARITY_WEIGHT)) add('rarity-field', 'rarity', `rarity "${String(row.rarity)}" is not one of ${Object.keys(RARITY_WEIGHT).join(', ')}`);
  else if ((rarity === 'rare') !== (row.replaces !== undefined) || (row.chance !== undefined && (rarity !== 'rare' || !(row.chance >= RARE_CHANCE[0] && row.chance <= RARE_CHANCE[1])))) add('rarity-field', 'replaces', `a rare names the row it replaces (and only a rare does), with a chance in ${RARE_CHANCE[0]}..${RARE_CHANCE[1]}`);
  if (row.respawnSeconds !== undefined && !(row.respawnSeconds >= RESPAWN_RANGE[0] && row.respawnSeconds <= RESPAWN_RANGE[1])) add('respawn-range', 'respawnSeconds', `respawn is ${RESPAWN_RANGE[0]}..${RESPAWN_RANGE[1]} s`);
  if (ctx.generated && row.named) add('named-generated', 'named', 'named creatures stay on their encounter and are not generated');
  return out;
}

// Weights for one zone's draw: a ladder row's weight is scaled by how much of its band the zone's level window covers, so the zone's home rung is the one
// whose band sits in it (a rung wholly outside is 0). A row with no ladder keeps its own weight, so a zone with no ladders draws exactly as before.
export function rungWeights(rows: readonly MobRow[], window: { levelMin: number; levelMax: number }): number[] {
  return rows.map((r) => {
    const w = (r.weight ?? DEFAULTS.weight) * (RARITY_WEIGHT[r.rarity ?? 'common'] ?? 1);
    if (r.ladder === undefined) return w;
    const [lo, hi] = r.level, over = Math.min(hi, window.levelMax) - Math.max(lo, window.levelMin) + 1;
    return over > 0 ? (w * over) / (hi - lo + 1) : 0;
  });
}

export function validateRows(rows: readonly MobRow[], ctx: RowContext): RowIssue[] {
  const seen = new Set<string>(), out: RowIssue[] = [];
  rows.forEach((r, i) => {
    if (seen.has(r.id)) out.push({ code: 'dup-id', path: `[${i}].id`, message: `${r.id} appears twice` });
    seen.add(r.id); out.push(...validateMobRow(r, ctx, `[${i}]`));
  });
  // A rare stands in a placeholder's camp: that row exists, is not itself a rare, and is not the rare.
  rows.forEach((r, i) => { if (r.replaces === undefined) return; const ph = rows.find((x) => x.id === r.replaces);
    if (!ph || ph === r || ph.rarity === 'rare') out.push({ code: 'rare-placeholder', path: `[${i}].replaces`, message: `${r.id} replaces ${r.replaces}, which is not a common or uncommon row in this set` }); });
  // Ladders: one body, each rung once, bands climbing with the rung.
  const ladders = new Map<string, { r: MobRow; i: number }[]>();
  rows.forEach((r, i) => { if (r.ladder !== undefined && r.rung !== undefined) ladders.set(r.ladder, [...(ladders.get(r.ladder) ?? []), { r, i }]); });
  for (const members of ladders.values()) {
    const body = ctx.look(members[0]!.r.id)?.opponent, byRung = [...members].sort((a, b) => a.r.rung! - b.r.rung!);
    byRung.forEach(({ r, i }, k) => {
      const prev = byRung[k - 1]?.r;
      if (ctx.look(r.id) && ctx.look(r.id)!.opponent !== body) out.push({ code: 'ladder-body', path: `[${i}].ladder`, message: `${r.id} is not on the ${body} body of its ladder ${r.ladder}` });
      if (prev && prev.rung === r.rung) out.push({ code: 'dup-rung', path: `[${i}].rung`, message: `rung ${r.rung} of ${r.ladder} appears twice` });
      else if (prev && (r.level[0] < prev.level[0] || r.level[1] < prev.level[1])) out.push({ code: 'rung-order', path: `[${i}].rung`, message: `rung ${r.rung} of ${r.ladder} is below rung ${prev.rung} in level` });
    });
  }
  return out;
}
