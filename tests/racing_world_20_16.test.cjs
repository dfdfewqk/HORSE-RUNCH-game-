'use strict';
const assert=require('node:assert/strict');
const Race=require('../systems/race-engine.js'), C=require('../systems/competition-rules.js');
const N=require('../systems/npc-auto-racing.js'), E=require('../systems/ranch-economy.js');
const A=require('../systems/ranch-auction.js'), R=require('../systems/ranch-ranking.js');
const horse=(id,r=80)=>({id,name:'H'+id,age:3,rating:r,speed:r,stamina:r,power:r,
 style:'선행',distanceBand:'마일',surface:'잔디',condition:90,hoof:100,fatigue:0,injury:0,lastRaceIndex:-100,
 starts:0,wins:0,seconds:0,thirds:0,history:[],caps:{speed:96,stamina:96,power:96}});
const ranch=(name,ids,cash=150000000)=>({name,named:true,funds:cash,stalls:30,horses:ids.map(id=>horse(id))});
const race={id:'test',year:1,month:1,day:10,dist:1600,grade:'G2',surface:'잔디',prize:35000000};
const field=[11,12,13,14].map(id=>({horse:horse(id),jockey:null}));
const sim=entrants=>Race.simulate({race,entrants,seed:42});
const clear=sim(field);
assert.deepEqual(clear.results,sim(field).results,'deterministic replay');
assert.equal(clear.results.length,4);
assert.equal(new Set(clear.results.map(x=>x.horseId)).size,4);
assert.ok(clear.results.every((x,i)=>x.place===i+1&&x.time>0&&(i===0||x.time>=clear.results[i-1].time)));
const blocked=sim([{...field[0],response:{type:'strong',delay:1.2,paceWaste:.09}},...field.slice(1)]);
const time=(s,id)=>s.results.find(x=>String(x.horseId)===String(id)).time;
assert.ok(time(blocked,11)>time(clear,11),'refusal slows the run');
const w={ranchName:'Player',year:1,month:1,day:10,money:50000000,stalls:8,horses:[horse(9000)],
 npcs:[ranch('A',[1,2]),ranch('B',[3,4])],races:[{...race,state:'open'}],results:[],registrations:[]};
const ctx={eligible:(h,r)=>C.entryCheck(h,r).ok,score:(h,r,t)=>C.entrantScore(h,r,t),
 simulate:args=>Race.simulate(args),rating:h=>C.rating(h),newRating:(v,g,p,k)=>C.newRating(v,g,p,k),
 recordMerit:(world,r)=>R.recordRace(world,r)};
assert.equal(N.closeDay(w,N.dayOf(w),ctx).held,1);
assert.equal(N.closeDay(w,N.dayOf(w),ctx).held,0,'no double race');
assert.equal(w.npcAutoRacing.totalRaces,1);
assert.equal(w.money,50000000,'NPC races cannot credit player');
const done=w.races[0],winner=String(done.result[0].horseId),sellerName=done.npcPurseOwners[winner];
const seller=w.npcs.find(x=>x.name===sellerName),buyer=w.npcs.find(x=>x!==seller);
const sold=seller.horses.splice(seller.horses.findIndex(h=>String(h.id)===winner),1)[0];
buyer.horses.push(sold);
const expected=Object.fromEntries(w.npcs.map(x=>[x.name,x.funds]));
for(const row of done.result)expected[done.npcPurseOwners[String(row.horseId)]]+=Math.round(E.pricePool(done,row.place));
E.creditFinishedRaces(w);
for(const x of w.npcs)assert.equal(x.funds,expected[x.name],'pay original race owner');
assert.equal(E.creditFinishedRaces(w).paid,0,'single prize transaction');
assert.equal(R.ensure(w).events.find(x=>x.raceId===done.id&&String(x.horseId)===winner).ownerKey,'npc:'+sellerName,'historical rank ownership');
assert.equal(done.npcPurseSettled,true);
const poor={year:1,month:1,day:5,money:0,stalls:8,horses:[],
 npcs:[ranch('Seller',[50],5000000),ranch('Empty',[],0)],
 ranchAuction:{current:{status:'open',day:5,week:0,lots:[{horseId:50,seller:'Seller',sellerKind:'npc',reserve:1000000,playerBid:0}],consignment:null},history:[]}};
assert.equal(A.closeAuction(poor,6).sold,0,'zero-cash NPC cannot receive free money');
assert.equal(poor.npcs[1].funds,0);
assert.equal(A.closeAuction(poor,6).applied,false);
const buy={year:1,month:1,day:5,money:4000000,stalls:1,horses:[],
 npcs:[ranch('Seller',[60,61,62,63,64],5000000)],
 ranchAuction:{current:{status:'open',day:5,week:0,lots:[{horseId:64,seller:'Seller',sellerKind:'npc',reserve:1000000,playerBid:0}],consignment:null},history:[]}};
assert.equal(A.placeBid(buy,64,()=>1000000).ok,true);
assert.equal(A.closeAuction(buy,6).won,1);
assert.equal(buy.horses.length,1);
assert.equal(buy.npcs[0].horses.length,4,'sell without liquidating NPC core horses');
assert.equal(buy.money,3000000);
assert.equal(buy.npcs[0].funds,6000000);
assert.equal(E.buyerForPlayerSale({npcs:[ranch('Empty',[],0)]},horse(8),1000000),null);
assert.equal(E.buyerForPlayerSale({npcs:[ranch('Rich',[],20000000)]},horse(8),1000000).name,'Rich');
const q={ranchName:'Player',year:6,month:1,day:1,horses:[],npcs:[ranch('A',[88]),ranch('B',[99])],
 ranchMerit:{version:1,migratedPlayerResults:true,events:[]}};
const day=R.dayOf(q);
for(let i=0;i<200;i++)q.ranchMerit.events.push({key:'a'+i,day:day-1,ownerKey:'npc:A',grade:'G1',place:1});
for(let i=0;i<150;i++)q.ranchMerit.events.push({key:'b'+i,day:day-1,ownerKey:'npc:B',grade:'G1',place:1});
const ranking=R.ranking(q);
assert.ok(ranking.find(x=>x.name==='A').meritScore>ranking.find(x=>x.name==='B').meritScore,'ranking must retain merit differentiation');
console.log('PASS racing-world integrity');
