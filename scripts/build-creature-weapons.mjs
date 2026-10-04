// Additive authored equipment/clips. Preserve approved creature surfaces and source maps.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const hash = b => createHash('sha256').update(b).digest('hex');
globalThis.ProgressEvent ??= class { constructor(_, fields) { Object.assign(this, fields); } };
for (const family of process.argv.slice(2).length ? process.argv.slice(2) : ['minotaur', 'wraith']) {
  if (!['minotaur','wraith'].includes(family)) throw Error(family);
  const file = `src/assets/${family}.glb`, bytes = await fs.readFile(file), size = bytes.readUInt32LE(12);
  let doc = JSON.parse(bytes.subarray(20,20+size));
  const previous = doc.extras?.creatureWeaponBase;
  let bin = bytes.subarray(28+size,28+size+(previous?.bytes ?? doc.buffers[0].byteLength));
  if (previous) doc = previous.doc;
  const base = { bytes: bin.length, doc: structuredClone(doc) };
  const parsed = structuredClone(doc); parsed.images=[]; parsed.textures=[]; parsed.materials=parsed.materials.map(m=>({name:m.name}));
  parsed.buffers[0]={byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')};
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(parsed),''), scene=asset.scene;
  const bone=n=>scene.getObjectByName(n), point=b=>b.getWorldPosition(new T.Vector3());
  const mixer=new T.AnimationMixer(scene), bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o);});
  const play=(name,t=0)=>{mixer.stopAllAction();const c=asset.animations.find(c=>c.name===name);mixer.clipAction(c).play();mixer.setTime(Math.min(.999999,t)*c.duration);scene.updateMatrixWorld(true);};
  play('Idle'); if(process.env.CREATURE_DEBUG)console.log(family,...['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'].map(n=>[n,point(bone(n)).toArray()])); const chest=bone('spine_03');
  const aim=(joint,child,target)=>{const parent=joint.parent;scene.updateMatrixWorld(true);const from=parent.worldToLocal(point(child)).sub(joint.position).normalize(),to=parent.worldToLocal(target.clone()).sub(joint.position).normalize();joint.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(from,to));scene.updateMatrixWorld(true);};
  const reach=(side,target)=>{const u=bone('upperarm_'+side),l=bone('lowerarm_'+side),h=bone('hand_'+side),start=point(u),a=start.distanceTo(point(l)),b=point(l).distanceTo(point(h)),dir=target.clone().sub(start),d=Math.min(dir.length(),a+b-.001);dir.normalize();const along=(a*a-b*b+d*d)/(2*d),bend=point(l).sub(start).addScaledVector(dir,-point(l).sub(start).dot(dir));if(bend.lengthSq()<1e-5)bend.set(side==='r'?-1:1,-1,0);bend.normalize();aim(u,l,start.clone().addScaledVector(dir,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along))));aim(l,h,start.clone().addScaledVector(dir,d));};
  const restChest=chest.getWorldQuaternion(new T.Quaternion());
  const weapon=bone('WeaponDrawn'), weaponIndex=doc.nodes.findIndex(n=>n.name==='WeaponDrawn');
  const empty=i=>{delete doc.nodes[i].mesh;for(const c of doc.nodes[i].children??[])empty(c);};
  for(const name of ['WeaponDrawn','SwordDrawn','SwordSheathed']){const i=doc.nodes.findIndex(n=>n.name===name);if(i>=0)empty(i);}
  const chunks=[bin,Buffer.alloc((4-bin.length%4)%4)];let offset=chunks.reduce((n,b)=>n+b.length,0);
  const add=(array,type)=>{const raw=Buffer.from(new Float32Array(array).buffer),view=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:raw.length})-1;chunks.push(raw);offset+=raw.length;
    const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type], a={bufferView:view,componentType:5126,count:array.length/width,type};
    if(type==='SCALAR') {a.min=[Math.min(...array)];a.max=[Math.max(...array)];}
    if(type==='VEC3'){a.min=[0,1,2].map(k=>Math.min(...array.filter((_,i)=>i%3===k)));a.max=[0,1,2].map(k=>Math.max(...array.filter((_,i)=>i%3===k)));}
    return doc.accessors.push(a)-1;
  };
  const maul=family==='minotaur', prefix=maul?'Maul':'Reaper', scale=maul?1:1.5;
  {
    const material=(name,color,metallicFactor,roughnessFactor)=>doc.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...new T.Color(color).toArray(),1],metallicFactor,roughnessFactor}})-1;
    const stone=material('WeatheredStone','#777166',0,.98),iron=material('MaulIronBands','#393733',.75,.73),wood=material('MaulAshHaft','#513521',0,.9),wrap=material('MaulLeather','#30241d',0,.95);
    const piece=(g,mat)=>{g=g.index?g.toNonIndexed():g;if(!maul)g.scale(1,.8,1);const attributes={};for(const [name,key,type]of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2'],['color','COLOR_0','VEC3']])if(g.attributes[name])attributes[key]=add(Array.from(g.attributes[name].array),type);
      const mesh=doc.meshes.push({primitives:[{attributes,material:mat}]})-1,node=doc.nodes.push({name:`${prefix}Part`,mesh})-1;doc.nodes[weaponIndex].children.push(node);};
    const shaft=(r,a,b,mat)=>piece(new T.CylinderGeometry(r,r,b-a,10).translate(0,(a+b)/2,0),mat);
    if(maul){
    shaft(.029,-.30,.92,wood);shaft(.034,-.17,.12,wrap);shaft(.034,.29,.54,wrap);
    // Broad chipped stone head with two dark iron hoops, no texture/download dependency.
    const head=new T.BoxGeometry(.52,.30,.30,6,4,4),pos=head.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const bevel=1-.07*(Math.abs(y)/.18)*(Math.abs(z)/.17);pos.setXYZ(i,x*bevel,y+.92,z*bevel);}head.computeVertexNormals();const colors=[];for(let i=0;i<pos.count;i++){const n=Math.sin(pos.getX(i)*93+pos.getY(i)*157+pos.getZ(i)*71)*43758.5,v=.62+.36*(n-Math.floor(n));colors.push(v,v*.98,v*.92);}head.setAttribute('color',new T.Float32BufferAttribute(colors,3));piece(head,stone);
    for(const x of [-.17,.17])piece(new T.BoxGeometry(.055,.315,.315).translate(x,.92,0),iron);
    doc.nodes[weaponIndex].extras={weapon:'maul',contact:{from:.73,to:1.11},contactByClip:{Maul_Thrust:{from:.25,to:.65}}};
    } else {
      const dark=material('ReaperBlackenedAsh','#211f23',.05,.82), metal=material('ReaperForgedSteel','#626d78',.8,.48), edge=material('ReaperHonedEdge','#bbc4c8',.85,.29);
      const curve=new T.CatmullRomCurve3([new T.Vector3(.07,-.78,0),new T.Vector3(0,-.28,0),new T.Vector3(0,.50,0),new T.Vector3(.07,1.15,0)]);
      piece(new T.TubeGeometry(curve,32,.024,10,false),dark);
      shaft(.029,-.16,.12,wrap);shaft(.029,.26,.53,wrap);
      shaft(.035,1.01,1.17,metal);shaft(.031,-.80,-.72,metal);
      // A long, thin crescent in the shaft plane, with a separate bright cutting bevel.
      const blade=new T.Shape();blade.moveTo(.07,1.15);blade.bezierCurveTo(-.25,1.52,-.80,1.52,-1.12,1.02);blade.bezierCurveTo(-.70,1.31,-.24,1.29,.07,1.04);blade.closePath();
      piece(new T.ExtrudeGeometry(blade,{depth:.025,bevelEnabled:true,bevelThickness:.006,bevelSize:.007,bevelSegments:1,steps:1,curveSegments:20}).translate(0,0,-.0125),metal);
      const bevel=new T.Shape();bevel.moveTo(.07,1.04);bevel.bezierCurveTo(-.24,1.29,-.70,1.31,-1.12,1.02);bevel.bezierCurveTo(-.70,1.35,-.24,1.33,.07,1.09);bevel.closePath();
      piece(new T.ExtrudeGeometry(bevel,{depth:.029,bevelEnabled:false,steps:1,curveSegments:20}).translate(0,0,-.0145),edge);
      const start=new T.Vector3(-.25,1.21*.8,0),end=new T.Vector3(-1.10,1.035*.8,0),direction=end.clone().sub(start);
      const contact={from:0,to:direction.length()};
      const node=doc.nodes.push({name:'ReaperEdge',translation:start.toArray(),rotation:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()).toArray(),extras:{contact}})-1;
      doc.nodes[weaponIndex].children.push(node);
      doc.nodes[weaponIndex].extras={weapon:'reaper',contactNode:'ReaperEdge'};
    }
  }
  const qWeapon=weapon.quaternion.clone();
  const bodyMesh=bone('CreatureBody');bodyMesh.skeleton.update();
  const palms={};for(const side of ['l','r']){const hand=bone('hand_'+side),joint=new Set(bodyMesh.skeleton.bones.flatMap((b,i)=>/^(hand|thumb|index|middle|ring|pinky)_/.test(b.name)&&b.name.endsWith('_'+side)?[i]:[])),sum=new T.Vector3();let count=0;for(let i=0;i<bodyMesh.geometry.attributes.position.count;i++){let weight=0;for(let k=0;k<4;k++)if(joint.has(bodyMesh.geometry.attributes.skinIndex.getComponent(i,k)))weight+=bodyMesh.geometry.attributes.skinWeight.getComponent(i,k);if(weight>.5){const p=bodyMesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(bodyMesh.matrixWorld);sum.add(hand.worldToLocal(p));count++;}}palms[side]=count?sum.divideScalar(count):new T.Vector3(0,.045,0);}

  if(!maul){weapon.position.copy(palms.r);doc.nodes[weaponIndex].translation=weapon.position.toArray();}
  // Hand frames derive from the actual wrist/finger landmarks, independently for each side.
  const frame=(finger,palm)=>{const x=finger.clone().normalize(),z=palm.clone().addScaledVector(x,-palm.dot(x)).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,z.clone().cross(x),z));};
  const local={};for(const side of ['r','l']){
    const finger=bone('middle_01_'+side).position.clone(), thumb=bone('thumb_01_'+side).position.clone();
    const palm=finger.clone().cross(thumb).normalize().multiplyScalar(side==='r'?1:-1);
    local[side]=frame(finger,palm).invert();
  }
  const rest=maul?{r:[-.24,-.26,.15],l:[.20,-.14,.42],dir:[.55,.04,.82]}:{r:[-.24,-.30,.23],l:[.20,-.12,.38],dir:[.64,.74,.20]};
  const key=(t,r,l,dir)=>({t,r,l,dir});
  const seq={
    Slash:maul?[key(0,...[rest.r,rest.l,rest.dir]),key(.17,[-.10,-.18,.18],rest.l,[-.78,.12,.60]),key(.34,[-.22,-.28,.30],rest.l,[.22,-.10,1]),key(.52,[-.16,-.24,.20],rest.l,[.84,-.10,.54]),key(1,rest.r,rest.l,rest.dir)]:[key(0,rest.r,rest.l,rest.dir),key(.17,[-.18,-.22,.20],rest.l,[-.55,.08,.83]),key(.34,[-.22,-.43,.34],rest.l,[.65,-.12,.75]),key(.75,[-.16,-.35,.22],rest.l,[.96,-.16,.23]),key(1,rest.r,rest.l,rest.dir)],
    Heavy:[key(0,rest.r,rest.l,rest.dir),key(.28,[-.25,.30,.22],[.25,.30,.22],[.15,.92,.30]),key(.40,[-.25,-.38,.30],[.25,-.18,.36],[.20,-.12,1]),key(.48,[-.20,-.40,.40],[.20,-.40,.40],[.12,-.28,1]),key(.64,[-.22,-.50,.25],[.22,-.50,.25],[.2,-.45,.9]),key(1,rest.r,rest.l,rest.dir)],
    Thrust:[key(0,rest.r,rest.l,rest.dir),key(.17,[-.30,-.24,.05],[.30,-.24,.12],rest.dir),key(.34,[-.13,-.26,.42],[.20,-.26,.40],[.08,-.10,1]),key(.5,[-.13,-.26,.42],[.20,-.26,.40],[.08,-.10,1]),key(1,rest.r,rest.l,rest.dir)],
  };
  const made=[];
  for(const [name,body]of [['Idle','Idle'],['Walk','ArmedWalk'],['StrafeLeft','StrafeLeft'],['StrafeRight','StrafeRight'],['Slash','Idle'],['Heavy','Idle'],['Thrust','Idle'],['Guard','Idle'],['Hit','Hit'],['Death','Death'],['Kick','Kick'],['Roll','Roll']]){
    const source=asset.animations.find(c=>c.name===body),duration=['Idle','Walk','StrafeLeft','StrafeRight','Hit','Death','Kick','Roll'].includes(name)?source.duration:1;
    const times=Array.from({length:Math.ceil(duration*30)+1},(_,i)=>i/Math.ceil(duration*30)*duration), rotations=new Map(bones.map(b=>[b.name,[]])),positions=[];
    for(const time of times){const t=time/duration;play(body,t);if(!maul && seq[name]){const pelvis=bone('pelvis'),drop=.18*Math.min(1,t/.17,(1-t)/.15);pelvis.position.copy(pelvis.parent.worldToLocal(point(pelvis).add(new T.Vector3(0,-drop,0))));scene.updateMatrixWorld(true);}if(maul && name==='Thrust'){const spine=bone('spine_01'),q=spine.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.3*Math.min(1,t/.17,(1-t)/.2)));spine.quaternion.copy(spine.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));scene.updateMatrixWorld(true);}const origin=point(chest);let pose=rest;
      if(seq[name]){const keys=seq[name],i=Math.max(0,keys.findIndex(k=>k.t>=t)-1),a=keys[i],b=keys[Math.min(i+1,keys.length-1)],f=(t-a.t)/(b.t-a.t||1);pose=Object.fromEntries(['r','l','dir'].map(k=>[k,a[k].map((v,j)=>T.MathUtils.lerp(v,b[k][j],f))]));}
      if(maul && name==='Thrust'){const blend=Math.min(1,t/.17,(1-t)/.2);pose={...pose,r:pose.r.map((v,i)=>T.MathUtils.lerp(v,[-.27,-.20,.48][i],blend)),dir:pose.dir.map((v,i)=>T.MathUtils.lerp(v,[.65,-.10,.76][i],blend))};}
      if(!maul && name==='Thrust' && t>=.25 && t<=.75)pose={r:[-.13,-.42,.34],l:rest.l,dir:[.25,-.16,1]};
      if(!maul && seq[name]){pose={...pose,dir:[pose.dir[0]+.38,pose.dir[1],pose.dir[2]],r:[pose.r[0],pose.r[1]-.06,pose.r[2]]};}
      if(name==='Guard')pose={r:[-.26,-.10,.36],l:[.26,-.10,.36],dir:[.78,.5,.38]};
      const follow=['Death','Roll'].includes(name)?chest.getWorldQuaternion(new T.Quaternion()).multiply(restChest.clone().invert()):new T.Quaternion();
      const shaft=new T.Vector3(...pose.dir).normalize().applyQuaternion(follow);
      for(const side of ['r','l']){
        const hand=bone('hand_'+side);let goal=origin.clone().add(new T.Vector3(...pose[side]).applyQuaternion(follow));if(!maul && side==='r'){goal.x+=.07;goal.z-=.08;}
        let orientation;
        {
          const cross=new T.Vector3(0,1,0).cross(shaft).normalize();
          const wq=maul?new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft):new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(cross,shaft,cross.clone().cross(shaft)));
          if(side==='r')orientation=wq.multiply(qWeapon.clone().invert());
          else {scene.updateMatrixWorld(true);let target=weapon.localToWorld(new T.Vector3(0,.38,0));const palm=shaft.clone().cross(new T.Vector3(0,1,0)).normalize();orientation=frame(new T.Vector3(0,-1,0),palm).multiply(local.l);const offset=palms.l.clone().applyQuaternion(orientation),shoulder=point(bone('upperarm_l')),length=shoulder.distanceTo(point(bone('lowerarm_l')))+point(bone('lowerarm_l')).distanceTo(point(hand))-.015;let score=Infinity;for(let along=.10;along<=.501;along+=.01){const candidate=weapon.localToWorld(new T.Vector3(0,along,0)).sub(offset);const cost=Math.max(0,candidate.distanceTo(shoulder)-length)*100+Math.abs(along-.38);if(cost<score){score=cost;goal=candidate;}}}
        }
        reach(side,goal);if(process.env.CREATURE_DEBUG && name==='Thrust' && Math.abs(t-1/3)<.001)console.log(family,side,'goal',goal.toArray(),'hand',point(hand).toArray());hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation));scene.updateMatrixWorld(true);
      }
      positions.push(...bone('pelvis').position.toArray());for(const b of bones)rotations.get(b.name).push(...b.quaternion.toArray());
    }
    const input=add(times,'SCALAR'),animation={name:`${prefix}_${name}`,samplers:[],channels:[]};
    for(const [n,values,property]of [['pelvis',positions,'translation'],...bones.map(b=>[b.name,rotations.get(b.name),'rotation'])]){const output=add(values,property==='translation'?'VEC3':'VEC4'),sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;animation.channels.push({sampler,target:{node:doc.nodes.findIndex(b=>b.name===n),path:property}});}
    doc.animations.push(animation);made.push(animation.name);
  }
  doc.extras={...doc.extras,creatureWeaponBase:base,creatureWeapon:{id:maul?'maul':'reaper',generator:hash(await fs.readFile(import.meta.filename)),scale,clips:made}};
  doc.buffers=[{byteLength:offset}];const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);bin=Buffer.concat(chunks);
  const out=Buffer.alloc(28+json.length+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);await fs.writeFile(file,out);console.log(family,made.length,'clips',out.length,'bytes');
}
