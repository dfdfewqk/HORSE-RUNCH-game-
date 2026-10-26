/* HORSE RANCH 20.15 — breeding temperament, time-based schooling, rider trust.
 * Pure game rules. No DOM, player balances or 3D dependencies.
 * All balance constants are provisional and intentionally small.
 */
(function(root){
'use strict';
const TRAITS=['sensitivity','excitability','independence','sociability','compliance'];
const COURSE={ground:{name:'기초 순치',days:[14,30],minDays:360,keys:['handling','equipment']},ride:{name:'기승·주행',days:[14,30,60],minDays:570,keys:['mount','steering']},gate:{name:'게이트·출발',days:[7,14,30],minDays:590,keys:['entry','wait','release']},race:{name:'경주 전문',days:[7,14,30],minDays:720,keys:['pace','position']}};
const REL_BASE=[{limit:[90,100],minor:.02,strong:.0005},{limit:[70,89],minor:.04,strong:.001},{limit:[45,69],minor:.07,strong:.002},{limit:[15,44],minor:.12,strong:.004},{limit:[0,20],minor:.18,strong:.008}];
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const dayOf=s=>(n(s.year)-1)*360+(n(s.month)-1)*30+n(s.day);
const hash=s=>{let v=2166136261;for(const c of String(s)){v^=c.charCodeAt(0);v=Math.imul(v,16777619)}return v>>>0};
const roll=s=>hash(s)/4294967296;
const ageDays=(h,day)=>Number.isFinite(h?.foalEducation?.bornAtDay)?day-h.foalEducation.bornAtDay:null;
const legacy=h=>!Number.isFinite(h?.foalEducation?.bornAtDay);
const trait=(h,k)=>{const v=h?.hrTemperament?.[k];return Number.isFinite(v)?clamp(v,0,100):null};
function ensureLegacyTemperament(h){
 if(!h||h.hrTemperament)return h?.hrTemperament||null;
 const label=h.growthFoundation?.innateTemperament||h.profileTraits?.temperament;
 if(!label)return null; // do not invent unknown ancestry or a fictional personality
 const preset={'침착':[28,30,38,64,70],'예민':[78,65,48,45,47],'활동적':[48,74,63,59,49],'신중':[62,32,40,48,63]};
 const keys=preset[label]||[50,50,50,50,50];
 h.hrTemperament={schema:1,source:'legacy-observed-not-pedigree'};
 TRAITS.forEach((k,i)=>h.hrTemperament[k]=clamp(keys[i]+Math.round((roll(h.id+'|'+k+'|legacy')-.5)*18),0,100));
 return h.hrTemperament;
}

const baseGene=(seed,k)=>clamp(Math.round(50+(roll(seed+'|'+k)-.5)*44),12,88);
function bornTemperament(child,father,mother,grandparents=[]){
 const weights=[[father,.35],[mother,.35],...[0,1,2,3].map(i=>[grandparents[i],.075])];
 const obj={schema:1};for(const k of TRAITS){
   let score=0,used=0;
   for(const [ancestor,w] of weights){const t=trait(ancestor,k);if(t!==null){score+=t*w;used+=w;}}
   // Unknown ancestor values are unobserved, not invented pedigree records.
   const fallback=baseGene(String(child.id),k);
   score+=(1-used)*fallback;
   obj[k]=clamp(Math.round(score+(roll('individual|'+child.id+'|'+k)-.5)*18),0,100);
 }
 obj.source='ancestry-and-individual';child.hrTemperament=obj;return obj;
}
function ensureWorld(world){
 if(!world.hr15||typeof world.hr15!=='object')world.hr15={version:1,contracts:[],bookings:[],history:[],lastRoutineDay:0};
 const s=world.hr15;s.version=1;
 for(const k of ['contracts','bookings','history'])if(!Array.isArray(s[k]))s[k]=[];
 if(!Number.isFinite(s.lastRoutineDay))s.lastRoutineDay=0;
 return s;
}
function ensureSchool(h){
 if(legacy(h))return null;
 if(!h.hrSchooling)h.hrSchooling={version:1,skills:{},completed:[],gateProofDays:[],safe:false,stress:0,courseHistory:[]};
 const s=h.hrSchooling;
 if(!s.skills)s.skills={};for(const key of Object.values(COURSE).flatMap(c=>c.keys))s.skills[key]=clamp(n(s.skills[key]),0,100);
 if(!Array.isArray(s.completed))s.completed=[];
 if(!Array.isArray(s.gateProofDays))s.gateProofDays=[];
 if(!Array.isArray(s.courseHistory))s.courseHistory=[];
 s.stress=clamp(n(s.stress),0,100);
 return s;
}
function occupied(world,id){const s=ensureWorld(world);return s.contracts.find(c=>String(c.horseId)===String(id)&&c.status==='active')||null;}
function booked(world,id){return ensureWorld(world).bookings.find(b=>String(b.horseId)===String(id)&&b.status==='active')||null;}
function fee(course,days){return (Math.ceil(days/7))*({ground:80000,ride:110000,gate:90000,race:120000}[course]||0);}
function canEnroll(world,h,kind,days){
 const c=COURSE[kind];if(!h||!c||!c.days.includes(days))return '교육 과정 또는 기간이 올바르지 않습니다.';
 if(h.retired||h.injury||h.pregnantUntil)return '은퇴·부상·번식 중에는 교육시설에 보낼 수 없습니다.';
 if(occupied(world,h.id)||booked(world,h.id))return '진행 중인 위탁 교육이나 지정 기수 조교가 있습니다.';
 if((world.registrations||[]).some(x=>String(x.horseId)===String(h.id)))return '경주 출전 등록을 먼저 취소해야 합니다.';
 const s=ensureSchool(h),age=ageDays(h,dayOf(world));
 if(s&&age<c.minDays)return '이 교육을 시작하기에는 말이 아직 어립니다.';
 if(s&&kind==='ride'&&Math.min(s.skills.handling,s.skills.equipment)<30)return '기초 순치 과정에서 사람·장비 적응이 필요합니다.';
 if(s&&kind==='gate'&&Math.min(s.skills.mount,s.skills.steering)<30)return '기승·주행 적응이 먼저 필요합니다.';
 if(s&&kind==='race'&&Math.min(s.skills.mount,s.skills.steering)<40)return '기승 적응이 먼저 필요합니다.';
 return null;
}
function enroll(world,h,kind,days){const problem=canEnroll(world,h,kind,days);if(problem)return{ok:false,reason:problem};
 const s=ensureWorld(world);const today=dayOf(world),contract={horseId:h.id,kind,days,starts:today,ends:today+days,status:'active',paid:fee(kind,days),progress:0,mode:'standard',report:null,reportDay:0};
 s.contracts.push(contract);return{ok:true,contract};
}
function schoolingTick(world,h,contract,day){
 const s=ensureSchool(h);if(!s)return;
 const c=COURSE[contract.kind],t=h.hrTemperament||{};
 const difficulty=clamp((n(t.sensitivity)+n(t.independence)+n(t.excitability)-n(t.compliance))/240,-.35,.65);
 const difficultyFactor=clamp(1-difficulty*.34,.66,1.16);
 const stable=(roll(`${h.id}|${contract.kind}|${day}|school`)-.5)*2.2;
 const progress=clamp((contract.mode==='gentle'?4.7:5.7)*difficultyFactor+stable,1.2,8);
 for(const key of c.keys)s.skills[key]=clamp(s.skills[key]+progress,0,100);
 contract.progress++;
 const adverse=roll(`${h.id}|${contract.kind}|${day}|stress`)<clamp(.035+difficulty*.08,0,.10);
 s.stress=clamp(s.stress+(adverse?7:-2)+(contract.mode==='gentle'?-1:0),0,100);
 // Observations are based on tested behavior, not an assumed horse personality.
 if(contract.kind==='gate'&&c.keys.every(k=>s.skills[k]>=50)&&s.stress<80){
  if(!s.gateProofDays.includes(day))s.gateProofDays.push(day);
  if(s.gateProofDays.length>=2)s.safe=true;
 }
 if(contract.progress>=Math.ceil(contract.days/2)&&!contract.report&&!contract.reportDay&&
   (s.stress>=60||(roll(`${h.id}|${contract.kind}|report`)<.025&&difficulty>.1))){
  contract.report={reason:'적응이 불안정하거나 긴장 반응이 관찰됩니다.',issued:day,decision:null};contract.reportDay=day;
 }
}
function decide(world,id,choice){const c=occupied(world,id);if(!c||!c.report||c.report.decision)return{ok:false,reason:'조치할 교육 중간 보고가 없습니다.'};
 if(choice==='gentle'){c.mode='gentle';c.report.decision='gentle';return{ok:true,cost:0};}
 if(choice==='extend'){c.days+=7;c.ends+=7;c.report.decision='extend';const cost=fee(c.kind,7);return{ok:true,cost};}
 if(choice==='return'){c.report.decision='return';c.ends=dayOf(world);return{ok:true,cost:0};}
 return{ok:false,reason:'지원하지 않는 조치입니다.'};
}
function finishSchool(world,h,c){const s=ensureSchool(h),def=COURSE[c.kind];
 const min=Math.min(...def.keys.map(k=>s.skills[k]));
 const state=min>=65?'수료':min>=28?'부분 수료':'미수료';
 if(state==='수료'&&!s.completed.includes(c.kind))s.completed.push(c.kind);
 const row={horseId:h.id,kind:c.kind,days:c.progress,result:state,day:dayOf(world),safe:!!s.safe};
 s.courseHistory.push(row);s.courseHistory=s.courseHistory.slice(-20);
 ensureWorld(world).history.push(row);ensureWorld(world).history=ensureWorld(world).history.slice(-60);
 c.status='done';return row;
}
function schoolAdvance(world,horseOf){const s=ensureWorld(world),day=dayOf(world),finished=[];
 for(const c of s.contracts){if(c.status!=='active')continue;const h=horseOf(c.horseId);if(!h){c.status='cancelled';continue;}
  if(day>c.starts&&day<=c.ends&&c.lastTickDay!==day){schoolingTick(world,h,c,day);c.lastTickDay=day;}
  // If the owner doesn't respond, fall back to gentle instruction rather than deadlocking time.
  if(c.report&&!c.report.decision&&day-c.report.issued>=4){c.report.decision='automatic-gentle';c.mode='gentle';}
  if(day>=c.ends){finished.push(finishSchool(world,h,c));}
 }
 return finished;
}
function ensureRelation(r,h,j){if(!r||!h||!j)return r;
 if(!r.hr15){const t=h.hrTemperament;
  if(!t){r.hr15={version:1,unknown:true,observations:0,history:[],totalPositive:0};return r;}
  const cautious=Number(j.pace)||77,patience=Number(j.corner)||77;
  const style=Array.isArray(j.style)&&j.style.includes(h.style)?8:0;
  const base=52+(n(t.sociability)-50)*.20+(n(t.compliance)-50)*.21-(n(t.independence)-50)*.16-(n(t.sensitivity)-50)*.06+
    (cautious-77)*.45+(patience-77)*.2+style+(roll(h.id+'|'+j.id+'|compat')-.5)*24;
  const compatibility=clamp(Math.round(base),0,100);
  const tier=compatibility>=82?0:compatibility>=64?1:compatibility>=43?2:compatibility>=22?3:4;
  const bounds=REL_BASE[tier].limit;
  r.hr15={version:1,compatibility,tier,cap:Math.round(bounds[0]+roll(h.id+'|'+j.id+'|cap')*(bounds[1]-bounds[0])),observations:0,history:[],totalPositive:0};
 }
 return r;
}
function observe(rel,h,j,day,source){ensureRelation(rel,h,j);const s=rel.hr15;
 if(!s||s.unknown)return{delta:0,description:'관계 관찰 기록 없음'};
 const ok=roll(h.id+'|'+j.id+'|'+day+'|'+source+'|reaction');
 const pressure=clamp((n(h.hrSchooling?.stress))/200,0,.4);
 const positive=clamp(.38+(s.compatibility-50)/165-pressure,.1,.8);
 let delta=0,event='변화 없음';
 if(ok<positive){delta=roll(h.id+'|'+day+'|up')<.68?1:2;event='안정적인 지시 반응';s.totalPositive++;}
 else if(ok<positive+clamp(.26-(s.compatibility-50)/280,.08,.52)){delta=-1-(roll(h.id+'|'+day+'|down')<.2?1:0);event='지시 거부 또는 긴장';}
 const previous=n(rel.friendship);rel.friendship=clamp(previous+delta,0,s.cap);
 s.observations++;
 // Exceptionally rare breakthrough. No guaranteed increase after N rides.
 if(s.tier>=3&&s.totalPositive>=8&&roll(h.id+'|'+j.id+'|'+day+'|breakthrough')<.0015){s.cap=Math.min(70,s.cap+8);s.breakthroughs=(s.breakthroughs||0)+1;event+=' · 드문 관계 개선';}
 const actual=rel.friendship-previous;
 s.history.push({day,source,delta:actual,event});s.history=s.history.slice(-30);
 return{delta:actual,description:event};
}
function scheduleRider(world,h,j,duration){const s=ensureWorld(world),day=dayOf(world);
 if(!h||!j||![7,14,30].includes(duration))return{ok:false,reason:'기수 또는 기간 선택 오류'};
 if(h.retired||h.injury||h.pregnantUntil||n(h.age)<2||occupied(world,h.id)||booked(world,h.id))return{ok:false,reason:'현재 지정 기수 조교를 진행할 수 없습니다.'};
 if(s.bookings.some(b=>b.status==='active'&&String(b.jockeyId)===String(j.id)))return{ok:false,reason:'기수는 동시에 한 마리만 지정 조교할 수 있습니다.'};
 const row={horseId:h.id,jockeyId:j.id,starts:day,ends:day+duration,status:'active',rides:0,positive:0,negative:0};s.bookings.push(row);return{ok:true,booking:row};
}
function riderAdvance(world,horseOf,jockeyOf,relationOf){const day=dayOf(world),s=ensureWorld(world),out=[];
 for(const b of s.bookings){if(b.status!=='active')continue;
  const h=horseOf(b.horseId),j=jockeyOf(b.jockeyId);if(!h||!j){b.status='cancelled';continue;}
  if(day>b.starts&&day<=b.ends && (day-b.starts)%4===1 && !occupied(world,h.id) && !h.injury && n(h.fatigue)<60 && n(h.hrSchooling?.stress)<60){
   const isRaceDay=(world.races||[]).some(r=>r.year===world.year&&r.month===world.month&&r.day===world.day&&(world.registrations||[]).some(q=>q.raceId===r.id&&String(q.horseId)===String(h.id)));
   const next=(world.registrations||[]).some(q=>String(q.horseId)===String(h.id)&&(world.races||[]).some(r=>r.id===q.raceId&&dayOf(r)-day<=3&&dayOf(r)>=day));
   if(!isRaceDay&&!next&&day-n(h.lastRaceIndex)>2&&b.lastRideDay!==day){
    const rel=relationOf(h.id,j.id,true),result=observe(rel,h,j,day,'조교');b.lastRideDay=day;b.rides++;if(result.delta>0)b.positive++;if(result.delta<0)b.negative++;out.push({horseId:h.id,jockeyId:j.id,...result});
   }
  }
  if(day>=b.ends)b.status='done';
 }
 return out;
}
// Baseline daily clock drains hoof condition without any recovery path.
// Existing care stays automatic: a bounded weekly hoof check prevents permanent
// collapse over years. 18 is a provisional game-balance value, not a stat bonus.
function routineCare(h,day){
 if(!h||!Number.isFinite(Number(h.hoof))||!Number.isInteger(day)||day<1||day%7!==0)return false;
 if(!h.hrRoutineCare||typeof h.hrRoutineCare!=='object')h.hrRoutineCare={lastHoofCareDay:0};
 if(h.hrRoutineCare.lastHoofCareDay===day)return false;
 h.hrRoutineCare.lastHoofCareDay=day;
 const previous=clamp(Number(h.hoof),0,100);
 h.hoof=clamp(previous+18,0,100);
 return h.hoof>previous;
}
function raceReaction(h,j,rel,seed){if(!h?.hrTemperament||!j)return{type:'none',minor:0,strong:0,delay:0,paceWaste:0};
 ensureRelation(rel,h,j);const s=rel.hr15;if(!s||s.unknown)return{type:'none',minor:0,strong:0,delay:0,paceWaste:0};
 const b=REL_BASE[s.tier],stress=n(h.hrSchooling?.stress),skill=n(h.hrSchooling?.skills?.pace);
 const factor=clamp(1+stress/180-skill/500,0.65,1.9);
 const minor=b.minor*factor,strong=b.strong*factor;
 const u=roll(seed+'|reaction');const type=u<strong?'strong':u<strong+minor?'minor':'none';
 return{type,minor,strong,delay:type==='strong'?1.2:type==='minor'?.25:0,paceWaste:type==='strong'?.09:type==='minor'?.025:0};
}
const api=Object.freeze({TRAITS,COURSE,REL_BASE,ensureLegacyTemperament,dayOf,ageDays,legacy,bornTemperament,ensureWorld,ensureSchool,occupied,booked,fee,canEnroll,enroll,decide,schoolAdvance,ensureRelation,observe,scheduleRider,riderAdvance,routineCare,raceReaction});
root.HorseRanchInteraction=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
