/* HORSE RANCH 20.12 — NPC-only racing on closed race days.
 * Pure progression API. No player ownership, wallet, jockey relation, registration
 * or personal career records are touched. Uses the physical 20.2 race engine.
 * Tuning constants are provisional game design values.
 */
(function(root){
'use strict';
const MAX_FIELD=12, MIN_FIELD=2, HISTORY_LIMIT=48;
const num=(v,defaultValue=0)=>Number.isFinite(Number(v))&&v!==null?Number(v):defaultValue;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function dayOf(x){return (num(x.year)-1)*360+(num(x.month)-1)*30+num(x.day);}
function ensure(world){
  if(!world.npcAutoRacing||typeof world.npcAutoRacing!=='object')world.npcAutoRacing={version:1,history:[],totalRaces:0,totalCancelled:0};
  const s=world.npcAutoRacing;
  if(!Array.isArray(s.history))s.history=[];
  s.totalRaces=Math.max(0,num(s.totalRaces));s.totalCancelled=Math.max(0,num(s.totalCancelled));
  return s;
}
function selectField(world,race,eligibleFn,scoreFn,usedIds){
  const target=race.grade==='G1'?88:race.grade==='G2'?79:race.grade==='G3'?70:65;
  const options=[];
  for(const npc of world.npcs||[])for(const h of npc.horses||[]){
    if(usedIds.has(String(h.id))||!eligibleFn(h,race))continue;
    // Prefer horses with appropriate grade and distance, while spreading
    // opportunities among qualified entrants rather than always taking top 12.
    options.push({h,npc,score:scoreFn(h,race,target)});
  }
  options.sort((a,b)=>b.score-a.score||num(a.h.id)-num(b.h.id));
  return options.slice(0,MAX_FIELD);
}
function restoreNpcDaily(world){
  for(const ranch of world.npcs||[])for(const h of ranch.horses||[]){
    // Current player's horses are never in this list. Ordinary NPC horses
    // recover on the same calendar rhythm as player horses.
    h.fatigue=clamp(num(h.fatigue)-3,0,100);
    h.condition=clamp(num(h.condition,82)+2,25,100);
    h.hoof=clamp(num(h.hoof,100)+1,0,100);
    if(num(h.injury)>0)h.injury=Math.max(0,num(h.injury)-1);
  }
}
function complete(world,race,ctx,usedIds){
  if(!race||race.state==='finished'||race.npcAutoResult)return{applied:false,reason:'already-completed'};
  const day=dayOf(race);
  const entrants=selectField(world,race,ctx.eligible,ctx.score,usedIds);
  if(entrants.length<MIN_FIELD){
    race.state='finished';race.result=[];
    race.npcAutoResult={version:1,status:'not-enough-entrants',date:day,entrants:entrants.length};
    return{applied:true,held:false,reason:'not-enough-entrants'};
  }
  // No mutation of race/horse state until the entire physical simulation
  // completes; unexpected simulation errors do not leave a half-written race.
  const sim=ctx.simulate({race,entrants:entrants.map(x=>({horse:x.h,jockey:null,friendship:null}))});
  if(!sim||!Array.isArray(sim.results)||sim.results.length!==entrants.length)throw Error('NPC race engine did not return a complete field');
  const byId=new Map(entrants.map(x=>[String(x.h.id),x.h]));
  const seen=new Set();
  const rows=sim.results.map((item,i)=>{
    const id=String(item.horseId),h=byId.get(id);
    if(!h||seen.has(id)||num(item.place)!==i+1||!Number.isFinite(Number(item.time)))throw Error('NPC race result integrity failed');
    seen.add(id);
    return{horseId:h.id,horseName:h.name,place:i+1,time:Number(item.time).toFixed(2)};
  });
  // Prize ownership is fixed at the actual start, even if an auction transfers the horse before payday.
  race.npcPurseOwners=Object.fromEntries(entrants.map(x=>[String(x.h.id),x.npc.name]));
  race.result=rows;race.state='finished';
  race.npcAutoResult={version:1,status:'finished',date:day,winner:rows[0].horseName,entrants:rows.length};
  race.ratingChanges=[];
  for(const row of rows){
    const h=byId.get(String(row.horseId));
    const prior=ctx.rating(h),next=ctx.newRating(prior,race.grade,row.place,rows.length);
    h.rating=next;
    race.ratingChanges.push({horseId:h.id,before:prior,after:next,delta:next-prior});
    h.starts=Math.max(0,num(h.starts))+1;
    if(row.place===1)h.wins=Math.max(0,num(h.wins))+1;
    if(row.place===2)h.seconds=Math.max(0,num(h.seconds))+1;
    if(row.place===3)h.thirds=Math.max(0,num(h.thirds))+1;
    h.lastRaceIndex=day;
    h.history=Array.isArray(h.history)?h.history:[];
    h.history.unshift({year:race.year,month:race.month,day:race.day,grade:race.grade,dist:race.dist,place:row.place,npc:true,auto:true});
    h.history=h.history.slice(0,40);
    h.fatigue=clamp(num(h.fatigue)+16,0,100);
    h.condition=clamp(num(h.condition,82)-7,25,100);
    h.hoof=clamp(num(h.hoof,100)-7,0,100);
    usedIds.add(String(h.id));
    if(ctx.recordAchievement)ctx.recordAchievement(h,race,row.place);
  }
  race.ratingSettled=true;
  if(ctx.recordMerit)ctx.recordMerit(world,race);
  return{applied:true,held:true,entrants:rows.length,winner:rows[0].horseName};
}
function closeDay(world,day,ctx){
  const store=ensure(world),races=(world.races||[]).filter(r=>dayOf(r)===day&&r.state!=='finished').sort((a,b)=>num(a.no)-num(b.no));
  if(!races.length)return{applied:false,held:0,cancelled:0};
  const usedIds=new Set();
  // Avoid entering a horse twice on the same day, including after a player
  // completed a race earlier that day.
  for(const r of world.races||[])if(dayOf(r)===day&&r.state==='finished')for(const row of r.result||[])usedIds.add(String(row.horseId));
  let held=0,cancelled=0;
  for(const r of races){
    const out=complete(world,r,ctx,usedIds);
    if(!out.applied)continue;
    if(out.held){held++;store.totalRaces++;}else{cancelled++;store.totalCancelled++;}
    store.history.push({raceId:r.id,year:r.year,month:r.month,day:r.day,grade:r.grade,dist:r.dist,
      status:out.held?'finished':'not-enough-entrants',entrants:out.entrants||0,winner:out.winner||null,podium:r.result.slice(0,3).map(x=>({horseName:x.horseName,place:x.place,time:x.time}))});
  }
  store.history=store.history.slice(-HISTORY_LIMIT);
  return{applied:held+cancelled>0,held,cancelled};
}
const api=Object.freeze({MAX_FIELD,MIN_FIELD,dayOf,ensure,selectField,restoreNpcDaily,complete,closeDay});
root.HorseRanchNpcAutoRacing=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
