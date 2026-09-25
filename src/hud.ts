// The combat HUD: meters, labels, the combat buttons' enabled/hidden/label state, and the floating damage numbers. Pure DOM
// binding over the practice state — it never decides anything about the fight. `element` is injected so the entry point's
// own lookup (and the VM test harness's fake document) is what it binds to.
import { accepts, practiceHint, type CombatEvent, type Practice } from './combat.ts';
import { nextAfter, won } from './ladder.ts';
import { bareName } from './roster.ts';
import type { OpponentId } from './moves.ts';

// Heavy-class contacts: bigger damage numbers here, a longer hit-stop in the frame loop.
export const HEAVY_MOVES = new Set<string>(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);
const KICK_LANDS = 1.5;

export type HudView = { controlsReady: boolean; debug: boolean; opponentId: OpponentId; replay?: boolean; practiceOnly?: boolean; stalled?: boolean };   // replay: watching a record (PLAY NOW after); practiceOnly: that fight, no ladder step; stalled: the viewer page cannot go on
type Lookup = <T extends HTMLElement>(id: string) => T;

export function createHud(element: Lookup) {
  const attackButton = element<HTMLButtonElement>('attack-button');
  const kickButton = element<HTMLButtonElement>('kick-button');
  const heavyButton = element<HTMLButtonElement>('heavy-button');
  const skillButton = element<HTMLButtonElement>('skill-button');
  const dodgeButton = element<HTMLButtonElement>('dodge-button');
  const guardButton = element<HTMLButtonElement>('guard-button');
  const thrustButton = element<HTMLButtonElement>('thrust-button');
  const resetButton = element<HTMLButtonElement>('reset-button');
  const playerHealth = element<HTMLMeterElement>('player-health');
  const stamina = element<HTMLMeterElement>('stamina');
  const health = element<HTMLMeterElement>('target-health');
  const combatStatus = element('combat-status');
  // Damage numbers (owner mockup, 2026-09-19): a clean hit floats its damage off the victim — white for dealt, warm red for taken, gold and
  // bigger for the heavy-class ones (charged, counter, riposte, critical). Four pooled spans round-robin (a duel never shows four at once);
  // positions come from the scene's world→screen projection. Presentation-only.
  const dmgPool = Array.from(element('dmg-pool').children) as HTMLElement[];
  let dmgCursor = 0;
  let lastHud = '';
  return {
    // Force the next update to write everything (the debug toggle relabels the buttons).
    invalidate() {
      lastHud = '';
    },
    update(practice: Practice, view: HudView) {
      const hint = practiceHint(practice, bareName(view.opponentId)),
        controlsReady = view.controlsReady;
      const ok = (['light', 'heavy', 'kick', 'backstep', 'parry'] as const).map(
        (a) => accepts(practice, a) || (a === 'backstep' && accepts(practice, 'dodge')),
      );
      const inKickReach =
        Math.hypot(practice.enemy.x - practice.fighter.x, practice.enemy.z - practice.fighter.z) <= KICK_LANDS;
      const key = `${practice.phase}:${practice.duel.fighters[0].lastMove ?? ''}:${practice.health}:${practice.playerHealth}:${Math.floor(practice.stamina)}:${Math.floor(practice.posture)}:${Math.floor(practice.enemyPosture)}:${hint}:${controlsReady}:${ok.join('')}:${practice.wound > 0}:${practice.exhausted}:${practice.threat}:${practice.threatMove}:${inKickReach}:${view.replay ? 'r' : ''}${view.practiceOnly ? 'p' : ''}${view.stalled ? 's' : ''}`;
      if (key === lastHud) return;
      lastHud = key;
      health.max = practice.enemyMaxHealth;
      playerHealth.max = practice.maxHealth; // an opponent may carry more than a man (moves.ts `Opponent.health`)
      health.value = practice.health;
      element('health-value').textContent = `${practice.health} / ${practice.enemyMaxHealth}`;
      playerHealth.value = practice.playerHealth;
      element('player-health-value').textContent = `${practice.playerHealth} / ${practice.maxHealth}`;
      for (const [meter, value, max] of [
        [health, practice.health, practice.enemyMaxHealth],
        [playerHealth, practice.playerHealth, practice.maxHealth],
        [stamina, practice.stamina, 100],
      ] as const)
        meter.style.setProperty('--fill', `${(value / max) * 100}%`);
      stamina.style.setProperty('--max', `${practice.maxStamina}%`);
      stamina.dataset.leg = String(practice.legWound); // attrition: the lost ceiling is shaded; a leg wound marks the bar
      stamina.value = practice.stamina;
      element('stamina-value').textContent = `${Math.floor(practice.stamina)} / 100`;
      for (const [id, value] of [
        ['posture', practice.posture],
        ['target-posture', practice.enemyPosture],
      ] as const) {
        const meter = element<HTMLMeterElement>(id);
        meter.value = value;
        meter.style.setProperty('--fill', `${value}%`);
        meter.dataset.critical = String(value >= 70);
      }
      combatStatus.textContent = hint;
      element('stamina-label').dataset.mobile = practice.exhausted
        ? 'Stamina · exhausted'
        : practice.wound
          ? 'Stamina · wound'
          : 'Stamina';
      stamina.setAttribute(
        'aria-label',
        practice.exhausted
          ? 'Stamina — exhausted: no attacks or guard until it recovers'
          : practice.wound
            ? 'Stamina — wounded: recovery reduced 20 percent'
            : 'Stamina',
      );
      kickButton.hidden =
        practice.phase === 'sheathed' || practice.phase === 'draw' || !practice.health || !practice.playerHealth;
      kickButton.setAttribute('aria-disabled', String(!controlsReady || !ok[2]));
      kickButton.dataset.reach = String(inKickReach); // a kick has a short cone: the button brightens when it can land
      combatStatus.dataset.threat = String(practice.threat);
      combatStatus.dataset.move = practice.threatMove ?? '';
      const attackLabel = practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
      const labelNode = attackButton.firstChild;   // the text node; the side-mark SVG after it must survive the rewrite
      if (labelNode && labelNode.nodeType === 3) { if (labelNode.textContent !== attackLabel) labelNode.textContent = attackLabel; } else attackButton.textContent = attackLabel;
      // Side hint: the cuts alternate, so the button lights the side of the NEXT one (none while sheathed — the button says Draw).
      const nextCut = practice.phase === 'sheathed' ? null : practice.duel.fighters[0].lastMove === 'light_right' ? 'left' : 'right';
      if ((attackButton.dataset.next ?? null) !== nextCut) { if (nextCut) attackButton.dataset.next = nextCut; else delete attackButton.dataset.next; }
      attackButton.dataset.mobile = practice.phase === 'sheathed' ? 'Draw' : 'Slash';
      attackButton.setAttribute('aria-label', attackLabel);
      thrustButton.hidden = !practice.health || !practice.playerHealth || practice.phase === 'sheathed';
      thrustButton.setAttribute('aria-disabled', String(!controlsReady || !accepts(practice, 'thrust')));
      // Keep receiving repeated touches while busy; native disabled can surrender them to browser zoom.
      attackButton.setAttribute('aria-disabled', String(!controlsReady || !ok[0]));
      const ended = !practice.health || !practice.playerHealth;
      heavyButton.hidden = ended;
      skillButton.hidden = ended;   // the seventh button follows Heavy's visibility
      // Lit exactly like the six: the simulation's own test (legal: a skill equipped, not cooling, 40 stamina). No ring, no countdown.
      skillButton.setAttribute('aria-disabled', String(!controlsReady || !practice.duel.fighters[0].skill || !accepts(practice, 'skill')));
      heavyButton.setAttribute('aria-disabled', String(!controlsReady || !ok[1]));
      attackButton.hidden = ended;
      // A stalled viewer page (record ran out, or the link never decoded) shows the button over the frozen frame: it is the only way on.
      resetButton.hidden = !ended && !view.stalled;
      const next = ended && !view.practiceOnly && !view.replay && won(practice.finish) ? nextAfter(view.opponentId) : undefined;
      // "PLAY NOW" on a shared link, not "Avenge him" (owner 2026-09-22): a stranger does not know whose death they are avenging.
      resetButton.textContent = view.replay || view.stalled ? 'PLAY NOW' : next ? `Next: ${next.name}` : 'Rematch';
      // On a viewer page PLAY NOW is the only live control on the screen (every combat button beside it is asleep), so it wears the
      // kill screen's primary rather than the dark glass it shares with Rematch — style.css `#reset-button[data-play='1']`.
      resetButton.dataset.play = view.replay || view.stalled ? '1' : '0';
      dodgeButton.setAttribute('aria-disabled', String(!controlsReady || !ok[3]));
      guardButton.setAttribute('aria-disabled', String(!controlsReady || !(ok[4] || practice.phase === 'guard')));
      guardButton.setAttribute('aria-pressed', String(practice.phase === 'guard'));
      element('debug').hidden = !view.debug;
    },
    // The journal's damage-numbers toggle turning off: whatever is floating disappears.
    hideDamage() {
      for (const span of dmgPool) span.hidden = true;
    },
    floatDamage(
      events: CombatEvent[],
      fighters: readonly { body: { x: number; z: number }; scale: number }[],
      project: ((point: [number, number, number]) => [number, number] | null) | undefined,
    ): void {
      if (!dmgPool.length || typeof project !== 'function') return; // the VM harness ships an empty pool and a stub view: nothing to float there (the entry point gates on the journal setting)
      for (const e of events) {
        if (e.type !== 'Hit' || e.target === undefined || !e.damage) continue;
        const victim = fighters[e.target];
        const at = project([victim.body.x, 1.62 * victim.scale, victim.body.z]);
        if (!at) continue;
        const span = dmgPool[dmgCursor++ % dmgPool.length];
        span.textContent = String(Math.round(e.damage));
        span.className = `dmg${e.target === 0 ? ' taken' : ''}${e.counter || e.charged || HEAVY_MOVES.has(e.move ?? '') ? ' heavy' : ''}`;
        span.style.left = `${at[0]}px`;
        span.style.top = `${at[1]}px`;
        span.hidden = false;
        if (typeof span.animate === 'function')
          span.animate(
            [
              { transform: 'translate(-50%, 0)', opacity: 1 },
              { transform: 'translate(-50%, -44px)', opacity: 0 },
            ],
            { duration: 900, easing: 'ease-out', fill: 'forwards' },
          ).onfinish = () => {
            span.hidden = true;
          };
        else
          setTimeout(() => {
            span.hidden = true;
          }, 900);
      }
    },
  };
}
