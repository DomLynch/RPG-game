// A JSON-aware 3-way merge for scripts/as-data/allow/*.json, so two PRs that each add or retire an entry no longer conflict on adjacent lines.
//   node scripts/as-data/merge-allow.mjs <base> <ours> <theirs> [<path>]    writes the result over <ours>, exit 0; exit 1 on a true clash (nothing is written)
// Setup, once per clone (git merge drivers are local config; .gitattributes names the driver):
//   git config merge.as-data-allow.driver 'node scripts/as-data/merge-allow.mjs %O %A %B %P'
// Rules, per list entry (identity = file + literal for `allow`, file + name for `verbs` and `tunables`):
//   kept by both sides -> kept (one side changed it -> that change; both changed it the same way -> kept; both changed it differently -> CLASH)
//   retired by either side -> dropped (the other side's edit of a retired entry is reported, not kept: a debt paid in code has no row left to edit)
//   added by one side -> kept; added by both -> kept if identical, else CLASH
// Order is ours', with the other side's additions placed after the entry that precedes them there; the file is written in the repo's own one-line-per-entry format.
import { readFileSync, writeFileSync } from 'node:fs';

const IDENT = { allow: ['file', 'literal'], verbs: ['file', 'name'], tunables: ['file', 'name'] };
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const same = (a, b) => canon(a) === canon(b);
const idOf = (section, e) => (IDENT[section] ?? ['file', 'name']).map((k) => e[k]).join(' | ');
const line = (e) => `{${Object.entries(e).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`;

export function serialize(doc) {
  const parts = Object.entries(doc).map(([key, val]) => (Array.isArray(val) ? `  ${JSON.stringify(key)}: [\n${val.map((e) => `    ${line(e)}`).join(',\n')}\n  ]` : `  ${JSON.stringify(key)}: ${JSON.stringify(val)}`));
  return `{\n${parts.join(',\n')}\n}\n`;
}

// Three-way merge of one list. Returns { list, clashes, notes }.
function mergeList(section, base, ours, theirs) {
  const index = (list) => new Map(list.map((e) => [idOf(section, e), e]));
  const B = index(base), O = index(ours), T = index(theirs), clashes = [], notes = [], keep = new Map();
  for (const id of new Set([...B.keys(), ...O.keys(), ...T.keys()])) {
    const b = B.get(id), o = O.get(id), t = T.get(id);
    if (!o && !t) continue;                                   // retired by both
    if (b && (!o || !t)) {                                    // retired by one side
      const other = o ?? t;
      if (!same(other, b)) notes.push(`${section} ${id}: retired on one side, edited on the other; dropped`);
      continue;
    }
    if (!b) {                                                 // added
      if (o && t && !same(o, t)) { clashes.push({ section, id, base: null, ours: o, theirs: t }); continue; }
      keep.set(id, o ?? t); continue;
    }
    if (same(o, t)) keep.set(id, o);
    else if (same(o, b)) keep.set(id, t);
    else if (same(t, b)) keep.set(id, o);
    else clashes.push({ section, id, base: b, ours: o, theirs: t });
  }
  // Order: ours', then each of theirs' additions right after the nearest earlier entry of theirs that survives.
  const out = [], placed = new Set();
  for (const e of ours) { const id = idOf(section, e); if (keep.has(id) && !placed.has(id)) { out.push(id); placed.add(id); } }
  const after = new Map();
  let prev = null;
  for (const e of theirs) {
    const id = idOf(section, e);
    if (keep.has(id) && !placed.has(id)) { const k = prev ?? ''; if (!after.has(k)) after.set(k, []); after.get(k).push(id); }
    if (keep.has(id)) prev = id;
  }
  const ordered = [];
  const emit = (key) => { for (const id of after.get(key) ?? []) { ordered.push(id); placed.add(id); emit(id); } };
  emit('');
  for (const id of out) { ordered.push(id); emit(id); }
  for (const id of keep.keys()) if (!ordered.includes(id)) ordered.push(id);   // unreachable anchors: keep, at the end
  return { list: ordered.map((id) => keep.get(id)), clashes, notes };
}

export function mergeAllow(baseText, oursText, theirsText) {
  const [b, o, t] = [baseText, oursText, theirsText].map((s) => JSON.parse(s));
  const out = {}, clashes = [], notes = [];
  const keys = [...new Set([...Object.keys(o), ...Object.keys(t), ...Object.keys(b)])];
  for (const key of keys) {
    const [bv, ov, tv] = [b[key], o[key], t[key]];
    if ([bv, ov, tv].some(Array.isArray)) {
      const r = mergeList(key, bv ?? [], ov ?? [], tv ?? []);
      clashes.push(...r.clashes); notes.push(...r.notes);
      if (r.list.length || ov !== undefined || tv !== undefined) out[key] = r.list;
    } else if (same(ov, tv)) { if (ov !== undefined) out[key] = ov; }
    else if (same(ov, bv)) { if (tv !== undefined) out[key] = tv; }
    else if (same(tv, bv)) { if (ov !== undefined) out[key] = ov; }
    else clashes.push({ section: key, id: key, base: bv, ours: ov, theirs: tv });
  }
  // Key order: ours', then keys only theirs has.
  const order = [...Object.keys(o), ...Object.keys(t)].filter((k, i, a) => a.indexOf(k) === i && k in out);
  return { text: serialize(Object.fromEntries(order.map((k) => [k, out[k]]))), clashes, notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, ours, theirs, path = ours] = process.argv.slice(2);
  if (!base || !ours || !theirs) { console.error('usage: merge-allow.mjs <base> <ours> <theirs> [<path>]'); process.exit(2); }
  const { text, clashes, notes } = mergeAllow(readFileSync(base, 'utf8'), readFileSync(ours, 'utf8'), readFileSync(theirs, 'utf8'));
  for (const n of notes.slice(0, 5)) console.error(`merge-allow ${path}: ${n}`);
  if (notes.length > 5) console.error(`merge-allow ${path}: ... and ${notes.length - 5} more retired-vs-edited entries dropped`);
  if (clashes.length) {
    for (const c of clashes) console.error(`merge-allow ${path}: CLASH on ${c.section} ${c.id}\n  base:   ${c.base ? line(c.base) : '(absent)'}\n  ours:   ${c.ours ? line(c.ours) : '(retired)'}\n  theirs: ${c.theirs ? line(c.theirs) : '(retired)'}`);
    console.error(`merge-allow ${path}: ${clashes.length} true clash(es); nothing written, resolve by hand`);
    process.exit(1);
  }
  writeFileSync(ours, text);
}
