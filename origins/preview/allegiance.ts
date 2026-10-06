// Origins greybox: the graduation picker (living-world §10: on reaching Gladiator and entering the Exchange, choose Independent, a company
// or a patron's clan). The rules are origins/patrons; this file is the panel only, built from the ui.ts kit. It opens only on the SAVED
// career at Gladiator or above (a preview or offline career never opens it), and the choice is kept in the preview's own save (save.ts
// ALLEGIANCE_KEY), never in the live game's storage. Perks are shown, never applied: the preview's Pit duel is the live arena fight.
import { gateAccess } from '../contracts/world.ts';
import { allegianceName, bookLine, chooseAtGraduation, PATRONS, PERK_TEMPLATES, templateOf, templateText, type Allegiance, type AllegianceState, type PatronId } from '../patrons/patrons.ts';
import { ui } from './ui.ts';

// Gladiator or above on the career the writer returned. `saved` is false for the in-memory preview career (offline, reset, checking).
export const pickerOpen = (saved: boolean, level: number): boolean => saved && gateAccess('outer', { source: 'server', careerLevel: level }, false).ok;

const GROUPS = [...new Set([...PATRONS.values()].map((p) => p.group))];
const COMPANY_NAME = 'The Free Company';
let view = 'top', msg = '';

export const picker = {
  reset() { view = 'top'; msg = ''; },
  // A tap: returns the new state when a choice was made (the page saves it), else null.
  act(d: DOMStringMap, state: AllegianceState, level: number, nowS: number): AllegianceState | null {
    if (d.view) { view = d.view; msg = ''; return null; }
    if (!d.choose) return null;
    const to: Allegiance = d.choose === 'independent' ? { kind: 'independent' }
      : d.choose.startsWith('company:') ? { kind: 'company', name: COMPANY_NAME, template: d.choose.slice('company:'.length) }
      : { kind: 'patron-clan', patron: d.choose as PatronId };
    const r = chooseAtGraduation(state, to, { standing: { source: 'server', careerLevel: level }, at: Math.floor(nowS) });
    if (!r.ok) { msg = r.issues[0]!.message; return null; }
    view = 'top'; msg = ''; return r.value.state;
  },
  render(state: AllegianceState, player: string): string {
    if (state.allegiance) {
      const t = templateOf(state.allegiance);
      return ui.panel('Allegiance', ui.heading(allegianceName(state.allegiance)), ui.text(t ? `${t.id}: ${templateText(t)}` : 'No perk: you stand alone.'),
        ui.text('In the Pit: small, visible perks that never add damage. Damage perks only in Origins. Leaving a clan: joining another within 28 days costs 2,000 bronze (not in the preview).', true), ui.heading('The Exchange book'), ...state.log.map((e) => ui.text(bookLine(e, player), true)));
    }
    if (view === 'top') {
      return ui.panel('Choose your allegiance', ui.text('You passed the outer gate. Stand Independent, found a company, or swear to a patron\'s clan. Your first choice is free.'),
        ui.button('Stand Independent', { choose: 'independent' }), ui.button('Found a company', { view: 'company' }),
        ui.heading('Swear to a patron'), ...GROUPS.map((g) => ui.row(g, `${[...PATRONS.values()].filter((p) => p.group === g).length}`, { view: `group:${g}` })), ui.text(msg, true));
    }
    if (view === 'company') {
      return ui.panel(COMPANY_NAME, ui.text('A company picks one perk template. Every template is a +3% gain with a matching −3% cost.', true),
        ...[...PERK_TEMPLATES.values()].map((t) => ui.row(t.id, templateText(t), { choose: `company:${t.id}` })), ui.button('Back', { view: 'top' }), ui.text(msg, true));
    }
    if (view.startsWith('group:')) {
      const g = view.slice('group:'.length);
      return ui.panel(g, ...[...PATRONS.values()].filter((p) => p.group === g).map((p) => ui.row(p.name, p.template, { view: p.patron })), ui.button('Back', { view: 'top' }));
    }
    const p = PATRONS.get(view as PatronId);
    if (!p) { view = 'top'; return picker.render(state, player); }
    return ui.panel(`The clan of ${p.name}`, ui.text(p.clanTheme), ui.text(`${p.source} · ${p.era}`, true), ui.heading(p.template), ui.text(templateText(p.perk)),
      ui.button(`Swear to ${p.name}`, { choose: p.patron }), ui.button('Back', { view: `group:${p.group}` }), ui.text(msg, true));
  },
};
