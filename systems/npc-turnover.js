/* HORSE RANCH 20.8 — NPC roster renewal, without mortality or breeding.
 * One annual operation. Preserve every incumbent, including retired horses.
 * Existing race rules, genetic potential and player ownership are unchanged.
 */
(function(root){
'use strict';
const MAX_STALLS=100, VERSION=1;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function hash(text){let x=2166136261;for(const c of String(text)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
function randomSeeded(text){let x=hash(text)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function rosterLimit(ranch){
  const count=(ranch.horses||[]).length;
  const raw=Number(ranch.stalls);
  return clamp(Number.isFinite(raw)&&raw>0?Math.floor(raw):Math.max(24,count+6),count>MAX_STALLS?MAX_STALLS:Math.min(count,MAX_STALLS),MAX_STALLS);
}
function ensure(world){
  if(!world.npcTurnover||typeof world.npcTurnover!=='object'){
    world.npcTurnover={version:VERSION,lastYear:Math.floor(Number(world.year)||1),last:null,history:[]};
  }
  const store=world.npcTurnover;
  store.version=VERSION;
  if(!Number.isInteger(store.lastYear))store.lastYear=Math.floor(Number(world.year)||1);
  if(!Array.isArray(store.history))store.history=[];
  if(!('last' in store))store.last=null;
  return store;
}
function incomingPlan(ranch,year){
  const named=!!ranch.named;
  const rng=randomSeeded(year+'|'+ranch.name+'|npc-turnover-v1');
  const red=ranch.name==='레드크라운 목장';
  const current=(ranch.horses||[]);
  const active=current.filter(h=>!h.retired&&Number(h.age)>=2).length;
  // Moderate annual arrivals. Redcrown can recruit faster, but never receives
  // arbitrarily inflated stats as a catch-up shortcut.
  let requested=named?(red?3:2+(rng()<.32?1:0)):(rng()<.38?2:1);
  const severeShortage=named?active<Math.min(10,Math.ceil(current.length*.22)):active<6;
  if(severeShortage)requested+=named?2:1;
  return {requested,active,named,red,severeShortage,rng};
}
function candidate(ranch,year,ordinal,context){
  const rng=randomSeeded(year+'|'+ranch.name+'|'+ordinal+'|incoming');
  const eliteChance=context.named?(context.red?.085:.075):.035;
  const elite=rng()<eliteChance;
  const experienced=elite || (context.severeShortage && ordinal===0) || rng()<.24;
  const age=experienced?(rng()<.5?3:4):(rng()<.72?2:3);
  const base=elite?85+Math.floor(rng()*6):experienced?72+Math.floor(rng()*12):61+Math.floor(rng()*19);
  const variate=()=>Math.floor(rng()*9)-4;
  const stats={speed:clamp(base+variate(),50,94),stamina:clamp(base+variate(),50,94),power:clamp(base+variate(),50,94)};
  // The generated profile stays under the existing 20.5 global cap model.
  const bonus=2+Math.floor(rng()*7), gp=clamp(base+bonus,55,96);
  const experience=experienced?{starts:3+Math.floor(rng()*10),wins:elite?1+Math.floor(rng()*3):Math.floor(rng()*2)}:{starts:0,wins:0};
  return {age,stats,gp,elite,experienced,experience,source:experienced?'외부 영입':'신예 영입'};
}
function expandForNeed(ranch,wanted){
  const owned=(ranch.horses||[]).length;
  let stalls=rosterLimit(ranch);
  if(ranch.named&&stalls-owned<wanted){
    // NPC capacity can grow modestly, preserving the 100-live-horse rule.
    // Player stall expansion is a separate existing feature/roadmap.
    stalls=Math.min(MAX_STALLS,stalls+Math.min(4,Math.max(2,wanted-(stalls-owned))));
  }
  // Existing saves with undefined stalls remain valid.
  ranch.stalls=stalls;
  return Math.max(0,Math.min(wanted,stalls-owned));
}
function advance(world,make){
  if(typeof make!=='function')throw Error('NPC 영입을 위한 말 생성기가 없습니다.');
  const store=ensure(world),current=Math.floor(Number(world.year)||1);
  if(current<=store.lastYear)return {applied:false,year:current,added:0,ranches:[]};
  let last=null;
  for(let year=store.lastYear+1;year<=current;year++){
    const reports=[];
    let added=0;
    for(const ranch of world.npcs||[]){
      if(!ranch||!Array.isArray(ranch.horses))continue;
      const plan=incomingPlan(ranch,year);
      const count=expandForNeed(ranch,plan.requested);
      const report={ranch:ranch.name,named:!!ranch.named,added:0,rookies:0,experienced:0,activeBefore:plan.active,stalls:ranch.stalls,horseIds:[],examples:[]};
      for(let i=0;i<count;i++){
        const spec=candidate(ranch,year,i,plan);
        const newHorse=make(spec,ranch,year);
        if(!newHorse||!Number.isFinite(Number(newHorse.id)))throw Error('NPC 신규 영입마 생성 실패');
        if(ranch.horses.some(h=>String(h.id)===String(newHorse.id)))throw Error('NPC 영입마 ID 중복');
        newHorse.npcArrival={year,source:spec.source,ranch:ranch.name};
        ranch.horses.push(newHorse);
        report.added++;
        if(spec.experienced)report.experienced++;else report.rookies++;
        report.horseIds.push(newHorse.id);
        if(report.examples.length<2)report.examples.push(newHorse.name);
        added++;
      }
      if(ranch.horses.length>MAX_STALLS)throw Error('목장 최대 100마리 초과');
      reports.push(report);
    }
    last={year,added,ranches:reports};
    store.history.push({year,added,named:reports.filter(r=>r.named).reduce((n,r)=>n+r.added,0),general:reports.filter(r=>!r.named).reduce((n,r)=>n+r.added,0)});
    store.history=store.history.slice(-8);
    store.lastYear=year;
  }
  store.last=last;
  return {applied:true,...last};
}
root.HorseRanchNpcTurnover=Object.freeze({version:VERSION,MAX_STALLS,ensure,incomingPlan,candidate,expandForNeed,advance});
if(typeof module!=='undefined'&&module.exports)module.exports=root.HorseRanchNpcTurnover;
})(typeof globalThis!=='undefined'?globalThis:this);
