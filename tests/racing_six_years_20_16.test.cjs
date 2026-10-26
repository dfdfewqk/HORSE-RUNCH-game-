'use strict';
const assert=require('node:assert/strict');
const Engine=require('../systems/race-engine.js'),Rules=require('../systems/competition-rules.js');
const NPC=require('../systems/npc-auto-racing.js'),Economy=require('../systems/ranch-economy.js');
const Auction=require('../systems/ranch-auction.js'),Rank=require('../systems/ranch-ranking.js');
const Turnover=require('../systems/npc-turnover.js'),Training=require('../systems/npc-training.js');
const horse=(id,r)=>({id,name:'H'+id,age:3,rating:r,speed:r,stamina:r,power:r,style:'선행',
 distanceBand:'마일',surface:'잔디',condition:90,hoof:100,fatigue:0,injury:0,lastRaceIndex:-100,
 starts:0,wins:0,seconds:0,thirds:0,history:[],caps:{speed:96,stamina:96,power:96}});
const names=['그랜드 스터드','블루힐 팜','윈드필드 목장','노스밸리 목장','레드크라운 목장'];
let next=100;
const w={ranchName:'Player',year:1,month:1,day:1,money:50000000,stalls:8,
 horses:[horse(1,77)],registrations:[],results:[],races:[],
 npcs:names.map((name,i)=>({name,named:true,funds:220000000,stalls:50,
  horses:Array.from({length:8},(_,j)=>horse(next++,74+(i*3+j)%14))}))};
Economy.ensure(w);NPC.ensure(w);Rank.ensure(w);Turnover.ensure(w);Training.ensure(w);
const ctx={eligible:(h,r)=>Rules.entryCheck(h,r).ok,score:(h,r,target)=>Rules.entrantScore(h,r,target),
 simulate:args=>Engine.simulate(args),rating:h=>Rules.rating(h),
 newRating:(v,g,p,s)=>Rules.newRating(v,g,p,s),recordMerit:(world,r)=>Rank.recordRace(world,r)};
let total=0;
for(let year=1;year<=6;year++){
 for(let month=1;month<=12;month++){
  for(let day=1;day<=30;day++){
   Object.assign(w,{year,month,day});const time=NPC.dayOf(w);
   if(day===10||day===24){
    for(let no=1;no<=3;no++){
     const grade=month%3===0&&no===3?'G1':month%3===0&&no===2?'G2':no===3?'G3':'일반';
     w.races.push({id:year+'-'+month+'-'+day+'-'+no,year,month,day,no,grade,dist:1600,surface:'잔디',
       prize:grade==='G1'?50000000:grade==='G2'?35000000:grade==='G3'?24000000:4000000,state:'open'});
    }
    const result=NPC.closeDay(w,time,ctx);total+=result.held+result.cancelled;
    Economy.creditFinishedRaces(w);
    assert.equal(NPC.closeDay(w,time,ctx).applied,false,'race cannot replay');
   }
   if(Auction.isFriday(time))Auction.openAuction(w,time,h=>1000000+100000*h.rating);
   Auction.closeAuction(w,time);
   NPC.restoreNpcDaily(w);
   if(day===30){
    const counts=Object.fromEntries(w.npcs.map(r=>[r.name,r.horses.length]));
    assert.equal(Economy.closeMonth(w,year+'-'+month,w.horses.length,counts,h=>1000000+100000*h.rating).applied,true);
    assert.equal(Economy.closeMonth(w,year+'-'+month,w.horses.length,counts,()=>1000000).applied,false,'upkeep cannot replay');
   }
  }
  const trained=Training.advance(w,()=>1,{trainingBudget:Economy.trainingBudget});
  if(trained.applied)Economy.settleNpcTraining(w,trained.summaries);
 }
 if(year<6){
  Object.assign(w,{year:year+1,month:1,day:1});
  const newcomers=Turnover.advance(w,s=>({...horse(next++,s.stats.speed),age:s.age,
   speed:s.stats.speed,stamina:s.stats.stamina,power:s.stats.power}));
  assert.equal(newcomers.applied,true);
 }
 const ids=w.npcs.flatMap(r=>r.horses).map(h=>String(h.id));
 assert.equal(ids.length,new Set(ids).size,'no duplicated horse after auctions or recruiting');
 assert.ok(w.npcs.every(r=>r.horses.length<=r.stalls&&r.horses.length<=100&&Number.isFinite(r.funds)&&r.funds>=0),'cash/capacity intact');
 assert.equal(w.npcs.length,5,'named league continues');
}
assert.equal(total,432,'all 6-year scheduled races resolved');
assert.equal(w.ranchEconomy.lastMonth,'6-12');
assert.equal(Rank.ranking(w).length,6);
assert.ok(new Set(Rank.ranking(w).filter(r=>!r.player).map(r=>r.meritScore)).size>1,'rankings must not all tie after 6 years');
console.log('PASS six-year race, training, trade, monthly balance and ranking');
