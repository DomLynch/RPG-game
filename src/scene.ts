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
import { bloodiesMaterial, createFinisherBlood, finisherBloodSources } from './finisher-blood.ts';
import { phoneTier } from './quality.ts';

export function cameraPose(
  state: State,
  yaw: number,
  pitch: number,
  locked: boolean,
  target: { x: number; z: number } = TARGET,
) {
  const distance = Math.hypot(state.x - target.x, state.z - target.z);
  // Duel lock sits ~30% closer and lower than the first pass; the distance terms still pull back to frame both fighters.
  const back = locked ? Math.max(4.2, distance * 0.62 + 2.8) : 7.5 * Math.cos(pitch);
  let x = state.x + Math.sin(yaw) * back,
    z = state.z + Math.cos(yaw) * back;
  // Camera stays inside the colonnade even when the fighter reaches the arena edge.
  const radius = Math.hypot(x, z);
  if (radius > 11.5) {
    x *= 11.5 / radius;
    z *= 11.5 / radius;
  }
  return {
    x,
    y: locked ? Math.max(3.2, distance * 1.3) : 1 + 7.5 * Math.sin(pitch),
    z,
    lookX: locked ? (state.x + target.x) / 2 : state.x,
    lookZ: locked ? (state.z + target.z) / 2 : state.z,
  };
}

// Late finisher reveal: a three-quarter side view, fitted to the phone's horizontal field of view.
// Choose the inward side from the frozen duel positions so the camera cannot switch sides as the corpse moves.
export function finisherSidePose(
  killer: { x: number; z: number },
  fallen: { x: number; z: number },
  aspect: number,
  finisher: 'runThrough' | 'splitCrown' | 'quietOne' | 'opened' = 'runThrough',
  bodyScale = 1,
) {
  const dx = fallen.x - killer.x,
    dz = fallen.z - killer.z,
    gap = Math.hypot(dx, dz) || 1;
  const ux = dx / gap,
    uz = dz / gap,
    lookX = (killer.x + fallen.x) / 2,
    lookZ = (killer.z + fallen.z) / 2;
  const back = Math.max(
    finisher === 'opened' ? 5.2 : finisher === 'quietOne' ? 4.5 : 3.8,
    (gap / 2 + (finisher === 'opened' ? 1.5 * bodyScale : finisher === 'quietOne' ? 1.5 : 0.42)) /
      (Math.tan((51 * Math.PI) / 360) * Math.min(aspect, 1)),
  );
  // Split Crown (owner 2026-09-20): the seam runs front-to-back over a head that bows toward the killer, so a profile
  // hides it — a raised front-quarter (45°, higher eye) looks down onto the opened crown past the killer's shoulder.
  const angle = finisher === 'splitCrown' ? Math.PI / 4 : finisher !== 'runThrough' ? Math.PI / 3 : (5 * Math.PI) / 12,
    sideward = Math.sin(angle),
    rearward = Math.cos(angle);
  const side = (sign: number, front = 1) => ({
    x: lookX + (-uz * sign * sideward - ux * rearward * front) * back,
    y: finisher === 'opened' ? 3.7 + 3 * (bodyScale - 1) : finisher === 'splitCrown' ? 4.2 : 3.1,
    z: lookZ + (ux * sign * sideward - uz * rearward * front) * back,
    lookX,
    lookY: 0.85,
    lookZ,
  });
  // Large halves need the inward front-quarter option when the killer stands against the wall;
  // clamping an outward rear view alone squeezes the corpse out of the portrait frame.
  const candidates =
    finisher === 'opened' && bodyScale > 1
      ? [side(1), side(-1), side(1, -1), side(-1, -1)]
      : [side(1), side(-1)];
  const pose = candidates.reduce((best, p) => (Math.hypot(p.x, p.z) < Math.hypot(best.x, best.z) ? p : best));
  const radius = Math.hypot(pose.x, pose.z);
  if (radius > 11.5) {
    pose.x *= 11.5 / radius;
    pose.z *= 11.5 / radius;
  }
  return pose;
}

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
  function rebuildEnvironment() {
    const environment = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    try {
      const target = pmrem.fromScene(environment, 0.04);
      environmentTarget?.dispose();
      environmentTarget = target;
      scene.environment = target.texture;
    } finally {
      environment.dispose();
      pmrem.dispose();
    }
  }
  rebuildEnvironment();
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
  const metal = new THREE.MeshStandardMaterial({ color: '#89949b', metalness: 0.72, roughness: 0.4 });
  // The target marker's brass is a combat tell (it warms on a threat); the arena has its own materials in arena.ts.
  const brass = new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.48 });
  scene.add(new THREE.HemisphereLight('#c9cfc6', '#4a4238', 1.6));
  const sun = new THREE.DirectionalLight('#ffe2b8', 4.2);
  sun.position.set(-15, 26, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(PHONE ? 512 : 1024, PHONE ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
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
  const ready = loadWarriors(
    fighterUrls['./assets/warrior.glb'],
    fighterUrls[`./assets/${ROSTER[opponentId].body}.glb`],
    weapons,
  )
    .then((loaded) => {
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
  const splats = Array.from({ length: 12 }, () => {
    const splat = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        color: '#591415',
        map: splatTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    splat.rotation.x = -Math.PI / 2;
    splat.visible = false;
    scene.add(splat);
    return { mesh: splat, life: 0, grow: 0 }; // grow: a kill pool spreads over ~2 s instead of appearing at once
  });
  let bloodMode: 'red' | 'dark' | 'off' = 'red',
    splatIndex = 0,
    impactDuration = 0.18,
    impactHeading = 0,
    flesh = false,
    killSpray = false;
  let finisherOverride: FinisherId | null = null; // dev/test pick (owner 2026-09-19): swap which finisher plays on a ceremonial kill; null = the spec's selection
  // Rotation memory (owner 2026-09-20: never the same ceremony twice in a row). `lastFinisher` is the ceremony the previous
  // fight showed and feeds this fight's pick; `fightFinisher` is this fight's, rolled into `lastFinisher` when the next
  // fight starts (practice.finish clears on rematch). Presentation state only — the simulation never sees it.
  let lastFinisher: FinisherId | null = null, fightFinisher: FinisherId | null = null;
  let impact = 0,
    lastHealth: number = RULES.health,
    lastPlayerHealth: number = RULES.health;
  // Decapitation (owner 2026-09-18): the severed head, its ballistic state, and the killing blow's heading (the pop direction).
  let severHead: {
      group: THREE.Group;
      velocity: THREE.Vector3;
      spin: THREE.Vector3;
      radius: number;
      resting: boolean;
    } | null = null,
    killHeading = 0;
  let finishClock = -1; // the finisher corpse animates at 0.75× on a presentation clock (owner 2026-09-18: savour it) — the sim window stays 144 ticks
  // Wound-site mark + drips (finishers & gore 2026-09-17): a small dark mark at the wound site with three drips below it,
  // living the four-second wound window (the sim's wound refreshes without stacking — so does the mark: a fresh hit on the
  // same fighter re-arms his decal). One pooled decal per fighter; hidden in 'off' like every blood effect.
  const wounds = [0, 1].map((side) => {
    const group = new THREE.Group();
    group.name = `Wound_${side}`;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.2),
      new THREE.MeshBasicMaterial({
        color: '#4a1213',
        map: splatTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const drips = [0, 1, 2].map((i) => {
      const drip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.014, 0.1),
        new THREE.MeshBasicMaterial({
          color: '#4a1213',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      drip.position.set((i - 1) * 0.045, -0.13, 0);
      group.add(drip);
      return drip;
    });
    group.add(mark);
    group.visible = false;
    scene.add(group);
    return { group, mark, drips, life: 0, side: 0 as 0 | 1, site: 'torso' as 'head' | 'torso' | 'legs' };
  });
  // Blood on the blade (finishers & gore 2026-09-17): the killer's weapon tints after a kill and stays bloodied until the next
  // fight. Materials are cloned before tinting so a shared GLB never bloodies both swords.
  const bladeOriginals = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  let bloodiedBlade = false,
    bloodiedSide: 0 | 1 = 0;
  function setBladeBlood(on: boolean, side: 0 | 1 = bloodiedSide) {
    bloodiedSide = side;
    if (!warriors) return;
    const anchors = on
      ? [side === 0 ? warriors.player.anchor : warriors.opponent.anchor]
      : [warriors.player.anchor, warriors.opponent.anchor];
    for (const anchor of anchors) {
      const twoHanded = anchor.getObjectByName('WeaponDrawn'),
        node = twoHanded ?? anchor.getObjectByName('SwordDrawn');
      node?.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial))
          return;
        if (!bloodiesMaterial(object.material.name, !!twoHanded)) return; // the blade, never the haft
        const original = bladeOriginals.get(object) ?? (object.material as THREE.MeshStandardMaterial);
        if (on) {
          if (!bladeOriginals.has(object)) {
            bladeOriginals.set(object, object.material as THREE.MeshStandardMaterial);
            object.material = object.material.clone();
          }
          (object.material as THREE.MeshStandardMaterial).color
            .copy(original.color)
            .lerp(new THREE.Color(bloodMode === 'dark' ? '#2a1516' : '#7a1410'), 0.55);
        } else if (bladeOriginals.has(object)) {
          object.material.dispose();
          object.material = original;
          bladeOriginals.delete(object);
        }
      });
    }
    bloodiedBlade = on;
  }
  let finishPush = 0; // the authorized slow dolly over the death window (0 = off; respects prefers-reduced-motion)
  const desired = new THREE.Vector3(),
    look = new THREE.Vector3(),
    aim = new THREE.Vector3(0, 1, 0),
    spinAxis = new THREE.Vector3();
  let yaw = 0,
    pitch = 0.45,
    heading = Math.PI,
    started = false;
  // Camera kick: a blow nudges the camera a few centimetres along the blow's heading and it settles in ~0.15 s. Small on purpose
  // (readable brutality: nothing may obscure a pose); off when the viewer prefers reduced motion. Placeholder for the visual lane's impact pass.
  const stillCamera =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The kick is a world-space offset scaled by `kick` (1 → 0): a landing blow drops the camera and shoves it a little along the blow; a parry
  // flicks it sideways with the deflection. A push along the blow alone is a dolly down the view axis and reads as nothing on screen.
  let kick = 0,
    kickHold = 0, // a heavy-class contact holds its full displacement for two frames before settling: the weight lands, then the camera recovers
    kickRate = 1 / 0.15, // 1/s: how fast the offset settles
    shoved = 0; // the kick applied to the camera for the last draw; taken off before the next frame's settle so it never compounds
  const kickOffset = new THREE.Vector3();
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
      for (const splat of splats) {
        splat.life = 0;
        splat.grow = 0;
        splat.mesh.visible = false;
      }
      if (flesh) {
        impact = 0;
        sparks.visible = false;
      }
      if (mode === 'off') setBladeBlood(false);
      else if (bloodiedBlade) {
        bloodiedBlade = false;
        setBladeBlood(true);
      }
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
      return yaw;
    },
    orbit(dx: number, dy: number) {
      yaw -= dx * 0.005;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.22, 0.9);
    },
    recenter() {
      yaw = 0;
      pitch = 0.45;
      started = false;
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
        for (const splat of splats) {
          splat.life = 0;
          splat.grow = 0;
        }
        for (const wound of wounds) wound.life = 0;
        setBladeBlood(false);
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
      if (shoveEvent && shove && dt > 0 && !stillCamera) {
        // The blow's heading: a landed blow carries it; a block or parry takes the attacker's facing (the attacker is the event's target).
        const heading = shoveEvent.heading ?? (shoveEvent.target && !blow ? practice.enemy.heading : state.heading);
        kickOffset.set(Math.sin(heading) * shove.along + Math.cos(heading) * shove.side, -shove.drop, Math.cos(heading) * shove.along - Math.sin(heading) * shove.side);
        kick = 1;
        kickHold = shove.hold;
        kickRate = 1 / shove.settle;
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
          // The blades meet at the defender's guard: a third of a metre in front of his chest toward the attacker's hand, at the height the
          // attacking blade is passing (on the contact tick the rig's blade already reaches into the defender's body, so its own points are not the meeting point).
          const defenderBody = attacker ? state : practice.enemy,
            hand = weapon?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(attacker ? practice.enemy.x : state.x, 1.1, attacker ? practice.enemy.z : state.z),
            bladeHeight = weapon && contactRange ? (weapon.localToWorld(new THREE.Vector3(0, contactRange.from, 0)).y + weapon.localToWorld(new THREE.Vector3(0, contactRange.to, 0)).y) / 2 : 1.15;
          const at = new THREE.Vector3(defenderBody.x, 0, defenderBody.z);
          at.add(hand.clone().setY(0).sub(at).normalize().multiplyScalar(0.35)).setY(Math.min(1.6, Math.max(0.8, bladeHeight)));
          clash.burst(at, attacker ? practice.enemy.heading : state.heading, strength);
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
        if (flesh && !(killed && detailedBlood)) {
          const splat = splats[splatIndex++ % splats.length];
          splat.life = 20;
          splat.grow = 0;
          splat.mesh.position.set(target.x, 0.022 + (splatIndex % 12) * 0.0001, target.z);
          splat.mesh.scale.set(0.22 + (splatIndex % 3) * 0.05, 0.13 + (splatIndex % 4) * 0.035, 1);
          splat.mesh.rotation.z = splatIndex * 2.4;
          splat.mesh.material.color.set(bloodMode === 'dark' ? '#352426' : '#681a19');
        }
        if (flesh) {
          const wound = wounds[enemyHurt ? 1 : 0];
          wound.life = 4;
          wound.side = enemyHurt ? 1 : 0;
          wound.site = site;
        } // the wound-site mark: refreshed, never stacked
        if (killed && flesh && !detailedBlood) {
          // the corpse keeps pooling after the splashes fade (cleared on rematch like everything else)
          const pool = splats[splatIndex++ % splats.length];
          pool.life = 1e9;
          pool.grow = 1e-6;
          pool.mesh.position.set(target.x, 0.03, target.z);
          pool.mesh.rotation.z = splatIndex * 2.4;
          pool.mesh.scale.set(0.3, 0.2, 1);
          pool.mesh.material.color.set(bloodMode === 'dark' ? '#352426' : '#681a19');
          setBladeBlood(true, killed.actor as 0 | 1);
        }
        if (killed && flesh && detailedBlood) {
          impact = 0;
          setBladeBlood(true, killed.actor as 0 | 1);
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
      for (const splat of splats) {
        splat.life = Math.max(0, splat.life - dt);
        splat.mesh.visible = splat.life > 0;
        if (splat.life > 1e8) {
          splat.grow = Math.min(1, splat.grow + dt / 2.2);
          splat.mesh.scale.set(0.3 + 0.7 * splat.grow, (0.2 + 0.55 * splat.grow) * 0.8, 1);
          splat.mesh.material.opacity = 0.7 * splat.grow;
        } // the kill pool spreads
        else splat.mesh.material.opacity = Math.min(0.65, splat.life / 4);
      }
      for (const wound of wounds) {
        // the wound-site mark rides the wounded fighter for his four-second window
        if (wound.life > 0) {
          wound.life = Math.max(0, wound.life - dt);
          const body = wound.side === 1 ? practice.enemy : state;
          wound.group.position.set(
            body.x,
            wound.site === 'head' ? 1.55 : wound.site === 'legs' ? 0.6 : 1.15,
            body.z,
          );
          wound.group.rotation.set(0, body.heading, 0);
          wound.mark.scale.set(1, 1, 1);
          const fade = Math.min(1, wound.life),
            seep = Math.min(1, (4 - wound.life) / 1.2); // drips run in the first ~1.2 s, the mark fades over the last
          const tone = bloodMode === 'dark' ? '#241314' : '#4a1213';
          wound.mark.material.color.set(tone);
          wound.mark.material.opacity = 0.55 * fade;
          wound.drips.forEach((drip, i) => {
            drip.position.set((i - 1) * 0.045, -0.13, 0);
            drip.material.color.set(tone);
            drip.material.opacity = 0.5 * fade * seep;
            drip.scale.set(1, 0.4 + 0.6 * seep, 1);
          });
          wound.group.visible = bloodMode !== 'off' && wound.life > 0;
        } else wound.group.visible = false;
      }
      // The severed head (decapitation): gravity, a bounce or two, then a roll without slipping until friction stops it.
      if (severHead) {
        severHead.group.visible = bloodMode !== 'off';
        const head = severHead;
        if (!head.resting && dt > 0) {
          head.velocity.y -= 12 * dt; // a touch heavier than life: reads on a phone screen
          head.group.position.addScaledVector(head.velocity, dt);
          const rate = head.spin.length();
          if (rate > 0) {
            spinAxis.copy(head.spin).multiplyScalar(1 / rate);
            head.group.rotateOnWorldAxis(spinAxis, rate * dt);
          }
          if (head.group.position.y < head.radius) {
            head.group.position.y = head.radius;
            const speed = Math.hypot(head.velocity.x, head.velocity.z);
            if (head.velocity.y < -1) {
              head.velocity.y = -head.velocity.y * 0.28;
              head.velocity.x *= 0.68;
              head.velocity.z *= 0.68;
            } // a real bounce
            else {
              head.velocity.y = 0;
              const decay = Math.max(0, 1 - 2.1 * dt);
              head.velocity.x *= decay;
              head.velocity.z *= decay; // rolling friction
              if (speed > 0.05)
                head.spin.set(head.velocity.z / head.radius, 0, -head.velocity.x / head.radius);
              else {
                head.resting = true;
              }
            }
          }
        }
      }
      const animationDt = frozen ? 0 : dt;
      arena.update(animationDt, events);
      const dx = state.x - player.position.x,
        dz = state.z - player.position.z,
        ex = practice.enemy.x - opponent.position.x,
        ez = practice.enemy.z - opponent.position.z;
      const travel =
        started && dt > 0 ? Math.hypot(state.x - player.position.x, state.z - player.position.z) / dt : 0;
      const enemyTravel =
        started && dt > 0
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
      );
      // Detailed finishers use their animated cut sites; the standing combat mark would float above a fallen body.
      if (detailedBlood) wounds[1].group.visible = false;
      if (finisher === 'opened' && practice.finish?.victim === 1) {
        warriors?.opponent.openWaist(victimProgress, bloodMode);
        wounds[1].group.visible = false;
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
          severHead = {
            group: built.group,
            velocity: new THREE.Vector3(-axis.z * 1.1, 1.8, axis.x * 1.1),
            spin: new THREE.Vector3(Math.cos(killHeading), 0, -Math.sin(killHeading)).multiplyScalar(9),
            radius: built.radius,
            resting: false,
          };
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
      if (locked) {
        const lockYaw = Math.atan2(state.x - practice.enemy.x, state.z - practice.enemy.z);
        yaw += wrapAngle(lockYaw - yaw) * blend;
      }
      const cameraTarget = cameraPose(state, yaw, pitch, locked, practice.enemy);
      look.set(cameraTarget.lookX, locked ? 0.8 : 1, cameraTarget.lookZ);
      desired.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
      // The authorized slow push-in over the death window (finishers & gore 2026-09-17): a dolly toward the fallen, never a cut,
      // never an FOV change. Off when the viewer prefers reduced motion; the frame loop's hit-stop stays the one impact pause.
      // Paced to the slowed finisher clock (1.3 s / 0.75); a plain-death pick gets no dolly — an ordinary kill stays ordinary.
      if (practice.finish && finisherPose && !practice.finish.draw && !stillCamera)
        finishPush = Math.min(1, finishPush + dt / (1.3 / 0.75));
      else if (!practice.finish) finishPush = 0;
      if (finishPush > 0) {
        const fallen = practice.finish!.victim === 1 ? practice.enemy : state;
        const killer = practice.finish!.victim === 1 ? state : practice.enemy;
        // Owner phone review 2026-09-20: Decapitation keeps its front view — no push-in and no look change, so the
        // detached head stays in frame (#167) — but slides to camera-right so the killer's back stops hiding the corpse.
        const push = finisher === 'decapitation' ? 0 : 0.38,
          slide = finisher === 'decapitation' ? 0.8 : 0.95,
          turn = finisher === 'decapitation' ? 0.85 : 0.6;
        desired.x += (fallen.x - desired.x) * push * finishPush;
        desired.z += (fallen.z - desired.z) * push * finishPush;
        // Framing tune (same authorized dolly — still no cut, no FOV, no slow-mo): slide the camera laterally off the
        // killer→fallen axis and a touch higher, so the settled frame reads the kneeling corpse past the killer's
        // shoulder instead of hiding it behind his back.
        const axisX = fallen.x - killer.x,
          axisZ = fallen.z - killer.z,
          axisLen = Math.hypot(axisX, axisZ) || 1;
        desired.x += (-axisZ / axisLen) * slide * finishPush;
        desired.z += (axisX / axisLen) * slide * finishPush;
        // The look turns onto the fallen for every finisher: with the slide, the killer reads left and the corpse centre.
        // Decapitation looks at the midpoint of corpse and severed head — the head lands beside the corpse wherever the
        // blow sent it, and framing the corpse alone left it at the portrait edge (deploy gate, trunk 63f4cd9).
        const focusX = severHead ? (fallen.x + severHead.group.position.x) / 2 : fallen.x,
          focusZ = severHead ? (fallen.z + severHead.group.position.z) / 2 : fallen.z;
        look.x += (focusX - look.x) * turn * finishPush;
        look.z += (focusZ - look.z) * turn * finishPush;
        if (push) {
          desired.y += (1.55 - desired.y) * 0.3 * finishPush;
          look.y += (0.8 - look.y) * 0.7 * finishPush;
        }
      }
      heading += wrapAngle(state.heading - heading) * blend;
      if (['kick', 'attack', 'roll', 'guard', 'hurt', 'dead'].includes(practice.phase))
        heading = state.heading;
      player.rotation.y = heading;
      // Poses and headings must be final before aiming at the animated torso. Simulation positions stay untouched.
      const chest = runThroughHold ? warriors?.opponent.boneWorld('spine_02') : null;
      if (chest) warriors?.player.aimBladeAt(chest, Math.min(1, finishClock / 0.25));
      if (quietFinish && warriors) {
        // Reuse the pooled wound at the animated neck: a narrow cut, covered partly by the clutching hand.
        const neck = warriors.opponent.boneWorld('neck_01')!,
          head = warriors.opponent.boneWorld('Head')!;
        const up = head.clone().sub(neck).normalize(),
          forward = new THREE.Vector3(Math.sin(practice.enemy.heading), 0, Math.cos(practice.enemy.heading));
        forward.addScaledVector(up, -forward.dot(up)).normalize();
        const size = head.distanceTo(neck) / 0.075,
          wound = wounds[1];
        wound.life = 4;
        wound.group.position.copy(neck).addScaledVector(forward, 0.075 * size);
        wound.group.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(up.clone().cross(forward), up, forward),
        );
        wound.mark.scale.set(0.85 * size, 0.14 * size, 1);
        wound.mark.material.opacity = 0.82;
        const tone = bloodMode === 'dark' ? '#241314' : '#581017';
        wound.mark.material.color.set(tone);
        wound.drips.forEach((drip, i) => {
          drip.position.set((i - 1) * 0.025 * size, -0.05 * size, 0);
          drip.scale.set(0.55, 0.5 * size, 1);
          drip.material.color.set(tone);
          drip.material.opacity = 0.6 * Math.min(1, finishClock / 0.25);
        });
        wound.group.visible = bloodMode !== 'off';
      }
      bloodSources =
        detailedBlood && warriors
          ? finisherBloodSources(finisher!, opponent, severHead?.group ?? null, practice.finish?.location)
          : [];
      finisherBlood.update(dt, detailedBlood ? finisher : null, victimProgress, bloodSources, bloodMode);
      if (
        locked &&
        !stillCamera &&
        practice.finish?.victim === 1 &&
        (finisher === 'runThrough' ||
          finisher === 'splitCrown' ||
          finisher === 'quietOne' ||
          finisher === 'opened')
      ) {
        const t = THREE.MathUtils.clamp(
            finisher === 'opened'
              ? (finishClock - 0.04) / (['wraith', 'minotaur'].includes(opponentId) ? 0.6 : 0.4)
              : finisher === 'quietOne'
                ? (finishClock - 0.12) / 0.43
                : (finishClock - 0.45) / 0.55,
            0,
            1,
          ),
          reveal = t * t * (3 - 2 * t);
        const side = finisherSidePose(
          state,
          practice.enemy,
          camera.aspect,
          finisher,
          ['wraith', 'minotaur'].includes(opponentId) ? 1.5 : 1,
        );
        desired.lerp(new THREE.Vector3(side.x, side.y, side.z), reveal);
        look.lerp(new THREE.Vector3(side.lookX, side.lookY, side.lookZ), reveal);
        const radius = Math.hypot(desired.x, desired.z);
        if (radius > 11.5) {
          desired.x *= 11.5 / radius;
          desired.z *= 11.5 / radius;
        }
      }
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
      camera.position.addScaledVector(kickOffset, -shoved); // last draw's shove comes off before the settle
      shoved = 0;
      camera.position.lerp(desired, started ? blend : 1);
      aim.lerp(look, started ? blend : 1);
      camera.lookAt(aim);
      started = true;
      // The kick is applied after the look-at (so the frame itself shifts) and stays on the camera until the next frame takes it off
      // before settling — a shove left inside the lerped position would compound.
      shoved = kick;
      camera.position.addScaledVector(kickOffset, shoved);
      const exposure = renderer.toneMappingExposure;
      if (dip > 0) renderer.toneMappingExposure = exposure * (1 - DIP_DEPTH * Math.min(1, dip / (DIP_FRAMES - 1)));   // held, then eased back
      renderer.render(scene, camera);
      renderer.toneMappingExposure = exposure;
      if (dip > 0 && dt > 0) dip--;
      if (kick > 0) {
        if (kickHold > 0) kickHold -= dt;
        else kick = Math.max(0, kick - dt * kickRate);
      }
    },
  };
}
