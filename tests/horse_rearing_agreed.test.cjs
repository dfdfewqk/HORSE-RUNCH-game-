'use strict';
const assert=require('node:assert/strict');
const R=require('../systems/horse-rearing.js');
const run=(name,fn)=>{fn();console.log('✓ '+name);};
const born=(id)=>({id,name:'foal'+id,age:0,speed:60,stamina:60,power:60,caps:{speed:90,stamina:90,power:90},condition:100,hoof:100,foalEducation:{bornAtDay:1,ageMilestone:0}});
run('180-day pregnancies have stable individual variation',()=>{
 let min=999,max=0;const values=new Set();
 for(let id=1;id<=600;id++){const d=R.gestationDays(id,id+900,3);min=Math.min(min,d);max=Math.max(max,d);values.add(d);assert.equal(d,R.gestationDays(id,id+900,3));}
 assert.ok(min>=170&&max<=190&&values.size>10);
});
run('record mating enforces a rolling 360-day interval and never edits old bookings',()=>{
 const mare={id:1,pregnantUntil:null},old={id:'old',due:1000},world={breedings:[old]};
 const record={id:'new'};const out=R.stampMating(mare,record,200,2);
 assert.equal(out.matingDay,200);assert.equal(out.duration,out.due-200);assert.equal(mare.pregnantUntil,out.due);
 assert.equal(old.due,1000);mare.pregnantUntil=null;
 assert.ok(R.matingRestriction(mare,559));assert.equal(R.matingRestriction(mare,560),null);
 assert.equal(R.nextMatingDay(mare),560);assert.ok(R.pendingParent({breedings:[{mareId:1,sireId:2}]},2));
});
run('pasture expansion charges once and changes the real capacity',()=>{
 const world={money:2000000,horses:[born(1),born(2),born(3)]};
 assert.deepEqual([R.pastureStatus(world).capacity,R.pastureStatus(world).overflow],[2,1]);
 const out=R.expandPasture(world);assert.equal(out.ok,true);assert.equal(world.money,800000);assert.equal(R.pastureStatus(world).overcrowded,false);
 assert.equal(R.expandPasture(world).ok,false);assert.equal(world.money,800000);
});
run('crowding delays but does not destroy inherited age-milestone growth',()=>{
 const world={money:5000000,hrPasture:{hectares:1},horses:[born(1),born(2),born(3)]};
 for(let day=1;day<360;day++)R.rearingDay(world,day);
 const h=world.horses[0];h.age=1;h.foalEducation.ageMilestone=1;for(const k of ['speed','stamina','power'])h[k]+=3;
 const mark=R.rearingDay(world,360);
 assert.ok(mark.delayed>0);assert.ok(h.hrRearing.deferred.speed>0);const after=h.speed;
 R.rearingDay(world,360);assert.equal(h.speed,after);
 const p=R.expandPasture(world);assert.ok(p.ok);
 for(let day=361;day<=420;day++)R.rearingDay(world,day);
 assert.equal(h.hrRearing.deferred.speed,0);assert.equal(h.speed,63);
 assert.equal(h.caps.speed,90);
});
run('sufficient pasture preserves normal age growth and condition',()=>{
 const world={hrPasture:{hectares:2},horses:[born(1),born(2),born(3)]};
 for(let day=1;day<360;day++)R.rearingDay(world,day);
 for(const h of world.horses){h.age=1;h.foalEducation.ageMilestone=1;h.speed+=3;}
 const r=R.rearingDay(world,360);
 assert.equal(r.delayed,0);assert.ok(world.horses.every(h=>h.speed===63&&h.condition===100));
});
run('basic hoof maintenance runs automatically and is idempotent',()=>{
 const h={id:1,hoof:100},w={horses:[h]};let lowest=100;
 for(let day=1;day<=3600;day++){
  h.hoof=Math.max(0,h.hoof-(day%2?1:2));
  const v=h.hoof;
  R.hoofCare(w,day);
  if(day%28===0){const once=h.hoof;R.hoofCare(w,day);assert.equal(h.hoof,once);}
  if(day>60)lowest=Math.min(lowest,h.hoof);
 }
 assert.ok(lowest>40,'ten-year running health must not degrade into zero hoof: '+lowest);
});
