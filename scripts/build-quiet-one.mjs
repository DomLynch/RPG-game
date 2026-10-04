// Original additive finisher. Append to shipped rigs without rewriting any existing binary data.
// Also used by the full warrior builder after its final scale is applied. No external art inputs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const smooth = t => { t = T.MathUtils.clamp(t, 0, 1); return t*t*(3-2*t); };
const point = bone => bone.getWorldPosition(new T.Vector3());

export function quietOneClip(scene, clips) {
  const bones = [], skins = []; scene.traverse(o => { if (o.isBone) bones.push(o); if (o.isSkinnedMesh) skins.push(o); });
  const bone = name => scene.getObjectByName(name), pelvis = bone('pelvis');
  const saved = bones.map(b => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const mixer = new T.AnimationMixer(scene), idle = clips.find(c => c.name === 'Armed');
  const reset = () => { mixer.stopAllAction(); mixer.clipAction(idle).play(); mixer.setTime(0); scene.updateMatrixWorld(true); };
  reset();
  const home = point(pelvis), height = point(bone('Head')).y, scale = height/1.65;
  const pelvisRotation = pelvis.getWorldQuaternion(new T.Quaternion());
  const feet = Object.fromEntries(['l','r'].map(s => [s, point(bone('foot_'+s))]));
  const footRotations = Object.fromEntries(['l','r'].map(s => [s, bone('foot_'+s).getWorldQuaternion(new T.Quaternion())]));
  // Calibrated hinge frames preserve axial roll as the hands reach the neck (same anatomical principle as the polearm repair).
  const frame = (axis, normal) => {
    const y = axis.clone().normalize(), z = normal.clone().addScaledVector(y,-normal.dot(y)).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(y.clone().cross(z),y,z));
  };
  const limbs = {};
  for (const leg of [false,true]) for (const side of ['l','r']) {
    const [upper,lower,end] = (leg ? ['thigh_','calf_','foot_'] : ['upperarm_','lowerarm_','hand_']).map(n => bone(n+side));
    const u = point(lower).sub(point(upper)), f = point(end).sub(point(lower)), normal = u.clone().cross(f).normalize();
    const local = (b,axis) => { const q=b.getWorldQuaternion(new T.Quaternion()).invert(); return frame(axis.clone().applyQuaternion(q),normal.clone().applyQuaternion(q)).invert(); };
    limbs[`${leg}:${side}`] = {upper,lower,end,a:u.length(),b:f.length(),uf:local(upper,u),lf:local(lower,f)};
  }
  const reach = (side,target,leg=false,fall=0) => {
    const {upper,lower,a,b,uf,lf} = limbs[`${leg}:${side}`]; scene.updateMatrixWorld(true);
    const start=point(upper), direction=target.clone().sub(start), distance=T.MathUtils.clamp(direction.length(),.02,a+b-.001);
    direction.normalize(); const along=(a*a-b*b+distance*distance)/(2*distance);
    const bend=new T.Vector3(...(leg ? [0,.08+fall*.4,1] : [side==='l'?.5:-.5,-.3,1])); bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
    const u=elbow.clone().sub(start), f=start.clone().addScaledVector(direction,distance).sub(elbow), n=u.clone().cross(f).normalize();
    for(const [joint,axis,local] of [[upper,u,uf],[lower,f,lf]]) {
      joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame(axis,n)).multiply(local));scene.updateMatrixWorld(true);
    }
  };
  const times=Array.from({length:61},(_,i)=>i/60), positions=[], rotations=new Map(bones.map(b=>[b.name,[]]));
  for (const p of times) {
    reset();
    const shock=Math.sin(Math.PI*smooth(p/.13)), clutch=smooth((p-.035)/.16), step=smooth((p-.12)/.22);
    const buckle=smooth((p-.42)/.29), fall=smooth((p-.62)/.29), roll=fall*1.48;
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll);
    const hip=home.clone().add(new T.Vector3(-fall*.29*scale,-home.y*(buckle*.55+fall*.23)+fall*.14*scale,-step*.16*scale));
    pelvis.position.copy(pelvis.parent.worldToLocal(hip));
    pelvis.quaternion.copy(pelvis.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation).multiply(pelvisRotation));
    bone('spine_01').rotation.x += .09*clutch+.14*buckle;
    bone('spine_02').rotation.x += .06*clutch+.07*buckle;
    bone('neck_01').rotation.x += -shock*.12+clutch*.09;
    bone('Head').rotation.x += -shock*.22+clutch*.12;
    bone('Head').rotation.z += .07*clutch;
    scene.updateMatrixWorld(true);
    for (const side of ['l','r']) {
      const back=smooth((p-(side==='r'?.13:.30))/.16);
      const target=feet[side].clone().add(new T.Vector3(fall*.10*scale,0,-back*.18*scale-buckle*.19*scale));
      target.y=Math.max(.045,feet[side].y)+(side==='l'?.10:.04)*fall*scale;
      target.y+=Math.sin(Math.PI*back)*.055*scale*(1-buckle);
      reach(side,target,true,fall);
      const foot=bone('foot_'+side);
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation).multiply(footRotations[side]));
    }
    scene.updateMatrixWorld(true);
    // Palm at the front/left of the throat, fingers reaching upwards under the jaw; stays there through the fall.
    const neck=bone('neck_01'), neckQ=neck.getWorldQuaternion(new T.Quaternion());
    const throat=point(neck).add(new T.Vector3(.025,-.035,.075).multiplyScalar(scale).applyQuaternion(rotation));
    const left=bone('hand_l'), leftHome=point(left); reach('l',leftHome.lerp(throat,clutch));
    const palm=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,Math.PI/2));
    left.quaternion.slerp(left.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(neckQ).multiply(palm),clutch);
    const right=bone('hand_r'), rightHome=point(right);
    const low=point(pelvis).add(new T.Vector3(-.27,.04,.14).multiplyScalar(scale).applyQuaternion(rotation));
    reach('r',rightHome.lerp(low,smooth((p-.08)/.28)));
    const weapon=bone('WeaponDrawn') ?? bone('SwordDrawn');
    if(weapon) {
      const bladeDirection=new T.Vector3(-.5,.14,.85).applyQuaternion(rotation).lerp(new T.Vector3(.2,.03,.98),fall).normalize();
      const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bladeDirection).multiply(weapon.quaternion.clone().invert());
      right.quaternion.slerp(right.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q),clutch);
    }
    scene.updateMatrixWorld(true);
    // Ground the actual skin/clothing envelope, not just the joints. The broad Goblin head and
    // Executioner sleeves need different clearance. This is baked once, with no per-frame runtime scan.
    if (fall > 0) {
      let floor=Infinity; const vertex=new T.Vector3();
      for(const mesh of skins){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);
      }}
      const lift=Math.max(0,.005-floor)*smooth(fall/.3);
      pelvis.position.copy(pelvis.parent.worldToLocal(point(pelvis).add(new T.Vector3(0,lift,0))));
      scene.updateMatrixWorld(true);
    }
    positions.push(...pelvis.position.toArray());
    for(const b of bones) rotations.get(b.name).push(...b.quaternion.toArray());
  }
  mixer.stopAllAction();
  for(const [b,p,q,s] of saved){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);} scene.updateMatrixWorld(true);
  return new T.AnimationClip('Death_QuietOne',2.4,[new T.VectorKeyframeTrack('pelvis.position',times.map(t=>t*2.4),positions),...bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times.map(t=>t*2.4),rotations.get(b.name)))]);
}

export async function appendQuietOne(file) {
  const bytes=await fs.readFile(file), size=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+size));
  if(!json.animations?.some(a=>a.name==='Death_RunThrough')) return;
  // Replacing our own last append keeps reruns byte stable; never reserialize or modify the original binary chunk.
  const previous=json.extras?.quietOneBase;
  if (!previous && json.animations.some(a=>a.name==='Death_QuietOne')) return; // already authored by the full builder
  if (previous && (json.animations.length!==previous.animations+1 || json.animations.at(-1).name!=='Death_QuietOne')) throw Error('Newer animations follow Quiet One; rebuild from source instead of truncating them');
  if(previous) {json.accessors.length=previous.accessors;json.bufferViews.length=previous.views;json.animations.length=previous.animations;}
  const binary=bytes.subarray(28+size,28+size+(previous?.bytes ?? json.buffers[0].byteLength));
  const base={bytes:binary.length,accessors:json.accessors.length,views:json.bufferViews.length,animations:json.animations.length};
  const parsed=structuredClone(json); parsed.images=[];parsed.textures=[];parsed.materials=parsed.materials.map(m=>({name:m.name}));
  parsed.buffers[0]={byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')};
  globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(parsed),''); const clip=quietOneClip(asset.scene,asset.animations);
  const chunks=[binary,Buffer.alloc((4-binary.length%4)%4)];let offset=chunks.reduce((n,b)=>n+b.length,0);
  const accessor=(array,type)=>{
    const bytes=Buffer.from(new Float32Array(array).buffer), view=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
    chunks.push(bytes);offset+=bytes.length;const count=array.length/({SCALAR:1,VEC3:3,VEC4:4}[type]);
    return json.accessors.push({bufferView:view,componentType:5126,count,type,...(type==='SCALAR'?{min:[Math.min(...array)],max:[Math.max(...array)]}:{})})-1;
  };
  const input=accessor(clip.tracks[0].times,'SCALAR'), animation={name:clip.name,samplers:[],channels:[]};
  for(const track of clip.tracks){const [name,property]=track.name.split('.'), node=json.nodes.findIndex(n=>n.name===name);if(node<0)throw Error(name);
    const output=accessor(track.values,property==='position'?'VEC3':'VEC4'), sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;
    animation.channels.push({sampler,target:{node,path:property==='position'?'translation':'rotation'}});
  }
  json.animations.push(animation);json.extras={...json.extras,quietOneBase:base};json.buffers[0].byteLength=offset;
  const raw=Buffer.from(JSON.stringify(json)), js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]), bin=Buffer.concat(chunks);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+bin.length,8);header.writeUInt32LE(js.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  await fs.writeFile(file,Buffer.concat([header,js,bh,bin]));console.log(`${file}: ${clip.tracks.length} tracks, +${offset-base.bytes} bytes`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const files=process.argv.slice(2);
  for(const file of files.length ? files : ['warrior','veteran','pitborn','goblin','nightborn','executioner','weapons/cleaver/veteran-cleaver','weapons/estoc/nightborn-estoc','weapons/scythe/warrior-scythe','weapons/scythe/executioner-scythe'].map(n=>'src/assets/'+n+'.glb')) await appendQuietOne(file);
}
