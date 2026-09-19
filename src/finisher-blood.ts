import { Color, DynamicDrawUsage, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, SkinnedMesh, SphereGeometry, Texture, Vector3 } from 'three';
import type { FinisherId } from './finishers.ts';
import { DISARMED_BEATS } from './disarmed.ts';

export type BloodSource = { site: string; position: Vector3; direction: Vector3; strength: number; delay?: number };
type Mode = 'red' | 'dark' | 'off';

// Read after posing, separation and final actor headings. Every position is world space.
export function finisherBloodSources(kind: FinisherId, victim: Object3D, head: Object3D | null, location = 'torso'): BloodSource[] {
  victim.updateWorldMatrix(true, true);
  const at = (name: string) => victim.getObjectByName(name)?.getWorldPosition(new Vector3());
  const neck = at('neck_01'), crown = at('Head'), chest = at('spine_02');
  if (!neck || !crown || !chest) return [];
  const up = crown.clone().sub(neck).normalize(), size = Math.max(.5, Math.min(1.6, crown.distanceTo(neck)/.075));
  const forward = new Vector3(0,0,1).transformDirection(victim.matrixWorld);
  forward.addScaledVector(up,-forward.dot(up)).normalize();
  const source = (site: string, position: Vector3, direction: Vector3, strength = 1): BloodSource => ({site,position,direction:direction.normalize(),strength:strength*size});
  if (kind === 'opened') {
    const opened = victim.getObjectByName('Opened');
    if (!opened?.visible) return [];
    return ['OpenedLegs','OpenedTorso'].flatMap((name,i) => {
      const half = opened.getObjectByName(name);
      if (!half?.visible) return [];
      const cut = half.getObjectByName('WaistCut') as Mesh | undefined;
      if (!cut) return [];
      if (!cut.geometry.boundingBox) cut.geometry.computeBoundingBox();
      return [source(i ? 'waist-torso' : 'waist-legs', cut.localToWorld(cut.geometry.boundingBox!.getCenter(new Vector3())), new Vector3(0,i ? -1 : 1,0).transformDirection(cut.matrixWorld),1.4)];
    });
  }
  if (kind === 'disarmed') {
    const sites: BloodSource[] = [];
    const arm = victim.getObjectByName('DisarmedArm');
    const stump = victim.getObjectByName('ArmStump');
    if (arm?.visible && stump instanceof SkinnedMesh && stump.visible) {
      stump.updateMatrixWorld(true); stump.skeleton.update();
      const cut = arm.getObjectByName('ArmCut') as Mesh | undefined;
      const position = stump.getVertexPosition(0, new Vector3()).applyMatrix4(stump.matrixWorld);
      const direction = at('hand_r')?.sub(position) ?? forward.clone();
      sites.push({...source('arm-stump', position, direction, 1.1), delay: DISARMED_BEATS.arm * DISARMED_BEATS.duration});
      if (cut) sites.push({...source('detached-arm', cut.localToWorld(new Vector3().fromBufferAttribute(cut.geometry.getAttribute('position'), 0)), new Vector3(0,-1,0), .65), delay: DISARMED_BEATS.arm * DISARMED_BEATS.duration});
    }
    // The neck starts bleeding only when the second strike has actually severed the head.
    if (head?.visible) for (const site of finisherBloodSources('decapitation', victim, head)) sites.push({...site, delay: DISARMED_BEATS.neck * DISARMED_BEATS.duration});
    return sites;
  }
  if (kind === 'decapitation') {
    const sites = [source('neck-stump',neck.clone().addScaledVector(up,.035*size),up.clone().addScaledVector(forward,.35),1.35)];
    const cut = head?.getObjectByName('BloodHeadCut');
    if (cut) sites.push(source('detached-head',cut.getWorldPosition(new Vector3()),new Vector3(0,-1,0).transformDirection(cut.matrixWorld),.8));
    return sites;
  }
  if (kind === 'quietOne') {
    const side = new Vector3().crossVectors(up,forward);
    return [source('jugular',neck.clone().addScaledVector(forward,.06*size).addScaledVector(side,-.035*size),forward.clone().addScaledVector(side,-.55),.85)];
  }
  if (kind === 'splitCrown') return [source('skull-seam',crown.clone().addScaledVector(up,.045*size),up.clone().addScaledVector(forward,.4),1.15)];
  if (kind === 'runThrough') return [
    source('chest-entry',chest.clone().addScaledVector(forward,.14*size),forward.clone(),1),
    source('back-exit',chest.clone().addScaledVector(forward,-.13*size),forward.clone().negate(),.85),
  ];
  return [source('blade-wound',location === 'head' ? crown : location === 'legs' ? at('thigh_r') ?? chest : chest,forward,.9)];
}

// Fixed resources: two draws, 160 ballistic droplets and 80 growing floor stains. No allocation per emission.
export function createFinisherBlood(map: Texture) {
  const group = new Group(); group.name = 'FinisherBlood'; group.visible = false;
  const dropMaterial = new MeshStandardMaterial({color:'#740f19',roughness:.46,metalness:0});
  const poolMaterial = new MeshBasicMaterial({map,color:'#68121a',transparent:true,opacity:.86,depthWrite:false,toneMapped:false});
  const drops = new InstancedMesh(new SphereGeometry(1,8,4),dropMaterial,160);
  const pools = new InstancedMesh(new PlaneGeometry(2,2),poolMaterial,80);
  drops.name = 'FinisherDroplets'; pools.name = 'FinisherPools';
  for (const mesh of [drops,pools]) { mesh.instanceMatrix.setUsage(DynamicDrawUsage); mesh.frustumCulled=false; }
  group.add(drops,pools);
  const particles = Array.from({length:160},()=>({position:new Vector3(),velocity:new Vector3(),life:0,size:0}));
  const stains = Array.from({length:80},()=>({position:new Vector3(),radius:0,target:0,angle:0,site:''}));
  const velocityDirection = new Vector3(), turn = new Quaternion(), zAxis = new Vector3(0,0,1);
  const dummy = new Object3D(), yAxis = new Vector3(0,1,0), flat = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2), tone = new Color();
  let active: FinisherId | null = null, elapsed = 0, cursor = 0, stainCursor = 0, serial = 0;
  let pending: number[] = [], emitted = 0, landed = 0, lateSeeded = false;
  function reset() {
    for (const p of particles) p.life=0;
    for (const s of stains) { s.radius=0; s.target=0; }
    drops.count=pools.count=0; pending=[]; cursor=stainCursor=serial=emitted=landed=0; elapsed=0; active=null; lateSeeded=false; group.visible=false;
  }
  function stain(position: Vector3, amount: number, site: string) {
    // Merge nearby landings without pulling a previous pool along with a moving wound.
    let s=stains.find(p=>p.target>0 && (p.position.x-position.x)**2+(p.position.z-position.z)**2<.2*.2);
    if (!s) { s=stains[stainCursor++%stains.length]; s.position.set(position.x,.025,position.z);s.radius=.035;s.target=.055;s.angle=serial*2.4;s.site=site; }
    s.target=Math.min(.85,Math.sqrt(s.target*s.target+amount));
  }
  reset();
  return {
    group,
    update(dt: number, kind: FinisherId | null, progress: number, sources: readonly BloodSource[], mode: Mode) {
      if (!kind) { if(active)reset(); return; }
      if(active!==kind) {reset();active=kind;}
      group.visible=mode!=='off';
      dropMaterial.color.set(mode==='dark' ? '#342127' : '#740f19'); poolMaterial.color.set(mode==='dark' ? '#2b2226' : '#68121a');
      // Hold state at zero dt; off hides and clears airborne drops but never freezes the bleed clock.
      if(dt<=0)return;
      dt=Math.min(dt,.1);elapsed+=dt;
      if(mode==='off') {for(const p of particles)p.life=0;drops.count=0;return;}
      if(elapsed>=7 && !lateSeeded && stainCursor===0) { for(const s of sources)stain(s.position,.3,s.site);lateSeeded=sources.length>0; }
      const start=kind==='decapitation' ? .05 : kind==='opened' || kind==='splitCrown' ? .045 : .01;
      if(progress>=start && elapsed<7) sources.forEach((s,i)=>{
        const age=Math.max(0,elapsed-(s.delay??0)),burst=age<1.7, rate=(burst ? 78 : age<3.5 ? 32 : 14)*s.strength;
        pending[i]=(pending[i]??0)+rate*dt;
        while(pending[i]>=1) {
          pending[i]--; const p=particles[cursor++%particles.length], a=++serial*2.399963;
          const pressure=burst ? (1.5+.8*Math.sin(age*17)**2) : .25;
          p.position.copy(s.position);p.velocity.copy(s.direction).multiplyScalar(pressure*Math.min(1.2,s.strength));
          p.velocity.x+=Math.sin(a)*.45;p.velocity.z+=Math.cos(a)*.45;p.velocity.y+=burst ? .35+.35*Math.sin(a*1.7) : -.3;
          p.life=2;p.size=(serial%11===0 ? .022 : .004+(serial%4)*.002)*Math.sqrt(s.strength);emitted++;
        }
        // Once the wound is near the floor, seep directly underneath it as well as landing droplets.
        if(s.position.y<.65)stain(s.position,dt*.08*s.strength,s.site);
      });
      let count=0;
      for(const p of particles) {
        if(p.life<=0)continue;
        p.life-=dt;p.velocity.y-=9.8*dt;p.position.addScaledVector(p.velocity,dt);
        if(p.position.y<=.03) {stain(p.position,.006,'spray');p.life=0;landed++;continue;}
        dummy.position.copy(p.position);dummy.quaternion.setFromUnitVectors(yAxis,velocityDirection.copy(p.velocity).normalize());
        dummy.scale.set(p.size,p.size*(1.4+Math.min(1.2,p.velocity.length()*.2)),p.size);dummy.updateMatrix();drops.setMatrixAt(count++,dummy.matrix);
      }
      drops.count=count;drops.instanceMatrix.needsUpdate=true;
      count=0;
      for(const s of stains) {
        if(!s.target)continue;
        s.radius+=(s.target-s.radius)*(1-Math.exp(-dt*2.2));
        dummy.position.copy(s.position);dummy.position.y+=count*.00004;
        dummy.quaternion.copy(flat).multiply(turn.setFromAxisAngle(zAxis,s.angle));
        dummy.scale.set(s.radius,s.radius*(.7+.2*Math.sin(s.angle)**2),1);dummy.updateMatrix();pools.setMatrixAt(count,dummy.matrix);
        tone.setScalar(.75+.25*Math.min(1,s.radius/.2));pools.setColorAt(count++,tone);
      }
      pools.count=count;pools.instanceMatrix.needsUpdate=true;if(pools.instanceColor)pools.instanceColor.needsUpdate=true;
    },
    inspect() { return {kind:active,elapsed,emitted,landed,color:poolMaterial.color.getHexString(),airborne:drops.count,visible:group.visible,pools:stains.filter(s=>s.target>0).map(s=>({position:s.position.toArray(),radius:s.radius,site:s.site})),capacity:{drops:particles.length,pools:stains.length}}; },
    reset,
    dispose() {reset();group.removeFromParent();drops.geometry.dispose();pools.geometry.dispose();dropMaterial.dispose();poolMaterial.dispose();},
  };
}
