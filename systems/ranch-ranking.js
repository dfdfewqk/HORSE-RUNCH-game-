/* HORSE RANCH 20.11 — merit-based ranch standings.
 * Ranking is driven by verified race results (recorded at race time), not
 * wealth or the number of owned horses. Game-balance weights are provisional.
 */
(function(root){
'use strict';
const WINDOW=360,TOP_COUNT=5,MAX_MERIT=90;
const POINTS=Object.freeze({G1:[24,12,7],G2:[15,8,5],G3:[10,5,3],'특별':[6,3,2],default:[4,2,1]});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const dayOf=o=>(num(o.year)-1)*360+(num(o.month)-1)*30+num(o.day);
const round1=n=>Math.round(n*10)/10;
const recent=(event,day)=>Number.isFinite(event.day)&&event.day<=day&&event.day>day-WINDOW;
function points(grade,place){const rank=Math.floor(num(place));return rank>=1&&rank<=3?(POINTS[grade]||POINTS.default)[rank-1]:0;}
function ensure(world){
 let s=world.ranchMerit;
 if(!s||typeof s!=='object'){s={version:1,events:[],migratedPlayerResults:false};world.ranchMerit=s;}
 if(!Array.isArray(s.events))s.events=[];
 const today=dayOf(world);
 // User-owned saved results establish historical ownership; other old
 // horse histories do not reliably establish the ranch that owned the horse.
 if(!s.migratedPlayerResults){
   const seen=new Set(s.events.map(e=>e.key));
   for(const r of world.results||[]){
     const date=dayOf(r),p=Math.floor(num(r.place));
     if(!recent({day:date},today)||p<1||p>3||!r.raceId||r.horseId==null)continue;
     const key=String(r.raceId)+'|'+String(r.horseId);
     if(seen.has(key))continue;
     s.events.push({key,day:date,raceId:String(r.raceId),horseId:r.horseId,grade:r.grade,place:p,ownerKey:'player',source:'saved-player-result'});
     seen.add(key);
   }
   s.migratedPlayerResults=true;
 }
 // No retroactive deletion of archives: this stores only a bounded one-year
 // active merit window, not the permanent race or achievement history.
 s.events=s.events.filter(e=>e&&e.key&&recent(e,today)).slice(-2400);
 s.version=1;
 return s;
}
function recordRace(world,race){
 if(!race||race.state!=='finished'||!Array.isArray(race.result)||!race.result.length)return{added:0};
 const s=ensure(world),today=dayOf(world),raceDay=dayOf(race);
 if(!recent({day:raceDay},today))return{added:0};
 const map=new Map();
 for(const h of world.horses||[])map.set(String(h.id),'player');
 for(const n of world.npcs||[])for(const h of n.horses||[])if(!map.has(String(h.id)))map.set(String(h.id),'npc:'+n.name);
 const seen=new Set(s.events.map(e=>e.key));let added=0;
 for(const row of race.result){
   const key=String(race.id)+'|'+String(row.horseId),ownerKey=map.get(String(row.horseId)),place=Math.floor(num(row.place));
   if(!ownerKey||seen.has(key)||place<1||place>12)continue;
   s.events.push({key,day:raceDay,raceId:String(race.id),horseId:row.horseId,grade:race.grade,place,ownerKey,source:'race-result'});
   seen.add(key);added++;
 }
 s.events=s.events.slice(-2400);
 return{added};
}
function strength(h){
 const rating=h.rating!=null&&Number.isFinite(Number(h.rating))?num(h.rating):59+((num(h.speed)*.45+num(h.stamina)*.3+num(h.power)*.25)-70)*1.4+Math.min(11,num(h.wins)*1.25);
 const physical=(num(h.speed)+num(h.stamina)+num(h.power))/3;
 return rating*.78+physical*.22;
}
function ranking(world){
 const day=dayOf(world),s=ensure(world),eventMap=new Map();
 for(const e of s.events)if(recent(e,day)){
   if(!eventMap.has(e.ownerKey))eventMap.set(e.ownerKey,[]);
   eventMap.get(e.ownerKey).push(e);
 }
 const ranches=[{name:world.ranchName||'내 목장',player:true,horses:world.horses||[]},...(world.npcs||[]).map(n=>({name:n.name,player:false,horses:n.horses||[]}))];
 return ranches.map(r=>{
   const active=r.horses.filter(h=>h&&!h.retired&&num(h.age)>=2),top=active.map(strength).sort((a,b)=>b-a).slice(0,3);
   const strengthScore=top.length?round1(top.reduce((a,b)=>a+b,0)/top.length):0;
   const events=eventMap.get(r.player?'player':'npc:'+r.name)||[];
   const raw=events.reduce((sum,e)=>sum+points(e.grade,e.place)*(.6+.4*(1-(day-e.day)/WINDOW)),0);
   // Smooth diminishing returns: a hard ceiling caused every established
   // stable to tie at 90 points in long-running leagues, erasing race merit.
   const meritScore=round1(MAX_MERIT*raw/(MAX_MERIT+raw));
   const wins=events.filter(e=>num(e.place)===1);
   const score=round1(strengthScore+meritScore);
   return{name:r.name,player:r.player,score,strengthScore,meritScore,active:active.length,
     g1Wins:wins.filter(e=>e.grade==='G1').length,g2Wins:wins.filter(e=>e.grade==='G2').length,
     g3Wins:wins.filter(e=>e.grade==='G3').length,podiums:events.filter(e=>num(e.place)<=3).length};
 }).sort((a,b)=>b.score-a.score||b.meritScore-a.meritScore||b.strengthScore-a.strengthScore||
   (a.player&&!b.player?-1:b.player&&!a.player?1:a.name.localeCompare(b.name)))
   .map((r,i)=>({...r,rank:i+1,qualified:i<TOP_COUNT&&r.active>0}));
}
const api=Object.freeze({WINDOW,TOP_COUNT,MAX_MERIT,POINTS,dayOf,points,ensure,recordRace,strength,ranking});
root.HorseRanchRanking=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
