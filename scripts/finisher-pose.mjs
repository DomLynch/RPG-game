// Offline pose authoring shared by the next paired scenes. No runtime animation dependency.
import * as T from 'three';
export const smooth = t => {t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function poseRig(scene,clips) {
 const nodes=[],bones=[];scene.traverse(o=>{nodes.push(o);if(o.isBone)bones.push(o);});
 const saved=nodes.map(o=>[o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
 const bone=name=>scene.getObjectByName(name),point=o=>o.getWorldPosition(new T.Vector3());
 const sources=new Map(clips.map(c=>[c.name,{duration:c.duration,tracks:c.tracks.map(t=>{const [name,property]=t.name.split('.');return{node:bone(name),property,sample:t.createInterpolant()};})}]));
 const restore=()=>{for(const [o,p,q,s] of saved){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}scene.updateMatrixWorld(true);};
 const sample=(name,p=0)=>{restore();const clip=sources.get(name);if(!clip)throw Error('Missing source '+name);for(const t of clip.tracks)if(t.node)t.node[t.property].fromArray(t.sample.evaluate(T.MathUtils.clamp(p,0,1)*clip.duration));scene.updateMatrixWorld(true);};
 const capture=()=>bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone().normalize()}));
 const blend=(a,b,t)=>{bones.forEach((bone,i)=>{bone.position.lerpVectors(a[i].position,b[i].position,t);bone.quaternion.slerpQuaternions(a[i].rotation,b[i].rotation,t);});scene.updateMatrixWorld(true);};
 const interpolate=(keys,p)=>{const end=Math.max(1,keys.findIndex(k=>k.time>=p)),a=keys[end-1],b=keys[end];blend(a.pose,b.pose,smooth((p-a.time)/(b.time-a.time)));};
 sample('Armed');const scale=point(bone('Head')).y/1.65;
 const frame=(axis,normal)=>{const y=axis.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(y.clone().cross(z),y,z));};
 const legs={};
 for(const side of ['l','r']){
  const [upper,lower,end]=['thigh_','calf_','foot_'].map(n=>bone(n+side)),u=point(lower).sub(point(upper)),f=point(end).sub(point(lower)),normal=u.clone().cross(f).normalize();
  const local=(b,axis)=>{const q=b.getWorldQuaternion(new T.Quaternion()).invert();return frame(axis.clone().applyQuaternion(q),normal.clone().applyQuaternion(q)).invert();};
  legs[side]={upper,lower,end,a:u.length(),b:f.length(),uf:local(upper,u),lf:local(lower,f)};
 }
 const feet=()=>Object.fromEntries(Object.entries(legs).map(([side,{end}])=>[side,{position:point(end),rotation:end.getWorldQuaternion(new T.Quaternion())}]));
 const plant=targets=>{
  for(const [side,{upper,lower,end,a,b,uf,lf}] of Object.entries(legs)){
   scene.updateMatrixWorld(true);const start=point(upper),direction=targets[side].position.clone().sub(start),d=T.MathUtils.clamp(direction.length(),Math.abs(a-b)+.001,a+b-.001);direction.normalize();
   const along=(a*a-b*b+d*d)/(2*d),bend=new T.Vector3(side==='l'?.1:-.1,0,1);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
   const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along))),u=elbow.clone().sub(start),f=start.clone().addScaledVector(direction,d).sub(elbow),normal=u.clone().cross(f).normalize();
   for(const [joint,axis,local] of [[upper,u,uf],[lower,f,lf]]){joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame(axis,normal)).multiply(local));scene.updateMatrixWorld(true);}
   end.quaternion.copy(end.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(targets[side].rotation));scene.updateMatrixWorld(true);
  }
 };
 const lean=angle=>{const joint=bone('spine_01'),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle);joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q).multiply(joint.getWorldQuaternion(new T.Quaternion())));scene.updateMatrixWorld(true);};
 const ground=()=>{const bounds=new T.Box3();scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});if(bounds.min.y<.006){const pelvis=bone('pelvis'),p=point(pelvis);p.y+=.006-bounds.min.y;pelvis.position.copy(pelvis.parent.worldToLocal(p));scene.updateMatrixWorld(true);}};
 const make=(name,duration,pose,beats=[])=>{
  const times=[...new Set([...Array.from({length:Math.ceil(duration*30)+1},(_,i)=>i/Math.ceil(duration*30)),...beats])].sort((a,b)=>a-b),positions=[],rotations=new Map(bones.map(b=>[b.name,[]]));
  for(const p of times){pose(p);positions.push(...bone('pelvis').position.toArray());for(const b of bones)rotations.get(b.name).push(...b.quaternion.clone().normalize().toArray());}
  return new T.AnimationClip(name,duration,[new T.VectorKeyframeTrack('pelvis.position',times.map(t=>t*duration),positions),...bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times.map(t=>t*duration),rotations.get(b.name)))]);
 };
 return{bone,point,scale,sample,capture,blend,interpolate,feet,plant,lean,ground,make,restore};
}
