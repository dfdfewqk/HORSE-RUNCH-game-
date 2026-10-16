'use strict';
const assert=require('node:assert/strict');
const T=require('../systems/npc-turnover.js');
function make(age=3,id=1,retired=false){return{id,name:`말${id}`,age,retired,speed:75,stamina:74,power:70,rating:70,caps:{speed:89,stamina:89,power:89},history:[{year:1,place:1}]};}
let nextId=300;
const farms=[
 {name:'그랜드 스터드',named:true,stalls:75,horses:Array.from({length:65},(_,i)=>make(5,i+1))},
 {name:'블루힐 팜',named:true,stalls:50,horses:Array.from({length:40},(_,i)=>make(5,i+70))},
 {name:'윈드필드 목장',named:true,stalls:65,horses:Array.from({length:55},(_,i)=>make(5,i+120))},
 {name:'노스밸리 목장',named:true,stalls:55,horses:Array.from({length:45},(_,i)=>make(5,i+180))},
 {name:'레드크라운 목장',named:true,stalls:8,horses:Array.from({length:3},(_,i)=>make(3,i+240))},
 {name:'청마목장',horses:Array.from({length:18},(_,i)=>make(5,i+250))}
];
const world={year:1,npcs:farms,horses:[make(3,900)],npcTurnover:null};
assert.equal(T.ensure(world).lastYear,1);
const snapshots=farms.flatMap(n=>n.horses).map(h=>JSON.stringify(h));
const player=JSON.stringify(world.horses);
world.year=2;
const result=T.advance(world,(spec,ranch,y)=>({id:nextId++,name:`새말${nextId}`,age:spec.age,
 speed:spec.stats.speed,stamina:spec.stats.stamina,power:spec.stats.power,caps:{speed:spec.gp,stamina:spec.gp,power:spec.gp},
 retired:false,starts:spec.experience.starts,wins:spec.experience.wins,history:[], rating:72 }));
assert.equal(result.applied,true);
assert.equal(result.ranches.length,6);
assert.ok(result.added>=6);
assert.equal(result.ranches.filter(r=>r.named).length,5);
assert.equal(JSON.stringify(world.horses),player,'player untouched');
assert.deepEqual(farms.flatMap(n=>n.horses).filter(h=>h.id<300).map(h=>JSON.stringify(h)),snapshots,'existing horses and records preserved');
assert.ok(farms.every(n=>n.horses.length<=100 && n.horses.length<=n.stalls));
assert.ok(farms.flatMap(n=>n.horses).filter(h=>h.id>=300).every(h=>h.age>=2&&h.age<=4&&h.npcArrival.year===2));
const counts=farms.map(n=>n.horses.length);
assert.equal(T.advance(world,()=>{throw Error('duplicate annual renewal')}).applied,false,'year idempotent');
assert.deepEqual(farms.map(n=>n.horses.length),counts,'no duplicate arrivals');
const copy=JSON.parse(JSON.stringify(world));
assert.equal(T.advance(copy,()=>{throw Error('restored save must not regenerate')}).applied,false);
assert.equal(copy.npcTurnover.lastYear,2);
// Full ranch preserves living retired horses, no fake deaths or record deletion.
const retired=Array.from({length:100},(_,i)=>make(13,1000+i,true));
const full={year:8,npcs:[{name:'로열힐',named:true,stalls:100,horses:retired}],horses:[]};
T.ensure(full); full.year=9;
assert.equal(T.advance(full,()=>{throw Error('should not generate at cap')}).added,0);
assert.equal(full.npcs[0].horses.length,100);
assert.equal(full.npcs[0].horses.filter(h=>h.retired).length,100);
// New system on an existing late save must not retroactively spawn years of newcomers.
const legacy={year:14,npcs:[{name:'레드크라운 목장',named:true,stalls:8,horses:[]}],horses:[]};
assert.equal(T.ensure(legacy).lastYear,14);
assert.equal(T.advance(legacy,()=>{throw Error('retroactive spawn')}).applied,false);
console.log('HORSE RANCH 20.8 NPC annual renewal OK');
