// The input layer: keyboard, the strike/kick/dodge/guard buttons, the guard-ring strike circle (v8), the sprint button and the
// joystick, folded into one intent per tick for the simulation. At most one edge-triggered action per tick plus the held guard level;
// the simulation owns legality and buffering. Everything the layer touches is injected — the DOM lookup, window, clock, timers, media
// query, viewport width — so the entry point's own globals (and the VM harness's fakes in tests/graphics.test.ts) are what it binds to.
import { accepts, type Action, type CombatEvent, type Practice } from './combat.ts';
import { swipeAction, type Flick } from './gestures.ts';

type Lookup = <T extends HTMLElement>(id: string) => T;
export type InputEnv = {
  element: Lookup;
  window: Pick<Window, 'addEventListener'>;
  now: () => number;
  setTimeout: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  matchMedia: (query: string) => { matches: boolean };
  innerWidth: () => number;
  paused: () => boolean;
  ready: () => boolean;      // assets loaded and graphics up: only then do presses reach the simulation
  practice: () => Practice;
  ring8: () => boolean;
  quiet: () => void;         // feedback.quiet — clearing input also silences pending cues
};
export type Intent = { x: number; z: number; run: boolean; action: Action | null; guard: boolean; held: boolean; cancel: boolean };

// Dodge control: the press is an instant backstep; holding it past HOLD_MS grows the step into a roll. Swipe-down rolls directly.
export const HOLD_MS = 150,
  SPRINT_PUSH = 1.4;
// Strike controls: the press swings at once; keeping it held charges (Heavy), loads (Stab) or chambers (Slash) the swing — the simulation owns
// the timing. The held level belongs to the control that raised it: releasing one never drops another's. Dragging a held strike off its
// circle turns the press into a guard press (a feint inside the wind-up's feint window, a parry or a raised guard after it) until it lifts.
type Strike = 'light' | 'heavy' | 'thrust';
const ownerOf = (move: string | null): Strike | null =>
  move === 'heavy_overhead'
    ? 'heavy'
    : move === 'thrust'
      ? 'thrust'
      : move?.startsWith('light_')
        ? 'light'
        : null;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
const RING8_ARM_MS = 300;

export function createInput(env: InputEnv) {
  const { element, paused } = env;
  const attackButton = element<HTMLButtonElement>('attack-button');
  const kickButton = element<HTMLButtonElement>('kick-button');
  const heavyButton = element<HTMLButtonElement>('heavy-button');
  const dodgeButton = element<HTMLButtonElement>('dodge-button');
  const guardButton = element<HTMLButtonElement>('guard-button');
  const thrustButton = element<HTMLButtonElement>('thrust-button');
  const runButton = element<HTMLButtonElement>('run-button');
  const joystick = element('joystick');
  const stick = element('stick');
  let action: Action | null = null,
    guard = false,
    guardId: number | null = null,
    cancel = false;
  let dodgeHeld: { since: number; rolled: boolean } | null = null;
  const holders = new Set<Strike>();
  let dragGuard = false;
  // The held level the simulation sees: during a swing, whether the control that threw it is still down; otherwise whether any strike control is.
  const held = () => {
    const f = env.practice().duel.fighters[0],
      owner = f.phase === 'attack' ? ownerOf(f.move) : null;
    return owner ? holders.has(owner) : holders.size > 0;
  };
  function hold(by: Strike) {
    holders.add(by);
  }
  function unhold(by: Strike) {
    holders.delete(by);
  }
  function request(next: Action) {
    if (!paused() && env.ready() && accepts(env.practice(), next)) action = next;
  }
  function requestKick() {
    request('kick');
  }
  let run = false,
    stickRun = false,
    moveId: number | null = null;
  let moveX = 0,
    moveZ = 0;
  const keys = new Set<string>();
  // Step: a tap is a backstep, a hold (150 ms) becomes a roll. With the stick already deflected (or a movement key down) the intent is a roll in
  // that direction, so it rolls at once: the invulnerability arrives with the press, not 150 ms later.
  const moving = () => moveX !== 0 || moveZ !== 0 || MOVE_KEYS.some((k) => keys.has(k));
  function pressDodge(now: number) {
    if (dodgeHeld) return;
    const roll = moving();
    dodgeHeld = { since: now, rolled: roll };
    request(roll ? 'dodge' : 'backstep');
  }
  // Releasing a control only drops its held level; a queued press survives until the next tick consumes it. Only a cancelled pointer
  // (pointercancel, focus loss) withdraws the press: lostpointercapture follows every ordinary pointerup and must not eat a quick tap.
  // A press the simulation has already taken into its buffer is withdrawn there too (`cancel`), but only if that control owns the
  // buffered request — a cancelled thumb must not erase another finger's valid press.
  let sent: Action | null = null; // the last request handed to the simulation (the one its buffer can hold)
  function withdraw(owned: Action | Action[]) {
    const mine = ([] as Action[]).concat(owned);
    if (action && mine.includes(action)) action = null;
    else if (sent && mine.includes(sent)) cancel = true;
  }
  function releaseDodge(cancelled = false) {
    dodgeHeld = null;
    if (cancelled) withdraw(['backstep', 'dodge']);
  }
  function requestParry() {
    request('parry');
  }
  function requestStrike(isHeavy = false) {
    request(isHeavy ? 'heavy' : 'light');
  }
  env.window.addEventListener('keydown', (event) => {
    if (paused() || (event.target as { tagName?: string } | null)?.tagName === 'INPUT') return; // typing a name is not fighting
    if ([...MOVE_KEYS, 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (event.code === 'KeyF' && !event.repeat) {
      event.preventDefault();
      requestStrike();
    }
    if (event.code === 'KeyC' && !event.repeat) {
      event.preventDefault();
      requestKick();
    }
    if (event.code === 'KeyG' && !event.repeat) {
      event.preventDefault();
      hold('heavy');
      requestStrike(true);
    }
    if (event.code === 'KeyT' && !event.repeat) {
      event.preventDefault();
      hold('thrust');
      request('thrust');
    }
    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault();
      pressDodge(env.now());
    }
    if (event.code === 'KeyQ') {
      event.preventDefault();
      keys.add(event.code);
      if (!event.repeat) requestParry();
    }
    if (event.code === 'KeyR' && !event.repeat) element('recenter-button').click();
  });
  env.window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'KeyE') releaseDodge();
    if (event.code === 'KeyG') unhold('heavy');
    if (event.code === 'KeyT') unhold('thrust');
  });
  function setRun(value: boolean) {
    run = value;
    runButton.setAttribute('aria-pressed', String(value));
  }
  runButton.addEventListener('pointerdown', (event) => {
    if (!paused()) {
      runButton.setPointerCapture(event.pointerId);
      setRun(true);
    }
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    runButton.addEventListener(name, () => setRun(false));
  runButton.addEventListener('keydown', (event) => {
    if (['Space', 'Enter'].includes(event.code) && !paused()) {
      event.preventDefault();
      setRun(true);
    }
  });
  runButton.addEventListener('keyup', () => setRun(false));
  runButton.addEventListener('blur', () => setRun(false));
  // A strike button with pointer capture: press = strike (held while down); the pointer leaving the circle while down = guard press (drag-off feint).
  // `pointer` lets a scheme hand the button's touch grammar to its own handler (v8's strike circle) without disturbing the others.
  function strikeControl(
    button: HTMLButtonElement,
    name: Strike,
    start: () => void,
    pointer: () => boolean = () => true,
  ) {
    let id: number | null = null,
      dragged = false;
    const radius = () => {
      const r = button.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 + 6 };
    }; // 6 px of slack before a press counts as dragged off
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || id !== null || !pointer()) return;
      event.preventDefault();
      id = event.pointerId;
      dragged = false;
      try {
        button.setPointerCapture(id);
      } catch {
        /* capture is a convenience: an uncaptured press still strikes */
      }
      hold(name);
      start();
    });
    button.addEventListener('pointermove', (event) => {
      if (event.pointerId !== id || dragged) return;
      const c = radius();
      if (Math.hypot(event.clientX - c.x, event.clientY - c.y) <= c.r) return;
      dragged = true;
      unhold(name);
      dragGuard = true;
      requestParry(); // off the circle: the swing is abandoned into a guard press
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(type, (event) => {
        if ((event as PointerEvent).pointerId !== id) return;
        id = null;
        unhold(name);
        if (dragged) {
          dragged = false;
          dragGuard = false;
        }
        if (type === 'pointercancel') withdraw(name);
      });
    button.addEventListener('keydown', (event) => {
      if (['Space', 'Enter'].includes(event.code) && !event.repeat) {
        event.preventDefault();
        hold(name);
        start();
      }
    });
    button.addEventListener('keyup', () => unhold(name));
    button.addEventListener('blur', () => unhold(name));
  }
  strikeControl(
    attackButton,
    'light',
    () => requestStrike(),
    () => !env.ring8(),
  );
  kickButton.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      event.preventDefault();
      requestKick();
    }
  });
  kickButton.addEventListener('pointercancel', () => withdraw('kick'));
  kickButton.addEventListener('keydown', (event) => {
    if (['Space', 'Enter'].includes(event.code) && !event.repeat) {
      event.preventDefault();
      requestKick();
    }
  });
  strikeControl(heavyButton, 'heavy', () => requestStrike(true));
  strikeControl(thrustButton, 'thrust', () => request('thrust'));
  // Guard ring v8 (owner trial, 2026-09-18): the strike circle is the whole grammar — no Heavy or Stab buttons. A quick tap is the slash (it
  // fires as the thumb lifts, the fastest blow); holding loads the heavy (release early = plain, keep holding through the chamber = charged);
  // a flick up is the stab, sideways is that side's cut, back is guard. A loaded heavy dragged off the circle feints into guard, as the strike
  // buttons always have. Every intent is the one the dedicated button sends — the simulation owns every rule and timer, none are re-timed here.
  let ring8Stroke: {
    id: number;
    x: number;
    y: number;
    armed: boolean;
    feint: boolean;
    flick: Flick | null;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  attackButton.addEventListener('pointerdown', (event) => {
    if (!env.ring8() || event.button !== 0 || ring8Stroke !== null) return;
    event.preventDefault();
    const stroke = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      armed: false,
      feint: false,
      flick: null as Flick | null,
      timer: 0 as unknown as ReturnType<typeof setTimeout>,
    };
    stroke.timer = env.setTimeout(() => {
      if (ring8Stroke !== stroke || stroke.flick) return;
      stroke.armed = true;
      unhold('light');
      hold('heavy');
      requestStrike(true); // held long enough: the heavy loads; keeping it held charges
    }, RING8_ARM_MS);
    ring8Stroke = stroke;
    try {
      attackButton.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a convenience: an uncaptured press still strikes */
    }
    hold('light');
  });
  attackButton.addEventListener('pointermove', (event) => {
    const s = ring8Stroke;
    if (!s || event.pointerId !== s.id) return;
    if (s.armed) {
      // a loaded heavy leaves the circle: the feint, exactly as dragging a strike button off its circle always was
      if (s.feint) return;
      const r = attackButton.getBoundingClientRect();
      if (
        Math.hypot(event.clientX - (r.left + r.width / 2), event.clientY - (r.top + r.height / 2)) >
        r.width / 2 + 6
      ) {
        s.feint = true;
        unhold('heavy');
        dragGuard = true;
        requestParry();
      }
      return;
    }
    if (s.flick) return;
    const flick = swipeAction(event.clientX - s.x, event.clientY - s.y);
    if (!flick) return;
    env.clearTimeout(s.timer);
    unhold('light');
    s.flick = flick;
    if (flick === 'up') {
      hold('thrust');
      request('thrust');
    } else if (flick === 'down') {
      dragGuard = true;
      requestParry();
    } else request(flick === 'left' ? 'light_left' : 'light_right');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    attackButton.addEventListener(type, (event) => {
      const s = ring8Stroke;
      if (!s || (event as PointerEvent).pointerId !== s.id) return;
      ring8Stroke = null;
      env.clearTimeout(s.timer);
      unhold('light');
      unhold('heavy');
      unhold('thrust');
      if (s.flick === 'down' || s.feint) dragGuard = false;
      else if (!s.flick && !s.armed && type === 'pointerup') requestStrike(); // the quick tap: the slash fires as the thumb lifts
      if (type === 'pointercancel')
        withdraw(
          s.armed
            ? 'heavy'
            : s.flick
              ? s.flick === 'up'
                ? 'thrust'
                : s.flick === 'down'
                  ? 'parry'
                  : `light_${s.flick}`
              : 'light',
        );
    });
  dodgeButton.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      event.preventDefault();
      dodgeButton.setPointerCapture(event.pointerId);
      pressDodge(env.now());
    }
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    dodgeButton.addEventListener(name, () => releaseDodge(name === 'pointercancel'));
  dodgeButton.addEventListener('keydown', (event) => {
    if (['Space', 'Enter'].includes(event.code) && !event.repeat) {
      event.preventDefault();
      pressDodge(env.now());
    }
  });
  dodgeButton.addEventListener('keyup', () => releaseDodge());
  dodgeButton.addEventListener('blur', () => releaseDodge(true));
  guardButton.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || paused() || guardId !== null) return;
    event.preventDefault();
    guardId = event.pointerId;
    guardButton.setPointerCapture(guardId);
    guard = true;
    requestParry();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    guardButton.addEventListener(name, (event) => {
      if ((event as PointerEvent).pointerId === guardId) {
        guardId = null;
        guard = false;
        if (name === 'pointercancel') withdraw('parry');
      }
    });
  guardButton.addEventListener('keydown', (event) => {
    if (['Space', 'Enter'].includes(event.code) && !paused()) {
      event.preventDefault();
      guard = true;
      if (!event.repeat) requestParry();
    }
  });
  guardButton.addEventListener('keyup', () => {
    guard = false;
  });
  guardButton.addEventListener('blur', () => {
    guard = false;
    if (action === 'parry') action = null;
  });
  function moveStick(event: PointerEvent) {
    const rect = joystick.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / 42;
    const z = (event.clientY - rect.top - rect.height / 2) / 42;
    const length = Math.hypot(x, z),
      scale = Math.max(1, length);
    moveX = length < 0.12 ? 0 : x / scale;
    moveZ = length < 0.12 ? 0 : z / scale;
    // Sprint is a deliberate push well past the knob's rim (the rim is length 1; 1.4 is ~17 px beyond it), and the knob shows it.
    stickRun = (env.innerWidth() <= 900 || env.matchMedia('(pointer:coarse)').matches) && length > SPRINT_PUSH;
    stick.style.transform = `translate(${moveX * 34}px, ${moveZ * 34}px)`;
    stick.dataset.run = String(stickRun);
  }
  // The stick must never stay pushed after the thumb has gone: a new touch always takes it over, and its release is honoured wherever the
  // browser delivers it (a pointerup that lands outside the pad when capture was lost, or a touchend with no fingers left on the screen).
  function releaseStick() {
    moveId = null;
    stickRun = false;
    moveX = moveZ = 0;
    stick.style.transform = '';
    stick.dataset.run = 'false';
  }
  joystick.addEventListener('pointerdown', (event) => {
    if (paused()) return;
    moveId = event.pointerId;
    try {
      joystick.setPointerCapture(moveId);
    } catch {
      /* the pad still follows this pointer through the window listeners */
    }
    moveStick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === moveId) moveStick(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    joystick.addEventListener(name, (event) => {
      if ((event as PointerEvent).pointerId === moveId) releaseStick();
    });
  for (const name of ['pointerup', 'pointercancel'])
    env.window.addEventListener(name, (event) => {
      if ((event as PointerEvent).pointerId === moveId) releaseStick();
    });
  env.window.addEventListener('touchend', (event) => {
    if (moveId !== null && event.touches.length === 0) releaseStick();
  });
  env.window.addEventListener('touchcancel', (event) => {
    if (moveId !== null && event.touches.length === 0) releaseStick();
  });
  return {
    // Frame start: a held Step that has outlived HOLD_MS grows into the roll.
    promoteDodge(now: number) {
      if (dodgeHeld && !dodgeHeld.rolled && now - dodgeHeld.since >= HOLD_MS) {
        dodgeHeld.rolled = true;
        request('dodge');
      }
    },
    // What the simulation sees this tick. Presses reach it only once the assets are ready (the buttons read disabled until then).
    intent(): Intent {
      const ready = env.ready();
      return {
        x:
          moveX +
          Number(keys.has('KeyD') || keys.has('ArrowRight')) -
          Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        z:
          moveZ +
          Number(keys.has('KeyS') || keys.has('ArrowDown')) -
          Number(keys.has('KeyW') || keys.has('ArrowUp')),
        run: run || stickRun || keys.has('ShiftLeft') || keys.has('ShiftRight'),
        action: ready ? action : null,
        guard: ready && (guard || dragGuard || keys.has('KeyQ')),
        held: ready && held(),
        cancel,
      };
    },
    // After the tick: track what the simulation's buffer can still hold — a request we sent this tick, until something of ours starts
    // (or a cancel) — and clear the one-shot press and cancel.
    consumed(events: CombatEvent[]) {
      if (
        cancel ||
        events.some((e) => e.actor === 0 && (e.type === 'AttackStarted' || e.type === 'ActionStarted'))
      )
        sent = null;
      if (action) sent = action;
      action = null;
      cancel = false;
    },
    // Every press, hold, key and stick released: the welcome/journal/rename/visibility paths, a rematch, a graphics loss.
    clear() {
      if (ring8Stroke) {
        env.clearTimeout(ring8Stroke.timer);
        ring8Stroke = null;
      }
      action = null;
      cancel = true;
      dodgeHeld = null;
      holders.clear();
      dragGuard = false;
      env.quiet();
      keys.clear();
      guard = false;
      guardId = null;
      run = stickRun = false;
      moveX = moveZ = 0;
      moveId = null;
      stick.style.transform = '';
      stick.dataset.run = 'false';
      runButton.setAttribute('aria-pressed', 'false');
    },
  };
}
export type Input = ReturnType<typeof createInput>;
