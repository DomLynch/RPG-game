// ?look=creatures (src/audio/creature.ts): the Frontier creatures' growl when a "!" fires. The walk page has no audio of its own, so this chunk (loaded only under the flag) builds the game's
// feedback once, unlocks it on the first tap like the game does, and answers mobs-view.ts's `origins:creature` event. The Pit duel's bite and death cry are pit-duel.ts's, on its own feedback.
import { createFeedback } from '../../src/feedback.ts';
import type { CreatureCue } from '../../src/audio/creature.ts';

export function listenCreatures(): void {
  const feedback = createFeedback();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, () => feedback.unlock(), { passive: true });
  window.addEventListener('origins:creature', (e) => { const d = (e as CustomEvent<{ body: string; cue: CreatureCue }>).detail; feedback.creature(d.body, d.cue); });
}
