import {BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix3, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3, type BufferAttribute} from 'three';

export const DISARMED_BEATS = {arm:.16,neck:.58,settle:.96,duration:3.2} as const;

type Vertex = {attributes:Record<string,number[]>; weight:number};
// Prepared at the authored arm-contact pose outside combat. Split the actual skin/clothing at
// the forearm influence boundary, retaining skinning on the stump and baking the falling arm.
export function prepareDisarmed(root:Object3D, anchor:Group) {
  root.updateWorldMatrix(true,true);root.updateMatrixWorld(true);
  const elbow=root.getObjectByName('lowerarm_r')!,hand=root.getObjectByName('hand_r')!;
  const descendants=new Set<Object3D>();elbow.traverse(o=>descendants.add(o));
  const inverse=anchor.matrixWorld.clone().invert(),pivot=elbow.getWorldPosition(new Vector3()).applyMatrix4(inverse);
  const axis=hand.getWorldPosition(new Vector3()).applyMatrix4(inverse).sub(pivot).normalize();
  const across=new Vector3(0,1,0).cross(axis);if(across.lengthSq()<.01)across.set(1,0,0).cross(axis);across.normalize();
  const along=axis.clone().cross(across).normalize();
  const group=new Group();group.name='DisarmedArm';group.position.copy(pivot);group.visible=false;
  const cut=new MeshStandardMaterial({color:'#501c20',roughness:.9,side:DoubleSide});
  const changes:{mesh:SkinnedMesh;original:BufferGeometry;remainder:BufferGeometry;cap:SkinnedMesh|null}[]=[];
  const weapon=root.getObjectByName('WeaponDrawn') ?? root.getObjectByName('SwordDrawn');
  const weaponVisible=weapon?.visible ?? true;
  const supports:number[]=[];
  const geometry=(triangles:Vertex[],materials:number[]=[])=>{
    const g=new BufferGeometry(),remap=new Map<Vertex,number>(),values:Record<string,number[]>={},indices:number[]=[];
    for(const v of triangles){let index=remap.get(v);if(index===undefined){index=remap.size;remap.set(v,index);for(const [name,array] of Object.entries(v.attributes))(values[name]??=[]).push(...array);}indices.push(index);}
    if(triangles.length)for(const [name,array] of Object.entries(values))g.setAttribute(name,new Float32BufferAttribute(array,triangles[0].attributes[name].length));
    g.setIndex(indices);
    for(let i=0;i<materials.length;){let end=i+1;while(end<materials.length && materials[end]===materials[i])end++;g.addGroup(i*3,(end-i)*3,materials[i]);i=end;}
    return g;
  };
  const interpolate=(a:Vertex,b:Vertex,t:number):Vertex=>{
    const attributes:Record<string,number[]>={};
    for(const [name,values] of Object.entries(a.attributes))if(name!=='skinIndex' && name!=='skinWeight')attributes[name]=values.map((x,i)=>x+(b.attributes[name][i]-x)*t);
    const weights=new Map<number,number>();
    for(const [v,amount] of [[a,1-t],[b,t]] as const)for(let i=0;i<4;i++){const index=v.attributes.skinIndex[i];weights.set(index,(weights.get(index)??0)+v.attributes.skinWeight[i]*amount);}
    const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4);while(top.length<4)top.push([0,0]);const sum=top.reduce((s,v)=>s+v[1],0);
    attributes.skinIndex=top.map(v=>v[0]);attributes.skinWeight=top.map(v=>v[1]/sum);
    return {attributes,weight:a.weight+(b.weight-a.weight)*t};
  };
  function bake(mesh:Mesh,g:BufferGeometry) {
    const skin=mesh instanceof SkinnedMesh ? mesh : null,position=g.getAttribute('position'),normal=g.getAttribute('normal');
    const world=inverse.clone().multiply(mesh.matrixWorld),normalMatrix=new Matrix3().getNormalMatrix(world);
    const positions:number[]=[],normals:number[]=[],v=new Vector3(),n=new Vector3();
    skin?.skeleton.update();
    const temporary=skin ? new SkinnedMesh(g,mesh.material) : null;
    if(temporary && skin){temporary.bind(skin.skeleton,skin.bindMatrix);temporary.bindMatrixInverse.copy(skin.bindMatrixInverse);}
    for(let i=0;i<position.count;i++){
      if(temporary)temporary.getVertexPosition(i,v);else v.fromBufferAttribute(position,i);
      v.applyMatrix4(world).sub(pivot);positions.push(...v.toArray());supports.push(...v.toArray());
      n.fromBufferAttribute(normal,i);
      if(skin){const blend=new Matrix4();blend.elements.fill(0);for(let k=0;k<4;k++){const b=g.getAttribute('skinIndex').getComponent(i,k),w=g.getAttribute('skinWeight').getComponent(i,k);for(let e=0;e<16;e++)blend.elements[e]+=skin.skeleton.boneMatrices![b*16+e]*w;}blend.premultiply(skin.bindMatrixInverse).multiply(skin.bindMatrix);n.applyMatrix3(new Matrix3().getNormalMatrix(blend));}
      n.applyMatrix3(normalMatrix).normalize();normals.push(...n.toArray());
    }
    const baked=g.clone();baked.deleteAttribute('skinIndex');baked.deleteAttribute('skinWeight');baked.deleteAttribute('tangent');baked.boundingBox=null;baked.boundingSphere=null;baked.setAttribute('position',new Float32BufferAttribute(positions,3));baked.setAttribute('normal',new Float32BufferAttribute(normals,3));
    const prop=new Mesh(baked,mesh.material);prop.name=mesh.name;prop.castShadow=true;prop.receiveShadow=true;prop.frustumCulled=false;group.add(prop);
  }
  root.traverse(object=>{
    if(!(object instanceof SkinnedMesh))return;
    const g=object.geometry as BufferGeometry,skinIndex=g.getAttribute('skinIndex'),skinWeight=g.getAttribute('skinWeight');if(!skinIndex || !skinWeight)return;
    const selected=object.skeleton.bones.map(b=>descendants.has(b)),vertices:Vertex[]=[];
    for(let i=0;i<g.getAttribute('position').count;i++){
      const attributes:Record<string,number[]>={};for(const [name,a] of Object.entries(g.attributes) as [string,BufferAttribute][])attributes[name]=Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k));
      let weight=0;for(let k=0;k<4;k++)if(selected[skinIndex.getComponent(i,k)])weight+=skinWeight.getComponent(i,k);
      vertices.push({attributes,weight});
    }
    if(!vertices.some(v=>v.weight>.5))return;
    const halves:Vertex[][]=[[],[]],materialIndices:number[][]=[[],[]],boundary:Vertex[]=[];
    for(let i=0;i<(g.index?.count??vertices.length);i+=3){
      const tri=[0,1,2].map(k=>vertices[g.index ? g.index.getX(i+k) : i+k]);
      const intersections=new Map<string,Vertex>();
      for(const side of [0,1]){
        const polygon:Vertex[]=[];
        for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],inside=side ? a.weight>=.5 : a.weight<=.5;if(inside)polygon.push(a);
          if((a.weight<.5 && b.weight>.5)||(a.weight>.5 && b.weight<.5)){const key=String(k);let v=intersections.get(key);if(!v){v=interpolate(a,b,(.5-a.weight)/(b.weight-a.weight));intersections.set(key,v);boundary.push(v);}polygon.push(v);}
        }
        for(let k=1;k<polygon.length-1;k++){halves[side].push(polygon[0],polygon[k],polygon[k+1]);if(Array.isArray(object.material))materialIndices[side].push(g.groups.find(part=>i>=part.start && i<part.start+part.count)?.materialIndex??0);}
      }
    }
    const remainder=geometry(halves[0],materialIndices[0]),severed=geometry(halves[1],materialIndices[1]);bake(object,severed);severed.dispose();
    // Convex outer rim closes layered arm wraps without overlapping coplanar tissue fans.
    const posed=(v:Vertex)=>{const p=new Vector3().fromArray(v.attributes.position),sum=new Vector3(),q=new Vector3();p.applyMatrix4(object.bindMatrix);for(let k=0;k<4;k++){q.copy(p).applyMatrix4(new Matrix4().fromArray(object.skeleton.boneMatrices!,v.attributes.skinIndex[k]*16));sum.addScaledVector(q,v.attributes.skinWeight[k]);}return sum.applyMatrix4(object.bindMatrixInverse).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);};
    object.skeleton.update();const points=boundary.map(v=>{const p=posed(v);return{v,x:p.dot(across),y:p.dot(along)};}).sort((a,b)=>a.x-b.x||a.y-b.y);
    type Point=(typeof points)[number];const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const chain=(input:Point[])=>{const result:Point[]=[];for(const p of input){while(result.length>1 && cross(result.at(-2)!,result.at(-1)!,p)<=0)result.pop();result.push(p);}return result;};
    const front=chain(points),back=chain([...points].reverse()),hull=[...front.slice(0,-1),...back.slice(0,-1)];
    if(hull.length<3){changes.push({mesh:object,original:g,remainder,cap:null});return;} // a whole detached wrap has no cross-section; the skin closes the limb
    let center=hull[0].v;for(let i=1;i<hull.length;i++)center=interpolate(center,hull[i].v,1/(i+1));
    const capTriangles:Vertex[]=[];for(let i=0;i<hull.length;i++)capTriangles.push(center,hull[i].v,hull[(i+1)%hull.length].v);
    const capGeometry=geometry(capTriangles);capGeometry.computeVertexNormals();
    const cap=new SkinnedMesh(capGeometry,cut);cap.name='ArmStump';cap.bind(object.skeleton,object.bindMatrix);cap.bindMatrixInverse.copy(object.bindMatrixInverse);cap.position.copy(object.position);cap.quaternion.copy(object.quaternion);cap.scale.copy(object.scale);cap.matrixWorld.copy(object.matrixWorld);cap.frustumCulled=false;cap.visible=false;
    const count=group.children.length;bake(cap,capGeometry);group.children[count].name='ArmCut';
    changes.push({mesh:object,original:g,remainder,cap});
  });
  weapon?.traverse(o=>{if(o instanceof Mesh)bake(o,o.geometry);});
  const weaponAxis=new Vector3(0,1,0).transformDirection(weapon ? inverse.clone().multiply(weapon.matrixWorld) : new Matrix4());
  const flat=new Quaternion().setFromUnitVectors(weaponAxis,new Vector3(1,0,0)),rest=flat.clone();
  let best=Infinity;
  for(let i=0;i<48;i++){
    const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),i*Math.PI/24).multiply(flat),m=new Matrix4().makeRotationFromQuaternion(q).elements;
    let low=Infinity,high=-Infinity;for(let j=0;j<supports.length;j+=3){const y=m[1]*supports[j]+m[5]*supports[j+1]+m[9]*supports[j+2];low=Math.min(low,y);high=Math.max(high,y);}
    if(high-low<best){best=high-low;rest.copy(q);}
  }
  let active=false;
  return {
    group,
    apply(progress:number,mode:'red'|'dark'|'off') {
      const shown=mode!=='off' && progress>=DISARMED_BEATS.arm;
      for(const change of changes){change.mesh.geometry=shown ? change.remainder : change.original;if(change.cap){change.cap.visible=shown;if(shown && !change.cap.parent)change.mesh.parent!.add(change.cap);}}
      if(weapon)weapon.visible=shown ? false : weaponVisible;
      active=shown;group.visible=shown;cut.color.set(mode==='dark' ? '#302126' : '#501c20');
      const elapsed=Math.max(0,(progress-DISARMED_BEATS.arm)*DISARMED_BEATS.duration),fall=Math.min(1,elapsed/.7),ease=fall*fall*(3-2*fall);
      group.quaternion.identity().slerp(rest,ease);group.position.copy(pivot);group.position.x+=.20*ease;
      const m=new Matrix4().makeRotationFromQuaternion(group.quaternion).elements;let floor=Infinity;
      for(let i=0;i<supports.length;i+=3)floor=Math.min(floor,m[1]*supports[i]+m[5]*supports[i+1]+m[9]*supports[i+2]);
      group.position.y=Math.max(.006-floor,pivot.y-.5*12*elapsed*elapsed);
    },
    dispose(){for(const c of changes){c.mesh.geometry=c.original;c.cap?.removeFromParent();c.cap?.geometry.dispose();c.remainder.dispose();}if(active && weapon)weapon.visible=weaponVisible;group.removeFromParent();group.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});cut.dispose();}
  };
}
