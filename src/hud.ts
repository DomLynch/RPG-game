// The combat HUD: meters, labels, the combat buttons' enabled/hidden/label state, and the floating damage numbers. Pure DOM
// binding over the practice state — it never decides anything about the fight. `element` is injected so the entry point's
// own lookup (and the VM test harness's fake document) is what it binds to.
import { accepts, practiceHint, type CombatEvent, type Practice } from './combat.ts';
import { nextAfter, won } from './ladder.ts';
import type { OpponentId } from './moves.ts';

// Heavy-class contacts: bigger damage numbers here, a longer hit-stop in the frame loop.
export const HEAVY_MOVES = new Set<string>(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);
const KICK_LANDS = 1.5;

export type HudView = { controlsReady: boolean; debug: boolean; opponentId: OpponentId };
type Lookup = <T extends HTMLElement>(id: string) => T;

export function createHud(element: Lookup) {
  const attackButton = element<HTMLButtonElement>('attack-button');
  const kickButton = element<HTMLButtonElement>('kick-button');
  const heavyButton = element<HTMLButtonElement>('heavy-button');
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
      const hint = practiceHint(practice),
        controlsReady = view.controlsReady;
      const ok = (['light', 'heavy', 'kick', 'backstep', 'parry'] as const).map(
        (a) => accepts(practice, a) || (a === 'backstep' && accepts(practice, 'dodge')),
      );
      const inKickReach =
        Math.hypot(practice.enemy.x - practice.fighter.x, practice.enemy.z - practice.fighter.z) <= KICK_LANDS;
      const key = `${practice.phase}:${practice.health}:${practice.playerHealth}:${Math.floor(practice.stamina)}:${Math.floor(practice.posture)}:${Math.floor(practice.enemyPosture)}:${hint}:${controlsReady}:${ok.join('')}:${practice.wound > 0}:${practice.exhausted}:${practice.threatMove}:${inKickReach}`;
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
      attackButton.textContent =
        practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
      attackButton.dataset.mobile = practice.phase === 'sheathed' ? 'Draw' : 'Slash';
      attackButton.setAttribute('aria-label', attackButton.textContent);
      thrustButton.hidden = !practice.health || !practice.playerHealth || practice.phase === 'sheathed';
      thrustButton.setAttribute('aria-disabled', String(!controlsReady || !accepts(practice, 'thrust')));
      // Keep receiving repeated touches while busy; native disabled can surrender them to browser zoom.
      attackButton.setAttribute('aria-disabled', String(!controlsReady || !ok[0]));
      const ended = !practice.health || !practice.playerHealth;
      heavyButton.hidden = ended;
      heavyButton.setAttribute('aria-disabled', String(!controlsReady || !ok[1]));
      attackButton.hidden = ended;
      resetButton.hidden = !ended;
      const next = ended && won(practice.finish) ? nextAfter(view.opponentId) : undefined;
      resetButton.textContent = next ? `Next: ${next.name}` : 'Rematch';
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
