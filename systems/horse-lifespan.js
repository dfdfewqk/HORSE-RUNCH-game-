/* HORSE RANCH 20.9 — natural lifespan and compact lineage archive.
 * Age ranges are game balance parameters, not real-world veterinary predictions.
 * One annual evaluation, deterministic per-horse lifespan, no daily history.
 */
(function(root){
'use strict';
const VERSION=1;
const CONFIG=Object.freeze({earlyPercent:4,ordinaryPercent:88,longLivedPercent:8,ordinaryMin:22,ordinaryMax:30,longMin:31,longMax:36});
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function targetAge(h){
  const seed=String(h.id)+'|'+String(h.name||'')+'|lifespan-v1';
  const roll=hash(seed+'|group')%10000;
  if(roll<400)return 19+hash(seed+'|early')%3;  // Rare earlier natural departures
  if(roll<9200)return 22+hash(seed+'|ordinary')%9;
  return 31+hash(seed+'|long-lived')%6;       // Rare 31+ year survivors
}
function ensureHorse(h){
  if(!h||typeof h!=='object')return null;
  if(!h.lifeSpan||typeof h.lifeSpan!=='object'){
    // Preserve preexisting elderly horses on upgrading; never remove them on load.
    const age=Math.max(0,Math.floor(Number(h.age)||0));
    h.lifeSpan={version:VERSION,targetAge:Math.max(targetAge(h),age+1),assignedAtAge:age};
  }
  const s=h.lifeSpan;
  if(!Number.isFinite(s.targetAge)||s.targetAge<1)s.targetAge=Math.max(targetAge(h),Math.floor(Number(h.age)||0)+1);
  s.targetAge=Math.max(1,Math.floor(s.targetAge));s.version=VERSION;
  return s;
}
function ensureWorld(world){
  if(!world.horseLifespanClock||typeof world.horseLifespanClock!=='object')
    world.horseLifespanClock={version:VERSION,lastYear:Math.floor(Number(world.year)||1),totalDeaths:0};
  const clock=world.horseLifespanClock;
  if(!Number.isInteger(clock.lastYear))clock.lastYear=Math.floor(Number(world.year)||1);
  clock.version=VERSION;clock.totalDeaths=Math.max(0,Number(clock.totalDeaths)||0);
  if(!Array.isArray(world.pedigreeArchive))world.pedigreeArchive=[];
  if(!Array.isArray(world.horseLifeEvents))world.horseLifeEvents=[];
  for(const h of world.horses||[])ensureHorse(h);
  for(const ranch of world.npcs||[])for(const h of ranch.horses||[])ensureHorse(h);
  return clock;
}
function hasPendingBreeding(world,h){
  // Protect in-progress foals until the original 20.4 birth handling resolves.
  // No changes to mating rules or stored breeding data are necessary.
  return (world.breedings||[]).some(b=>String(b.mareId)===String(h.id)||String(b.sireId)===String(h.id));
}
function lineageRecord(h,year,owner,achievements){
  const career=achievements||h.careerAchievements||{};
  return {
    id:h.id,name:h.name,gender:h.gender,age:h.age,archive:true,deceased:true,retired:true,
    deathYear:year,deathReason:'자연사',lastRanch:owner,
    fatherId:h.fatherId??null,motherId:h.motherId??null,
    parents:{sire:h.parents?.sire||'기초 계통',dam:h.parents?.dam||'기초 계통'},
    // Retain only an actually recorded temperament. Missing data stays unknown.
    hrTemperament:h.hrTemperament&&typeof h.hrTemperament==='object'?{...h.hrTemperament}:null,
    distanceBand:h.distanceBand||null,coat:h.coat||null,
    starts:Math.max(0,Number(h.starts)||0),wins:Math.max(0,Number(h.wins)||0),
    seconds:Math.max(0,Number(h.seconds)||0),thirds:Math.max(0,Number(h.thirds)||0),
    children:Math.max(0,Number(h.children)||0),
    peakRating:typeof career.peakRating==='number'?career.peakRating:(h.rating??null),
    careerAchievements:{version:1,peakRating:typeof career.peakRating==='number'?career.peakRating:null,
      majorWins:(career.majorWins||[]).map(x=>({year:x.year,month:x.month,day:x.day,grade:x.grade,dist:x.dist??null}))},
    // Preserve only five compact recent rows to support legacy '5 wins' title rule.
    history:(h.history||[]).slice(0,5).map(x=>({year:x.year,month:x.month,day:x.day,grade:x.grade,dist:x.dist,place:x.place}))
  };
}
function archivePedigree(world,h,reason='판매',year=Math.floor(Number(world?.year)||1),owner=world?.ranchName||'플레이어 목장',achievements=null){
  if(!world||!h)return null;
  if(!Array.isArray(world.pedigreeArchive))world.pedigreeArchive=[];
  const existing=world.pedigreeArchive.find(x=>String(x.id)===String(h.id));
  if(existing)return existing; // Historical identity, not a new synthetic ancestor.
  const row=lineageRecord(h,year,owner,achievements);
  if(reason!=='자연사'){
    row.archiveReason=reason;
    row.deceased=false;
    row.retired=!!h.retired;
    row.deathYear=null;
    row.deathReason=null;
  }
  world.pedigreeArchive.push(row);
  return row;
}
function advanceYear(world,options={}){
  const clock=ensureWorld(world),year=Math.floor(Number(world.year)||1);
  if(year<=clock.lastYear)return{applied:false,year,deaths:0,playerDeaths:0,npcDeaths:0,deferred:0};
  const summary={applied:true,year,deaths:0,playerDeaths:0,npcDeaths:0,deferred:0,examples:[]};
  for(const [owner,ranch] of [[world.ranchName||'플레이어 목장',null],...(world.npcs||[]).map(n=>[n.name,n])]){
    const list=ranch?ranch.horses:world.horses;
    if(!Array.isArray(list))continue;
    for(let i=list.length-1;i>=0;i--){
      const h=list[i],span=ensureHorse(h);
      if(!span||Number(h.age)<span.targetAge)continue;
      if(hasPendingBreeding(world,h)){summary.deferred++;continue;}
      const achievements=typeof options.getAchievements==='function'?options.getAchievements(h):h.careerAchievements;
      const title=typeof options.getTitle==='function'?options.getTitle(h):null;
      if(typeof options.archiveLegend==='function')options.archiveLegend(h,year);
      archivePedigree(world,h,'자연사',year,owner,achievements);
      if(world.selectedHorse!=null&&String(world.selectedHorse)===String(h.id))world.selectedHorse=null;
      if(world.selectedDam!=null&&String(world.selectedDam)===String(h.id))world.selectedDam=null;
      if(world.selectedSire!=null&&String(world.selectedSire)===String(h.id))world.selectedSire=null;
      if(Array.isArray(world.registrations))world.registrations=world.registrations.filter(x=>String(x.horseId)!==String(h.id));
      list.splice(i,1);
      summary.deaths++;if(ranch)summary.npcDeaths++;else summary.playerDeaths++;
      const event={year,id:h.id,name:h.name,age:h.age,owner,title:title||null};
      world.horseLifeEvents.push(event);
      if(summary.examples.length<3)summary.examples.push(event);
    }
  }
  world.horseLifeEvents=world.horseLifeEvents.slice(-20);
  clock.lastYear=year;clock.totalDeaths+=summary.deaths;
  return summary;
}
const api=Object.freeze({version:VERSION,CONFIG,targetAge,ensureHorse,ensureWorld,hasPendingBreeding,lineageRecord,archivePedigree,advanceYear});
root.HorseRanchLifeSpan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
