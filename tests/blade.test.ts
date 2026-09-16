import test from 'node:test';
import assert from 'node:assert/strict';
import { bladeContact, segmentDistance } from '../src/blade.ts';
import { SWORD, initialPractice, stepPractice, PROFILES, type Intent } from '../src/combat.ts';
import { createFighter, stepDuel } from '../src/duel.ts';
import { MOVES, RULES } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';
const actor = { x:0,z:0,heading:0,distance:0 };
test('finite blade distance handles crossing, parallel, endpoints and degenerate segments', () => {
  assert.equal(segmentDistance([-1,1,0],[1,1,0],[0,0,0],[0,2,0]),0);
  assert.equal(segmentDistance([1,0,0],[1,2,0],[0,0,0],[0,2,0]),1);
  assert.equal(segmentDistance([0,3,0],[0,4,0],[0,0,0],[0,2,0]),1);
  assert.equal(segmentDistance([1,1,0],[1,1,0],[0,0,0],[0,2,0]),1);
});
test('blade contact rejects empty space inside the old broad cone and targets behind the fighter', () => {
  for (const [x,z] of [[.85,.85],[0,-1.2],[0,2.5]]) {
    const target={...actor,x,z};
    assert.equal(bladeContact('light_right',SWORD.contact-1,SWORD.contact,actor,actor,target,target),false,`${x},${z}`);
  }
  const target={...actor,z:1.2};
  assert.ok(bladeContact('light_right',SWORD.contact-1,SWORD.contact,actor,actor,target,target));
});
test('a moving target crossing the blade within a tick cannot tunnel through it', () => {
  const before={...actor,x:-1,z:1.1},after={...actor,x:1,z:1.1};
  assert.ok(bladeContact('light_right',SWORD.contact,SWORD.contact,actor,actor,before,after));
});
const idle=():Intent=>({move:{x:0,z:0,yaw:0,run:false},action:null,guard:false,lock:true});
const arena=(gap:number)=>({tick:0,fighters:[createFighter({x:0,z:TARGET.z+gap,heading:Math.PI,distance:0},'ready' as const),createFighter({...TARGET,heading:0,distance:0},'ready' as const)],finish:null,events:[]});
test('locked armed footwork faces the opponent while moving laterally; sweep damage resolves once', () => {
  const s=arena(1.2);
  const next=stepDuel(s,[{...idle(),move:{x:1,z:0,yaw:0,run:false}},{...idle(),lock:false}]);
  assert.ok(next.fighters[0].body.x>s.fighters[0].body.x);
  assert.ok(Math.abs(next.fighters[0].body.heading-Math.atan2(next.fighters[1].body.x-next.fighters[0].body.x,next.fighters[1].body.z-next.fighters[0].body.z))<.1);
  let fight=stepDuel(s,[{...idle(),action:'light'},{...idle(),lock:false}]); let hits=0;
  for(let i=0;i<SWORD.recovery;i++){fight=stepDuel(fight,[idle(),{...idle(),lock:false}]);hits+=fight.events.filter(e=>e.type==='Hit').length;}
  assert.equal(hits,1);assert.equal(fight.fighters[1].health,RULES.health-MOVES.light_right.damage);
});

test('a miss is reported only after follow-through closes, and late contact still hits once', () => {
  const quiet={...PROFILES.easy,aggression:0,parry:0,dodge:0,discipline:101};
  let miss=stepPractice(initialPractice(),{...idle(),action:'light'},quiet);
  for(let i=0;i<SWORD.draw;i++)miss=stepPractice(miss,idle(),quiet);
  miss=stepPractice(miss,{...idle(),action:'light'},quiet);
  for(let i=0;i<SWORD.contact;i++)miss=stepPractice(miss,idle(),quiet);
  assert.equal(miss.result,'none');
  for(let i=0;i<MOVES.light_right.active-1;i++)miss=stepPractice(miss,idle(),quiet);   // the miss is reported as the active window closes
  assert.equal(miss.result,'miss');
  // A target on the edge of reach is still swept during the follow-through ticks after the contact tick.
  const late=arena(1.4); late.fighters[1]={...late.fighters[1],phase:'attack',move:'light_left',age:SWORD.contact-1,lastMove:'light_left'};
  let s=late; let hit=false;
  for(let i=0;i<5;i++){s=stepDuel(s,[{...idle(),move:{x:0,z:-.5,yaw:0,run:false}},idle()]);hit||=s.events.some(e=>e.type==='Hit'&&e.actor===1);}
  assert.ok(hit);assert.equal(s.fighters[0].health,RULES.health-MOVES.light_left.damage);assert.ok(s.fighters[1].landed);
});

test('upright blade regions produce deterministic lethal-location data without renderer bones', () => {
  const weak=arena(1.2); weak.fighters[1]={...weak.fighters[1],health:MOVES.light_right.damage};
  let s=stepDuel(weak,[{...idle(),action:'light'},idle()]);
  for(let i=0;i<25;i++)s=stepDuel(s,[idle(),idle()]);
  assert.equal(s.fighters[1].health,0);assert.equal(s.finish?.victim,1);assert.equal(s.finish?.move,'light_right');
  assert.ok(['head','torso','legs'].includes(s.finish!.location));assert.equal(s.finish?.location,s.fighters[1].woundSite);
  assert.equal(initialPractice().finish,null);
});
