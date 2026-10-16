// Combat Sandbox (Dom's lane): the live game with a row-override panel. The engine is never edited or copied: this entry patches the row
// JSON objects in memory BEFORE src/main.ts (and so every row loader) evaluates, then boots the normal game. Overrides layer: the committed
// sandbox/rows.json, then this browser's unsaved edits (localStorage). Change a row -> reload -> the fight runs on the new numbers.
import SHEET from '../src/fight/sheet-defs.json' with { type: 'json' };
import STANCE from '../src/fight/stance-defs.json' with { type: 'json' };
import GEAR from '../src/fight/gear-defs.json' with { type: 'json' };
import KINDS from '../src/fight/damage-kind-defs.json' with { type: 'json' };
import CC from '../src/fight/cc-defs.json' with { type: 'json' };
import SWARM from '../src/fight/swarm-defs.json' with { type: 'json' };
import BOSSES from '../src/fight/bosses.json' with { type: 'json' };
import HIT_STOP from '../src/fight/hit-stop-defs.json' with { type: 'json' };
import STOP_RULES from '../src/hit-stop-rules.json' with { type: 'json' };
import CROWD from '../src/audio/crowd-defs.json' with { type: 'json' };
import RULES from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import PHASES from '../src/fight/boss-phase-defs.json' with { type: 'json' };
import PLAY_RADIUS from '../src/fight/play-radius-defs.json' with { type: 'json' };
import SAVED from './rows.json' with { type: 'json' };
import SPELL_LOOKS from './spell-looks.json' with { type: 'json' };

declare const __SANDBOX_INFO__: string;
// The spell picks survive a link or a reload that does not name them (a ?me= link used to drop them): remembered per browser, the URL wins, an empty Apply clears.
const LOADOUT_KEY = 'frankendom.sandbox.loadout', SPELL_KEYS = ['spell', 'spell2', 'cast', 'cast2', 'foespell', 'foecast'];
{
  const u = new URL(location.href); let saved: Record<string, string> = {}; let changed = false;
  try { saved = JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '{}') ?? {}; } catch { /* none */ }
  for (const k of SPELL_KEYS) { const v = u.searchParams.get(k); if (v) saved[k] = v; else if (saved[k]) { u.searchParams.set(k, saved[k]!); changed = true; } }
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(saved)); } catch { /* none */ }
  if (changed) history.replaceState(null, '', u.href);
}
type Rows = Record<string, unknown[]>;
type Overrides = { notes?: string[]; files?: Record<string, Rows> };
// Panel order = the brief's order. bosses.json is a bare array; it is edited as one family named "bosses".
const FILES: Record<string, Record<string, unknown>> = {
  'sheet-defs': SHEET, 'stance-defs': STANCE, 'hit-stop-defs': HIT_STOP, 'hit-stop-rules': STOP_RULES, 'crowd-defs': CROWD, 'sandbox-rules-defs': RULES, 'boss-phase-defs': PHASES, 'play-radius-defs': PLAY_RADIUS, 'gear-defs': GEAR, 'damage-kind-defs': KINDS, 'cc-defs': CC, 'swarm-defs': SWARM,
  bosses: { bosses: BOSSES } as Record<string, unknown>,
};
const KEY = 'frankendom.sandbox.rows';
// The 700 spell looks (sandbox/spell-looks.json, authored by spell-looks-gen.mjs) join the rules' `spellLook` family before the panel snapshots LIVE, so they show and edit like any family.
(RULES as unknown as { spellLook: unknown[] }).spellLook.splice(0, 0, ...(SPELL_LOOKS as { spellLook: unknown[] }).spellLook);
const LIVE: Record<string, Rows> = JSON.parse(JSON.stringify(FILES));
const read = (): Overrides => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? (SAVED as Overrides); } catch { return SAVED as Overrides; } };
const write = (o: Overrides | null) => { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch { /* private window: edits last this page only */ } };

const current = read();
// A family is an array of rows, or a keyed object {id: row} (hit-stop-defs `contacts`), edited as rows carrying their id.
const asRows = (v: unknown): unknown[] | undefined => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.entries(v).map(([id, r]) => ({ id, ...(r as object) })) : undefined;
for (const [file, fams] of Object.entries(current.files ?? {})) for (const [fam, rows] of Object.entries(fams)) {
  const target = FILES[file]?.[fam];
  if (Array.isArray(target)) target.splice(0, target.length, ...rows);
  else if (target && typeof target === 'object') {
    const keyed = target as Record<string, unknown>;
    for (const k of Object.keys(keyed)) delete keyed[k];
    for (const r of rows as { id: string }[]) { const { id, ...row } = r; keyed[id] = row; }
  }
}

const lines = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n');
const WEAPON_IDS = ['longsword', 'trident', 'cleaver', 'estoc', 'knife', 'gladius', 'scythe', 'maul', 'reaper', 'warhammer', 'bite'];
const ARMOUR_CLASSES = ['', 'unarmoured', 'light', 'medium', 'heavy'];   // index = the armourYou / armourFoe row value (0 = auto)
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e;
};

function panel(opponents: string[]) {
  const css = document.createElement('style');
  css.textContent = `#sbx-tab{position:fixed;top:8px;right:8px;z-index:99999;font:600 13px system-ui;padding:6px 10px;border-radius:6px;border:0;background:#c9a227;color:#111}
#sbx{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);z-index:99998;background:#14110ef2;color:#eee;font:12px system-ui;overflow:auto;padding:44px 12px 24px;box-sizing:border-box;display:none}
#sbx.open{display:block}#sbx h3{margin:14px 0 4px;font-size:13px;color:#c9a227}#sbx textarea{width:100%;box-sizing:border-box;min-height:90px;font:11px ui-monospace,monospace;background:#000;color:#ddd;border:1px solid #444;white-space:pre;overflow-x:auto}
#sbx textarea.dirty{border-color:#c9a227}#sbx button,#sbx select,#sbx input{font:12px system-ui;margin:2px 4px 2px 0;padding:5px 8px}#sbx .err{color:#f66}#sbx details summary{cursor:pointer;color:#c9a227;font-weight:600;margin-top:10px}`;
  document.head.append(css);
  const box = el('div', { id: 'sbx' });
  const tab = el('button', { id: 'sbx-tab', textContent: 'Sandbox' });
  tab.onclick = () => box.classList.toggle('open');

  const params = new URLSearchParams(location.search);
  const opp = el('select');
  for (const id of opponents) opp.append(el('option', { value: id, textContent: id, selected: params.get('opponent') === id }));
  if (!params.get('opponent')) opp.prepend(el('option', { value: '', textContent: '(game default)', selected: true }));
  const staged = new Map<string, string>();   // loadout picks wait here; ONE Apply button reloads once
  const stage = (param: string, value: string) => { staged.set(param, value); applyLoadout.textContent = 'Apply loadout + reload (changes waiting)'; };
  opp.onchange = () => stage('opponent', opp.value);

  const pick = (label: string, param: string, values: string[]) => {
    const sel = el('select'); sel.append(el('option', { value: '', textContent: '(auto)' }));
    for (const v of values) sel.append(el('option', { value: v, textContent: v, selected: params.get(param) === v }));
    sel.onchange = () => stage(param, sel.value);
    return el('div', { style: 'margin:4px 0' }, el('span', { textContent: label + ' ' }), sel);
  };
  // Weapon lists: the real weapons plus Staff / Bow / Crossbow (stand-ins: an existing weapon fires instead of striking, see the missile rows).
  const MISSILES: Record<string, string> = { staff: 'trident', bow: 'knife', crossbow: 'warhammer' };
  const weaponPick = (label: string, mine: boolean) => {
    const sel = el('select'), mineNow = mine ? (() => { try { return JSON.parse(sessionStorage.getItem('frankendom.dev-kit') ?? '{}').weapon as string | undefined; } catch { return undefined; } })() : params.get('foeWeapon');
    const asKind = Object.keys(MISSILES).find((k) => params.get(k) === mineNow && mineNow);
    sel.append(el('option', { value: '', textContent: '(auto)' }));
    for (const v of [...WEAPON_IDS, ...Object.keys(MISSILES).map((k) => k.toUpperCase())]) { const id = v.toLowerCase(), isKind = id in MISSILES; sel.append(el('option', { value: id, textContent: isKind ? `${v[0]}${v.slice(1).toLowerCase()} (ranged)` : v, selected: isKind ? asKind === id : !asKind && mineNow === id })); }
    sel.onchange = () => { const v = sel.value, w = MISSILES[v] ?? v; stage(mine ? '#myWeapon' : 'foeWeapon', w); if (MISSILES[v]) stage(v, w); };
    return el('div', { style: 'margin:4px 0' }, el('span', { textContent: label + ' ' }), sel);
  };
  const spellSel = el('select'), cast = el('input', { type: 'number', min: '0', max: '100', placeholder: 'cast skill', value: params.get('cast') ?? '', style: 'width:84px' } as Partial<HTMLInputElement>);
  spellSel.append(el('option', { value: '', textContent: '(none: class special)' }));
  // Every spell is MELEE (close range, paid in stamina) or MAGIC (medium / long range, paid in mana): the kind comes from the spell root's `spellRange` row. The three spell pickers group by kind, then school.
  const KIND_NAME: Record<string, string> = { melee: 'Melee (close, stamina)', magic: 'Magic (medium / long, mana)' };
  const spellBook = Promise.all([import('../src/fight/spell-catalogue.ts'), import('../src/fight/spell-cast.ts'), import('../src/fight/sandbox-rules.ts')]).then(([{ SPELL_INFO }, { spellRoot }, { spellRangeOf }]) => Object.entries(SPELL_INFO).map(([id, i]) => {
    const root = spellRoot(id), kind = (root && spellRangeOf(root)?.kind) || '';
    return { id, group: `${KIND_NAME[kind] ?? 'No kind row'} - ${i.school}`, label: `${i.spell || id} - L${i.level} (${i.legend})` };
  }));
  const fillSpells = (sel: HTMLSelectElement, param: string) => spellBook.then((book) => {
    const groups = new Map<string, { id: string; label: string }[]>();
    for (const s of book) { const l = groups.get(s.group) ?? []; l.push(s); groups.set(s.group, l); }
    for (const [name, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) { const g = el('optgroup', { label: name }); for (const s of list.sort((a, b) => a.label.localeCompare(b.label))) g.append(el('option', { value: s.id, textContent: s.label, selected: params.get(param) === s.id })); sel.append(g); }
  });
  void fillSpells(spellSel, 'spell').then(() => fill2());
  // The OPPONENT's spell (?foespell= ?foecast=): same book, same grouping.
  const foeSel = el('select'), foeCast = el('input', { type: 'number', min: '0', max: '100', placeholder: 'cast skill', value: params.get('foecast') ?? '', style: 'width:84px' } as Partial<HTMLInputElement>);
  foeSel.append(el('option', { value: '', textContent: '(none: class special)' }));
  void fillSpells(foeSel, 'foespell');
  foeSel.onchange = () => stage('foespell', foeSel.value); foeCast.onchange = () => stage('foecast', foeCast.value);
  const spell2Sel = el('select'), cast2 = el('input', { type: 'number', min: '0', max: '100', placeholder: 'cast skill', value: params.get('cast2') ?? '', style: 'width:84px' } as Partial<HTMLInputElement>);
  spell2Sel.append(el('option', { value: '', textContent: '(none)' }));
  const fill2 = () => { for (const g of spellSel.querySelectorAll('optgroup')) { const c = g.cloneNode(true) as HTMLOptGroupElement; for (const o of c.querySelectorAll('option')) (o as HTMLOptionElement).selected = params.get('spell2') === (o as HTMLOptionElement).value; spell2Sel.append(c); } };
  spell2Sel.onchange = () => stage('spell2', spell2Sel.value); cast2.onchange = () => stage('cast2', cast2.value);
  spellSel.onchange = () => stage('spell', spellSel.value); cast.onchange = () => stage('cast', cast.value);
  const applyLoadout = el('button', { textContent: 'Apply loadout + reload', style: 'background:#c9a227;color:#111;font-weight:600' });
  applyLoadout.onclick = () => {
    const u = new URL(location.href);
    for (const [k, v] of staged) {
      if (SPELL_KEYS.includes(k)) { try { const sv = JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '{}') ?? {}; if (v) sv[k] = v; else delete sv[k]; localStorage.setItem(LOADOUT_KEY, JSON.stringify(sv)); } catch { /* none */ } }
      if (k === '#myWeapon') { try { const kit = JSON.parse(sessionStorage.getItem('frankendom.dev-kit') ?? '{}') ?? {}; if (v) kit.weapon = v; else delete kit.weapon; sessionStorage.setItem('frankendom.dev-kit', JSON.stringify(kit)); } catch { /* none */ } }
      else if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
    }
    location.assign(u.href);
  };
  const loadout = el('div', { style: 'margin:8px 0;padding:8px;border:1px solid #444' },
    el('div', { textContent: 'Loadout (pick everything, then Apply once)', style: 'color:#c9a227;font-weight:600' }),
    el('div', { style: 'margin:4px 0' }, el('span', { textContent: 'Your spell (SPELL 1) ' }), spellSel, cast),
    el('div', { style: 'margin:4px 0' }, el('span', { textContent: 'Your spell 2 (SPELL 2) ' }), spell2Sel, cast2),
    el('div', { style: 'margin:4px 0' }, el('span', { textContent: 'Opponent spell ' }), foeSel, foeCast),
    weaponPick('Your weapon', true), weaponPick('Opponent weapon', false), pick('Opponent armour', 'foeArmour', ARMOUR_CLASSES.slice(1)), pick('Your armour', 'myArmour', ARMOUR_CLASSES.slice(1)), applyLoadout,
    el('div', { textContent: 'Armour picks the class the blow-type table reads (cut / stab / crush). Your weapon, move, the opponent and level 1-50, and the opponent\'s class special: Field journal, Sparring tab. Your spell runs in normal fights (career / practice), not Sparring.', style: 'color:#999;font-size:11px;margin-top:4px' }));
  const note = el('input', { placeholder: 'note: what you changed and why', style: 'width:100%;box-sizing:border-box' } as Partial<HTMLInputElement>);
  const status = el('div');
  const areas: { file: string; fam: string; ta: HTMLTextAreaElement }[] = [];
  const sections: HTMLElement[] = [];
  for (const [file, fams] of Object.entries(FILES)) {
    const d = el('details', { open: file === 'sheet-defs' }, el('summary', { textContent: `${file}.json` }));
    for (const fam of Object.keys(fams)) {
      const rows = asRows(fams[fam]); if (!rows) continue;
      const ta = el('textarea', { value: lines(rows), spellcheck: false });
      ta.rows = Math.min(14, rows.length + 1);
      const changed = JSON.stringify(rows) !== JSON.stringify(asRows(LIVE[file]![fam]));
      ta.oninput = () => ta.classList.add('dirty');
      d.append(el('h3', { textContent: `${fam}${changed ? '  (changed from live)' : ''}` }), ta);
      areas.push({ file, fam, ta });
    }
    sections.push(d);
  }

  const collect = (): Overrides | string => {
    const files: Record<string, Rows> = {};
    for (const { file, fam, ta } of areas) {
      let rows: unknown[];
      try { rows = ta.value.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)); } catch (e) { return `${file} / ${fam}: ${(e as Error).message}`; }
      if (JSON.stringify(rows) !== JSON.stringify(asRows(LIVE[file]![fam]))) (files[file] ??= {})[fam] = rows;
    }
    const notes = [...(current.notes ?? [])]; if (note.value.trim()) notes.push(`${new Date().toISOString().slice(0, 16)} ${note.value.trim()}`);
    return { notes, files };
  };
  const apply = el('button', { textContent: 'Apply + reload fight' });
  apply.onclick = () => { const o = collect(); if (typeof o === 'string') { status.className = 'err'; status.textContent = o; return; } write(o); location.reload(); };
  const reset = el('button', { textContent: 'Reset to live' });
  reset.onclick = () => { if (confirm('Drop every sandbox change and go back to the live rows?')) { write({ notes: [], files: {} }); location.reload(); } };
  const back = el('button', { textContent: 'Back to sandbox rows' });   // drops this browser's edits (and a Reset): the committed sandbox/rows.json again
  back.onclick = () => { write(null); location.reload(); };
  const save = el('button', { textContent: 'Save rows.json' });
  save.onclick = () => {
    const o = collect(); if (typeof o === 'string') { status.className = 'err'; status.textContent = o; return; }
    write(o);
    const body = JSON.stringify(o, null, 1).replace(/\{\s+"/g, '{"').replace(/,\s+"/g, ',"').replace(/\s+\}/g, '}');   // one row per line: diffable
    const a = el('a', { href: URL.createObjectURL(new Blob([body + '\n'], { type: 'application/json' })), download: 'rows.json' }); a.click();
    status.className = ''; status.textContent = 'Saved: send rows.json to the sandbox lane to commit.';
  };
  const changedCount = Object.values(current.files ?? {}).reduce((n, f) => n + Object.keys(f).length, 0);
  box.append(el('div', { textContent: `Opponent (boss row from the catalogue):` }), opp, loadout,
    el('div', { textContent: `${changedCount} row famil${changedCount === 1 ? 'y' : 'ies'} changed from live. One row per line; edit, then Apply.`, style: 'margin-top:8px' }),
    note, apply, reset, back, save, status, ...sections,
    el('div', { textContent: __SANDBOX_INFO__, style: 'margin-top:16px;color:#888;font-size:11px' }));
  document.body.append(tab, box);
}

// ?bands=0 switches the reach-band rule off for an A/B (the row stays in the panel).
if (new URLSearchParams(location.search).get('bands') === '0') for (const r of RULES.rules as { id: string; value?: number }[]) if (r.id === 'bandOff') r.value = 0;

// Loadout (the sandbox panel's menu): ?foeWeapon= swaps every warden's weapon (the sim, the AI and the rig's grafted equip follow the fighter's weapon), ?foeArmour= / ?myArmour= force the armour class the blow-type table reads.
{
  const q = new URLSearchParams(location.search), { OPPONENTS } = await import('../src/fight/moves.ts');
  const fw = q.get('foeWeapon'); if (fw && WEAPON_IDS.includes(fw)) for (const o of Object.values(OPPONENTS)) (o as { weapon: string }).weapon = fw;
  // ?staff=<weapon> makes that existing weapon fire bolts instead of striking (the missile rows, kind staff; a stand-in until the weapons lane bakes a staff): the sim, the AI and the sandbox bands follow the weapon id.
  {
    const rows = RULES as unknown as { missile?: { kind?: string; weapon: string }[]; bandBest?: { weapon: string; band: string }[] };
    // ?me=staff|bow|crossbow: one tappable link for the whole setup (the stand-in weapon you carry, set as the Dev kit weapon and as that kind's missile weapon).
    const STAND: Record<string, string> = { staff: 'trident', bow: 'knife', crossbow: 'warhammer' }, me = q.get('me');
    if (me && STAND[me]) { try { sessionStorage.setItem('frankendom.dev-kit', JSON.stringify({ ...JSON.parse(sessionStorage.getItem('frankendom.dev-kit') ?? '{}'), weapon: STAND[me] })); } catch { /* none */ } q.set(me, STAND[me]!); }
    for (const kind of ['staff', 'bow', 'crossbow']) {
      const w = q.get(kind);
      if (w && WEAPON_IDS.includes(w)) { for (const r of rows.missile ?? []) if (r.kind === kind) r.weapon = w; (rows.bandBest ??= []).push({ weapon: w, band: 'outer' }); }
    }
    // The ranged models (Characters & Art, sandbox/ranged-weapons.mjs): the stand-in weapon YOU carry is drawn as the staff / bow / crossbow, placed like SwordDrawn (rotation x +90 deg, offset 0, .08, .015) under the right hand so it follows the stand-in's swing clips.
    // Painted bow / crossbow (Characters & Art 3febe084b, from Dom's picks bow-concept-s71 / crossbow-concept-top-s71): loaded once before the fight; a failed load keeps the procedural v1.2 model.
    const painted: Record<string, { clone(r?: boolean): unknown } | undefined> = {};
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js'), { default: bowUrl } = await import('./painted/bow-v1.glb?url'), { default: xbowUrl } = await import('./painted/crossbow-v1.glb?url');
      for (const [kind, url] of [['bow', bowUrl], ['crossbow', xbowUrl]] as const) { try { painted[kind] = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url)).scene.getObjectByName('WeaponDrawn') ?? undefined; } catch (e) { (globalThis as { __SANDBOX_PAINTED_ERR__?: string[] }).__SANDBOX_PAINTED_ERR__ = [...((globalThis as { __SANDBOX_PAINTED_ERR__?: string[] }).__SANDBOX_PAINTED_ERR__ ?? []), `${kind}: ${String(e)}`]; /* keep the procedural one */ } }
    } catch (e) { (globalThis as { __SANDBOX_PAINTED_ERR__?: string[] }).__SANDBOX_PAINTED_ERR__ = [`import: ${String(e)}`]; /* keep the procedural ones */ }
    { const { RANGED_BUILDS } = await import('./ranged-weapons.mjs'), id = { staff: 'staff-v1', bow: 'bow-v1', crossbow: 'crossbow-v1' } as const;
      (globalThis as { __SANDBOX_RANGED__?: unknown }).__SANDBOX_RANGED__ = (weapon: string) => {
        const kind = (['staff', 'bow', 'crossbow'] as const).find((k) => q.get(k) === weapon); if (!kind) return undefined;
        // Holds from Characters & Art (scripts/weapon-stage/holds.json, 2026-10-15): ABSOLUTE local transforms under the hand bone (the part names its hand), Euler XYZ degrees, metres; they replace SwordDrawn's.
        const HOLD: Record<string, [number, number, number]> = { staff: [90, 0, 0], bow: [-1.9, 34.6, 114.3], crossbow: [92.8, 60.3, 96.2] };
        const paintedPart = painted[kind]?.clone(true) as { userData: Record<string, unknown>; rotation: { set(x: number, y: number, z: number): void }; position: { set(x: number, y: number, z: number): void } } | undefined;
        if (paintedPart) {
          paintedPart.userData.hand = kind === 'bow' ? 'hand_l' : 'hand_r';
          // TRELLIS exports metalness 1 / roughness 1: with no environment map the scene draws that black. Matte it (the painted colour map carries the look).
          (paintedPart as unknown as { traverse(f: (o: { isMesh?: boolean; material?: { clone(): { metalness: number; roughness: number }; metalness: number; roughness: number } }) => void): void }).traverse((o) => { if (o.isMesh && o.material) { const m = o.material.clone(); m.metalness = 0.08; m.roughness = 0.85; (o as { material: unknown }).material = m; } });
        }
        const part = paintedPart ?? (RANGED_BUILDS as Record<string, () => { rotation: { set(x: number, y: number, z: number): void }; position: { set(x: number, y: number, z: number): void } }>)[id[kind]]!(), d = Math.PI / 180, h = HOLD[kind]!;
        (part as unknown as { userData: Record<string, unknown> }).userData.sandboxRanged = true;   // characters.ts reshape leaves this node alone
        const tune = (q.get('hold') ?? '').split(',').map(Number);   // ?hold=rx,ry,rz[,px,py,pz]: degrees and metres ADDED to the hold, for nudging on the live page
        part.rotation.set((h[0] + (tune[0] || 0)) * d, (h[1] + (tune[1] || 0)) * d, (h[2] + (tune[2] || 0)) * d); part.position.set(tune[3] || 0, tune[4] || 0, tune[5] || 0);
        if (kind === 'staff') part.position.set(tune[3] || 0, .08 + (tune[4] || 0), .015 + (tune[5] || 0));   // Dom: the staff points OUT from the fist like the maul and trident (SwordDrawn's hold), not upright
        return part;
      }; }
    if (q.get('quiver') === '0') for (const r of RULES.rules as { id: string; value?: number }[]) if (r.id === 'quiver') r.value = 0;   // ?quiver=0: an unlimited quiver for the A/B
  }
  // Specials and spells are off below fight level 16 on trunk (match.ts CLASS_B_FROM), so at level 1 the SKILL and SPELL buttons did nothing. The sandbox switches them on from level 1 (?specialsFrom=N to change, 99 = trunk behaviour).
  (globalThis as { __SANDBOX_SPECIALS_FROM__?: number }).__SANDBOX_SPECIALS_FROM__ = Number(q.get('specialsFrom') ?? 1);
  // Trunk has a 20 s wait before the first special and 20 s between casts (rules special.first / special.cooldown, in ticks at 60/s): too slow to test. The sandbox uses 2 s and 6 s (?spellFirst= ?spellCooldown= in ticks).
  { const { RULES: R } = await import('../src/fight/moves.ts'); R.special.first = Number(q.get('spellFirst') ?? 120); R.special.cooldown = Number(q.get('spellCooldown') ?? 360); }
  // ?spell=<legend id> equips a catalogue spell for YOUR fights (the grimoire's own store: owned + equipped), ?cast=<0-100> sets the cast skill of its school (the school's sheet skill base).
  (globalThis as { __SANDBOX_OWNED__?: string[] }).__SANDBOX_OWNED__ = [q.get('spell'), q.get('spell2')].filter((x): x is string => !!x);   // see src/core/spell-equip.ts setOwnedSpells
  const spell = q.get('spell');
  if (spell) {
    const { isSpellId, BRICKS } = await import('../src/fight/spell-cast.ts'), { setOwnedSpells, useSpellStore } = await import('../src/core/spell-equip.ts'), { default: INDEX } = await import('../src/fight/spell-index.json', { with: { type: 'json' } });
    if (isSpellId(spell)) {
      try { useSpellStore(localStorage); } catch { /* none */ }   // the fight is created at boot, before main.ts hands the store over: give it now or the pick reads as none
      setOwnedSpells([spell]);
      try { localStorage.setItem('frankendom.spell.equipped.v1', spell); } catch { /* storage refused: the pick lasts until reload only */ }
      const school = BRICKS[(INDEX as unknown as { spells: Record<string, readonly [string, number]> }).spells[spell]![0]]?.school, row = (SHEET.skills as { id: string; base: number; cap: number }[]).find((s) => s.id === school), cast = Number(q.get('cast') ?? 100);
      if (row && Number.isFinite(cast)) row.base = Math.max(0, Math.min(row.cap, Math.floor(cast)));
    }
  } else { try { localStorage.removeItem('frankendom.spell.equipped.v1'); } catch { /* none */ } }
  // ?foespell=<legend id>&foecast=<0-100>: the OPPONENT's spell (it casts it under the same range rows as you), read at fight start through src/fight/spell-slot2.ts foeSpellPick.
  const foeSpell = q.get('foespell');
  if (foeSpell) {
    const { isSpellId } = await import('../src/fight/spell-cast.ts'); const skill = Number(q.get('foecast') ?? 100);
    if (isSpellId(foeSpell)) (globalThis as { __SANDBOX_FOE_SPELL__?: { id: string; skill: number } }).__SANDBOX_FOE_SPELL__ = { id: foeSpell, skill: Number.isFinite(skill) ? Math.max(0, Math.min(100, Math.floor(skill))) : 0 };
  }
  // ?spell2=<legend id>&cast2=<0-100>: the SECOND spell (SPELL 2), read at fight start through src/fight/spell-slot2.ts.
  const spell2 = q.get('spell2');
  if (spell2) {
    const { isSpellId } = await import('../src/fight/spell-cast.ts'); const skill = Number(q.get('cast2') ?? 100);
    if (isSpellId(spell2)) (globalThis as { __SANDBOX_SPELL2__?: { id: string; skill: number } }).__SANDBOX_SPELL2__ = { id: spell2, skill: Number.isFinite(skill) ? Math.max(0, Math.min(100, Math.floor(skill))) : 0 };
  }
  for (const [param, id] of [['myArmour', 'armourYou'], ['foeArmour', 'armourFoe']] as const) {
    const v = ARMOUR_CLASSES.indexOf(q.get(param) ?? ''); const row = (RULES.rules as { id: string; value?: number }[]).find((r) => r.id === id);
    if (row && v > 0) row.value = v;
  }
}
// The sandbox is an admin test bench: the journal's test tools and the Sparring tab (opponent, level 1-50, weapon, move, both sides' specials) are on, the way a local ?debug build has them.
(globalThis as { __SANDBOX__?: boolean }).__SANDBOX__ = true;
if (!/[?&]debug\b/.test(location.search)) { const u = new URL(location.href); u.searchParams.set('debug', '1'); history.replaceState(null, '', u.href); }

await import('../src/main.ts');
// Mana bar (sandbox-mech mana): under the stamina bar, same size, blue, only while the manaMax row is on. src/fight/hud.ts fills it from the player's fighter.
if ((RULES.rules as { id: string; value?: number }[]).some((r) => r.id === 'manaMax' && r.value)) {
  const st = document.getElementById('stamina');
  if (st && !document.getElementById('mana')) {
    const css = document.createElement('style');
    // Dom's pick (option B, 2026-10-15): on the phone HUD health runs full width, and stamina and mana share the row below at 50% each (rows shift down one pair; the style.css phone grid is otherwise untouched).
    css.textContent = '#mana{--bar-color:#3f78d4}#mana::-webkit-meter-optimum-value{background:#3f78d4}#mana::-moz-meter-bar{background:#3f78d4}' +
      '@media (max-width:900px),(pointer:coarse){.combat-hud>span:nth-of-type(2){grid-column:1/-1;grid-row:4}#player-health{grid-column:1/-1;grid-row:5}#posture{grid-column:1/-1;grid-row:6}' +
      '.combat-hud>span:nth-of-type(3){grid-column:1;grid-row:7}.combat-hud>span:nth-of-type(4){grid-column:2;grid-row:7;margin:5px 0 0!important;letter-spacing:1px;line-height:12px}#stamina{grid-column:1;grid-row:8}' +
      '#mana{grid-column:2;grid-row:8}#mana::-webkit-meter-bar{background:transparent;border:0;height:4px}#mana::-webkit-meter-optimum-value{background:transparent}#mana::-moz-meter-bar{background:transparent}' +
      '#fight-rank{grid-row:9}#combat-status{grid-row:10}#loot-panel{grid-row:11}#mana-value{display:none}}';
    document.head.append(css);
    const label = el('span', {}, el('span', { className: 'meter-label', id: 'mana-label', textContent: 'MANA' }), ' ', el('span', { id: 'mana-value', textContent: '100 / 100' }));
    const bar = el('meter', { id: 'mana', min: 0, max: 100, value: 100 } as Partial<HTMLMeterElement>); bar.setAttribute('aria-label', 'Your mana');
    label.firstElementChild?.setAttribute('data-mobile', 'Mana');   // the phone HUD draws the caption from data-mobile
    st.insertAdjacentElement('afterend', bar); st.insertAdjacentElement('afterend', label);
    const fillMana = () => { bar.style.setProperty('--fill', `${Math.round((bar.value / (bar.max || 100)) * 100)}%`); requestAnimationFrame(fillMana); };   // the phone bar paints from --fill like the health and stamina bars
    requestAnimationFrame(fillMana);
  }
}
if ((RULES.rules as { id: string; value?: number }[]).some((r) => r.id === 'quiver' && r.value) && !document.getElementById('ammo-value')) {   // the quiver counter, under the mana bar
  const anchor = document.getElementById('mana') ?? document.getElementById('stamina');
  if (anchor) anchor.insertAdjacentElement('afterend', el('span', {}, el('span', { className: 'meter-label', textContent: 'QUIVER' }), ' ', el('span', { id: 'ammo-value', textContent: 'unlimited' })));
}
// The admin tools stay on (Sparring tab, test tools) but the black combat-debug overlay starts OFF (Dom: not needed); the journal's Options > Combat debug turns it on, or ?overlay=1.
if (new URLSearchParams(location.search).get('overlay') !== '1') document.getElementById('debug-mode')?.click();
// The stance picker, restyled (Dom's pick of the icon stack: Neutral first, down the right edge, muted): the game's own #stance-panel buttons keep their handlers and aria-pressed; only the look changes.
const GLYPH: Record<string, string> = { neutral: '\u25CB', aggressive: '\u2694', defensive: '\u26E8', trickster: '\u263D' };
const restyleStances = (tries = 0): void => {
  const panel = document.getElementById('stance-panel'), buttons = panel ? [...panel.querySelectorAll('button')] : [];
  if ((RULES.rules as { id: string; value?: number }[]).some((r) => r.id === 'hideStancePicker' && r.value)) { if (panel) panel.style.display = 'none'; else if (tries < 40) setTimeout(() => restyleStances(tries + 1), 250); return; }
  if (!panel || buttons.length < 4) { if (tries < 40) setTimeout(() => restyleStances(tries + 1), 250); return; }
  const css = document.createElement('style');
  css.textContent = '#stance-panel{top:64px!important;right:8px!important;padding:4px!important;gap:0!important;max-width:none!important;background:rgba(14,11,9,.62)!important;border:1px solid rgba(200,190,170,.18)!important}#stance-panel>*:not(.sbx-row){display:none!important}.sbx-row{display:flex!important;flex-direction:column!important;gap:4px!important}.sbx-row button{width:38px!important;height:38px!important;padding:0!important;font:20px/1 system-ui!important;color:#bdb4a2!important;background:rgba(26,22,18,.85)!important;border:1px solid rgba(200,190,170,.22)!important;border-radius:6px!important}.sbx-row button[aria-pressed=true]{color:#e0c068!important;border-color:#b79a4a!important;background:rgba(60,48,22,.85)!important}';
  document.head.append(css);
  const row = buttons[0]!.parentElement!; row.classList.add('sbx-row');
  for (const b of buttons) { const id = (b as HTMLElement).dataset.stance ?? ''; b.setAttribute('aria-label', b.textContent!.trim()); b.title = b.textContent!.trim(); b.textContent = GLYPH[id] ?? b.textContent; }
};

// Touch layout A (Dom's approved picture, 2026-10-13): a tight diamond around one big STRIKE button. STRIKE sits at the thumb's rest point with its swipe zones drawn on it (stab on top, a slash each side: the oneButton rows);
// Spell 1 upper-left, Spell 2 upper-right, Guard lower-left, Roll lower-right, Kick far left. Positions are the picture's centre offsets from STRIKE, scaled to the phone (STRIKE 96 px). The game's own buttons keep their
// handlers and ids; only their place and size change. Spell 2 is a placeholder (the game has one spell slot). Only while the oneButton row is on.
const layoutA = (): void => {
  if (!(RULES.rules as { id: string; value?: number }[]).some((r) => r.id === 'oneButton' && r.value)) return;
  const CX = 104, CY = 128;   // STRIKE's centre, px from the right and bottom edge
  // Three variants of the one design (`?lay=1|2|3`; Dom picked 2 as the default, 2026-10-13): STRIKE's size and its zone ring grow apart from 1 to 3. Every outer button touches the zone ring with a 3 px gap (tangent, on the diagonals), the
  // kick sits against the guard's outer side.
  const lay = new URLSearchParams(location.search).get('lay');
  const V = ({ '1': { S: 80, R: 138, d: 47 }, '3': { S: 64, R: 154, d: 52 } } as Record<string, { S: number; R: number; d: number }>)[lay ?? ''] ?? { S: 72, R: 146, d: 50 };
  const GAP = 3, near = (deg: number, d: number): [number, number] => { const r = V.R / 2 + d / 2 + GAP, a = (deg * Math.PI) / 180; return [Math.round(r * Math.cos(a)), Math.round(-r * Math.sin(a))]; };   // centre offset (down is +) of a button of diameter d touching the ring at this angle
  const sp1 = near(135, V.d), sp2 = near(45, V.d), gd = near(225, V.d), rl = near(315, V.d), KD = 42, kk = near(180, KD);   // the kick is a touch smaller than the rest (Dom)
  const spots: [string, number, number, number][] = [['attack-button', 0, 0, V.S], ['skill-button', sp1[0], sp1[1], V.d], ['sbx-spell2', sp2[0], sp2[1], V.d], ['guard-button', gd[0], gd[1], V.d], ['dodge-button', rl[0], rl[1], V.d], ['kick-button', kk[0], kk[1], KD]];   // id, dx, dy (down is +), diameter
  const ids = spots.map(([id]) => `.actions #${id}`);
  const place = spots.map(([id, dx, dy, d]) => `.actions #${id}{right:${CX - dx - d / 2}px!important;bottom:${CY - dy - d / 2}px!important;width:${d}px!important;height:${d}px!important}`);
  const label: Record<string, string> = { 'attack-button': 'STRIKE', 'skill-button': 'SPELL 1', 'sbx-spell2': 'SPELL 2', 'guard-button': 'GUARD', 'dodge-button': 'ROLL', 'kick-button': 'KICK' };
  const css = document.createElement('style');
  css.textContent = [
    '.actions #heavy-button,.actions #thrust-button,.actions #run-button,.actions #attack-button svg{display:none!important}',
    `${ids.join(',')}{position:fixed!important;left:auto!important;top:auto!important;margin:0!important;border-radius:50%!important;padding:0!important;display:flex!important;align-items:center;justify-content:center;font-size:0!important;line-height:1!important;min-width:0!important;z-index:5}`,
    ...place,
    `${ids.map((i) => i + '::after').join(',')}{display:block!important;position:static!important;font-size:10px!important;font-weight:600;letter-spacing:.03em;color:inherit;text-align:center;white-space:nowrap}`,
    ...Object.entries(label).map(([id, t]) => `.actions #${id}::after{content:"${t}"!important}`),
    '.actions #attack-button::after{font-size:13px!important;letter-spacing:.05em}',
    
    '.actions #sbx-spell2{opacity:1}.actions #sbx-spell2[aria-disabled=true]{opacity:.5}',   // lit when it would cast, dim like SPELL 1 on cooldown / no mana (hud.ts sets aria-disabled each frame)
    '#joystick{bottom:max(56px,env(safe-area-inset-bottom))!important}',
    `#sbx-zones{position:fixed;z-index:4;pointer-events:none;right:${CX - V.R / 2}px;bottom:${CY - V.R / 2}px;width:${V.R}px;height:${V.R}px;border-radius:50%;border:1px dashed rgba(190,120,80,.7);background:conic-gradient(from -50deg,rgba(150,70,40,.34) 0 100deg,rgba(150,70,40,.16) 100deg 360deg)}`,
    '#sbx-zones i{position:absolute;font:600 10px sans-serif;color:rgba(255,235,215,.85);font-style:normal;letter-spacing:.04em}',
  ].join('\n');
  document.head.append(css);
  const two = document.createElement('button'); two.id = 'sbx-spell2'; two.type = 'button'; if ((globalThis as { __SANDBOX_SPELL2__?: unknown }).__SANDBOX_SPELL2__) { two.dataset.live = ''; two.title = 'Second spell'; } else { two.title = 'Second spell slot: pick a spell in the Sandbox menu'; two.setAttribute('aria-disabled', 'true'); } document.getElementById('actions')?.append(two);   // a placeholder: the game has one spell slot
  const zones = document.createElement('div'); zones.id = 'sbx-zones';
  zones.innerHTML = '<i style="left:50%;top:5px;transform:translateX(-50%)">stab</i><i style="left:6px;top:50%;transform:translateY(-50%)">sl</i><i style="right:6px;top:50%;transform:translateY(-50%)">sh</i>';
  document.body.append(zones);
};
layoutA();
restyleStances();
const { ROSTER } = await import('../src/roster.ts');
panel(Object.keys(ROSTER));
