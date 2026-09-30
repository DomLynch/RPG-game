import fs from 'node:fs';import {MeshoptSimplifier as S} from 'meshoptimizer';await S.ready;
const name=process.argv[2],cap=Number(process.argv[3]);const root=new URL('../props/'+name+'/',import.meta.url);const b=fs.readFileSync(new URL('donor.glb',root));const n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);
function acc(i){const a=d.accessors[i],v=d.bufferViews[a.bufferView],dims={SCALAR:1,VEC3:3,VEC2:2}[a.type],T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];const raw=bin.subarray((v.byteOffset??0)+(a.byteOffset??0));const copy=Uint8Array.from(raw.subarray(0,a.count*dims*T.BYTES_PER_ELEMENT));return new T(copy.buffer);}
const p=d.meshes[0].primitives[0],pos=acc(p.attributes.POSITION),idx=acc(p.indices);const unique=[],mapping=new Uint32Array(pos.length/3),lookup=new Map();
for(let i=0;i<mapping.length;i++){const xyz=Array.from(pos.subarray(i*3,i*3+3)),key=xyz.map(v=>Math.round(v*1e6)).join(',');if(!lookup.has(key)){lookup.set(key,unique.length/3);unique.push(...xyz);}mapping[i]=lookup.get(key);}
const positions=new Float32Array(unique);const indices=Uint32Array.from(idx,i=>mapping[i]);let [reduced,error]=S.simplify(indices,positions,3,(cap-20)*3,.03,['Prune']);let method='quadric welded';
if(reduced.length>cap*3){[reduced,error]=S.simplifySloppy(indices,positions,3,null,(cap-20)*3,.05);method='spatial simplify';}
if(reduced.length>cap*3||!reduced.length)throw Error('cap not met '+reduced.length/3);
const [remap,count]=S.compactMesh(reduced);const v=new Float32Array(count*3);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)v.set(positions.subarray(i*3,i*3+3),remap[i]*3);
fs.writeFileSync(new URL('lowmesh.json',root),JSON.stringify({positions:Array.from(v),indices:Array.from(reduced),coordinate:'original GLB Y-up',method,error,triangles:reduced.length/3,vertices:count}));console.log(JSON.stringify({name,triangles:reduced.length/3,vertices:count,error,method}));
