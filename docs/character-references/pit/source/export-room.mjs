import fs from 'node:fs';
import * as THREE from 'three';
// Snapshot-only scale correction to the brief's 3.2m crown; canonical game untouched.
const style=fs.readFileSync(new URL('../inputs/styles.ts',import.meta.url),'utf8').replace('height: 3.4','height: 2.8').replace('height: 2.3','height: 2.8');
fs.writeFileSync(new URL('../inputs/styles.ts',import.meta.url),style);
const roomURL=new URL('../inputs/room.ts',import.meta.url);fs.writeFileSync(roomURL,fs.readFileSync(roomURL,'utf8').replaceAll('H, 0.9, 10, T','H, 0.4, 10, T'));
const {buildRoom,POSES}=await import('../inputs/room.ts');
const scene=new THREE.Scene();
const r=buildRoom({scene,grade(){},pieces:async()=>[],loot:()=>({owned:[],equipped:{},taken:{}})});await r.ready;scene.updateMatrixWorld(true);
const materials=[],meshes=[],lights=[];
const matid=m=>{let i=materials.findIndex(a=>a.uuid===m.uuid);if(i>=0)return i;
let map=m.map?.image;const record={uuid:m.uuid,type:m.type,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,map:map?.data?{width:map.width,height:map.height,data:Array.from(map.data)}:null}; materials.push(record);return materials.length-1;};
r.group.traverse(o=>{if(o.isMesh){let g=o.geometry;meshes.push({name:o.name,position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal?.array??[]),uv:Array.from(g.attributes.uv?.array??[]),indices:Array.from(g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i)),matrix:o.matrixWorld.toArray(),material:matid(o.material)});}if(o.isLight){lights.push({type:o.type,color:o.color.toArray(),intensity:o.intensity,position:o.getWorldPosition(new THREE.Vector3()).toArray(),target:o.target?.getWorldPosition(new THREE.Vector3()).toArray(),angle:o.angle});}});
fs.writeFileSync(new URL('../inputs/room-snapshot.json',import.meta.url),JSON.stringify({revision:'58ad2798',crown:3.2,wallTop:2.8,poses:POSES,materials,meshes,lights}));console.log(JSON.stringify({meshes:meshes.length,materials:materials.length,lights:lights.length}));
