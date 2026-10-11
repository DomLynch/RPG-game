import { RANK_STEPS, TITLES, loadProfile, rankFor, readLeaderboards, readPublicNo, readScorecard, session, shownMarks, type BoardRow, type ScoreRow } from './core/index.ts';
import { LADDER } from './ladder.ts';
import { loadScorecard, totals } from './scorecard.ts';

// The Career screen (core slice 2, Web): the 50-rung ladder with the player's rung marked, and the scorecard the career service holds for the account (scorecard_rows(), read through
// the core's career-client; a screen never calls the server itself). Signed out, offline or on a failed read it says so and keeps the device's own figures: nothing is drawn empty.
export type Rung = { label: string; state: 'done' | 'now' | 'next' };
export type ShelfView = { title: string; rungs: Rung[] };
// One row per title (ten), five rungs each; `now` is the rank the marks give, everything under it is done. Pure.
export function ladderView(marks: number): ShelfView[] {
  const level = rankFor(marks).level, numerals = ['I', 'II', 'III', 'IV', 'V'];
  return TITLES.map((title, t) => ({ title, rungs: numerals.slice(0, RANK_STEPS).map((n, i) => { const at = t * RANK_STEPS + i + 1; return { label: `${title} ${n}`, state: at < level ? 'done' : at === level ? 'now' : 'next' } as Rung; }) }));
}
export type ScoreLine = { name: string; fights: number; wins: number; losses: string };
// Most-fought first (the Pit's own order, scorecard.ts), "3 (1 left)" only when a walk-away happened, then the total.
export function scoreLines(rows: readonly ScoreRow[], name: (opponent: string) => string = (o) => o): ScoreLine[] {
  const losses = (l: number, left: number) => (left ? `${l} (${left} left)` : String(l));
  const lines = [...rows].sort((a, b) => b.fights - a.fights).map((r) => ({ name: name(r.opponent), fights: r.fights, wins: r.wins, losses: losses(r.losses, r.left) }));
  const all = rows.reduce((s, r) => ({ fights: s.fights + r.fights, wins: s.wins + r.wins, losses: s.losses + r.losses, left: s.left + r.left }), { fights: 0, wins: 0, losses: 0, left: 0 });
  return [...lines, { name: 'All fights', fights: all.fights, wins: all.wins, losses: losses(all.losses, all.left) }];
}

// The boards (Strategy ruling C: live, 'Fighter #n' filled in by the server): one list per board, best place first. `who` is rendered as given, so real names switch on server-side with no change here.
export type BoardView = { title: string; lines: { place: number; who: string; score: number }[] };
const BOARD_TITLES: Record<BoardRow['board'], string> = { duel_rating: 'Duel rating', duel_wins: 'Duel wins' };
export function boardViews(rows: readonly BoardRow[]): BoardView[] {
  return (Object.keys(BOARD_TITLES) as BoardRow['board'][]).map((b) => ({ title: BOARD_TITLES[b], lines: rows.filter((r) => r.board === b).sort((x, y) => x.place - y.place).map((r) => ({ place: r.place, who: r.who, score: r.score })) })).filter((v) => v.lines.length > 0);
}

// The Profile card (top of the Career tab; Lead's spec): name, "Fighter #n", the record. From the account's scorecard when it answers, else this device's own record (and it says so).
export type RecordView = { fights: number; wins: number; losses: number; draws: number | null; source: 'account' | 'device' };
export function recordView(rows: readonly ScoreRow[] | null, device: { fights: number; wins: number; losses: number }): RecordView {
  if (!rows) return { ...device, draws: null, source: 'device' };
  const sum = rows.reduce((s, r) => ({ fights: s.fights + r.fights, wins: s.wins + r.wins, losses: s.losses + r.losses, draws: s.draws + r.draws }), { fights: 0, wins: 0, losses: 0, draws: 0 });
  return { ...sum, source: 'account' };
}
export const recordLine = (r: RecordView): string => `${r.fights} fights · ${r.wins} wins · ${r.losses} losses${r.draws === null ? '' : ` · ${r.draws} draws`}`;

type Db = Parameters<typeof readScorecard>[0] & Parameters<typeof readPublicNo>[0];
export type CareerMount = { render(): Promise<void> };
// `db()` is the account's client or null when signed out; `marks()` the rank's marks; `deviceNote` the line shown when the server's figures are not available.
export function mountCareer(root: HTMLElement, o: { db: () => Db | null | Promise<Db | null>; marks?: () => number; name?: (opponent: string) => string; rename?: () => void; links?: { label: string; go: () => void }[] }): CareerMount {
  // Defaults live HERE so every mode mounts the one component and no zone code reads Pit marks (core-boundary C6): the rank's marks = the account's server figure plus its pending wins, else this device's.
  const marks = o.marks ?? (() => shownMarks(session.standing?.marks ?? null, loadProfile(localStorage, () => crypto.randomUUID()).profile, session.standing?.pending ?? 0));
  const nameOf = o.name ?? ((id: string) => LADDER.find((x) => x.id === id)?.name ?? id);
  const doc = root.ownerDocument, el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  return {
    async render() {
      const rank = rankFor(marks()), head = el('p', 'career-rank', rank.label), profileCard = el('div', 'career-profile'), ladder = el('ol', 'career-ladder'), card = el('div', 'career-card');
      for (const shelf of ladderView(marks())) {
        const li = el('li', 'career-title'), rungs = el('span', 'career-rungs');
        li.append(el('b', '', shelf.title));
        for (const r of shelf.rungs) { const pip = el('i', `career-rung ${r.state}`); pip.title = r.label; if (r.state === 'now') pip.setAttribute('aria-current', 'step'); rungs.append(pip); }
        li.append(rungs); ladder.append(li);
      }
      root.replaceChildren(profileCard, head, ladder, el('h5', 'stats-heading', 'Scorecard'), card);
      const db = await o.db(), [rows, boards, publicNo] = db ? await Promise.all([readScorecard(db), readLeaderboards(db, 10), readPublicNo(db)]) : [null, null, null];
      const who = el('p', 'career-name'), name = el('strong', '', loadProfile(localStorage, () => crypto.randomUUID()).profile.name);
      who.append(name);
      if (o.rename) { const pencil = el('button', 'career-pencil', '✎'); pencil.type = 'button'; pencil.setAttribute('aria-label', 'Change your name'); pencil.addEventListener('click', o.rename); who.append(pencil); }
      profileCard.append(who);
      if (publicNo !== null) profileCard.append(el('p', 'career-note', `Fighter #${publicNo}`));
      const rec = recordView(rows, totals(loadScorecard(localStorage)));
      profileCard.append(el('p', 'career-record', recordLine(rec)), el('p', 'career-note', rec.source === 'account' ? 'Kept on your account.' : db ? 'This device\'s record (the account\'s is not available right now).' : 'This device\'s record. Sign in to keep it.'));
      if (o.links?.length) { const row = el('p', 'career-links'); for (const l of o.links) { const b = el('button', 'career-link', l.label); b.type = 'button'; b.addEventListener('click', l.go); row.append(b); } profileCard.append(row); }
      const tail = el('div', 'career-boards');
      root.append(el('h5', 'stats-heading', 'Boards'), tail);
      if (!db) tail.append(el('p', 'career-note', 'Sign in to see the boards.'));
      else if (!boards) tail.append(el('p', 'career-note', 'The boards are not available right now.'));
      else if (!boards.length) tail.append(el('p', 'career-note', 'No fighters on the boards yet.'));
      else for (const v of boardViews(boards)) { const ol = el('ol', 'career-board'); for (const l of v.lines) ol.append(el('li', '', `${l.place}. ${l.who} · ${l.score}`)); tail.append(el('h6', '', v.title), ol); }
      if (!rows) { card.append(el('p', 'career-note', db ? 'The scorecard is not available right now. Your device keeps its own record under Stats.' : 'Sign in to keep your scorecard on your account. Your device keeps its own record under Stats.')); return; }
      if (!rows.length) { card.append(el('p', 'career-note', 'No fights recorded yet.')); return; }
      const table = el('table', 'scorecard-table'), tr = el('tr');
      for (const h of ['Opponent', 'Fights', 'Wins', 'Losses']) tr.append(el('th', '', h));
      table.append(tr);
      for (const l of scoreLines(rows, nameOf)) { const row = el('tr'); row.append(el('td', '', l.name), el('td', '', String(l.fights)), el('td', '', String(l.wins)), el('td', '', l.losses)); table.append(row); }
      card.append(table);
    },
  };
}
