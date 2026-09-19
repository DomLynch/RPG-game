import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { defenceReaction, loadWarriors } from './characters.ts';
import { actorPose, initialPractice, type CombatEvent, type Practice } from './combat.ts';
import { OPPONENTS, RULES, type OpponentId, type WeaponId } from './moves.ts';
import { FINISHER_POSE, selectFinisher, type FinisherId } from './finishers.ts';
import { TARGET, wrapAngle, type State } from './sim.ts';
import { buildArena } from './arena.ts';
import { phoneTier } from './quality.ts';

export function cameraPose(state: State, yaw: number, pitch: number, locked: boolean, target: { x: number; z: number } = TARGET) {
  const distance = Math.hypot(state.x - target.x, state.z - target.z);
  // Duel lock sits ~30% closer and lower than the first pass; the distance terms still pull back to frame both fighters.
  const back = locked ? Math.max(4.2, distance * 0.62 + 2.8) : 7.5 * Math.cos(pitch);
  let x = state.x + Math.sin(yaw) * back, z = state.z + Math.cos(yaw) * back;
  // Camera stays inside the colonnade even when the fighter reaches the arena edge.
  const radius = Math.hypot(x, z);
  if (radius > 11.5) { x *= 11.5 / radius; z *= 11.5 / radius; }
  return {
    x, y: locked ? Math.max(3.2, distance * 1.3) : 1 + 7.5 * Math.sin(pitch), z,
    lookX: locked ? (state.x + target.x) / 2 : state.x,
    lookZ: locked ? (state.z + target.z) / 2 : state.z,
  };
}

// One GLB per opponent (moves.ts `OpponentId`); only the hero and the man he faces are ever loaded.
const OPPONENT_GLB: Record<OpponentId, string> = { veteran: new URL('./assets/veteran.glb', import.meta.url).href, pitborn: new URL('./assets/pitborn.glb', import.meta.url).href, nightborn: new URL('./assets/nightborn.glb', import.meta.url).href, goblin: new URL('./assets/goblin.glb', import.meta.url).href, executioner: new URL('./assets/executioner.glb', import.meta.url).href };
export function createScene(canvas: HTMLCanvasElement, assetStatus: (status: string) => void = () => {}, opponentId: OpponentId = 'veteran') {
  // Phone tier (the owner's iPhone GPU-pressure defect, 2026-09-18): cap the backing store at 1.25× and the
  // shadow map at 512² — the MSAA framebuffer at 1.5× on a ~1170×2532-class phone is ~200 MB of GPU memory.
  const PHONE = phoneTier(), PIXEL_CAP = PHONE ? 1.25 : 1.5;
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
    const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    try {
      const target = pmrem.fromScene(environment, 0.04);
      environmentTarget?.dispose(); environmentTarget = target; scene.environment = target.texture;
    } finally { environment.dispose(); pmrem.dispose(); }
  }
  rebuildEnvironment(); scene.environmentIntensity = 0.45;
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
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object);
    return object;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent: THREE.Object3D = scene) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  const arena = buildArena(scene);
  function capsule(x: number, z: number, material: THREE.Material) {
    const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z);
    mesh(new THREE.CapsuleGeometry(0.31, 1.12, 6, 14), material, 0, 0.88, 0, group);
    const band = mesh(new THREE.TorusGeometry(0.315, 0.025, 5, 20), brass, 0, 0.8, 0, group); band.rotation.x = Math.PI / 2;
    box(0.055, 0.85, 0.065, 0, 0.95, 0.305, brass, group);
    return group;
  }
  const player = capsule(0, 4, metal);
  const opponent = capsule(TARGET.x, TARGET.z, new THREE.MeshStandardMaterial({ color: '#6d5447', roughness: 0.8, metalness: 0.25 }));
  let warriors: Awaited<ReturnType<typeof loadWarriors>> | undefined;
  assetStatus('Loading warriors…');
  // The player, and the chosen opponent; each rig plays the clips of the weapon the simulation gives that side (moves.ts OPPONENTS, duel.ts initialDuel).
  const weapons = initialPractice(731, OPPONENTS[opponentId]).duel.fighters.map(f => f.weapon) as [WeaponId, WeaponId];
  const ready = loadWarriors(new URL('./assets/warrior.glb', import.meta.url).href, OPPONENT_GLB[opponentId], weapons).then(loaded => {
    warriors = loaded;
    for (const proxy of [player, opponent]) {
      proxy.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      proxy.clear();
    }
    player.add(loaded.player.anchor); opponent.add(loaded.opponent.anchor);
    assetStatus('');
  }).catch(error => {
    captureException(error);
    assetStatus('Warrior art could not load. Movement still works; reload to retry.');
  });
  const marker = mesh(new THREE.RingGeometry(0.56, 0.59, 48), brass, TARGET.x, 0.04, TARGET.z);
  marker.rotation.x = -Math.PI / 2; marker.castShadow = false;
  // Two original alpha sprites, generated once; all impacts reuse the same GPU resources.
  function impactTexture(splash: boolean) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    const fill=ctx.createRadialGradient(64,64,8,64,64,58);fill.addColorStop(0,'#ffffffff');fill.addColorStop(.75,'#ffffffcc');fill.addColorStop(1,'#ffffff00');ctx.fillStyle=fill;
    ctx.beginPath();
    for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,r=splash ? 33+Math.sin(angle*7)*6+Math.cos(angle*11)*4 : 48;const x=64+Math.cos(angle)*r,y=64+Math.sin(angle)*r*(splash ? 1 : .65);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.closePath();ctx.fill();
    if(splash)for(let i=0;i<17;i++){const a=i*2.4,r=42+i%4*4;ctx.beginPath();ctx.ellipse(64+Math.cos(a)*r,64+Math.sin(a)*r,1.5+i%3,1+i%2,a,0,Math.PI*2);ctx.fill();}
    return new THREE.CanvasTexture(canvas);
  }
  const dropTexture=impactTexture(false),splatTexture=impactTexture(true);
  const sparkPositions = new Float32Array(12 * 3), sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ color: '#ffe4af', map: dropTexture, alphaTest:.02, size: .045, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial); sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  // Charge glow: a warm light on a fighter holding a heavy, white once the hold has charged. Placeholder for the visual lane's charge VFX.
  const glows = [0, 1].map(() => { const light = new THREE.PointLight('#ff9a3c', 0, 3, 2); light.castShadow = false; scene.add(light); return light; });
  const splats = Array.from({length:12},()=>{
    const splat = new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:'#591415',map:splatTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
    splat.rotation.x=-Math.PI/2; splat.visible=false; scene.add(splat); return {mesh:splat,life:0,grow:0};   // grow: a kill pool spreads over ~2 s instead of appearing at once
  });
  let bloodMode: 'red' | 'dark' | 'off' = 'red', splatIndex=0, impactDuration=.18, impactHeading=0, flesh=false, killSpray=false;
let finisherOverride: FinisherId | null = null;   // dev/test pick (owner 2026-09-19): swap which finisher plays on a ceremonial kill; null = the spec's selection
  let impact = 0, lastHealth: number = RULES.health, lastPlayerHealth: number = RULES.health;
  // Decapitation (owner 2026-09-18): the severed head, its ballistic state, and the killing blow's heading (the pop direction).
  let severHead: { group: THREE.Group; velocity: THREE.Vector3; spin: THREE.Vector3; radius: number; resting: boolean } | null = null, killHeading = 0;
  let finishClock = -1;   // the finisher corpse animates at 0.75× on a presentation clock (owner 2026-09-18: savour it) — the sim window stays 144 ticks
  // Wound-site mark + drips (finishers & gore 2026-09-17): a small dark mark at the wound site with three drips below it,
  // living the four-second wound window (the sim's wound refreshes without stacking — so does the mark: a fresh hit on the
  // same fighter re-arms his decal). One pooled decal per fighter; hidden in 'off' like every blood effect.
  const wounds = [0, 1].map(() => {
    const group = new THREE.Group();
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(.15, .2), new THREE.MeshBasicMaterial({ color: '#4a1213', map: splatTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    const drips = [0, 1, 2].map(i => { const drip = new THREE.Mesh(new THREE.PlaneGeometry(.014, .1), new THREE.MeshBasicMaterial({ color: '#4a1213', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); drip.position.set((i - 1) * .045, -.13, 0); group.add(drip); return drip; });
    group.add(mark); group.visible = false; scene.add(group);
    return { group, mark, drips, life: 0, side: 0 as 0 | 1, site: 'torso' as 'head' | 'torso' | 'legs' };
  });
  // Blood on the blade (finishers & gore 2026-09-17): the killer's weapon tints after a kill and stays bloodied until the next
  // fight. Materials are cloned before tinting so a shared GLB never bloodies both swords.
  const bladeOriginals = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  let bloodiedBlade = false, bloodiedSide: 0 | 1 = 0;
  function setBladeBlood(on: boolean, side: 0 | 1 = bloodiedSide) {
    bloodiedSide = side;
    if (!warriors) return;
    const anchors = on ? [side === 0 ? warriors.player.anchor : warriors.opponent.anchor] : [warriors.player.anchor, warriors.opponent.anchor];
    for (const anchor of anchors) {
      const twoHanded = anchor.getObjectByName('WeaponDrawn'), node = twoHanded ?? anchor.getObjectByName('SwordDrawn');
      node?.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
        if (!twoHanded && object.material.name !== 'Blade') return;   // a sword bloodies its blade only; a one-piece weapon tints whole
        const original = bladeOriginals.get(object) ?? object.material as THREE.MeshStandardMaterial;
        if (on) {
          if (!bladeOriginals.has(object)) { bladeOriginals.set(object, object.material as THREE.MeshStandardMaterial); object.material = object.material.clone(); }
          (object.material as THREE.MeshStandardMaterial).color.copy(original.color).lerp(new THREE.Color(bloodMode === 'dark' ? '#2a1516' : '#7a1410'), .55);
        } else if (bladeOriginals.has(object)) { object.material.dispose(); object.material = original; bladeOriginals.delete(object); }
      });
    }
    bloodiedBlade = on;
  }
  let finishPush = 0;   // the authorized slow dolly over the death window (0 = off; respects prefers-reduced-motion)
  const desired = new THREE.Vector3(), look = new THREE.Vector3(), aim = new THREE.Vector3(0, 1, 0), spinAxis = new THREE.Vector3();
  let yaw = 0, pitch = 0.45, heading = Math.PI, started = false;
  // Camera kick: a blow nudges the camera a few centimetres along the blow's heading and it settles in ~0.15 s. Small on purpose
  // (readable brutality: nothing may obscure a pose); off when the viewer prefers reduced motion. Placeholder for the visual lane's impact pass.
  const stillCamera = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let kick = 0, kickHeading = 0;
  let ratio = Math.min(devicePixelRatio, PIXEL_CAP);   // the context-loss recovery path lowers this to 1 from the tier's ceiling
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
  resize(); window.addEventListener('resize', resize);
  return {
    renderer, ready, arena,
    setBloodMode(mode: 'red' | 'dark' | 'off') { bloodMode=mode; for (const splat of splats) { splat.life=0;splat.grow=0;splat.mesh.visible=false; } if (flesh) { impact=0;sparks.visible=false; } if (mode==='off') setBladeBlood(false); else if (bloodiedBlade) { bloodiedBlade=false; setBladeBlood(true); } },
    setFinisherOverride(id: FinisherId | null) { finisherOverride = id; },
    get yaw() { return yaw; },
    orbit(dx: number, dy: number) { yaw -= dx * 0.005; pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.22, 0.9); },
    recenter() { yaw = 0; pitch = 0.45; started = false; },
    lowerResolution() { if (ratio > 1) { ratio = 1; renderer.setPixelRatio(ratio); resize(); } },
    restoreGraphics() { this.lowerResolution(); rebuildEnvironment(); },
    // Debug probe: where the player's blade tip was drawn this frame (world metres), so a frame-by-frame check can see a held or moving pose.
    // World → CSS pixels for DOM overlays (damage numbers). Null when the point is behind the camera.
    project(point: [number, number, number]): [number, number] | null {
      const v = new THREE.Vector3(point[0], point[1], point[2]).project(camera);
      if (v.z > 1) return null;
      return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
    },
    playing(): string { return warriors ? `${warriors.player.playing()} ${warriors.opponent.playing()}` : ''; },   // debug probe: what each rig plays
    bladeTip(): [number, number, number] | null { const anchor = warriors?.player.anchor, drawn = anchor?.getObjectByName('WeaponDrawn') ?? anchor?.getObjectByName('SwordDrawn'); if (!drawn) return null; player.updateWorldMatrix(true, true); const tip = drawn.localToWorld(new THREE.Vector3(0, (drawn.userData.contact as { to: number } | undefined)?.to ?? .86, 0)); return [tip.x, tip.y, tip.z]; },
    // Effects consume the simulation's events for the frame; they never infer contact from animation.
    // `frozen`: the frame loop is in a hit-stop. Effects (sparks, blood, camera kick) keep running on dt; the rigs evaluate their pose for the
    // frozen tick without advancing their clocks — the one impact pause is the frame loop's.
    render(state: State, locked: boolean, dt: number, practice: Practice, events: CombatEvent[] = practice.events, frozen = false) {
      const blow = events.find(e => e.type === 'Hit' || e.type === 'GuardBroken'), contact = blow || events.some(e => e.type === 'Blocked' || e.type === 'Parried');
      const killed = events.find(e => e.type === 'Killed');
      if (practice.health===practice.enemyMaxHealth && practice.playerHealth===practice.maxHealth && (lastHealth<practice.enemyMaxHealth || lastPlayerHealth<practice.maxHealth)) { impact=0; for(const splat of splats) { splat.life=0; splat.grow=0; } for(const wound of wounds) wound.life=0; setBladeBlood(false); if (severHead) { scene.remove(severHead.group); severHead.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); severHead = null; } warriors?.player.unsever(); warriors?.opponent.unsever(); }   // a fresh match: both bars full again
      if (blow && dt > 0 && !stillCamera) { const heavy = blow.charged || blow.move === 'heavy_overhead' || blow.move === 'heavy_riposte' || blow.move === 'heavy_counter' || blow.move === 'critical' || blow.type === 'GuardBroken'; kick = heavy ? .045 : .02; kickHeading = blow.heading ?? state.heading; }
      if (contact && dt > 0) {
        const enemyHurt=blow?.target===1, hurt=!!blow;
        const kick=blow?.move==='kick'; flesh=hurt && !kick && bloodMode!=='off';
        impactDuration=flesh && killed ? .55 : flesh ? .34 : .18; impact=impactDuration; impactHeading=blow?.heading ?? state.heading;
        killSpray=!!(killed && flesh);   // a kill sprays a cone along the strike heading, not the radial puff
        if (killed && flesh) killHeading = blow?.heading ?? state.heading;   // the decapitation pop flies the way the blow did
        const site=enemyHurt ? practice.enemyWoundSite : practice.woundSite;
        const target=enemyHurt ? practice.enemy : state;
        sparks.position.set(hurt ? target.x : (state.x+practice.enemy.x)/2,hurt ? (site==='head' ? 1.55 : site==='legs' ? .6 : 1.15) : 1.2,hurt ? target.z : (state.z+practice.enemy.z)/2);
        sparkMaterial.color.set(flesh ? (bloodMode==='dark' ? '#3e2527' : '#a32b27') : kick || hurt ? '#b1a28a' : '#ffe4af');
        sparkMaterial.blending=flesh || kick || hurt ? THREE.NormalBlending : THREE.AdditiveBlending; sparkMaterial.size=flesh ? .095 : .045;
        if(flesh) { const splat=splats[splatIndex++%splats.length]; splat.life=20; splat.grow=0; splat.mesh.position.set(target.x,.022+splatIndex%12*.0001,target.z); splat.mesh.scale.set(.22+(splatIndex%3)*.05,.13+(splatIndex%4)*.035,1); splat.mesh.rotation.z=splatIndex*2.4;splat.mesh.material.color.set(bloodMode==='dark' ? '#352426' : '#681a19'); }
        if (flesh) { const wound = wounds[enemyHurt ? 1 : 0]; wound.life = 4; wound.side = enemyHurt ? 1 : 0; wound.site = site; }   // the wound-site mark: refreshed, never stacked
        if (killed && flesh) {   // the corpse keeps pooling after the splashes fade (cleared on rematch like everything else)
          const pool=splats[splatIndex++%splats.length]; pool.life=1e9; pool.grow=1e-6; pool.mesh.position.set(target.x,.03,target.z); pool.mesh.rotation.z=splatIndex*2.4; pool.mesh.scale.set(.3,.2,1); pool.mesh.material.color.set(bloodMode==='dark' ? '#352426' : '#681a19');
          setBladeBlood(true, killed.actor as 0 | 1);
        }
      }
      lastHealth = practice.health; lastPlayerHealth = practice.playerHealth;
      impact = Math.max(0, impact - dt); sparks.visible = impact > 0;
      if (impact > 0) {
        const t = impactDuration-impact; sparkMaterial.opacity=impact/impactDuration;
        const spread = killSpray ? .9 : 2, drive = killSpray ? 2.8 : 1.5;   // a kill: a tight cone driven along the heading
        for (let i = 0; i < 12; i++) { sparkPositions[i * 3] = (Math.sin(i*2.4)*spread+(flesh ? Math.sin(impactHeading)*drive : 0))*t; sparkPositions[i * 3 + 1] = Math.cos(i * 1.7) * t * 2 - t * t * 4; sparkPositions[i * 3 + 2] = (Math.cos(i*2.4)*spread+(flesh ? Math.cos(impactHeading)*drive : 0))*t; }
        sparkGeometry.attributes.position.needsUpdate = true;
      }
      for(const splat of splats) {
        splat.life=Math.max(0,splat.life-dt); splat.mesh.visible=splat.life>0;
        if (splat.life > 1e8) { splat.grow=Math.min(1,splat.grow+dt/2.2); splat.mesh.scale.set(.3+.7*splat.grow,(.2+.55*splat.grow)*.8,1); splat.mesh.material.opacity=.7*splat.grow; }   // the kill pool spreads
        else splat.mesh.material.opacity=Math.min(.65,splat.life/4);
      }
      for (const wound of wounds) {   // the wound-site mark rides the wounded fighter for his four-second window
        if (wound.life > 0) {
          wound.life = Math.max(0, wound.life - dt);
          const body = wound.side === 1 ? practice.enemy : state;
          wound.group.position.set(body.x, wound.site === 'head' ? 1.55 : wound.site === 'legs' ? .6 : 1.15, body.z);
          wound.group.rotation.y = body.heading;
          const fade = Math.min(1, wound.life), seep = Math.min(1, (4 - wound.life) / 1.2);   // drips run in the first ~1.2 s, the mark fades over the last
          const tone = bloodMode === 'dark' ? '#241314' : '#4a1213';
          wound.mark.material.color.set(tone); wound.mark.material.opacity = .55 * fade;
          for (const drip of wound.drips) { drip.material.color.set(tone); drip.material.opacity = .5 * fade * seep; drip.scale.y = .4 + .6 * seep; }
          wound.group.visible = bloodMode !== 'off' && wound.life > 0;
        } else wound.group.visible = false;
      }
      // The severed head (decapitation): gravity, a bounce or two, then a roll without slipping until friction stops it.
      if (severHead) {
        severHead.group.visible = bloodMode !== 'off';
        const head = severHead;
        if (!head.resting && dt > 0) {
          head.velocity.y -= 12 * dt;   // a touch heavier than life: reads on a phone screen
          head.group.position.addScaledVector(head.velocity, dt);
          const rate = head.spin.length();
          if (rate > 0) { spinAxis.copy(head.spin).multiplyScalar(1 / rate); head.group.rotateOnWorldAxis(spinAxis, rate * dt); }
          if (head.group.position.y < head.radius) {
            head.group.position.y = head.radius;
            const speed = Math.hypot(head.velocity.x, head.velocity.z);
            if (head.velocity.y < -1) { head.velocity.y = -head.velocity.y * .28; head.velocity.x *= .68; head.velocity.z *= .68; }   // a real bounce
            else {
              head.velocity.y = 0;
              const decay = Math.max(0, 1 - 2.1 * dt); head.velocity.x *= decay; head.velocity.z *= decay;   // rolling friction
              if (speed > .05) head.spin.set(head.velocity.z / head.radius, 0, -head.velocity.x / head.radius);
              else {
                head.resting = true;
                const splat = splats[splatIndex++ % splats.length]; splat.life = 25; splat.grow = 0;   // where the head fell, a stain stays
                splat.mesh.position.set(head.group.position.x, .026 + splatIndex % 12 * .0001, head.group.position.z);
                splat.mesh.scale.set(.16, .12, 1); splat.mesh.rotation.z = splatIndex * 2.4;
                splat.mesh.material.color.set(bloodMode === 'dark' ? '#352426' : '#681a19');
              }
            }
          }
        }
      }
      const animationDt = frozen ? 0 : dt;
      arena.update(animationDt, events);
      const dx = state.x-player.position.x, dz = state.z-player.position.z, ex = practice.enemy.x-opponent.position.x, ez = practice.enemy.z-opponent.position.z;
      const travel = started && dt > 0 ? Math.hypot(state.x - player.position.x, state.z - player.position.z) / dt : 0;
      const enemyTravel = started && dt > 0 ? Math.hypot(practice.enemy.x - opponent.position.x, practice.enemy.z - opponent.position.z) / dt : 0;
      player.position.set(state.x, 0, state.z); opponent.position.set(practice.enemy.x, 0, practice.enemy.z);
      marker.position.set(practice.enemy.x, .04, practice.enemy.z);
      const playerDefence=defenceReaction(practice),enemyDefence=defenceReaction(practice,true);
      // Both actors present the same per-move combat state; the rig's clip and contact pose come from the simulation's data.
      const mine = actorPose(practice, 0), theirs = actorPose(practice, 1);
      // The finisher (owner-authorized 2026-09-17): a pure function of the Killed event and the fighters' weapons picks the
      // victim's death pose; a finisher without a shipped clip falls back to the plain Death. The player's own death is
      // never a finisher (v1). v1's table has no weapon-dependent row, but the weapons are part of the contract.
      const pick = practice.finish ? selectFinisher(practice.finish, [practice.duel.fighters[0].weapon, practice.duel.fighters[1].weapon]) : null;
      const finisher = pick ? (finisherOverride ?? pick) : null;   // test override (owner 2026-09-19): swaps WHICH finisher plays on a ceremonial kill; a kill the spec gives no ceremony (draw, kick, the player's own death) stays plain
      const finisherPose = finisher ? FINISHER_POSE[finisher] : null;
      // Run Through revision (owner 2026-09-18): the blade STAYS through the body. The killer holds the downward drive
      // (Fin_RunThrough, keyed to settle by a quarter of the window then hold) on the same 0.75× finisher clock; the
      // tableau freezes at progress 1 for as long as the corpse kneels (practice.finish holds until rematch).
      const runThroughHold = finisher === 'runThrough' && practice.finish?.victim === 1;
      // Owner 2026-09-18: savour the killshot — a cinematic finisher's corpse animates at 0.75× on a presentation clock that
      // may run past the sim window (the spec's "presentation may hold past the window": no simulation slow motion, the
      // 144-tick death and the hit-stop are untouched). A plain-death pick plays at full speed, exactly like an unadorned kill.
      if (!practice.finish) finishClock = -1;
      else if (finishClock < 0) finishClock = 0;
      else finishClock = Math.min(1, finishClock + dt * 0.75 / (RULES.death / 60));
      const victimProgress = finisherPose && practice.finish?.victim === 1 ? finishClock : theirs.progress;
      warriors?.player.update(dx*Math.sin(state.heading)+dz*Math.cos(state.heading)<-.0001 ? -travel : travel, animationDt, runThroughHold ? 'runThroughHold' : playerDefence?.pose || mine.pose, runThroughHold ? finishClock : playerDefence?.progress ?? mine.progress, mine.attack, mine.contact, travel && dt ? (dx*Math.cos(state.heading)-dz*Math.sin(state.heading))/(travel*dt) : 0, practice.result === 'blocked' ? Math.max(0,1-practice.resultAge/12) : 0);
      warriors?.opponent.update(ex*Math.sin(practice.enemy.heading)+ez*Math.cos(practice.enemy.heading)<-.0001 ? -enemyTravel : enemyTravel, animationDt, enemyDefence?.pose || (finisherPose ?? theirs.pose), enemyDefence?.progress ?? victimProgress, theirs.attack, theirs.contact, enemyTravel && dt ? (ex*Math.cos(practice.enemy.heading)-ez*Math.sin(practice.enemy.heading))/(enemyTravel*dt) : 0, practice.result === 'enemyBlocked' ? Math.max(0,1-practice.resultAge/12) : 0);
      // Decapitation (owner 2026-09-18): when the seeded rotation picks it, the head comes off just after the skull-gives jolt
      // (the clip's first 9 %) — baked from the rig at that pose, popped along the killing blow, ballistic to a stop. Blood
      // 'off' keeps the head on: gore is presentation, like the rest of the layer.
      if (warriors && finisher === 'decapitation' && bloodMode !== 'off' && !severHead && practice.finish?.victim === 1 && victimProgress >= .05 && victimProgress < 1) {
        const built = warriors.opponent.sever();
        if (built) {
          scene.add(built.group);
          severHead = { group: built.group, velocity: new THREE.Vector3(Math.sin(killHeading) * 2.1, 1.8, Math.cos(killHeading) * 2.1), spin: new THREE.Vector3(Math.cos(killHeading), 0, -Math.sin(killHeading)).multiplyScalar(9), radius: built.radius, resting: false };
          const neck = built.group.position;
          flesh = true; killSpray = true; impactDuration = .4; impact = impactDuration; impactHeading = killHeading;
          sparkMaterial.color.set(bloodMode === 'dark' ? '#3e2527' : '#a32b27'); sparkMaterial.blending = THREE.NormalBlending; sparkMaterial.size = .095;
          sparks.position.set(neck.x, Math.max(.3, neck.y - built.radius * .7), neck.z);   // the sever bursts at the neck stump
        }
      }
      brass.color.set(practice.threat ? '#e7a35e' : '#ad9365');
      glows.forEach((glow, i) => { const f = practice.duel.fighters[i], at = i ? practice.enemy : state; glow.position.set(at.x, 1.2, at.z); glow.intensity = f.phase === 'attack' && f.charge ? (f.charged ? 8 : 1 + 4 * f.charge / RULES.charge.min) : 0; glow.color.set(f.charged ? '#fff3d0' : '#ff9a3c'); });
      marker.visible = practice.health > 0;
      if (practice.health) opponent.rotation.y = practice.enemy.heading;
      const blend = 1 - Math.exp(-dt * 8);
      if (locked) {
        const lockYaw = Math.atan2(state.x - practice.enemy.x, state.z - practice.enemy.z);
        yaw += wrapAngle(lockYaw - yaw) * blend;
      }
      const cameraTarget = cameraPose(state, yaw, pitch, locked, practice.enemy);
      look.set(cameraTarget.lookX, locked ? 0.8 : 1, cameraTarget.lookZ); desired.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
      // The authorized slow push-in over the death window (finishers & gore 2026-09-17): a dolly toward the fallen, never a cut,
      // never an FOV change. Off when the viewer prefers reduced motion; the frame loop's hit-stop stays the one impact pause.
      // Paced to the slowed finisher clock (1.3 s / 0.75); a plain-death pick gets no dolly — an ordinary kill stays ordinary.
      if (practice.finish && finisherPose && !practice.finish.draw && !stillCamera) finishPush = Math.min(1, finishPush + dt / (1.3 / 0.75)); else if (!practice.finish) finishPush = 0;
      if (finishPush > 0) {
        const fallen = practice.finish!.victim === 1 ? practice.enemy : state;
        const killer = practice.finish!.victim === 1 ? state : practice.enemy;
        desired.x += (fallen.x - desired.x) * .38 * finishPush; desired.z += (fallen.z - desired.z) * .38 * finishPush;
        // Framing tune (same authorized dolly — still no cut, no FOV, no slow-mo): slide the camera laterally off the
        // killer→fallen axis and a touch higher, so the settled frame reads the kneeling corpse past the killer's
        // shoulder instead of hiding it behind his back.
        const axisX = fallen.x - killer.x, axisZ = fallen.z - killer.z, axisLen = Math.hypot(axisX, axisZ) || 1;
        desired.x += (-axisZ / axisLen) * .95 * finishPush; desired.z += (axisX / axisLen) * .95 * finishPush;
        desired.y += (1.55 - desired.y) * .3 * finishPush;
        look.x += (fallen.x - look.x) * .6 * finishPush; look.z += (fallen.z - look.z) * .6 * finishPush; look.y += (.8 - look.y) * .7 * finishPush;
      }
      heading += wrapAngle(state.heading - heading) * blend;
      if (['kick', 'attack', 'roll', 'guard', 'hurt', 'dead'].includes(practice.phase)) heading = state.heading;
      player.rotation.y = heading;
      camera.position.lerp(desired, started ? blend : 1); aim.lerp(look, started ? blend : 1);
      if (kick > 0) { camera.position.x += Math.sin(kickHeading) * kick; camera.position.z += Math.cos(kickHeading) * kick; kick = Math.max(0, kick - dt * .3); }
      camera.lookAt(aim); started = true;
      renderer.render(scene, camera);
    }
  };
}
