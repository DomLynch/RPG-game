// Pit CLIENT entry from the walk page ('Fight in the Pit'); not Zone 1 creature combat, which runs through src/fight.
// What main.ts does when the duel chunk fails to load for a fight it started. Pure, so the rule is tested without a page (fight-load.test.ts).
// Still this fight (the player may have left meanwhile): the fight is un-counted either way, the session back to before it started; only a
// player still in the duel layer is walked back out and shown the retry hint. A fight since replaced by another is not this load's to undo.
export type LoadFailure = 'none' | 'restore' | 'restore-and-hint';
export const loadFailure = (stillThisFight: boolean, fighting: boolean): LoadFailure => (!stillThisFight ? 'none' : fighting ? 'restore-and-hint' : 'restore');
