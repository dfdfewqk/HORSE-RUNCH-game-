/* HORSE RANCH 20.6 — named NPC ranch training. Game days: 30 per month.
 * Shared player trainingGain; no hidden stat bonuses, cap breaches or extra ranches.
 * Persist only quarterly strategies and one short monthly summary per named ranch.
 */
(function(root){
 'use strict';
 const VERSION=1;
 const STATS=['speed','stamina','power'];
 const TOP_LEVEL=new Set(['그랜드 스터드','윈드필드 목장']);
 const ROOKIE='레드크라운 목장';
 const TRAINING_COST=75000;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function hash(text){let x=2166136261;for(const c of String(text)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
 function seededRandom(seed){let x=hash(seed)||1;return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
 function monthOf(s){return `${Number(s.year)}-${Number(s.month)}`;}
 function quarterOf(s){return `${Number(s.year)}-Q${Math.floor((Number(s.month)-1)/3)+1}`;}
 function strength(horses){
   const active=(horses||[]).filter(h=>h&&!h.retired&&Number(h.age)>=2&&Number(h.age)<8);
   const scores=active.map(h=>Number.isFinite(Number(h.rating))&&h.rating!==null?Number(h.rating):
     59+((Number(h.speed)||60)*.45+(Number(h.stamina)||60)*.3+(Number(h.power)||60)*.25-70)*1.4)
     .sort((a,b)=>b-a).slice(0,3);
   if(!scores.length)return null;
   return scores.reduce((a,b)=>a+b,0)/scores.length;
 }
 function ensure(world){
   if(!world.npcTraining||typeof world.npcTraining!=='object')world.npcTraining={version:VERSION,lastMonth:monthOf(world),lastQuarter:quarterOf(world),ranches:{}};
   const store=world.npcTraining;
   store.version=VERSION;
   if(!store.ranches||typeof store.ranches!=='object')store.ranches={};
   if(!store.lastMonth)store.lastMonth=monthOf(world); // never backfill old saves
   if(!store.lastQuarter)store.lastQuarter=quarterOf(world);
   for(const ranch of world.npcs||[]){if(!ranch.named)continue;
     if(!store.ranches[ranch.name])store.ranches[ranch.name]=planFor(ranch,world,quarterOf(world));
   }
   return store;
 }
 function planFor(ranch,world,quarter){
   const mine=strength(world.horses),their=strength(ranch.horses);
   // A struggling player is never force-matched. Rival only gets more training
   // attempts once the player's actual race team becomes competitive.
   const close=mine!==null&&their!==null&&mine>=their-8;
   const red=ranch.name===ROOKIE;
   const elite=TOP_LEVEL.has(ranch.name);
   const sessions=red?(close?4:3):elite?(close?3:1):(close?3:2);
   const gaps=Object.fromEntries(STATS.map(k=>[k,(ranch.horses||[]).reduce((n,h)=>n+Math.max(0,(Number(h.caps?.[k])||0)-(Number(h[k])||0)),0)]));
   // Training focus is recalculated every quarter from *actual* gaps, not
   // permanently assigned by distance, racing style or ranch identity.
   const random=seededRandom(ranch.name+'|'+quarter);
   const ranked=STATS.map(k=>({key:k,score:gaps[k]*(.9+random()*.2)})).sort((a,b)=>b.score-a.score);
   return {quarter,focus:ranked[0].key,mode:close?'투자 확대':'안정 육성',sessions,bench:their===null?null:Math.round(their),playerBench:mine===null?null:Math.round(mine),last:null};
 }
 function chooseStat(h,plan,random){
   const choices=STATS.map(k=>({key:k,gap:Math.max(0,(Number(h.caps?.[k])||0)-(Number(h[k])||0))})).filter(k=>k.gap>0);
   if(!choices.length)return null;
   // Focus biases selection but does not lock a ranch into one stat.
   const weights=choices.map(x=>Math.max(1,x.gap)*(x.key===plan.focus?1.45:1));
   let roll=random()*weights.reduce((a,b)=>a+b,0);
   for(let i=0;i<choices.length;i++){roll-=weights[i];if(roll<0)return choices[i].key;}
   return choices.at(-1).key;
 }
 function trainRanch(ranch,plan,month,gainFn,sessionBudget=Infinity){
   const summary={month,eligible:0,sessions:0,gains:0,improved:0,estimatedCost:0};
   for(const h of ranch.horses||[]){
     if(!h||h.retired||h.injury||h.pregnantUntil||Number(h.age)<2||Number(h.age)>=8)continue;
     summary.eligible++;
     const random=seededRandom(month+'|'+ranch.name+'|'+h.id);
     let improvement=0;
     // Session-local fatigue rises. It is recovered between monthly batches;
     // this avoids creating permanently unrecovered NPC fatigue, which 20.5
     // has no autonomous recovery mechanism for.
     for(let i=0;i<plan.sessions;i++){
       if(summary.sessions>=sessionBudget)break;
       const stat=chooseStat(h,plan,random);
       if(!stat)break;
       const shadow={...h,fatigue:clamp((Number(h.fatigue)||0)+i*10,0,100)};
       const step=Math.max(0,Math.min(Number(h.caps[stat])-Number(h[stat]),Number(gainFn(shadow,stat,random))||0));
       summary.sessions++;
       if(step>0){h[stat]+=step;improvement+=step;summary.gains+=step;}
     }
     if(improvement)summary.improved++;
   }
   summary.estimatedCost=summary.sessions*TRAINING_COST;
   return summary;
 }
 function advance(world,gainFn,opts={}){
   const store=ensure(world),month=monthOf(world);
   if(store.lastMonth===month)return{applied:false,month};
   if(typeof gainFn!=='function')throw Error('공통 조교 성장 함수를 찾을 수 없습니다.');
   // This must be invoked after crossing a month boundary, not on every day.
   const q=quarterOf(world),review=store.lastQuarter!==q;
   if(review){for(const r of world.npcs||[]){if(r.named)store.ranches[r.name]=planFor(r,world,q);}store.lastQuarter=q;}
   const summaries=[];
   for(const ranch of world.npcs||[]){
     if(!ranch.named)continue;
     const plan=store.ranches[ranch.name]||(store.ranches[ranch.name]=planFor(ranch,world,q));
     const maxSessions=typeof opts.trainingBudget==='function'?opts.trainingBudget(ranch,world):Infinity;
     const summary=trainRanch(ranch,plan,month,gainFn,maxSessions);
     plan.last=summary;
     summaries.push({ranch:ranch.name,...summary});
   }
   store.lastMonth=month;
   return{applied:true,month,review,summaries};
 }
 const api=Object.freeze({version:VERSION,STATS,monthOf,quarterOf,strength,ensure,planFor,chooseStat,trainRanch,advance});
 root.HorseRanchNpcTraining=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
