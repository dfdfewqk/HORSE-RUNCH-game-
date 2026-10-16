/* HORSE RANCH 20.7 — aging, retirement and permanent achievements.
 * These are game balance values (not veterinary predictions).
 * Data rules only. No DOM, timer, filesystem or network side effects.
 */
(function(root){
 'use strict';
 const KEYS=['speed','stamina','power'];
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function peakSnapshot(h){return Object.fromEntries(KEYS.map(k=>[k,Math.max(40,Number(h[k])||40)]));}
 function ensure(h){
   if(!h || typeof h!=='object')return null;
   if(!h.lifeCycle || typeof h.lifeCycle!=='object'){
     h.lifeCycle={version:1,lastProcessedAge:Math.floor(Number(h.age)||0),peakStats:peakSnapshot(h),peakIsObserved:Math.floor(Number(h.age)||0)>=11,declines:{speed:0,stamina:0,power:0},retirementYear:null};
   }
   const lc=h.lifeCycle;
   lc.version=1;
   if(!lc.peakStats || typeof lc.peakStats!=='object')lc.peakStats=peakSnapshot(h);
   if(!lc.declines || typeof lc.declines!=='object')lc.declines={speed:0,stamina:0,power:0};
   if(!Number.isInteger(lc.lastProcessedAge))lc.lastProcessedAge=Math.floor(Number(h.age)||0);
   for(const k of KEYS){
     if(!Number.isFinite(Number(lc.peakStats[k])))lc.peakStats[k]=Number(h[k])||40;
     if(!Number.isFinite(Number(lc.declines[k])))lc.declines[k]=0;
   }
   if(h.retired&&lc.retirementYear==null)lc.retirementYear=null; // no guessed retirement date for old saves
   return lc;
 }
 function effectiveCap(h,key){
   if(!KEYS.includes(key))return 0;
   const lc=ensure(h);
   const cap=Number(h.caps?.[key]);
   const raw=Number.isFinite(cap)?cap:99;
   if(Number(h.age)<11 || !lc.declines[key])return raw;
   // Even repeated high-quality training cannot restore the horse to its
   // measured peak once the 11-year transition has happened.
   const lowered=Math.min(raw-lc.declines[key],lc.peakStats[key]-Math.max(3,Math.floor(lc.declines[key]*.65)));
   return Math.min(raw,Math.max(40,Math.floor(lowered)));
 }
 function retireChance(h,age){
   if(age<8)return 0;
   const rates={8:.01,9:.03,10:.06,11:.09,12:.16,13:.24,14:.34,15:.50};
   let p=rates[Math.min(age,15)]||0;
   if(Number(h.condition)<50)p+=.08;
   if(Number(h.fatigue)>75)p+=.04;
   return clamp(p,0,.75);
 }
 function recordPeak(lc,h){for(const k of KEYS)lc.peakStats[k]=Math.max(lc.peakStats[k],Number(h[k])||40);}
 function stepAge(h,newAge,year,random=null){
   const lc=ensure(h),to=Math.max(0,Math.floor(Number(newAge)||0));
   if(to<=lc.lastProcessedAge)return{applied:false,retired:!!h.retired,declined:0};
   let declined=0,retirement=false;
   for(let a=lc.lastProcessedAge+1;a<=to;a++){
     if(a<=11){recordPeak(lc,h);}
     if(a>=11){
       for(let i=0;i<KEYS.length;i++){
         const key=KEYS[i],before=Number(h[key])||40;
         const decrease=a===11 ? 7+(hash(h.id+'|'+key+'|cliff')%5) : 1+(hash(h.id+'|'+a+'|'+key)%3);
         lc.declines[key]+=decrease;
         h[key]=Math.max(40,before-decrease);
         declined+=Math.max(0,before-h[key]);
       }
       // Training should never give an aged runner a better ceiling than the
       // new performance limit; the hereditary genetic potential is unchanged.
       for(const key of KEYS)h[key]=Math.min(h[key],effectiveCap(h,key));
     }
     if(!h.retired){
       const roll=typeof random==='function'?random():hash(h.id+'|'+year+'|retire|'+a)/4294967296;
       if(roll<retireChance(h,a)){
         h.retired=true;retirement=true;lc.retirementYear=year;lc.retirementAge=a;
       }
     }
   }
   lc.lastProcessedAge=to;
   return{applied:true,retired:!!h.retired,newRetirement:retirement,declined};
 }
 function ensureAchievements(h){
   if(!h.careerAchievements||typeof h.careerAchievements!=='object'){
     const observed=(h.history||[]).filter(x=>x.place===1&&['G1','G2','G3'].includes(x.grade));
     h.careerAchievements={version:1,majorWins:observed.map(x=>({year:x.year,month:x.month,day:x.day,grade:x.grade,dist:x.dist||null})),peakRating:typeof h.rating==='number'?h.rating:null,recordSource:'known-history-only'};
   }
   return h.careerAchievements;
 }
 function recordRace(h,r,place){
   const achievements=ensureAchievements(h);
   if(typeof h.rating==='number')achievements.peakRating=Math.max(achievements.peakRating??0,h.rating);
   if(place!==1 || !['G1','G2','G3'].includes(r.grade))return false;
   const when={year:r.year,month:r.month,day:r.day,grade:r.grade,dist:r.dist};
   if(achievements.majorWins.some(x=>x.year===when.year&&x.month===when.month&&x.day===when.day&&x.grade===when.grade&&x.dist===when.dist))return false;
   achievements.majorWins.push(when);
   return true;
 }
 function title(h){
   const a=ensureAchievements(h);
   const g1=a.majorWins.filter(x=>x.grade==='G1').length;
   const g2=a.majorWins.filter(x=>x.grade==='G2').length;
   const g3=a.majorWins.filter(x=>x.grade==='G3').length;
   if(g1)return `G1 ${g1}승`;
   if(g2)return `G2 ${g2}승`;
   if(g3)return `G3 ${g3}승`;
   return Number(h.wins)>=5&&(h.history||[]).length>=5?`통산 ${h.wins}승`:null;
 }
 function archive(world,h,reason,year){
   const t=title(h);
   if(!t)return false;
   if(!Array.isArray(world.horseLegends))world.horseLegends=[];
   const entry={id:h.id,name:h.name,gender:h.gender,reason,year,age:h.age,retired:!!h.retired,starts:h.starts||0,wins:h.wins||0,
     peakRating:ensureAchievements(h).peakRating,peakStats:{...ensure(h).peakStats},parents:{...h.parents},majorWins:ensureAchievements(h).majorWins.map(x=>({...x})),title:t};
   const at=world.horseLegends.findIndex(x=>String(x.id)===String(h.id));
   if(at>=0)world.horseLegends[at]=entry;else world.horseLegends.push(entry);
   return true;
 }
 function ensureWorld(world){
   if(!Array.isArray(world.horseLegends))world.horseLegends=[];
   if(!world.horseLifeClock||typeof world.horseLifeClock!=='object')world.horseLifeClock={lastYear:Number(world.year)};
   if(!Number.isFinite(Number(world.horseLifeClock.lastYear)))world.horseLifeClock.lastYear=Number(world.year);
   for(const h of world.horses||[])ensure(h);
   for(const n of world.npcs||[])for(const h of n.horses||[])ensure(h);
   return world.horseLifeClock;
 }
 function advanceYear(world,foalUpdater){
   const clock=ensureWorld(world),year=Math.floor(Number(world.year));
   if(year<=clock.lastYear)return{applied:false,declines:0,retirements:0};
   let declines=0,retirements=0;
   for(let y=clock.lastYear+1;y<=year;y++){
     for(const n of world.npcs||[]){
       for(const h of n.horses||[]){
         if(h.foalEducation?.bornAtDay!=null&&typeof foalUpdater==='function')foalUpdater(h,(y-1)*360+1);
         else h.age=Math.max(0,Math.floor(Number(h.age)||0)+1);
       }
     }
     for(const h of [...world.horses,...(world.npcs||[]).flatMap(n=>n.horses||[])]){
       const outcome=stepAge(h,h.age,y);
       if(outcome.applied){declines+=outcome.declined;retirements+=outcome.newRetirement?1:0;}
       if(h.retired)archive(world,h,'경주 은퇴',y);
     }
   }
   clock.lastYear=year;
   return{applied:true,declines,retirements};
 }
 const api=Object.freeze({ensure,ensureWorld,stepAge,effectiveCap,retireChance,ensureAchievements,recordRace,title,archive,advanceYear});
 root.HorseRanchLifeCycle=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
