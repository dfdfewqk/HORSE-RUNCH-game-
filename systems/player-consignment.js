(function installConsignment(){
'use strict';
/* HORSE RANCH: NPC-owned horses under temporary ranch care.
 * Runs AFTER 20.15; never transfers ownership into state.horses permanently.
 * Monetary parameters are prototypes until economy balance is agreed.
 */
const I=window.HorseRanchInteraction,F=window.HorseRanchFoalEducation;
if(!I||!F){console.error('Consignment dependencies missing');return;}
const CFG=Object.freeze({duration:30,fee:600000,specialBudget:300000,dailyUpkeep:5000,weeklyTraining:75000,riderWeekFee:75000,ownerShare:.80,ranchShare:.15,jockeyShare:.05});
const dayOf=w=>(Number(w.year)-1)*360+(Number(w.month)-1)*30+Number(w.day);
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const esc=x=>escapeHtml(String(x??''));
function ensure(w=state){
  if(!w.hrConsignment||typeof w.hrConsignment!=='object')w.hrConsignment={version:1,serial:0,contracts:[],history:[],trainingWorld:{version:1,contracts:[],bookings:[],history:[],lastRoutineDay:0},unpaidUpkeep:0};
  const s=w.hrConsignment;
  if(!Array.isArray(s.contracts))s.contracts=[];
  if(!Array.isArray(s.history))s.history=[];
  if(!s.trainingWorld)s.trainingWorld={version:1,contracts:[],bookings:[],history:[],lastRoutineDay:0};
  s.serial=Math.max(0,Math.floor(num(s.serial)));
  s.unpaidUpkeep=Math.max(0,num(s.unpaidUpkeep));
  return s;
}
function active(){return ensure().contracts.filter(c=>c.status==='active');}
function contracted(id){return active().find(c=>String(c.horse.id)===String(id))||null;}
function occupiedIds(){return new Set(active().map(c=>String(c.horse.id)));}
function slots(){const reputation=num(state.reputation);return reputation>=80?3:reputation>=30?2:1;}
function owner(c){return state.npcs.find(n=>n.name===c.ownerName);}
function unprotectedHorse(n){
  if(!Array.isArray(n?.horses)||n.horses.length<2)return null;
  return n.horses.slice(1).find(h=>h&&!h.retired&&!h.injury&&!h.pregnantUntil&&num(h.age)>=2&&!h.hrProtected&&!h.representative&&!h.breedingReserve&&!h.protectedForBreeding&&!state.registrations.some(x=>String(x.horseId)===String(h.id)))||null;
}
function offers(){return state.npcs.filter(n=>n&&n.horses?.length>1&&num(n.funds)>=CFG.fee+CFG.specialBudget).map(n=>({owner:n,horse:unprotectedHorse(n)})).filter(x=>x.horse&&!occupiedIds().has(String(x.horse.id))).slice(0,6);}
function accept(ownerName,horseId,type){
  if(!state.startDone)return{ok:false,reason:'목장 설립 이후 이용할 수 있습니다.'};
  if(!['care','development','race'].includes(type))return{ok:false,reason:'위탁 종류가 올바르지 않습니다.'};
  if(active().length>=slots())return{ok:false,reason:'현재 목장 명성에서 받을 수 있는 위탁마 수에 도달했습니다.'};
  if(state.horses.length+active().length>=state.stalls)return{ok:false,reason:'빈 마방이 없습니다.'};
  const n=state.npcs.find(x=>x.name===ownerName),h=n?.horses.find(x=>String(x.id)===String(horseId));
  if(!n||!h||unprotectedHorse(n)!==h)return{ok:false,reason:'해당 말은 현재 위탁할 수 없습니다.'};
  if(num(n.funds)<CFG.fee+CFG.specialBudget)return{ok:false,reason:'마주의 계약 예산이 부족합니다.'};
  n.funds-=CFG.fee+CFG.specialBudget;
  n.horses=n.horses.filter(x=>x!==h);
  const s=ensure();
  const c={id:'hc-'+(++s.serial),ownerName:n.name,horse:h,type,raceRights:type==='race',status:'active',starts:dayOf(state),ends:dayOf(state)+CFG.duration,lastTickDay:dayOf(state),feeTotal:CFG.fee,feePaid:0,feeEscrow:CFG.fee,specialRemaining:CFG.specialBudget,specialSpent:0,prizeForOwner:0,prizeForRanch:0,prizeForJockey:0,baseSessions:0};
  s.contracts.push(c);
  return{ok:true,contract:c};
}
function proxy(){return{year:state.year,month:state.month,day:state.day,hr15:ensure().trainingWorld,registrations:state.registrations};}
function school(c,kind,days){
  if(!c||c.status!=='active')return{ok:false,reason:'유효한 위탁 계약이 아닙니다.'};
  if(!['development','race'].includes(c.type))return{ok:false,reason:'일반 관리 계약에는 특별 교육 권한이 없습니다.'};
  const duration=Number(days),cost=I.fee(kind,duration);
  if(!I.COURSE[kind]?.days.includes(duration))return{ok:false,reason:'교육 과정이나 기간이 올바르지 않습니다.'};
  if(dayOf(state)+duration>c.ends)return{ok:false,reason:'계약 기간 안에 완료할 수 있는 교육만 신청할 수 있습니다.'};
  if(!cost||cost>c.specialRemaining)return{ok:false,reason:'NPC 마주의 특별 조교 예산이 부족합니다.'};
  if(I.legacy(c.horse)){
    if(c.specialJobs?.some(j=>j.status==='active')||I.occupied(proxy(),c.horse.id)||I.booked(proxy(),c.horse.id))
      return{ok:false,reason:'이미 진행 중인 특별 조교가 있습니다.'};
    if(!Array.isArray(c.specialJobs))c.specialJobs=[];
    c.specialJobs.push({kind,days:duration,starts:dayOf(state),ends:dayOf(state)+duration,status:'active',cost});
    c.specialRemaining-=cost;c.specialSpent+=cost;
    return{ok:true,cost};
  }
  const r=I.enroll(proxy(),c.horse,kind,duration);
  if(!r.ok)return r;
  c.specialRemaining-=cost;c.specialSpent+=cost;
  return{ok:true,cost};
}
function rider(c,jid,days){
  if(!c||c.status!=='active')return{ok:false,reason:'유효한 계약이 아닙니다.'};
  if(!['development','race'].includes(c.type))return{ok:false,reason:'일반 관리 계약에는 특별 조교 권한이 없습니다.'};
  if(c.specialJobs?.some(j=>j.status==='active'))return{ok:false,reason:'진행 중인 특별 조교가 있습니다.'};
  const j=getJockey(jid),duration=Number(days),cost=Math.ceil(duration/7)*CFG.riderWeekFee;
  if(dayOf(state)+duration>c.ends)return{ok:false,reason:'계약 기간을 넘기는 조교는 신청할 수 없습니다.'};
  if(cost>c.specialRemaining)return{ok:false,reason:'NPC 마주의 특별 조교 예산이 부족합니다.'};
  const r=I.scheduleRider(proxy(),c.horse,j,duration);
  if(!r.ok)return r;
  c.specialRemaining-=cost;c.specialSpent+=cost;
  return{ok:true,cost};
}
function credit(amount){
  const s=ensure(),owed=Math.min(amount,s.unpaidUpkeep);
  s.unpaidUpkeep-=owed;state.money+=amount-owed;
}
function debit(amount){
  const cost=Math.max(0,num(amount)),paid=Math.min(Math.max(0,num(state.money)),cost);
  state.money-=paid;ensure().unpaidUpkeep+=cost-paid;
}
function settleFee(c,elapsed){
  const should=Math.floor(c.feeTotal*Math.min(CFG.duration,elapsed)/CFG.duration);
  const due=Math.max(0,should-c.feePaid);
  if(!due)return;
  c.feePaid+=due;c.feeEscrow-=due;credit(due);
}
function finish(c){
  if(c.status!=='active')return;
  settleFee(c,CFG.duration);
  const n=owner(c);
  if(!n){c.status='return-pending';return;}
  n.funds+=c.specialRemaining+Math.max(0,c.feeEscrow);
  c.specialRemaining=0;c.feeEscrow=0;c.status='completed';c.completedDay=dayOf(state);
  state.registrations=state.registrations.filter(r=>String(r.horseId)!==String(c.horse.id));
  if(!n.horses.some(h=>String(h.id)===String(c.horse.id)))n.horses.push(c.horse);
  const s=ensure();s.history.push({id:c.id,horseName:c.horse.name,ownerName:c.ownerName,feePaid:c.feePaid,prizeForRanch:c.prizeForRanch,day:dayOf(state)});
  s.history=s.history.slice(-40);
}
function tick(){
  const s=ensure(),now=dayOf(state);let changed=false;
  const world=proxy();
  I.schoolAdvance(world,id=>contracted(id)?.horse||null);
  I.riderAdvance(world,id=>contracted(id)?.horse||null,getJockey,(id,jid,make)=>horseJockeyRelation(id,jid,make));
  for(const c of active()){
    const end=Math.min(now,c.ends);
    for(let d=Math.max(c.lastTickDay+1,c.starts+1);d<=end;d++){
      const h=c.horse,elapsed=d-c.starts;
      h.fatigue=Math.max(0,num(h.fatigue)-3);
      h.condition=Math.min(100,Math.max(25,num(h.condition)+2));
      h.hoof=Math.min(100,Math.max(0,num(h.hoof)+1));
      if(num(h.injury)>0)h.injury=Math.max(0,num(h.injury)-1);
      debit(CFG.dailyUpkeep);
      if(elapsed%7===0){
        settleFee(c,elapsed);
        if(!I.occupied(world,h.id)&&!I.booked(world,h.id)&&!h.retired&&!h.injury&&h.fatigue<60&&num(state.money)>=CFG.weeklyTraining){
          const keys=['speed','stamina','power'],stat=keys[(Math.floor(d/7)+num(h.id))%3];
          const cap=window.HorseRanchLifeCycle?.effectiveCap?.(h,stat)??num(h.caps?.[stat]);
          if(num(h[stat])<cap){
            const gain=F.trainingGain(h,stat,()=>((Math.imul(d+num(h.id),2654435761)>>>0)/4294967296));
            h[stat]=Math.min(cap,num(h[stat])+gain);
            state.money-=CFG.weeklyTraining;c.baseSessions++;
          }
        }
      }
    }
    for(const job of c.specialJobs||[]){
      if(job.status!=='active'||end<job.ends)continue;
      const stat=({ground:'power',ride:'stamina',gate:'power',race:'speed'})[job.kind];
      const cap=window.HorseRanchLifeCycle?.effectiveCap?.(c.horse,stat)??num(c.horse.caps?.[stat]);
      const sessions=Math.ceil(job.days/7);
      for(let k=0;k<sessions&&num(c.horse[stat])<cap;k++){
        const gain=F.trainingGain(c.horse,stat,()=>((Math.imul(job.ends+num(c.horse.id)+k,2654435761)>>>0)/4294967296));
        c.horse[stat]=Math.min(cap,num(c.horse[stat])+gain);
      }
      job.status='completed';
      changed=true;
    }
    if(end>c.lastTickDay){c.lastTickDay=end;changed=true;}
    if(now>=c.ends){finish(c);changed=true;}
  }
  return changed;
}
function racePermission(c,r){
  if(!c?.raceRights||c.status!=='active')return '계약에 경주 출전 권한이 없습니다.';
  if(!r||r.state==='finished')return '출전할 수 없는 경주입니다.';
  if(dayOf(r)>c.ends||dayOf(r)<dayOf(state))return '위탁 계약 기간 밖의 경주입니다.';
  if(I.occupied(proxy(),c.horse.id)||I.booked(proxy(),c.horse.id)||c.specialJobs?.some(j=>j.status==='active'))return '특별 조교 중에는 경주에 출전할 수 없습니다.';
  if(!eligible(c.horse,r))return '출전 자격 또는 휴식 조건이 충족되지 않았습니다.';
  return null;
}
function withHorse(c,fn){
  if(!c||state.horses.some(h=>String(h.id)===String(c.horse.id)))return fn();
  const previousHorse=state.selectedHorse,previousJockey=state.selectedJockey;
  state.horses.push(c.horse);
  try{return fn();}finally{
    state.selectedHorse=previousHorse;state.selectedJockey=previousJockey;
    state.horses=state.horses.filter(h=>h!==c.horse);
    save();render();
  }
}
function register(c,rid,jid){
  const r=state.races.find(x=>x.id===rid),problem=racePermission(c,r);
  if(problem)return{ok:false,reason:problem};
  if(!getJockey(jid))return{ok:false,reason:'기수 선택이 잘못되었습니다.'};
  withHorse(c,()=>registerRace(rid,c.horse.id,jid));
  const ok=state.registrations.some(x=>x.raceId===rid&&String(x.horseId)===String(c.horse.id));
  return{ok,reason:ok?'':'경주 등록 조건을 확인해 주세요.'};
}
function race(c,rid,jid){
  const r=state.races.find(x=>x.id===rid),problem=racePermission(c,r);
  if(problem)return{ok:false,reason:problem};
  if(dayOf(state)!==dayOf(r))return{ok:false,reason:'경주 당일에만 출전할 수 있습니다.'};
  const rec=state.registrations.find(x=>x.raceId===rid&&String(x.horseId)===String(c.horse.id));
  if(!rec||rec.jockeyId!==jid)return{ok:false,reason:'이 경주에 등록한 기수를 선택하세요.'};
  let result=null;
  withHorse(c,()=>{
    state.selectedHorse=c.horse.id;
    const before=state.results.length;
    runRace(rid,jid,false);
    if(state.results.length>before)result=state.results[state.results.length-1];
  });
  if(!result)return{ok:false,reason:'경주 결과가 생성되지 않았습니다.'};
  if(result.consignmentSettlementId)return{ok:false,reason:'이미 정산한 경주입니다.'};
  const gross=Math.round(num(result.payout)),ownerPay=Math.round(gross*CFG.ownerShare),jockeyPay=Math.round(gross*CFG.jockeyShare);
  const ranchPay=gross-ownerPay-jockeyPay,n=owner(c);
  state.money-=ownerPay+jockeyPay;
  if(n)n.funds+=ownerPay;
  c.prizeForOwner+=ownerPay;c.prizeForRanch+=ranchPay;c.prizeForJockey+=jockeyPay;
  result.consignmentSettlementId=c.id;
  result.consignmentSplit={owner:ownerPay,ranch:ranchPay,jockey:jockeyPay};
  return{ok:true,result};
}
window.HorseRanchConsignment={CFG,ensure,active,offers,accept,contracted,school,rider,tick,racePermission,register,race,slots};
ensure();
const priorAllHorses=allHorseObjects;
allHorseObjects=function(){
  const list=priorAllHorses(),ids=new Set(list.map(h=>String(h.id)));
  for(const c of active())if(!ids.has(String(c.horse.id))){list.push(c.horse);ids.add(String(c.horse.id));}
  return list;
};
const priorNormalize=normalize;normalize=function(){const r=priorNormalize.apply(this,arguments);ensure();return r;};
const priorDay=advanceDay;advanceDay=function(...args){const before=dayOf(state),ret=priorDay.apply(this,args);if(state.startDone&&dayOf(state)>before&&tick()){save();if(!args[0]&&!HR_BATCH_DAY)render();}return ret;};
const priorDashboard=dashboard;dashboard=function(){return priorDashboard()+panel();};
const priorTraining=training;training=function(){return priorTraining()+active().map(c=>`<div class="panel"><h3>위탁마 조교 · ${esc(c.horse.name)}</h3><div class="small">NPC 특별 교육 예산 ${money(c.specialRemaining)} · 계약 ${c.ends-dayOf(state)}일 남음</div>${buttons(c)}</div>`).join('');};
const priorRaces=raceList;raceList=function(){return priorRaces()+active().filter(c=>c.raceRights).map(c=>`<div class="panel"><h3>위탁 출전 · ${esc(c.horse.name)}</h3><div class="small">${esc(c.ownerName)} 소유 · 상금 NPC 80% / 목장 15% / 기수 5%</div>${state.races.filter(r=>r.state!=='finished'&&dayOf(r)>=dayOf(state)&&dayOf(r)<=c.ends).slice(0,8).map(r=>{const err=racePermission(c,r),reg=state.registrations.find(x=>x.raceId===r.id&&String(x.horseId)===String(c.horse.id));return `<div class="row" style="margin:7px 0"><span>${r.month}/${r.day} ${r.no}R · ${esc(r.grade)} · ${r.dist}m</span>${reg?`<button class="action green" onclick="hrConsignmentRace('${esc(c.id)}','${esc(r.id)}','${esc(reg.jockeyId)}')" ${dayOf(r)===dayOf(state)?'':'disabled'}>경주 시작</button>`:`<select id="hrc-${esc(c.id)}-${esc(r.id)}" style="background:#1c2228;color:#fff;padding:6px">${JOCKEYS.map(j=>`<option value="${esc(j.id)}">${esc(j.name)}</option>`).join('')}</select><button class="action gray" onclick="hrConsignmentRegister('${esc(c.id)}','${esc(r.id)}',document.getElementById('hrc-${esc(c.id)}-${esc(r.id)}').value)" ${err?'disabled title="'+esc(err)+'"':''}>등록</button>`}</div>`;}).join('')}</div>`).join('');};
function buttons(c){
  const avail=[['ground',14],['ride',14],['gate',7],['race',7]].filter(([kind,d])=>I.COURSE[kind].days.includes(d));
  return `<div class="row" style="margin-top:7px">${avail.map(([kind,d])=>`<button class="action gray" onclick="hrConsignmentSchool('${esc(c.id)}','${kind}',${d})" ${c.type==='care'||c.specialRemaining<I.fee(kind,d)||dayOf(state)+d>c.ends?'disabled':''}>${I.COURSE[kind].name} ${d}일 · ${money(I.fee(kind,d))}</button>`).join('')}</div><div class="row" style="margin-top:5px">${[7,14].map(d=>`<button class="action gray" onclick="hrConsignmentRider('${esc(c.id)}','j1',${d})" ${c.type==='care'||c.specialRemaining<Math.ceil(d/7)*CFG.riderWeekFee||dayOf(state)+d>c.ends?'disabled':''}>지정 기수 ${d}일 · ${money(Math.ceil(d/7)*CFG.riderWeekFee)}</button>`).join('')}</div>`;
}
function panel(){
  if(!state.startDone)return'';
  const s=ensure(),rows=offers();
  return `<div class="panel"><div class="panelTitle"><div><h2>NPC 경주마 위탁 계약</h2><div class="small">NPC 소유권 유지 · 30일 계약 · 일상 자동 관리 · 특별 조교비는 마주 예산</div></div><span class="badge">위탁 ${active().length}/${slots()} · 마방 ${state.horses.length+active().length}/${state.stalls}</span></div>
  <div class="notice">기본 위탁료 ${money(CFG.fee)}(주간 분할) · NPC 특별 조교 예산 ${money(CFG.specialBudget)} · 성과 보수는 출전 계약에만 적용됩니다. 금액은 시험용입니다.</div>
  ${active().map(c=>`<div class="card" style="margin:8px 0"><div class="between"><b>${esc(c.horse.name)} · ${esc(c.ownerName)}</b><span class="badge">${c.raceRights?'경주 출전 허용':c.type==='development'?'육성 위탁':'기본 관리'}</span></div><div class="small">잔여 ${Math.max(0,c.ends-dayOf(state))}일 · 받은 위탁료 ${money(c.feePaid)} / ${money(c.feeTotal)} · 특별 조교 예산 ${money(c.specialRemaining)}</div>${buttons(c)}</div>`).join('')}
  ${active().length<slots()?rows.map(x=>`<div class="card" style="margin:8px 0"><b>${esc(x.horse.name)} · ${esc(x.owner.name)}</b><div class="small">${age(x.horse)}세 · ${esc(x.horse.distanceBand)} · 마주 보유 자금 ${money(x.owner.funds)}</div><div class="row" style="margin-top:7px"><button class="action gray" onclick="hrConsignmentAccept('${esc(x.owner.name)}',${Number(x.horse.id)},'care')">일반 관리</button><button class="action gray" onclick="hrConsignmentAccept('${esc(x.owner.name)}',${Number(x.horse.id)},'development')">육성 위탁</button><button class="action gold" onclick="hrConsignmentAccept('${esc(x.owner.name)}',${Number(x.horse.id)},'race')">경주 출전 계약</button></div></div>`).join('')||'<div class="small">현재 신청 가능한 NPC 위탁마가 없습니다.</div>':''}
  ${s.unpaidUpkeep?`<div class="notice bad">미납 위탁 사육비 ${money(s.unpaidUpkeep)}</div>`:''}
  </div>`;
}
function action(fn){const r=fn();if(!r?.ok)alert(r?.reason||'처리하지 못했습니다.');else{save();render();}return r;}
window.hrConsignmentAccept=(n,id,type)=>action(()=>accept(n,id,type));
window.hrConsignmentSchool=(id,kind,days)=>action(()=>school(active().find(c=>c.id===id),kind,days));
window.hrConsignmentRider=(id,jid,days)=>action(()=>rider(active().find(c=>c.id===id),jid,days));
window.hrConsignmentRegister=(id,rid,jid)=>action(()=>register(active().find(c=>c.id===id),rid,jid||JOCKEYS[0]?.id));
window.hrConsignmentRace=(id,rid,jid)=>action(()=>race(active().find(c=>c.id===id),rid,jid));
save();render();
})();
