/* HORSE RANCH 20.10: rotating market, merit-ranked consignors and weekly auction.
 * Trial game-balance values only; all transactions use existing horse objects.
 * No random drawing, wagering or external funds.
 */
(function(root){
'use strict';
const TOP_COUNT=5, DAILY_COUNT=5, SPECIAL_COUNT=5, BID_STEP=500000;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const roundPrice=x=>Math.max(100000,Math.round(num(x)/100000)*100000);
const dayOf=world=>(num(world.year)-1)*360+(num(world.month)-1)*30+num(world.day);
const weekday=day=>((day-1)%7+7)%7; // 0=Monday, 4=Friday, continuous through 360-day years
const isFriday=day=>weekday(day)===4;
const weekOf=day=>Math.floor((day-1)/7);
function stableScore(h,world){
 const rating=num(h.rating)||(59+(num(h.speed)*.45+num(h.stamina)*.3+num(h.power)*.25-70)*1.4);
 const now=dayOf(world), recent=(h.history||[]).filter(x=>num(x.year)>0&&now-((num(x.year)-1)*360+(num(x.month)-1)*30+num(x.day))<=360);
 const points=recent.reduce((t,x)=>t+(num(x.place)===1?(['G1','G2','G3'].includes(x.grade)?6:3):num(x.place)<=3?1:0),0);
 return rating+(num(h.speed)+num(h.stamina)+num(h.power))/30+Math.min(20,points);
}
function ranking(world){
 if(root.HorseRanchRanking)return root.HorseRanchRanking.ranking(world);
 const candidates=[{name:world.ranchName||'내 목장',player:true,horses:world.horses||[]},...(world.npcs||[]).map(n=>({...n,player:false}))];
 return candidates.map(r=>{
  const active=(r.horses||[]).filter(h=>!h.retired&&num(h.age)>=2);
  const best=active.map(h=>stableScore(h,world)).sort((a,b)=>b-a).slice(0,3);
  return {name:r.name,player:r.player,score:best.length?Math.round(best.reduce((a,b)=>a+b,0)/best.length*10)/10:0,active:active.length};
 }).sort((a,b)=>b.score-a.score||Number(b.active)-Number(a.active)||a.name.localeCompare(b.name)).map((r,i)=>({...r,rank:i+1,qualified:i<TOP_COUNT&&r.active>0}));
}
function ensure(world){
 if(!world.ranchAuction||typeof world.ranchAuction!=='object')world.ranchAuction={version:1,current:null,history:[]};
 const v=world.ranchAuction;if(!Array.isArray(v.history))v.history=[];
 return v;
}
// All NPC sales share the core-horse and minimum-roster safeguards.
function npcCanSell(world,ranch,h){
 const E=root.HorseRanchEconomy,minimum=E?.CONFIG.minRanchHorses??3;
 return !!ranch&&!!h&&(ranch.horses||[]).length>minimum&&
  !(E&&E.isProtected(world,ranch,h));
}
function daily(world,day=dayOf(world)){
 const locked=new Set((ensure(world).current?.status==='open'?ensure(world).current.lots:[]).map(l=>String(l.horseId)));
 const pool=[];
 for(const ranch of world.npcs||[])for(const h of ranch.horses||[]){if(h.retired||num(h.age)<2||h.pregnantUntil||locked.has(String(h.id))||!npcCanSell(world,ranch,h))continue;pool.push({horseId:h.id,owner:ranch.name});}
 pool.sort((a,b)=>hash(`${day}|daily|${a.horseId}`)-hash(`${day}|daily|${b.horseId}`)||num(a.horseId)-num(b.horseId));
 return pool.slice(0,DAILY_COUNT);
}
function openAuction(world,day,priceFn){
 if(!isFriday(day))return null;
 const store=ensure(world);if(store.current&&store.current.week===weekOf(day))return store.current;
 const top=ranking(world).filter(r=>r.qualified);
 const eligible=top.filter(r=>!r.player).map(r=>r.name);
 const eligiblePlayer=top.some(r=>r.player);
 const pool=[];
 for(const n of world.npcs||[]){if(!eligible.includes(n.name))continue;
  for(const h of n.horses||[]){if(h.retired||num(h.age)<2||h.pregnantUntil||!npcCanSell(world,n,h))continue;pool.push({horseId:h.id,seller:n.name,sellerKind:'npc'});}
 }
 pool.sort((a,b)=>hash(`${day}|special|${a.horseId}`)-hash(`${day}|special|${b.horseId}`)||num(a.horseId)-num(b.horseId));
 const chosen=[],usage=new Map();for(const entry of pool){if(chosen.length>=SPECIAL_COUNT)break;if(num(usage.get(entry.seller))>=2)continue;chosen.push(entry);usage.set(entry.seller,num(usage.get(entry.seller))+1);}
 for(const entry of pool){if(chosen.length>=SPECIAL_COUNT)break;if(!chosen.includes(entry))chosen.push(entry);}
 const lots=chosen.map(entry=>{const n=world.npcs.find(n=>n.name===entry.seller);const h=n?.horses.find(x=>String(x.id)===String(entry.horseId));return {...entry,reserve:roundPrice(priceFn(h)),playerBid:0};});
 store.current={version:1,day,week:weekOf(day),status:'open',eligibleNames:eligible,eligiblePlayer,lots,consignment:null};
 return store.current;
}
function placeBid(world,id,priceFn){
 const a=ensure(world).current;if(!a||a.status!=='open'||!isFriday(dayOf(world))||a.day!==dayOf(world))return {ok:false,reason:'금요일 경매가 진행 중이 아닙니다.'};
 const lot=a.lots.find(x=>String(x.horseId)===String(id));if(!lot||lot.seller===world.ranchName)return{ok:false,reason:'입찰 대상이 아닙니다.'};
 const seller=(world.npcs||[]).find(n=>n.name===lot.seller),h=seller?.horses?.find(h=>String(h.id)===String(id));
 if(!npcCanSell(world,seller,h))return{ok:false,reason:'목장이 보호 중이거나 판매할 수 없는 경주마입니다.'};
 const min=lot.playerBid>0?lot.playerBid+BID_STEP:lot.reserve;
 const committed=a.lots.reduce((sum,x)=>sum+(x===lot?0:num(x.playerBid)),0);
 if(num(world.money)-committed<min)return{ok:false,reason:'동시 입찰에 필요한 자금이 부족합니다.'};
 if((world.horses||[]).length>=num(world.stalls))return{ok:false,reason:'마방에 빈자리가 없습니다.'};
 lot.playerBid=min;return{ok:true,bid:min};
}
function consign(world,id,priceFn){
 const a=ensure(world).current;
 if(!a||a.status!=='open'||!isFriday(dayOf(world))||a.day!==dayOf(world))return{ok:false,reason:'금요일에만 출품할 수 있습니다.'};
 if(!a.eligiblePlayer)return{ok:false,reason:'상위 5위 목장만 출품할 수 있습니다.'};
 if(a.consignment)return{ok:false,reason:'이번 주에 이미 한 마리를 출품했습니다.'};
 const h=(world.horses||[]).find(x=>String(x.id)===String(id));
 if(!h||h.retired||num(h.age)<2||h.pregnantUntil||(world.registrations||[]).some(x=>String(x.horseId)===String(id)))return{ok:false,reason:'출품할 수 없는 말입니다.'};
 a.consignment={horseId:h.id,seller:world.ranchName,sellerKind:'player',reserve:roundPrice(priceFn(h)),playerBid:0};
 return{ok:true};
}
function closeAuction(world,day,opts={}){
 const store=ensure(world),a=store.current;
 if(!a||a.status!=='open'||day<=a.day)return{applied:false};
 const all=[...a.lots,...(a.consignment?[a.consignment]:[])];
 let sold=0,won=0,earned=0,spent=0;
 const results=[];
 for(const lot of all){
  const mine=lot.sellerKind==='player';
  const seller=mine?null:world.npcs.find(n=>n.name===lot.seller);
  const horses=mine?world.horses:seller?.horses;
  const h=horses?.find(h=>String(h.id)===String(lot.horseId));
  if(!h){results.push({horseId:lot.horseId,status:'missing',seller:lot.seller});continue;}
  // Check again at settlement: a previously listed horse may become core stock.
  if(!mine&&!npcCanSell(world,seller,h)){results.push({horseId:h.id,horseName:h.name,seller:lot.seller,status:'retained'});continue;}
  const npcs=(world.npcs||[]).filter(n=>n.name!==lot.seller&&(n.horses||[]).length<Math.min(100,num(n.stalls)||100));
  const offers=npcs.map(n=>{const max=roundPrice(lot.reserve*(.86+(hash(`${a.week}|${lot.horseId}|${n.name}`)%50)/100));return{n,price:max};})
   .filter(o=>num(o.n.funds)>=o.price).sort((x,y)=>y.price-x.price||x.n.name.localeCompare(y.n.name));
  const rival=offers[0];const playerBid=mine?0:num(lot.playerBid);
  let buyer=null,price=0;
  if(!mine&&playerBid>=lot.reserve&&playerBid>=num(rival?.price)&&world.horses.length<num(world.stalls)&&num(world.money)>=playerBid){buyer='player';price=playerBid;}
  else if(rival&&rival.price>=lot.reserve){buyer=rival.n;price=rival.price;}
  if(!buyer){results.push({horseId:h.id,horseName:h.name,seller:lot.seller,status:'unsold'});continue;}
  if(buyer==='player'){world.money-=price;spent+=price;world.horses.push(h);won++;}
  else {buyer.horses.push(h);buyer.funds=num(buyer.funds)-price;}
  const at=horses.findIndex(x=>String(x.id)===String(h.id));if(at>=0)horses.splice(at,1);
  if(mine){world.money+=price;earned+=price;if(opts.archive)opts.archive(h,world.year);}else if(seller)seller.funds=num(seller.funds)+price;
  sold++;results.push({horseId:h.id,horseName:h.name,seller:lot.seller,status:'sold',buyer:buyer==='player'?'player':buyer.name,price});
 }
 a.status='closed';a.results=results;
 store.history.push({day:a.day,week:a.week,results:results.map(x=>({...x}))});store.history=store.history.slice(-12);
 return{applied:true,sold,won,earned,spent,results};
}
const api={TOP_COUNT,DAILY_COUNT,SPECIAL_COUNT,BID_STEP,dayOf,weekday,isFriday,weekOf,ranking,ensure,daily,openAuction,placeBid,consign,closeAuction};
root.HorseRanchAuction=Object.freeze(api);if(typeof module!=='undefined'&&module.exports)module.exports=root.HorseRanchAuction;
})(typeof globalThis!=='undefined'?globalThis:this);
