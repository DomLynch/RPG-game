// A JSON-aware 3-way merge for scripts/as-data/allow/*.json, so two PRs that each add or retire an entry no longer conflict on adjacent lines.
//   node scripts/as-data/merge-allow.mjs <base> <ours> <theirs> [<path>]    writes the result over <ours>, exit 0; exit 1 on a true clash (nothing is written)
// Setup, once per clone (git merge drivers are local config; .gitattributes names the driver):
//   git config merge.as-data-allow.driver 'node scripts/as-data/merge-allow.mjs %O %A %B %P'
// Rules, per list entry (identity = file + literal for `allow`, file + name for `verbs` and `tunables`):
//   kept by both sides -> kept (one side changed it -> that change; both changed it the same way -> kept; both changed it differently -> CLASH)
//   retired by either side -> dropped (the other side's edit of it is reported, not kept: a debt paid in code has no row left to edit) -- unless the retiring side added the same
//     name under another file (a move or rename): then the edit would be lost with the old entry, so it is a CLASH
//   added by one side -> kept; added by both -> kept if identical, else CLASH
// Order is ours', with the other side's additions placed after the entry that precedes them there; the file is written in the repo's own one-line-per-entry format.
// Imports only `node:` builtins: the cut copies this file to a temp directory outside the repo (driverArgs in scripts/cut-release.mjs), and tests/merge-allow.test.ts enforces it.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = { allow: 'literal' };   // the field that names an entry apart from its file (default: name)
const IDENT = { allow: ['file', 'literal'], verbs: ['file', 'name'], tunables: ['file', 'name'] };
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const same = (a, b) => canon(a) === canon(b);
const idOf = (section, e) => (IDENT[section] ?? ['file', 'name']).map((k) => e[k]).join(' | ');
const line = (e) => `{${Object.entries(e).filter(([, v]) => v !== undefined).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`;

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
      const other = o ?? t, retiring = o ? theirs : ours;
      if (!same(other, b)) {
        // A file move or rename reads as retire + add: the other side's edit (verdict, owner, sunset) would be lost with the old entry, so that is a clash, not a paid debt.
        const moved = retiring.find((e) => e[NAME[section] ?? 'name'] === b[NAME[section] ?? 'name'] && e.file !== b.file && !B.has(idOf(section, e)));
        if (moved) clashes.push({ section, id, base: b, ours: o, theirs: t, why: `${o ? 'theirs' : 'ours'} retired it and added ${NAME[section] ?? 'name'} ${JSON.stringify(b[NAME[section] ?? 'name'])} under ${moved.file} (a move), while the other side edited it` });
        else notes.push(`${section} ${id}: retired on one side, edited on the other; dropped`);
      }
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
  const list = ordered.map((id) => keep.get(id));
  // The lists are kept sorted by identity (the loader sorts too): when both sides are, so is the result, whatever the order the PRs merged in.
  const fields = IDENT[section] ?? ['file', 'name'], cmp = (a, b) => { for (const k of fields) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1; return 0; };
  const sorted = (l) => l.every((e, i) => i === 0 || cmp(l[i - 1], e) <= 0);
  if (sorted(ours) && sorted(theirs)) list.sort(cmp);
  return { list, clashes, notes };
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

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return basename(process.argv[1] ?? '') === 'merge-allow.mjs'; } })();   // never a silent no-op as a command; not a URL string compare: a path with a space or non-ASCII is percent-encoded in import.meta.url
if (isMain) {
  const [base, ours, theirs, path = ours] = process.argv.slice(2);
  if (!base || !ours || !theirs) { console.error('usage: merge-allow.mjs <base> <ours> <theirs> [<path>]'); process.exit(2); }
  const { text, clashes, notes } = mergeAllow(readFileSync(base, 'utf8'), readFileSync(ours, 'utf8'), readFileSync(theirs, 'utf8'));
  for (const n of notes.slice(0, 5)) console.error(`merge-allow ${path}: ${n}`);
  if (notes.length > 5) console.error(`merge-allow ${path}: ... and ${notes.length - 5} more retired-vs-edited entries dropped`);
  if (clashes.length) {
    for (const c of clashes) console.error(`merge-allow ${path}: CLASH on ${c.section} ${c.id}${c.why ? ` (${c.why})` : ''}\n  base:   ${c.base ? line(c.base) : '(absent)'}\n  ours:   ${c.ours ? line(c.ours) : '(retired)'}\n  theirs: ${c.theirs ? line(c.theirs) : '(retired)'}`);
    console.error(`merge-allow ${path}: ${clashes.length} true clash(es); nothing written, resolve by hand`);
    process.exit(1);
  }
  writeFileSync(ours, text);
}
