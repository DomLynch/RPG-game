import {Buffer} from 'node:buffer';
// Append only our pair. Re-running replaces only our own last append; never truncate later work.
export async function appendFinisher(file,kind,build) {
  const key=kind[0].toLowerCase()+kind.slice(1)+'Base';
  const fs=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
  const previous=json.extras?.[key],names=['Death_'+kind,'Fin_'+kind];
  if(previous && (json.animations.length!==previous.animations+2 || json.animations.slice(-2).some((a,i)=>a.name!==names[i])))throw Error('Newer animations follow '+kind+'; refusing to truncate');
  if(!previous && json.animations.some(a=>names.includes(a.name)))throw Error('Existing '+kind+' clips have no append provenance');
  if(previous){json.accessors.length=previous.accessors;json.bufferViews.length=previous.views;json.animations.length=previous.animations;}
  const binary=bytes.subarray(28+size,28+size+(previous?.bytes??json.buffers[0].byteLength));
  const base={bytes:binary.length,accessors:json.accessors.length,views:json.bufferViews.length,animations:json.animations.length};
  const parsed=globalThis.structuredClone(json);parsed.images=[];parsed.textures=[];parsed.materials=parsed.materials.map(m=>({name:m.name}));
  parsed.buffers[0]={byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')};
  globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(parsed),'');
  const clips=build(asset.scene,asset.animations).map(c=>c.optimize());
  const chunks=[binary,Buffer.alloc((4-binary.length%4)%4)];let offset=chunks.reduce((n,b)=>n+b.length,0);
  const accessor=(array,type)=>{const buffer=Buffer.from(new Float32Array(array).buffer),view=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length})-1;chunks.push(buffer);offset+=buffer.length;return json.accessors.push({bufferView:view,componentType:5126,count:array.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type,...(type==='SCALAR'?{min:[Math.min(...array)],max:[Math.max(...array)]}:{})})-1;};
  for(const clip of clips){
    const animation={name:clip.name,samplers:[],channels:[]};
    for(const track of clip.tracks){const [name,property]=track.name.split('.'),node=json.nodes.findIndex(n=>n.name===name);if(node<0)throw Error(name);
      const input=accessor(track.times,'SCALAR'),output=accessor(track.values,property==='position'?'VEC3':'VEC4'),sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;animation.channels.push({sampler,target:{node,path:property==='position'?'translation':'rotation'}});
    }
    json.animations.push(animation);
  }
  json.extras={...json.extras,[key]:base};json.buffers[0].byteLength=offset;
  const raw=Buffer.from(JSON.stringify(json)),js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),bin=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
  [0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>header.writeUInt32LE(v,i*4));bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  await fs.writeFile(file,Buffer.concat([header,js,bh,bin]));return {file,addedBytes:offset-base.bytes,clips:clips.map(c=>c.name)};
}


