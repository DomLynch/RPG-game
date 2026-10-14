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
import CROWD from '../src/audio/crowd-defs.json' with { type: 'json' };
import RULES from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import PHASES from '../src/fight/boss-phase-defs.json' with { type: 'json' };
import SAVED from './rows.json' with { type: 'json' };

declare const __SANDBOX_INFO__: string;
type Rows = Record<string, unknown[]>;
type Overrides = { notes?: string[]; files?: Record<string, Rows> };
// Panel order = the brief's order. bosses.json is a bare array; it is edited as one family named "bosses".
const FILES: Record<string, Record<string, unknown>> = {
  'sheet-defs': SHEET, 'stance-defs': STANCE, 'hit-stop-defs': HIT_STOP, 'crowd-defs': CROWD, 'sandbox-rules-defs': RULES, 'boss-phase-defs': PHASES, 'gear-defs': GEAR, 'damage-kind-defs': KINDS, 'cc-defs': CC, 'swarm-defs': SWARM,
  bosses: { bosses: BOSSES } as Record<string, unknown>,
};
const KEY = 'frankendom.sandbox.rows';
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
  opp.onchange = () => { const u = new URL(location.href); if (opp.value) u.searchParams.set('opponent', opp.value); else u.searchParams.delete('opponent'); location.assign(u.href); };

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
  box.append(el('div', { textContent: `Opponent (boss row from the catalogue):` }), opp,
    el('div', { textContent: `${changedCount} row famil${changedCount === 1 ? 'y' : 'ies'} changed from live. One row per line; edit, then Apply.`, style: 'margin-top:8px' }),
    note, apply, reset, back, save, status, ...sections,
    el('div', { textContent: __SANDBOX_INFO__, style: 'margin-top:16px;color:#888;font-size:11px' }));
  document.body.append(tab, box);
}

// ?bands=0 switches the reach-band rule off for an A/B (the row stays in the panel).
if (new URLSearchParams(location.search).get('bands') === '0') for (const r of RULES.rules as { id: string; value?: number }[]) if (r.id === 'bandOff') r.value = 0;

await import('../src/main.ts');
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
    
    '.actions #sbx-spell2{opacity:.45}',
    '#joystick{bottom:max(56px,env(safe-area-inset-bottom))!important}',
    `#sbx-zones{position:fixed;z-index:4;pointer-events:none;right:${CX - V.R / 2}px;bottom:${CY - V.R / 2}px;width:${V.R}px;height:${V.R}px;border-radius:50%;border:1px dashed rgba(190,120,80,.7);background:conic-gradient(from -50deg,rgba(150,70,40,.34) 0 100deg,rgba(150,70,40,.16) 100deg 360deg)}`,
    '#sbx-zones i{position:absolute;font:600 10px sans-serif;color:rgba(255,235,215,.85);font-style:normal;letter-spacing:.04em}',
  ].join('\n');
  document.head.append(css);
  const two = document.createElement('button'); two.id = 'sbx-spell2'; two.type = 'button'; two.title = 'Second spell slot: not wired yet'; two.setAttribute('aria-disabled', 'true'); document.getElementById('actions')?.append(two);   // a placeholder: the game has one spell slot
  const zones = document.createElement('div'); zones.id = 'sbx-zones';
  zones.innerHTML = '<i style="left:50%;top:5px;transform:translateX(-50%)">stab</i><i style="left:6px;top:50%;transform:translateY(-50%)">sl</i><i style="right:6px;top:50%;transform:translateY(-50%)">sh</i>';
  document.body.append(zones);
};
layoutA();
restyleStances();
const { ROSTER } = await import('../src/roster.ts');
panel(Object.keys(ROSTER));
