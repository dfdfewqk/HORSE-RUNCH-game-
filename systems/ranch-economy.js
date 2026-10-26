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

/* Ranch identity: protect one racing flagship and up to one sire and dam.
 * Persist role IDs in the existing economy ledger. Re-select only if the
 * incumbent becomes ineligible or a challenger clearly outperforms it.
 * Breeding is owned by the lifecycle/education systems; no NPC mating here.
 */
const coreKey=h=>String(h&&typeof h==='object'?h.id:h);
const coreDay=w=>(n(w.year)-1)*360+(n(w.month)-1)*30+n(w.day);
function racingValue(h,w){
 const rating=Number.isFinite(Number(h.rating))&&h.rating!=null?n(h.rating):
  (n(h.speed)*.45+n(h.stamina)*.30+n(h.power)*.25);
 const today=coreDay(w);
 let important=0;
 for(const rec of h.history||[]){
  if(n(rec.place)!==1)continue;
  const weight=rec.grade==='G1'?14:rec.grade==='G2'?9:rec.grade==='G3'?5:2;
  const day=(n(rec.year)-1)*360+(n(rec.month)-1)*30+n(rec.day);
  important+=day>0&&today-day>=0&&today-day<360?weight:weight*.20;
 }
 return rating+Math.min(25,important)+Math.min(6,n(h.wins)*.5);
}
function breedingValue(h,world){
 const genes=['speed','stamina','power'].map(k=>{
  const value=h.genetic?.[k]??h.caps?.[k]??h[k];
  return Number.isFinite(Number(value))?n(value):0;
 });
 const potential=genes.reduce((a,b)=>a+b,0)/3;
 const pedigree=Number.isFinite(Number(h.pedigree))?n(h.pedigree):potential;
 // Count only recorded descendants, never invent successful progeny.
 let bestChild=0;
 const children=[...(world.horses||[]),...(world.pool||[]),
  ...(world.npcs||[]).flatMap(r=>r.horses||[])];
 for(const child of children){
  if(coreKey(child.fatherId)!==coreKey(h.id)&&coreKey(child.motherId)!==coreKey(h.id))continue;
  const rating=n(child.rating)||((n(child.speed)+n(child.stamina)+n(child.power))/3);
  const g1=(child.history||[]).filter(x=>x.grade==='G1'&&n(x.place)===1).length;
  bestChild=Math.max(bestChild,Math.min(8,Math.max(0,rating-70)*.15+n(child.wins)*.5+g1*2));
 }
 return potential*.75+pedigree*.25+bestChild;
}
function keepCore(horses,oldId,eligible,score,margin){
 const candidates=horses.filter(eligible);
 if(!candidates.length)return null;
 const ranked=candidates.map(h=>({h,score:score(h)}))
  .sort((a,b)=>b.score-a.score||coreKey(a.h).localeCompare(coreKey(b.h)));
 const best=ranked[0],incumbent=ranked.find(x=>oldId!=null&&coreKey(x.h)===String(oldId));
 return coreKey(incumbent&&best.score<incumbent.score+margin?incumbent.h:best.h);
}
function coreHorseIds(world,ranch){
 if(!ranch)return{racer:null,sire:null,dam:null};
 const e=ensure(world),ledger=e.ranches[ranch.name],prev=ledger.coreIds||{};
 const horses=ranch.horses||[];
 const racer=keepCore(horses,prev.racer,h=>h&&!h.retired&&n(h.age)>=2,
  h=>racingValue(h,world),7);
 const sire=keepCore(horses,prev.sire,h=>h&&!h.retired&&n(h.age)>=3&&h.gender==='수',
  h=>breedingValue(h,world),5);
 const dam=keepCore(horses,prev.dam,h=>h&&!h.retired&&n(h.age)>=3&&h.gender==='암',
  h=>breedingValue(h,world),5);
 ledger.coreIds={racer,sire,dam};
 return ledger.coreIds;
}
function protectedIds(world,ranch){
 return new Set(Object.values(coreHorseIds(world,ranch)).filter(x=>x!=null).map(String));
}
function isProtected(world,ranch,horse){
 return !!horse&&protectedIds(world,ranch).has(coreKey(horse));
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
 const protectedHorseIds=protectedIds(world,seller);
 const candidates=horses.filter(h=>!protectedHorseIds.has(String(h.id))&&isSaleCandidate(h,world)&&!soldIdSet.has(String(h.id)))
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
  // Every NPC ranch survives downturns; reserve is explicit in the ledger.
  if(meta.crisisMonths>=3&&count>0){
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
function buyerForPlayerSale(world,horse,price){
 if(!horse)return null;
 const cost=n(price);
 return (world.npcs||[]).filter(r=>{
  const capacity=Math.min(100,n(r.stalls)||100);
  return (r.horses||[]).length<capacity &&
   n(r.funds)>=cost+upcomingUpkeep(r)*3 &&
   (r.horses||[]).every(h=>String(h.id)!==String(horse.id));
 }).sort((a,b)=>n(b.funds)-n(a.funds)||a.name.localeCompare(b.name))[0]||null;
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
const api=Object.freeze({CONFIG,RESERVE_MONTHS,monthKey,status,ensure,trainingBudget,settleNpcTraining,pricePool,creditFinishedRaces,closeMonth,buyerForPlayerSale,recruitmentCost,canRecruit,chargeRecruit,racingValue,breedingValue,coreHorseIds,protectedIds,isProtected});
root.HorseRanchEconomy=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
