// Original paired Disarmed motion. Offline authoring; old clips and meshes remain untouched.
import * as T from 'three';
import {appendFinisher} from './append-finisher.mjs';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
const smooth = t => { t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t); };
const point = bone => bone.getWorldPosition(new T.Vector3());
import {DISARMED_BEATS} from '../src/disarmed.ts';
export {DISARMED_BEATS};

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
    return new T.AnimationClip(name,DISARMED_BEATS.duration,[new T.VectorKeyframeTrack('pelvis.position',times.map(t=>t*DISARMED_BEATS.duration),positions),...bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times.map(t=>t*DISARMED_BEATS.duration),rotations.get(b.name)))]);
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
    if(p>=DISARMED_BEATS.neck) {
      // Ground the actual body, including larger creature silhouettes, while authoring the fall.
      const bounds=new T.Box3();scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});
      if(bounds.min.y<.006){const pelvis=bone('pelvis'),position=point(pelvis);position.y+=.006-bounds.min.y;pelvis.position.copy(pelvis.parent.worldToLocal(position));scene.updateMatrixWorld(true);}
    }
  });
  // Fixed authored poses avoid shortest-arc flips from blending against a moving quaternion target.
  const keys=[[0,'Armed',0],[.09,'Attack',.05],[DISARMED_BEATS.arm,'Attack',.35],[.27,'Attack',.6],[.38,'Armed',0],[.47,'Return',.05],[DISARMED_BEATS.neck,'Return',.35],[.72,'Return',.6],[.90,'Armed',0],[1,'Armed',0]].map(([time,name,phase])=>{
    sample(name,phase);return {time,poses:bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone().normalize()}))};
  });
  const killer=make('Fin_Disarmed',p=>interpolate(keys,p));
  for(const [b,p,q,s] of saved){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}scene.updateMatrixWorld(true);
  return [victim,killer];
}

export const appendDisarmed=file=>appendFinisher(file,'Disarmed',disarmedClips);

// Rebuild the additive scene and keep the estoc's authored/baked twin identical to the rendered Nightborn.
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const files=process.argv.slice(2);
  if(!files.length)files.push(...['warrior','veteran','pitborn','goblin','nightborn','executioner','minotaur','wraith'].map(id=>'src/assets/'+id+'.glb'),'src/assets/weapons/cleaver/veteran-cleaver.glb');
  for(const file of files)await appendDisarmed(file);
  if(files.includes('src/assets/nightborn.glb'))await (await import('node:fs/promises')).copyFile('src/assets/nightborn.glb','src/assets/weapons/estoc/nightborn-estoc.glb');
}
