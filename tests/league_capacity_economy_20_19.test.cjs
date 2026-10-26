'use strict';
// Reproducible *diagnostic*, not a claim about actual on-screen save-data population.
// Uses current NPC and economy code, seeded league-sized horses and lightweight result order.
// Run: node tests/league_capacity_economy_20_19.test.cjs
const assert=require('node:assert/strict');
const League=require('../systems/league-schedule.js');
const Npc=require('../systems/npc-auto-racing.js');
const Rules=require('../systems/competition-rules.js');
const Economy=require('../systems/ranch-economy.js');
const Turnover=require('../systems/npc-turnover.js');
const Training=require('../systems/npc-training.js');
const Engine=require('../systems/race-engine.js');
let seed=42,nextId=1;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const rnd=(a,b)=>a+Math.floor(random()*(b-a+1));
function horse(lo,hi,age,starts){
 const rating=rnd(lo,hi),n=starts===undefined?rnd(0,15):starts;
 const h={id:nextId++,name:'Fixture'+nextId,age,rating,speed:rating,stamina:rating,power:rating,
   gender:random()<.5?'수':'암',surface:random()<.65?'잔디':'더트',
   distanceBand:['단거리','마일','중거리','장거리'][rnd(0,3)],style:'선행',
   starts:n,wins:n?rnd(0,Math.floor(n/4)):0,seconds:0,thirds:0,history:[],
   lastRaceIndex:-100,fatigue:0,condition:90,hoof:100,injury:0,retired:false,pedigree:75,
   genetic:{speed:rating,stamina:rating,power:rating},
   caps:{speed:Math.min(rating+8,99),stamina:Math.min(rating+8,99),power:Math.min(rating+8,99)}};
 return h;
}
const ordinary=['청마목장','한빛목장','로열힐','서광목장','그린필드','블루리본','골든브릿지','선샤인팜']
 .map(name=>({name,funds:70000000,stalls:24,horses:Array.from({length:18},()=>horse(58,84,rnd(2,7)))}));
const named=[
 ['그랜드 스터드',65,520000000,.25],['블루힐 팜',40,220000000,.12],
 ['윈드필드 목장',55,370000000,.22],['노스밸리 목장',45,260000000,.13],
 ['레드크라운 목장',3,200000000,0]
].map(([name,count,funds,elite])=>({name,named:true,funds,
 stalls:name==='레드크라운 목장'?8:Math.min(100,count+10),
 horses:Array.from({length:count},()=>{
   const strong=random()<elite;
   return horse(strong?81:64,strong?91:84,rnd(2,6));
 })}));
const world={ranchName:'Fixture Player',year:1,month:1,day:1,money:50000000,stalls:8,
 horses:[],pool:[],registrations:[],results:[],breedings:[],npcs:[...ordinary,...named],races:League.generate(1)};
Economy.ensure(world);Npc.ensure(world);Turnover.ensure(world);Training.ensure(world);
assert.equal(world.npcs.length,13);
assert.equal(world.npcs.flatMap(r=>r.horses).length,352);
const ctx={
 eligible:(h,r)=>!!h&&!h.retired&&!h.injury&&!h.pregnantUntil&&h.age>=2&&
   Npc.dayOf(r)-h.lastRaceIndex>=8&&
   (r.grade!=='신마'||h.starts===0)&&(r.grade!=='미승리'||h.wins===0)&&
   Rules.entryCheck(h,r).ok,
 score:(h,r,t)=>Rules.entrantScore(h,r,t),
 // Fast order preserves race entry, records, funds and rest intervals while omitting physics.
 simulate:({race,entrants})=>({results:entrants.map((entry,i)=>({
   horseId:entry.horse.id,
   score:entry.horse.rating+(entry.horse.distanceBand===race.band?2:0)+
     (entry.horse.surface===race.surface?2:0)+((i*37+race.day)%7)*.1
 })).sort((a,b)=>b.score-a.score).map((e,i)=>({horseId:e.horseId,place:i+1,time:100+i*.5}))}),
 rating:h=>Rules.rating(h),newRating:Rules.newRating
};
const report=[];
for(let year=1;year<=3;year++){
 if(year>1){
   Object.assign(world,{year,month:1,day:1});
   Turnover.advance(world,spec=>{
     const h=horse(spec.stats.speed,spec.stats.speed,spec.age,spec.experience.starts);
     h.wins=spec.experience.wins;return h;
   });
   world.races=League.generate(year);
 }
 const fundsBefore=world.npcs.reduce((sum,r)=>sum+r.funds,0);
 let paid=0,upkeep=0,training=0,held=0,cancelled=0,entrants=0;
 const grades={};
 for(let month=1;month<=12;month++){
  for(let day=1;day<=30;day++){
   Object.assign(world,{year,month,day});
   const today=Npc.dayOf(world);
   if(League.isRaceDay(year,month,day)){
     const scheduled=world.races.filter(r=>r.month===month&&r.day===day);
     const outcome=Npc.closeDay(world,today,ctx);
     held+=outcome.held;cancelled+=outcome.cancelled;
     assert.equal(outcome.held+outcome.cancelled,scheduled.length);
     for(const race of scheduled){
       const count=race.npcAutoResult.entrants||0;
       const stat=grades[race.grade]??(grades[race.grade]={events:0,cancelled:0,under8:0,entrants:0});
       stat.events++;stat.entrants+=count;entrants+=count;
       if(count<8)stat.under8++;
       if(race.npcAutoResult.status==='not-enough-entrants'){
         assert.ok(count<2,'never cancel race with at least two entrants');
         stat.cancelled++;
       }else{
         assert.ok(count>=2&&count<=Npc.MAX_FIELD);
         assert.equal(new Set(race.result.map(x=>x.horseId)).size,count);
       }
     }
     const first=Economy.creditFinishedRaces(world);
     const twice=Economy.creditFinishedRaces(world);
     assert.equal(twice.paid,0,'no double prize payment');
     paid+=first.paid;
   }
   Npc.restoreNpcDaily(world);
   if(day===30){
     const counts=Object.fromEntries(world.npcs.map(r=>[r.name,r.horses.length]));
     const settled=Economy.closeMonth(world,year+'-'+month,world.horses.length,counts,()=>3000000);
     assert.ok(settled.applied);
     upkeep+=settled.npcSummary.reduce((sum,x)=>sum+x.paid,0);
     assert.equal(Economy.closeMonth(world,year+'-'+month,world.horses.length,counts,()=>3000000).applied,false);
   }
  }
  world.month=month===12?1:month+1;
  world.year=month===12?year+1:year;
  const trained=Training.advance(world,()=>1,{trainingBudget:Economy.trainingBudget});
  if(trained.applied)training+=Economy.settleNpcTraining(world,trained.summaries);
  world.year=year;world.month=month;
 }
 const after=world.npcs.reduce((sum,r)=>sum+r.funds,0);
 assert.ok(world.npcs.every(r=>Number.isFinite(r.funds)&&r.funds>=0&&r.horses.length<=r.stalls));
 assert.equal(held+cancelled,world.races.length);
 report.push({year,races:world.races.length,held,cancelled,averageEntrants:+(entrants/world.races.length).toFixed(2),
   prizeIncome:paid,upkeep,training,netCashChange:after-fundsBefore,
   byGrade:Object.fromEntries(Object.entries(grades).map(([grade,s])=>[grade,{
     races:s.events,averageEntrants:+(s.entrants/s.events).toFixed(1),
     cancelled:s.cancelled,under8:s.under8}]))});
}
// Verify that a representative real physical race accepts the same entrant data.
const example=League.generate(1).find(r=>r.grade==='G3');
const physical=Engine.simulate({race:example,entrants:Array.from({length:8},()=>({
 horse:horse(70,85,3,1),jockey:null,friendship:null
}))});
assert.equal(physical.results.length,8,'real race engine resolves complete field');
assert.equal(new Set(physical.results.map(x=>x.horseId)).size,8);
assert.ok(physical.results.every((x,i)=>x.place===i+1&&Number.isFinite(x.time)));
const saved=JSON.parse(JSON.stringify(world));
assert.equal(saved.npcs.length,13);
assert.equal(saved.ranchEconomy.lastMonth,'3-12');
assert.equal(saved.npcAutoRacing.totalRaces,report.reduce((x,y)=>x+y.held,0));
console.log('REAL ENGINE sample: 8 finishers; 3-year save round-trip bytes: '+JSON.stringify(world).length);
console.log('DIAGNOSTIC SYNTHETIC 13 NPC RANCHES / 352 INITIAL HORSES');
console.log(JSON.stringify(report,null,2));
