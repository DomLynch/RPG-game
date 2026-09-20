import { ROSTER, supportsFinishers, resolveFinisher, hasBlood } from './roster.ts';
import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { defenceReaction, loadWarriors } from './characters.ts';
import { actorPose, initialPractice, type CombatEvent, type Practice } from './combat.ts';
import { OPPONENTS, RULES, weaponOf, type OpponentId, type WeaponId } from './moves.ts';
import { FINISHER_POSE, type FinisherId } from './finishers.ts';
import { TARGET, wrapAngle, type State } from './sim.ts';
import { buildArena } from './arena.ts';
import { createFootDust } from './foot-dust.ts';
import { HEAVY_CLASS, clashStrength, createClashSparks } from './clash-sparks.ts';
import { shoveFor } from './camera-kick.ts';
import { createFinisherBlood, finisherBloodSources } from './finisher-blood.ts';
import { phoneTier } from './quality.ts';
import { createCameraRig } from './camera.ts';
import { launchSeveredHead, stepSeveredHead, type SeveredHead } from './severed-head.ts';
import { createBladeBlood, createSplatPool, createWoundDecals } from './gore.ts';

// One GLB per opponent (moves.ts `OpponentId`); only the hero and the man he faces are ever loaded.
export function createScene(
  canvas: HTMLCanvasElement,
  assetStatus: (status: string) => void = () => {},
  opponentId: OpponentId = 'veteran',
) {
  // Phone tier (the owner's iPhone GPU-pressure defect, 2026-09-18): cap the backing store at 1.25× and the
  // shadow map at 512² — the MSAA framebuffer at 1.5× on a ~1170×2532-class phone is ~200 MB of GPU memory.
  const PHONE = phoneTier(),
    PIXEL_CAP = PHONE ? 1.25 : 1.5;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_CAP));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9a89c');
  scene.fog = new THREE.FogExp2('#a9a89c', 0.018);
  let environmentTarget: THREE.WebGLRenderTarget | undefined;
  // The environment map: the arena's own ash sky (an equirect the world lane paints, warm sand below the horizon) once it has landed,
  // so bronze and iron reflect this place; the studio RoomEnvironment only until then (audit 2026-09-20).
  let arenaSky: THREE.Texture | undefined;
  function rebuildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer), environment = arenaSky ? null : new RoomEnvironment();
    try {
      const target = environment ? pmrem.fromScene(environment, 0.04) : pmrem.fromEquirectangular(arenaSky!);
      environmentTarget?.dispose();
      environmentTarget = target;
      scene.environment = target.texture;
      scene.environmentIntensity = environment ? 0.45 : 1.0;
    } finally {
      environment?.dispose();
      pmrem.dispose();
    }
  }
  rebuildEnvironment();
  const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
  const metal = new THREE.MeshStandardMaterial({ color: '#89949b', metalness: 0.72, roughness: 0.4 });
  // The target marker's brass is a combat tell (it warms on a threat); the arena has its own materials in arena.ts.
  const brass = new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.48 });
  scene.add(new THREE.HemisphereLight('#c9cfc6', '#4a4238', 1.6));
  const sun = new THREE.DirectionalLight('#ffe2b8', 4.2);
  sun.position.set(-15, 26, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(PHONE ? 512 : 1024, PHONE ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 70 });   // the pit floor to the wall's foot (11.7 m), not the tiers: 1.25× sharper shadows on the sand for free (audit 2026-09-20)
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = scene,
  ) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  const arena = buildArena(scene),
    footDust = createFootDust(scene),
    clash = createClashSparks(scene);
  arena.ready.then(() => { if ((arena.sky.image as { width: number }).width > 2) { arenaSky = arena.sky; rebuildEnvironment(); } }).catch(() => {});
  function capsule(x: number, z: number, material: THREE.Material) {
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(x, 0, z);
    mesh(new THREE.CapsuleGeometry(0.31, 1.12, 6, 14), material, 0, 0.88, 0, group);
    const band = mesh(new THREE.TorusGeometry(0.315, 0.025, 5, 20), brass, 0, 0.8, 0, group);
    band.rotation.x = Math.PI / 2;
    box(0.055, 0.85, 0.065, 0, 0.95, 0.305, brass, group);
    return group;
  }
  const player = capsule(0, 4, metal);
  const opponent = capsule(
    TARGET.x,
    TARGET.z,
    new THREE.MeshStandardMaterial({ color: '#6d5447', roughness: 0.8, metalness: 0.25 }),
  );
  let warriors: Awaited<ReturnType<typeof loadWarriors>> | undefined;
  const dustFeet: (THREE.Object3D | null)[] = [],
    dustPositions = Array.from({ length: 4 }, () => new THREE.Vector3());
  assetStatus('Loading warriors…');
  // The player, and the chosen opponent; each rig plays the clips of the weapon the simulation gives that side (moves.ts OPPONENTS, duel.ts initialDuel).
  const weapons = initialPractice(731, OPPONENTS[opponentId]).duel.fighters.map((f) => f.weapon) as [
    WeaponId,
    WeaponId,
  ];
  // Every roster body except the held ones (roster.ts `hold`): glob patterns must be literals, so the exclusions are spelled out here —
  // tests/roster.test.ts checks the two lists agree. Held GLBs stay in src/assets for their lanes; they are just not in the beta bundle.
  const fighterUrls = import.meta.glob<string>(['./assets/*.glb', '!./assets/minotaur.glb', '!./assets/werewolf.glb', '!./assets/wraith.glb', '!./assets/skeleton.glb'], { eager: true, query: '?url', import: 'default' });
  // Combat waits for the arena's worker textures and props too (arena.ready never rejects): their GPU uploads then land during the
  // loading screen instead of stalling the first exchange (measured 69 ms p95 in the first window when they arrived late under load).
  const ready = Promise.all([
    loadWarriors(fighterUrls['./assets/warrior.glb'], fighterUrls[`./assets/${ROSTER[opponentId].body}.glb`], weapons),
    arena.ready,
  ])
    .then(([loaded]) => {
      warriors = loaded;
      if (supportsFinishers(opponentId, 'opened')) loaded.opponent.prepareOpened();
      for (const proxy of [player, opponent]) {
        proxy.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        proxy.clear();
      }
      player.add(loaded.player.anchor);
      opponent.add(loaded.opponent.anchor);
      for (const rig of [loaded.player, loaded.opponent])
        for (const name of ['foot_l', 'foot_r']) dustFeet.push(rig.anchor.getObjectByName(name) ?? null);
      assetStatus('');
    })
    .catch((error) => {
      captureException(error);
      assetStatus('Warrior art could not load. Movement still works; reload to retry.');
    });
  const marker = mesh(new THREE.RingGeometry(0.56, 0.59, 48), brass, TARGET.x, 0.04, TARGET.z);
  marker.rotation.x = -Math.PI / 2;
  marker.castShadow = false;
  // Two original alpha sprites, generated once; all impacts reuse the same GPU resources.
  function impactTexture(splash: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const fill = ctx.createRadialGradient(64, 64, 8, 64, 64, 58);
    fill.addColorStop(0, '#ffffffff');
    fill.addColorStop(0.75, '#ffffffcc');
    fill.addColorStop(1, '#ffffff00');
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2,
        r = splash ? 33 + Math.sin(angle * 7) * 6 + Math.cos(angle * 11) * 4 : 48;
      const x = 64 + Math.cos(angle) * r,
        y = 64 + Math.sin(angle) * r * (splash ? 1 : 0.65);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (splash)
      for (let i = 0; i < 17; i++) {
        const a = i * 2.4,
          r = 42 + (i % 4) * 4;
        ctx.beginPath();
        ctx.ellipse(
          64 + Math.cos(a) * r,
          64 + Math.sin(a) * r,
          1.5 + (i % 3),
          1 + (i % 2),
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    return new THREE.CanvasTexture(canvas);
  }
  const dropTexture = impactTexture(false),
    splatTexture = impactTexture(true);
  const finisherBlood = createFinisherBlood(splatTexture);
  scene.add(finisherBlood.group);
  let bloodSources: ReturnType<typeof finisherBloodSources> = [];
  const sparkPositions = new Float32Array(12 * 3),
    sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    color: '#ffe4af',
    map: dropTexture,
    alphaTest: 0.02,
    size: 0.045,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.visible = false;
  scene.add(sparks);
  // Charge glow: a warm light on a fighter holding a heavy, white once the hold has charged. Placeholder for the visual lane's charge VFX.
  const glows = [0, 1].map(() => {
    const light = new THREE.PointLight('#ff9a3c', 0, 3, 2);
    light.castShadow = false;
    scene.add(light);
    return light;
  });
  const splats = createSplatPool(scene, splatTexture);
  let bloodMode: 'red' | 'dark' | 'off' = 'red',
    impactDuration = 0.18,
    impactHeading = 0,
    flesh = false,
    killSpray = false;
  let finisherOverride: FinisherId | null = null; // dev/test pick (owner 2026-09-19): swap which finisher plays on a ceremonial kill; null = the spec's selection
  // Rotation memory (owner 2026-09-20: never the same ceremony twice in a row). `lastFinisher` is the ceremony the previous
  // fight showed and feeds this fight's pick; `fightFinisher` is this fight's, rolled into `lastFinisher` when the next
  // fight starts (practice.finish clears on rematch). Presentation state only — the simulation never sees it.
  let lastFinisher: FinisherId | null = null, fightFinisher: FinisherId | null = null;
  let openedReach = 0;   // Opened: farthest horizontal extent of the landed pieces from the fallen's origin (camera fit)
  let impact = 0,
    lastHealth: number = RULES.health,
    lastPlayerHealth: number = RULES.health;
  // Decapitation (owner 2026-09-18): the severed head, its ballistic state, and the killing blow's heading (the pop direction).
  let severHead: SeveredHead | null = null,
    killHeading = 0;
  let finishClock = -1; // the finisher corpse animates at 0.75× on a presentation clock (owner 2026-09-18: savour it) — the sim window stays 144 ticks
  const wounds = createWoundDecals(scene, splatTexture);
  const blade = createBladeBlood();
  let heading = Math.PI;
  const rig = createCameraRig(camera);
  // Kill dip: the killing blow darkens the frame 6 % for two frames and recovers over two more — the cinematic reserve (GAME_SPEC 80/15/5),
  // never on an ordinary hit. Applied around the draw on top of whatever exposure the renderer holds, so nothing else has to know.
  let dip = 0; // frames remaining, counted down per drawn frame while time passes
  const DIP_FRAMES = 4, DIP_DEPTH = 0.06;
  const blockHeavy = [false, false]; // which fighter's standing block just caught a heavy (his recoil is deeper while `blocked` lasts)
  let ratio = Math.min(devicePixelRatio, PIXEL_CAP); // the context-loss recovery path lowers this to 1 from the tier's ceiling
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  return {
    renderer,
    ready,
    arena,
    bloodState() {
      const opened = warriors?.opponent.anchor.getObjectByName('Opened');
      return {
        ...finisherBlood.inspect(),
        head: severHead
          ? {
              position: severHead.group.position.toArray(),
              screen: this.project(severHead.group.position.toArray()),
              visible: severHead.group.visible,
            }
          : null,
        opened: opened
          ? {
              visible: opened.visible,
              pieces: opened.children
                .filter((p) => p.name !== 'OpenedWeapon')
                .map((p) => ({
                  name: p.name,
                  visible: p.visible,
                  opacity:
                    (
                      (p.getObjectByName('CreatureBody') as THREE.Mesh | undefined)?.material as
                        | THREE.MeshStandardMaterial
                        | undefined
                    )?.opacity ?? 1,
                })),
            }
          : null,
        sources: bloodSources.map((s) => ({
          site: s.site,
          position: s.position.toArray(),
          direction: s.direction.toArray(),
        })),
      };
    },
    setBloodMode(mode: 'red' | 'dark' | 'off') {
      bloodMode = mode;
      finisherBlood.group.visible = mode !== 'off' && bloodSources.length > 0;
      splats.clear(true);
      if (flesh) {
        impact = 0;
        sparks.visible = false;
      }
      if (mode === 'off') blade.set(false, warriors, mode);
      else if (blade.bloodied) blade.set(true, warriors, mode);
    },
    // The ceremony the previous fight showed (main.ts hands it to the audio resolver so both sides pick alike).
    previousFinisher(): FinisherId | null {
      return lastFinisher;
    },
    // Test/harness reset (the preview harness replays independent kills; each starts as a first fight).
    setPreviousFinisher(id: FinisherId | null) {
      lastFinisher = id;
      fightFinisher = null;
    },
    setFinisherOverride(id: FinisherId | null) {
      finisherOverride = id;
    },
    get yaw() {
      return rig.yaw;
    },
    orbit(dx: number, dy: number) {
      rig.orbit(dx, dy);
    },
    stopTour() {
      rig.stopTour();
    },
    recenter() {
      rig.recenter();
    },
    lowerResolution() {
      if (ratio > 1) {
        ratio = 1;
        renderer.setPixelRatio(ratio);
        resize();
      }
    },
    restoreGraphics() {
      this.lowerResolution();
      rebuildEnvironment();
    },
    // Debug probe: where the player's blade tip was drawn this frame (world metres), so a frame-by-frame check can see a held or moving pose.
    // World → CSS pixels for DOM overlays (damage numbers). Null when the point is behind the camera.
    project(point: [number, number, number]): [number, number] | null {
      const v = new THREE.Vector3(point[0], point[1], point[2]).project(camera);
      if (v.z > 1) return null;
      return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
    },
    playing(): string {
      return warriors ? `${warriors.player.playing()} ${warriors.opponent.playing()}` : '';
    }, // debug probe: what each rig plays
    probe(): { sparks: number; burst: [number, number, number] } {
      return { sparks: clash.alive(), burst: clash.last() };
    }, // debug probe for the presentation harness: live contact effects
    bladeTip(): [number, number, number] | null {
      const anchor = warriors?.player.anchor,
        drawn = anchor?.getObjectByName('WeaponDrawn') ?? anchor?.getObjectByName('SwordDrawn');
      if (!drawn) return null;
      player.updateWorldMatrix(true, true);
      const tip = drawn.localToWorld(
        new THREE.Vector3(0, (drawn.userData.contact as { to: number } | undefined)?.to ?? 0.86, 0),
      );
      return [tip.x, tip.y, tip.z];
    },
    // Effects consume the simulation's events for the frame; they never infer contact from animation.
    // `frozen`: the frame loop is in a hit-stop. Effects (sparks, blood, camera kick) keep running on dt; the rigs evaluate their pose for the
    // frozen tick without advancing their clocks — the one impact pause is the frame loop's.
    render(
      state: State,
      locked: boolean,
      dt: number,
      practice: Practice,
      events: CombatEvent[] = practice.events,
      frozen = false,
    ) {
      const blow = events.find((e) => e.type === 'Hit' || e.type === 'GuardBroken'),
        contact = blow || events.some((e) => e.type === 'Blocked' || e.type === 'Parried');
      const killed = events.find((e) => e.type === 'Killed');
      const finisher = practice.finish
        ? resolveFinisher(
            opponentId,
            practice.finish,
            [practice.duel.fighters[0].weapon, practice.duel.fighters[1].weapon],
            finisherOverride,
            lastFinisher,
          )
        : null;
      if (finisher) fightFinisher = finisher;
      else if (!practice.finish && fightFinisher) { lastFinisher = fightFinisher; fightFinisher = null; }
      const finisherPose = finisher ? FINISHER_POSE[finisher] : null;
      const detailedBlood = finisher !== null && practice.finish?.victim === 1;
      const quietFinish = finisher === 'quietOne' && practice.finish?.victim === 1;
      if (
        practice.health === practice.enemyMaxHealth &&
        practice.playerHealth === practice.maxHealth &&
        (lastHealth < practice.enemyMaxHealth || lastPlayerHealth < practice.maxHealth)
      ) {
        finisherBlood.reset();
        bloodSources = [];
        impact = 0;
        splats.clear(false);
        wounds.clear();
        blade.set(false, warriors, bloodMode);
        if (severHead) {
          scene.remove(severHead.group);
          severHead.group.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
          });
          severHead = null;
        }
        warriors?.player.unsever();
        warriors?.opponent.unsever();
        if (supportsFinishers(opponentId, 'opened')) warriors?.opponent.prepareOpened();
      } // a fresh match: both bars full again
      // Camera kick: what each contact does to the camera is camera-kick.ts's table (a heavy drops it 6 cm and holds, a light 1.2 cm, a
      // heavy block 2.8 cm, a parry flicks 2 cm sideways) — the guard shudders, the screen never shakes. Off under prefers-reduced-motion.
      const clashKick = blow ? undefined : events.find((e) => e.type === 'Blocked' || e.type === 'Parried');
      const shoveEvent = blow ?? (clashKick?.target !== undefined ? clashKick : undefined), shove = shoveEvent && shoveFor(shoveEvent);
      if (shoveEvent && shove && dt > 0) {
        // The blow's heading: a landed blow carries it; a block or parry takes the attacker's facing (the attacker is the event's target).
        rig.shove(shoveEvent.heading ?? (shoveEvent.target && !blow ? practice.enemy.heading : state.heading), shove);
      }
      if (clashKick?.type === 'Blocked') blockHeavy[clashKick.actor] = HEAVY_CLASS.has(clashKick.move ?? '');
      if (killed && dt > 0) dip = DIP_FRAMES;
      // A heavy landing on a planted man (or caught on his guard) kicks sand off his rear foot — the foot farther from the attacker. Feet are
      // last frame's world positions (a frame old, a centimetre); no puff for a kick, a light, or a fighter who is not on his feet.
      const planted = shoveEvent && dt > 0 && shoveEvent.type !== 'Parried' && HEAVY_CLASS.has(shoveEvent.move ?? '') ? shoveEvent : undefined;
      if (planted && planted.target !== undefined && dustFeet.length === 4) {
        const defender = blow ? planted.target : planted.actor, attackerAt = defender ? state : practice.enemy;
        const feet = [dustPositions[defender * 2], dustPositions[defender * 2 + 1]].filter((_f, i) => dustFeet[defender * 2 + i]);
        const rear = feet.sort((a, b) => Math.hypot(b.x - attackerAt.x, b.z - attackerAt.z) - Math.hypot(a.x - attackerAt.x, a.z - attackerAt.z))[0];
        if (rear && rear.y < 0.25) footDust.puff(rear, blow ? 1 : 0.6);
      }
      if (contact && dt > 0) {
        const enemyHurt = blow?.target === 1,
          hurt = !!blow;
        const kick = blow?.move === 'kick';
        flesh = hurt && (!enemyHurt || hasBlood(opponentId)) && !kick && bloodMode !== 'off';
        impactDuration = flesh && killed ? (quietFinish ? 0.2 : 0.55) : flesh ? 0.34 : 0.18;
        impact = impactDuration;
        impactHeading = blow?.heading ?? state.heading;
        killSpray = !!(killed && flesh); // a kill sprays a cone along the strike heading, not the radial puff
        if (killed && flesh) killHeading = blow?.heading ?? state.heading; // the decapitation pop flies the way the blow did
        const site = enemyHurt ? practice.enemyWoundSite : practice.woundSite;
        const target = enemyHurt ? practice.enemy : state;
        // Steel on steel: a block or parry of a metal blade by a blade guard throws metal sparks from the attacker's blade (clash-sparks.ts);
        // the generic contact dots stay for everything else (a shaft catching a blade, a kick, a fist).
        const clashEvent = blow ? undefined : events.find((e) => e.type === 'Blocked' || e.type === 'Parried');
        const strength = clashEvent ? clashStrength(clashEvent, weaponOf(practice.duel.fighters[clashEvent.actor].weapon)) : 0;
        if (clashEvent && strength > 0 && clashEvent.target !== undefined) {
          const attacker = clashEvent.target,
            rig = attacker ? warriors?.opponent : warriors?.player,
            weapon = rig?.anchor.getObjectByName('WeaponDrawn') ?? rig?.anchor.getObjectByName('SwordDrawn'),
            contactRange = weapon?.userData.contact as { from: number; to: number } | undefined;
          // Struck off the attacking blade itself (owner 2026-09-20): the outer part of its contact zone as the rig draws it this frame,
          // with a fallback segment at the defender's guard when a rig is not loaded.
          const defenderBody = attacker ? state : practice.enemy, guard = new THREE.Vector3(defenderBody.x, 1.15, defenderBody.z);
          let a: THREE.Vector3, b: THREE.Vector3;
          if (weapon && contactRange) {
            // The rig's contact pose already drives the blade into the defender; sparks belong on the visible length, so the zone ends
            // where the blade enters his body (0.3 m off his axis) and runs 0.4 m back toward the attacker's hand.
            const hand = weapon.localToWorld(new THREE.Vector3(0, 0, 0)), tip = weapon.localToWorld(new THREE.Vector3(0, contactRange.to, 0)), length = hand.distanceTo(tip) || 1;   // the grip to the tip: the whole visible length
            let entry = 1;
            for (let t = 0; t <= 1; t += 0.05) { const q = hand.clone().lerp(tip, t); if (Math.hypot(q.x - guard.x, q.z - guard.z) < 0.3) { entry = t; break; } }
            b = hand.clone().lerp(tip, Math.max(0.25, entry - 0.02)); a = b.clone().sub(tip.clone().sub(hand).multiplyScalar(Math.min(0.4, length * 0.35) / length));
          } else { const towardAttacker = new THREE.Vector3(attacker ? practice.enemy.x : state.x, 0, attacker ? practice.enemy.z : state.z).sub(new THREE.Vector3(guard.x, 0, guard.z)).normalize(); a = guard.clone().addScaledVector(towardAttacker, 0.2); b = guard.clone().addScaledVector(towardAttacker, 0.6); }
          clash.burst(a, b, attacker ? practice.enemy.heading : state.heading, strength);
          impact = 0; // the dedicated sparks replace the generic dots for this contact
        }
        sparks.position.set(
          hurt ? target.x : (state.x + practice.enemy.x) / 2,
          hurt ? (site === 'head' ? 1.55 : site === 'legs' ? 0.6 : 1.15) : 1.2,
          hurt ? target.z : (state.z + practice.enemy.z) / 2,
        );
        sparkMaterial.color.set(
          flesh ? (bloodMode === 'dark' ? '#3e2527' : '#a32b27') : kick || hurt ? '#b1a28a' : '#ffe4af',
        );
        sparkMaterial.blending = flesh || kick || hurt ? THREE.NormalBlending : THREE.AdditiveBlending;
        sparkMaterial.size = flesh ? (quietFinish ? 0.045 : 0.095) : 0.045;
        if (quietFinish && enemyHurt) {
          const neck = warriors?.opponent.boneWorld('neck_01');
          if (neck) sparks.position.copy(neck);
        }
        if (finisher === 'opened' && enemyHurt && warriors) {
          const hip = warriors.opponent.boneWorld('pelvis'),
            spine = warriors.opponent.boneWorld('spine_01');
          if (hip && spine) sparks.position.copy(hip.lerp(spine, 0.6));
        }
        if (flesh && !(killed && detailedBlood)) splats.splash(target, bloodMode);
        if (flesh) wounds.arm(enemyHurt ? 1 : 0, site); // the wound-site mark: refreshed, never stacked
        if (killed && flesh && !detailedBlood) {
          // the corpse keeps pooling after the splashes fade (cleared on rematch like everything else)
          splats.pool(target, bloodMode);
          blade.set(true, warriors, bloodMode, killed.actor as 0 | 1);
        }
        if (killed && flesh && detailedBlood) {
          impact = 0;
          blade.set(true, warriors, bloodMode, killed.actor as 0 | 1);
        }
      }
      lastHealth = practice.health;
      lastPlayerHealth = practice.playerHealth;
      clash.update(dt); // contact effects run on the frame's dt through a hit-stop, like the generic sparks and the camera kick
      impact = Math.max(0, impact - dt);
      sparks.visible = impact > 0;
      if (impact > 0) {
        const t = impactDuration - impact;
        sparkMaterial.opacity = impact / impactDuration;
        const spread = killSpray ? 0.9 : 2,
          drive = killSpray ? 2.8 : 1.5; // a kill: a tight cone driven along the heading
        for (let i = 0; i < 12; i++) {
          sparkPositions[i * 3] =
            (Math.sin(i * 2.4) * spread + (flesh ? Math.sin(impactHeading) * drive : 0)) * t;
          sparkPositions[i * 3 + 1] = Math.cos(i * 1.7) * t * 2 - t * t * 4;
          sparkPositions[i * 3 + 2] =
            (Math.cos(i * 2.4) * spread + (flesh ? Math.cos(impactHeading) * drive : 0)) * t;
        }
        sparkGeometry.attributes.position.needsUpdate = true;
      }
      splats.update(dt);
      wounds.update(dt, [state, practice.enemy], bloodMode);
      // The severed head (decapitation): gravity, a bounce or two, then a roll without slipping until friction stops it.
      if (severHead) {
        severHead.group.visible = bloodMode !== 'off';
        stepSeveredHead(severHead, dt);
      }
      const animationDt = frozen ? 0 : dt;
      arena.update(animationDt, events, rig.started ? camera : undefined);   // the crowd culls against the settled camera; the first frame draws everyone
      const dx = state.x - player.position.x,
        dz = state.z - player.position.z,
        ex = practice.enemy.x - opponent.position.x,
        ez = practice.enemy.z - opponent.position.z;
      const travel =
        rig.started && dt > 0 ? Math.hypot(state.x - player.position.x, state.z - player.position.z) / dt : 0;
      const enemyTravel =
        rig.started && dt > 0
          ? Math.hypot(practice.enemy.x - opponent.position.x, practice.enemy.z - opponent.position.z) / dt
          : 0;
      player.position.set(state.x, 0, state.z);
      opponent.position.set(practice.enemy.x, 0, practice.enemy.z);
      marker.position.set(practice.enemy.x, 0.04, practice.enemy.z);
      const playerDefence = defenceReaction(practice),
        enemyDefence = defenceReaction(practice, true);
      // Both actors present the same per-move combat state; the rig's clip and contact pose come from the simulation's data.
      const mine = actorPose(practice, 0),
        theirs = actorPose(practice, 1);
      // Run Through revision (owner 2026-09-18): the blade STAYS through the body. The killer holds the downward drive
      // (Fin_RunThrough, keyed to settle by a quarter of the window then hold) on the same 0.75× finisher clock; the
      // tableau freezes at progress 1 for as long as the corpse kneels (practice.finish holds until rematch).
      const runThroughHold = finisher === 'runThrough' && practice.finish?.victim === 1;
      // Owner 2026-09-18: savour the killshot — a cinematic finisher's corpse animates at 0.75× on a presentation clock that
      // may run past the sim window (the spec's "presentation may hold past the window": no simulation slow motion, the
      // 144-tick death and the hit-stop are untouched). A plain-death pick plays at full speed, exactly like an unadorned kill.
      if (!practice.finish) finishClock = -1;
      else if (finishClock < 0) finishClock = 0;
      else finishClock = Math.min(1, finishClock + (dt * 0.75) / (RULES.death / 60));
      const victimProgress = finisherPose && practice.finish?.victim === 1 ? finishClock : theirs.progress;
      warriors?.player.update(
        dx * Math.sin(state.heading) + dz * Math.cos(state.heading) < -0.0001 ? -travel : travel,
        animationDt,
        runThroughHold ? 'runThroughHold' : playerDefence?.pose || mine.pose,
        runThroughHold ? finishClock : (playerDefence?.progress ?? mine.progress),
        mine.attack,
        mine.contact,
        travel && dt ? (dx * Math.cos(state.heading) - dz * Math.sin(state.heading)) / (travel * dt) : 0,
        practice.result === 'blocked' ? (blockHeavy[0] ? 1.5 : 1) * Math.max(0, 1 - practice.resultAge / 12) : 0,
        practice.duel.fighters[0].guardDirection,
      );
      warriors?.opponent.update(
        ex * Math.sin(practice.enemy.heading) + ez * Math.cos(practice.enemy.heading) < -0.0001
          ? -enemyTravel
          : enemyTravel,
        animationDt,
        enemyDefence?.pose || (finisherPose ?? theirs.pose),
        enemyDefence?.progress ?? victimProgress,
        theirs.attack,
        theirs.contact,
        enemyTravel && dt
          ? (ex * Math.cos(practice.enemy.heading) - ez * Math.sin(practice.enemy.heading)) /
              (enemyTravel * dt)
          : 0,
        practice.result === 'enemyBlocked' ? (blockHeavy[1] ? 1.5 : 1) * Math.max(0, 1 - practice.resultAge / 12) : 0,
        practice.duel.fighters[1].guardDirection,
      );
      // Detailed finishers use their animated cut sites; the standing combat mark would float above a fallen body.
      if (detailedBlood) wounds.hide(1);
      if (finisher === 'opened' && practice.finish?.victim === 1) {
        warriors?.opponent.openWaist(victimProgress, bloodMode);
        wounds.hide(1);
      }
      if (finisher === 'splitCrown' && practice.finish?.victim === 1)
        warriors?.opponent.splitCrown(victimProgress, bloodMode);
      // Decapitation (owner 2026-09-18): when the seeded rotation picks it, the head comes off just after the skull-gives jolt
      // (the clip's first 9 %) — baked from the rig at that pose, popped along the killing blow, ballistic to a stop. Blood
      // 'off' keeps the head on: gore is presentation, like the rest of the layer.
      if (
        warriors &&
        finisher === 'decapitation' &&
        bloodMode !== 'off' &&
        !severHead &&
        practice.finish?.victim === 1 &&
        victimProgress >= 0.05 &&
        victimProgress < 1
      ) {
        const headCutPosition = warriors.opponent.boneWorld('neck_01')!;
        const built = warriors.opponent.sever();
        if (built) {
          const headCut = new THREE.Object3D();
          headCut.name = 'BloodHeadCut';
          headCut.position.copy(headCutPosition).sub(built.group.position);
          built.group.add(headCut);
          scene.add(built.group);
          // A short lateral fall clears the victor's silhouette in the original front camera.
          const axis = new THREE.Vector3(
            practice.enemy.x - state.x,
            0,
            practice.enemy.z - state.z,
          ).normalize();
          severHead = launchSeveredHead(built.group, built.radius, axis, killHeading);
        }
      }
      brass.color.set(practice.threat ? '#e7a35e' : '#ad9365');
      glows.forEach((glow, i) => {
        const f = practice.duel.fighters[i],
          at = i ? practice.enemy : state;
        glow.position.set(at.x, 1.2, at.z);
        glow.intensity =
          f.phase === 'attack' && f.charge ? (f.charged ? 8 : 1 + (4 * f.charge) / RULES.charge.min) : 0;
        glow.color.set(f.charged ? '#fff3d0' : '#ff9a3c');
      });
      marker.visible = practice.health > 0;
      if (practice.health) opponent.rotation.y = practice.enemy.heading;
      const blend = 1 - Math.exp(-dt * 8);
      heading += wrapAngle(state.heading - heading) * blend;
      if (['kick', 'attack', 'roll', 'guard', 'hurt', 'dead'].includes(practice.phase))
        heading = state.heading;
      player.rotation.y = heading;
      // Poses and headings must be final before aiming at the animated torso. Simulation positions stay untouched.
      const chest = runThroughHold ? warriors?.opponent.boneWorld('spine_02') : null;
      if (chest) warriors?.player.aimBladeAt(chest, Math.min(1, finishClock / 0.25));
      if (quietFinish && warriors)
        wounds.throatCut(warriors.opponent.boneWorld('neck_01')!, warriors.opponent.boneWorld('Head')!, practice.enemy.heading, finishClock, bloodMode);
      bloodSources =
        detailedBlood && warriors
          ? finisherBloodSources(finisher!, opponent, severHead?.group ?? null, practice.finish?.location)
          : [];
      finisherBlood.update(dt, detailedBlood ? finisher : null, victimProgress, bloodSources, bloodMode);
      // Read feet after the rigs and headings settle; only grounded locomotion kicks up sand.
      const canScuff = (pose: string, speed: number) =>
        ['sheathed', 'ready', 'guard'].includes(pose) && speed > 0.25 && speed < 6;
      footDust.update(
        animationDt,
        dustFeet.map((foot, i) => foot?.getWorldPosition(dustPositions[i]) ?? null),
        [
          canScuff(mine.pose, travel),
          canScuff(mine.pose, travel),
          canScuff(theirs.pose, enemyTravel),
          canScuff(theirs.pose, enemyTravel),
        ],
      );
      // Opened: measure how far the landed pieces reach from the fallen's origin (world bounds of torso, legs and the dropped
      // weapon), so the side view fits what actually landed. Monotonic — the camera only ever backs off, never creeps in.
      // Only while the pieces can still move (the victim clip places them until progress 1); after that the value is frozen —
      // a precise bounds traversal of the corpse meshes has no business running 60× a second while the player sits on the tableau.
      if (finisher === 'opened' && practice.finish?.victim === 1 && warriors && victimProgress < 1) {
        const pieces = warriors.opponent.anchor.getObjectByName('Opened');
        if (pieces?.visible) {
          const origin = warriors.opponent.anchor.getWorldPosition(new THREE.Vector3());
          for (const piece of pieces.children) {
            if (!piece.visible || !piece.children.length) continue;
            const box = new THREE.Box3().setFromObject(piece, true);
            if (box.isEmpty()) continue;
            for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) openedReach = Math.max(openedReach, Math.hypot(x - origin.x, z - origin.z));
          }
        }
      } else if (!practice.finish) openedReach = 0;
      rig.update(dt, state, practice.enemy, locked, practice.finish ? {
        finisher, posed: !!finisherPose, draw: !!practice.finish.draw, victim: practice.finish.victim, clock: finishClock,
        head: severHead ? { x: severHead.group.position.x, z: severHead.group.position.z } : null,
        big: ['wraith', 'minotaur'].includes(opponentId),
        reach: openedReach,
      } : null);
      const exposure = renderer.toneMappingExposure;
      if (dip > 0) renderer.toneMappingExposure = exposure * (1 - DIP_DEPTH * Math.min(1, dip / (DIP_FRAMES - 1)));   // held, then eased back
      renderer.render(scene, camera);
      renderer.toneMappingExposure = exposure;
      if (dip > 0 && dt > 0) dip--;
      rig.settle(dt);
    },
  };
}
