/* HORSE RANCH 20.13 — monthly upkeep, NPC income and self-funded recovery.
 * Monetary constants are experimental game parameters, NOT finalized balance.
 * No grants, imaginary sale proceeds, duplicate player school fees or health charges.
 */
(function(root){
'use strict';
const CONFIG=Object.freeze({monthlyUpkeep:150000,npcSessionFee:75000,runwayWatch:6,runwayCrisis:3,runwayRecovery:1,minRanchHorses:3,transferDiscount:.55});
// Deliberately lightweight NPC behavior: preserve a viable league, no AI manager.
// Target cash buffers restrict optional recruitment, not essential horse care.
const RESERVE_MONTHS=Object.freeze({'그랜드 스터드':6,'블루힐 팜':4,'윈드필드 목장':4,'노스밸리 목장':6,'레드크라운 목장':3});
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const monthOf=s=>`${s.year}-${s.month}`;
const monthKey=s=>monthOf(s);
const priceValue=x=>Math.max(100000,Math.round(n(x)/100000)*100000);
function status(funds,horseCount){
 const base=Math.max(1,n(horseCount))*CONFIG.monthlyUpkeep;
 const runway=n(funds)/base;
 return {runway,status:runway<CONFIG.runwayRecovery?'회생':runway<CONFIG.runwayCrisis?'위기':runway<CONFIG.runwayWatch?'주의':'정상'};
}
function ensure(world){
 if(!world.ranchEconomy||typeof world.ranchEconomy!=='object')world.ranchEconomy={version:1,lastMonth:null,player:{unpaid:0,totalPaid:0},ranches:{},recent:[]};
 const e=world.ranchEconomy;
 e.version=1;e.player=e.player||{unpaid:0,totalPaid:0};e.player.unpaid=n(e.player.unpaid);e.player.totalPaid=n(e.player.totalPaid);
 if(!Array.isArray(e.recent))e.recent=[];
 if(!e.ranches||typeof e.ranches!=='object')e.ranches={};
 for(const ranch of world.npcs||[]){
  if(!Number.isFinite(Number(ranch.funds)))ranch.funds=70000000; // 20.10's implicit NPC purse, assigned only once
  ranch.funds=n(ranch.funds);
  if(!e.ranches[ranch.name])e.ranches[ranch.name]={totalUpkeep:0,totalTraining:0,totalPrizes:0,totalSales:0,totalRecruitment:0};
  const ledger=e.ranches[ranch.name];ledger.crisisMonths=Math.max(0,Math.floor(n(ledger.crisisMonths)));ledger.totalSafetySupport=n(ledger.totalSafetySupport);
 }
 return e;
}
function upcomingUpkeep(r){return (r.horses||[]).length*CONFIG.monthlyUpkeep;}
function trainingBudget(r,world){
 ensure(world);const current=status(r.funds,(r.horses||[]).length);
 const rawAvailable=Math.max(0,n(r.funds)-upcomingUpkeep(r));
 const ceiling=current.status==='정상'?1:current.status==='주의'?.5:current.status==='위기'?.15:0;
 const funded=Math.floor(rawAvailable/CONFIG.npcSessionFee);
 const active=(r.horses||[]).filter(h=>h&&!h.retired&&n(h.age)>=2&&n(h.age)<8).length;
 const maxSlots=active*4;
 return Math.max(0,Math.min(funded,Math.floor(maxSlots*ceiling)));
}
function settleNpcTraining(world,summaries){
 const e=ensure(world);let paid=0;
 for(const s of summaries||[]){
  const ranch=(world.npcs||[]).find(r=>r.name===s.ranch);if(!ranch)continue;
  const fee=Math.min(n(ranch.funds),n(s.sessions)*CONFIG.npcSessionFee);
  ranch.funds-=fee;paid+=fee;e.ranches[ranch.name].totalTraining+=fee;
 }
 return paid;
}
function pricePool(race,place){
 const p=n(race.prize);
 return p*({1:1,2:.55,3:.33,4:.18,5:.1}[place]||0);
}
function creditFinishedRaces(world){
 const e=ensure(world);let paid=0,events=0;
 const ownerOf=new Map();for(const r of world.npcs||[])for(const h of r.horses||[])ownerOf.set(String(h.id),r);
 for(const race of world.races||[]){
  if(race.state!=='finished'||race.npcPurseSettled)continue;
  // Historical game migration prevents retroactive revenue on load; new
  // races are stamped only by the live integration at their real completion.
  for(const row of race.result||[]){
   const owners=race.npcPurseOwners;
   const savedOwner=owners&&Object.prototype.hasOwnProperty.call(owners,String(row.horseId))
    ?owners[String(row.horseId)]:null;
   const receiver=owners
    ?(world.npcs||[]).find(r=>r.name===savedOwner)
    :ownerOf.get(String(row.horseId));
   if(!receiver)continue;
   const award=Math.round(pricePool(race,Number(row.place)));
   if(award>0){receiver.funds=n(receiver.funds)+award;e.ranches[receiver.name].totalPrizes+=award;paid+=award;events++;}
  }
  race.npcPurseSettled=true;
 }
 return {paid,events};
}
function isSaleCandidate(h,world){
 if(!h||h.retired||h.pregnantUntil||Number(h.age)<2)return false;
 const auction=world.ranchAuction?.current;
 if(auction?.status==='open'&&[...(auction.lots||[]),auction.consignment].some(l=>l&&String(l.horseId)===String(h.id)))return false;
 return true;
}
function tryRealSale(world,seller,priceFn,soldIdSet){
 const horses=seller.horses||[];
 if(horses.length<=CONFIG.minRanchHorses)return null;
 const candidates=horses.filter(h=>isSaleCandidate(h,world)&&!soldIdSet.has(String(h.id)))
 .sort((a,b)=>n(a.rating)-n(b.rating)||n(a.id)-n(b.id));
 for(const h of candidates){
  const price=priceValue(priceFn(h)*CONFIG.transferDiscount);
  const receivers=(world.npcs||[]).filter(r=>r!==seller&&
    (r.horses||[]).length<Math.min(100,n(r.stalls)||100)&&
    n(r.funds)>=price+upcomingUpkeep(r)*3&&
    status(r.funds,(r.horses||[]).length).status==='정상');
  receivers.sort((a,b)=>n(b.funds)-n(a.funds)||a.name.localeCompare(b.name));
  const buyer=receivers[0];if(!buyer)continue; // not a simulated, guaranteed sale
  const index=horses.indexOf(h);if(index<0)continue;
  horses.splice(index,1);buyer.horses.push(h);
  buyer.funds-=price;seller.funds+=price;
  const e=ensure(world);e.ranches[seller.name].totalSales+=price;
  soldIdSet.add(String(h.id));
  return{horseId:h.id,horseName:h.name,seller:seller.name,buyer:buyer.name,price};
 }
 return null;
}
function closeMonth(world,month,prevPlayerCount,npcCounts,priceFn){
 const e=ensure(world);if(e.lastMonth===month)return{applied:false};
 const playerBill=n(prevPlayerCount)*CONFIG.monthlyUpkeep+e.player.unpaid;
 const payment=Math.min(n(world.money),playerBill);
 world.money=n(world.money)-payment;e.player.unpaid=Math.max(0,playerBill-payment);e.player.totalPaid+=payment;
 const sold=[],soldIds=new Set(),summary=[];
 for(const ranch of world.npcs||[]){
  const count=n(npcCounts?.[ranch.name]??ranch.horses?.length);
  const bill=count*CONFIG.monthlyUpkeep;
  const due=bill+n(e.ranches[ranch.name].unpaid);
  const paid=Math.min(n(ranch.funds),due);
  ranch.funds-=paid;
  const meta=e.ranches[ranch.name];meta.totalUpkeep+=paid;
  // Unpaid upkeep is not free: insolvent farms cannot buy or train,
  // and the deficit remains visible without creating negative balances.
  meta.unpaid=Math.max(0,due-paid);
  const s=status(ranch.funds,(ranch.horses||[]).length);
  if(['위기','회생'].includes(s.status)&&typeof priceFn==='function'){
   const actual=tryRealSale(world,ranch,priceFn,soldIds);
   if(actual)sold.push(actual);
  }
  // Small explicit operating safety net after three consecutive distressed
  // settlements. This is a game-world support entry, not invisible sales or
  // elite horse grants. Old/normal NPC farms still follow their own budgets.
  const stillInCrisis=['위기','회생'].includes(status(ranch.funds,ranch.horses.length).status);
  meta.crisisMonths=stillInCrisis?meta.crisisMonths+1:0;
  let safetySupport=0;
  if(ranch.named&&meta.crisisMonths>=3&&count>0){
   const minimum=4*count*CONFIG.monthlyUpkeep;
   safetySupport=Math.max(0,minimum-n(ranch.funds));
   ranch.funds+=safetySupport;
   meta.totalSafetySupport+=safetySupport;
   meta.crisisMonths=0;
  }
  summary.push({name:ranch.name,paid,bill,unpaid:meta.unpaid,remaining:n(ranch.funds),safetySupport,status:status(ranch.funds,ranch.horses.length).status});
 }
 e.lastMonth=month;
 const report={month,playerBill,playerPaid:payment,playerUnpaid:e.player.unpaid,npcSummary:summary,npcSales:sold};
 e.recent.push({month,playerBill,playerPaid:payment,npcSales:sold.length,crisis:summary.filter(s=>['위기','회생'].includes(s.status)).length});
 e.recent=e.recent.slice(-12);
 return{applied:true,...report};
}
function recruitmentCost(spec){return spec.elite?22000000:spec.experienced?15000000:8000000;}
function canRecruit(ranch,fee){
 const balance=n(ranch.funds);
 const active=(ranch.horses||[]).filter(h=>h&&!h.retired&&n(h.age)>=2).length;
 // A prestigious ranch with fewer than three active racers can rebuild with
 // low-cost arrivals; never bypass the actual purchase charge.
 const rebuild=!!ranch.named&&active<3;
 const months=rebuild?2:(RESERVE_MONTHS[ranch.name]||3);
 return (status(balance,ranch.horses?.length).status==='정상'||rebuild)&&balance>=n(fee)+upcomingUpkeep(ranch)*months;
}
function chargeRecruit(world,ranch,cost){const e=ensure(world);const fee=n(cost);if(!canRecruit(ranch,fee))return false;ranch.funds-=fee;e.ranches[ranch.name].totalRecruitment+=fee;return true;}
const api=Object.freeze({CONFIG,RESERVE_MONTHS,monthKey,status,ensure,trainingBudget,settleNpcTraining,pricePool,creditFinishedRaces,closeMonth,recruitmentCost,canRecruit,chargeRecruit});
root.HorseRanchEconomy=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
