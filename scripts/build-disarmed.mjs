// Original paired Disarmed motion. Offline authoring; old clips and meshes remain untouched.
import * as T from 'three';
const smooth = t => { t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t); };
const point = bone => bone.getWorldPosition(new T.Vector3());
export const DISARMED_BEATS = {arm:.16,neck:.58,settle:.96};

export function disarmedClips(scene, clips) {
  const bones=[],nodes=[];scene.traverse(o=>{nodes.push(o);if(o.isBone)bones.push(o);});
  const bone=name=>scene.getObjectByName(name), saved=nodes.map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);
  const samples=new Map(clips.map(clip=>[clip.name,{duration:clip.duration,tracks:clip.tracks.map(track=>{
    const [name,property]=track.name.split('.');return {node:bone(name),property,interpolant:track.createInterpolant()};
  })}]));
  const sample=(name,p=0)=>{
    const clip=samples.get(name);if(!clip)throw Error('Missing source '+name);
    for(const [b,position,rotation,scale] of saved){b.position.copy(position);b.quaternion.copy(rotation);b.scale.copy(scale);}
    for(const {node,property,interpolant} of clip.tracks)if(node)node[property].fromArray(interpolant.evaluate(T.MathUtils.clamp(p,0,1)*clip.duration));
    scene.updateMatrixWorld(true);
  };
  sample('Armed');
  const scale=point(bone('Head')).y/1.65, handHome=point(bone('hand_r'));
  const frame=(axis,normal)=>{const y=axis.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(y.clone().cross(z),y,z));};
  const arms={};
  for(const side of ['l','r']) {
    const [upper,lower,end]=['upperarm_','lowerarm_','hand_'].map(n=>bone(n+side));
    const u=point(lower).sub(point(upper)),f=point(end).sub(point(lower)),normal=u.clone().cross(f).normalize();
    const local=(b,axis)=>{const q=b.getWorldQuaternion(new T.Quaternion()).invert();return frame(axis.clone().applyQuaternion(q),normal.clone().applyQuaternion(q)).invert();};
    arms[side]={upper,lower,a:u.length(),b:f.length(),uf:local(upper,u),lf:local(lower,f)};
  }
  function reach(side,target) {
    const {upper,lower,a,b,uf,lf}=arms[side];scene.updateMatrixWorld(true);
    const start=point(upper),direction=target.clone().sub(start),distance=T.MathUtils.clamp(direction.length(),Math.abs(a-b)+.001,a+b-.001);direction.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),bend=new T.Vector3(side==='l'?.6:-.6,-.4,.4);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
    const u=elbow.clone().sub(start),f=start.clone().addScaledVector(direction,distance).sub(elbow),normal=u.clone().cross(f).normalize();
    for(const [joint,axis,local] of [[upper,u,uf],[lower,f,lf]]){joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame(axis,normal)).multiply(local));scene.updateMatrixWorld(true);}
  }
  const times=Array.from({length:97},(_,i)=>i/96), make=(name,pose)=>{
    const positions=[],rotations=new Map(bones.map(b=>[b.name,[]]));
    for(const p of times){pose(p);positions.push(...bone('pelvis').position.toArray());for(const b of bones)rotations.get(b.name).push(...b.quaternion.clone().normalize().toArray());}
    return new T.AnimationClip(name,3.2,[new T.VectorKeyframeTrack('pelvis.position',times.map(t=>t*3.2),positions),...bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times.map(t=>t*3.2),rotations.get(b.name)))]);
  };
  const fallKeys=[[.70,.2],[.80,.5],[.90,.8],[1,1]].map(([time,phase])=>{sample('Death_QuietOne',phase);return {time,poses:bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone().normalize()}))};});
  const interpolate=(keys,p)=>{const right=keys.findIndex(k=>k.time>=p),end=keys[Math.max(1,right)],start=keys[Math.max(1,right)-1],t=smooth((p-start.time)/(end.time-start.time));bones.forEach((b,i)=>{b.position.lerpVectors(start.poses[i].position,end.poses[i].position,t);b.quaternion.slerpQuaternions(start.poses[i].rotation,end.poses[i].rotation,t);});};
  const victim=make('Death_Disarmed',p=>{
    sample('Armed');
    const shock=Math.sin(Math.PI*smooth((p-DISARMED_BEATS.arm)/.18)),clutch=smooth((p-.19)/.15);
    bone('spine_01').rotation.y+=.12*shock;bone('spine_02').rotation.y+=.17*shock;
    bone('Head').rotation.x+=.30*clutch;bone('Head').rotation.z-=.16*clutch;
    scene.updateMatrixWorld(true);
    // Right forearm presented to the cutting line; the left hand releases a polearm before impact.
    reach('r',handHome.clone().add(new T.Vector3(-.03,-.09,.13).multiplyScalar(scale*smooth(p/.14))));
    const elbow=point(bone('lowerarm_r')),left=point(bone('hand_l'));
    const release=new T.Vector3(.22,.04,.18).multiplyScalar(scale).add(point(bone('spine_01')));
    const target=left.lerp(release,smooth(p/.10)).lerp(elbow.clone().add(new T.Vector3(.025,.015,.035).multiplyScalar(scale)),clutch);
    reach('l',target);
    // Neck strike ends the held reaction. Reuse only the established grounded fall, retimed after the second impact.
    if(p>=DISARMED_BEATS.neck) {
      const held=bones.map(b=>[b,b.position.clone(),b.quaternion.clone()]);
      interpolate(fallKeys,Math.max(.70,p));
      const weight=smooth((p-DISARMED_BEATS.neck)/(.70-DISARMED_BEATS.neck));
      for(const [b,position,rotation] of held){b.position.lerpVectors(position,b.position,weight);b.quaternion.slerpQuaternions(rotation,b.quaternion.clone().normalize(),weight);}
    }
    scene.updateMatrixWorld(true);
  });
  // Fixed authored poses avoid shortest-arc flips from blending against a moving quaternion target.
  const keys=[[0,'Armed',0],[.09,'Attack',.05],[DISARMED_BEATS.arm,'Attack',.35],[.27,'Attack',.6],[.38,'Armed',0],[.47,'Return',.05],[DISARMED_BEATS.neck,'Return',.35],[.72,'Return',.6],[.90,'Armed',0],[1,'Armed',0]].map(([time,name,phase])=>{
    sample(name,phase);return {time,poses:bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone().normalize()}))};
  });
  const killer=make('Fin_Disarmed',p=>interpolate(keys,p));
  for(const [b,p,q,s] of saved){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}scene.updateMatrixWorld(true);
  return [victim,killer];
}

// Append only our pair. Re-running replaces only our own last append; never truncate later work.
export async function appendDisarmed(file) {
  const fs=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
  const previous=json.extras?.disarmedBase,names=['Death_Disarmed','Fin_Disarmed'];
  if(previous && (json.animations.length!==previous.animations+2 || json.animations.slice(-2).some((a,i)=>a.name!==names[i])))throw Error('Newer animations follow Disarmed; refusing to truncate');
  if(!previous && json.animations.some(a=>names.includes(a.name)))throw Error('Existing Disarmed clips have no append provenance');
  if(previous){json.accessors.length=previous.accessors;json.bufferViews.length=previous.views;json.animations.length=previous.animations;}
  const binary=bytes.subarray(28+size,28+size+(previous?.bytes??json.buffers[0].byteLength));
  const base={bytes:binary.length,accessors:json.accessors.length,views:json.bufferViews.length,animations:json.animations.length};
  const parsed=structuredClone(json);parsed.images=[];parsed.textures=[];parsed.materials=parsed.materials.map(m=>({name:m.name}));
  parsed.buffers[0]={byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')};
  globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(parsed),'');
  const clips=disarmedClips(asset.scene,asset.animations).map(c=>c.optimize());
  const chunks=[binary,Buffer.alloc((4-binary.length%4)%4)];let offset=chunks.reduce((n,b)=>n+b.length,0);
  const accessor=(array,type)=>{const buffer=Buffer.from(new Float32Array(array).buffer),view=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length})-1;chunks.push(buffer);offset+=buffer.length;return json.accessors.push({bufferView:view,componentType:5126,count:array.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type,...(type==='SCALAR'?{min:[Math.min(...array)],max:[Math.max(...array)]}:{})})-1;};
  for(const clip of clips){
    const animation={name:clip.name,samplers:[],channels:[]};
    for(const track of clip.tracks){const [name,property]=track.name.split('.'),node=json.nodes.findIndex(n=>n.name===name);if(node<0)throw Error(name);
      const input=accessor(track.times,'SCALAR'),output=accessor(track.values,property==='position'?'VEC3':'VEC4'),sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;animation.channels.push({sampler,target:{node,path:property==='position'?'translation':'rotation'}});
    }
    json.animations.push(animation);
  }
  json.extras={...json.extras,disarmedBase:base};json.buffers[0].byteLength=offset;
  const raw=Buffer.from(JSON.stringify(json)),js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),bin=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
  [0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>header.writeUInt32LE(v,i*4));bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  await fs.writeFile(file,Buffer.concat([header,js,bh,bin]));return {file,addedBytes:offset-base.bytes,clips:clips.map(c=>c.name)};
}
