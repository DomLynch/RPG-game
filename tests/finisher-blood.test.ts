import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Texture, Vector3 } from 'three';
import { createFinisherBlood, type BloodSource } from '../src/finisher-blood.ts';

test('finisher blood falls from a moving wound, lands on the sand, grows at the landing and stays bounded', () => {
  const blood=createFinisherBlood(new Texture());
  const source: BloodSource={site:'jugular',position:new Vector3(4,1.5,-3),direction:new Vector3(1,0,0),strength:1};
  for(let frame=0;frame<600;frame++) {
    if(frame>50 && frame<150) {source.position.x-=.01;source.position.y=Math.max(.15,source.position.y-.014);}
    blood.update(1/60,'quietOne',Math.min(1,frame/192),[source],'red');
    const state=blood.inspect();
    assert.ok(state.airborne<=160 && state.pools.length<=80);
    assert.ok(state.pools.every(p=>p.position[1]>=.02 && p.position[1]<.04));
  }
  const state=blood.inspect();
  assert.ok(state.emitted>200 && state.landed>200,'substantially more than the original twelve-particle burst');
  assert.equal(state.airborne,0,'bleeding tapers out instead of an endless fountain');
  assert.ok(state.pools.some(p=>Math.hypot(p.position[0]-source.position.x,p.position[2]-source.position.z)<.3 && p.radius>.4),'pool grows beside final wound');
  assert.ok(state.pools.every(p=>Math.hypot(p.position[0],p.position[2])>2),'floor spills stay at the wound and flight landings, not arena origin');
  const before=JSON.stringify(state);blood.update(0,'quietOne',1,[source],'red');assert.equal(JSON.stringify(blood.inspect()),before,'zero-dt does not add blood');
  blood.update(1/60,'quietOne',1,[source],'off');assert.equal(blood.group.visible,false);
  blood.update(1/60,'quietOne',1,[source],'dark');assert.equal(blood.group.visible,true);
  blood.update(1/60,null,0,[],'red');assert.equal(blood.inspect().pools.length,0);assert.equal(blood.group.visible,false);
  blood.dispose();
});

test('off never emits, changing the finisher clears old pools, resources are owned without disposing the borrowed texture', () => {
  const map=new Texture(),blood=createFinisherBlood(map),source={site:'waist',position:new Vector3(1,.2,2),direction:new Vector3(1,0,0),strength:1.4};
  for(let i=0;i<100;i++)blood.update(1/60,'opened',.8,[source],'off');
  assert.equal(blood.inspect().emitted,0);assert.equal(blood.inspect().pools.length,0);
  for(let i=0;i<100;i++)blood.update(1/60,'opened',.8,[source],'red');
  assert.ok(blood.inspect().pools.length>0);
  blood.update(0,'runThrough',0,[],'red');assert.equal(blood.inspect().pools.length,0);
  let disposed=0,textureDisposed=0;map.addEventListener('dispose',()=>textureDisposed++);
  for(const child of blood.group.children) { const mesh=child as InstancedMesh;mesh.geometry.addEventListener('dispose',()=>disposed++);(mesh.material as import('three').Material).addEventListener('dispose',()=>disposed++); }
  blood.dispose();assert.equal(disposed,4);assert.equal(textureDisposed,0);
});


test('enabling blood after an off-mode finish restores nearby pools without replaying the jets', () => {
  const blood=createFinisherBlood(new Texture()),source={site:'jugular',position:new Vector3(3,.15,4),direction:new Vector3(1,0,0),strength:1};
  for(let i=0;i<600;i++)blood.update(1/60,'quietOne',1,[source],'off');
  blood.update(1/60,'quietOne',1,[source],'red');
  assert.equal(blood.inspect().emitted,0);assert.equal(blood.inspect().pools.length,1);
  for(let i=0;i<180;i++)blood.update(1/60,'quietOne',1,[source],'red');
  assert.ok(blood.inspect().pools[0].radius>.5);assert.equal(blood.inspect().airborne,0);
  blood.dispose();
});
