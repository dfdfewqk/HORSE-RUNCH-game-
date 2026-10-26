/* HORSE RANCH — agreed retirement destinations; no automatic disposal. */
(function(root){
'use strict';
function ensure(w){
 if(!w.hrLifeChoice||typeof w.hrLifeChoice!=='object')w.hrLifeChoice={version:1,pending:[],history:[],placed:[],lastSummary:null};
 const x=w.hrLifeChoice;x.version=1;
 for(const k of ['pending','history','placed'])if(!Array.isArray(x[k]))x[k]=[];
 return x;
}
function siteCount(w){return(w.horses||[]).filter(h=>h?.hrAftercare?.status!=='board').length;}
function find(w,id){return(w.horses||[]).find(h=>String(h.id)===String(id));}
function hasBooking(w,id){return(w.breedings||[]).some(b=>String(b.mareId)===String(id)||String(b.sireId)===String(id));}
function queue(w,id,reason='경주 은퇴'){
 const h=find(w,id);if(!h)return{ok:false,reason:'말을 찾을 수 없습니다.'};
 const s=ensure(w);h.retired=true;
 if(!s.pending.some(x=>String(x.id)===String(id)))s.pending.push({id:h.id,name:h.name,reason,year:w.year});
 h.hrAftercare={...(h.hrAftercare||{}),status:'pending'};
 return{ok:true};
}
function decide(w,id,mode,opts={}){
 const s=ensure(w),h=find(w,id);
 if(!h||!h.retired||!s.pending.some(x=>String(x.id)===String(id)))return{ok:false,reason:'결정 대기 중인 은퇴마가 아닙니다.'};
 if(!['breeding','keep','board','place'].includes(mode))return{ok:false,reason:'선택할 수 없는 진로입니다.'};
 if(['board','place'].includes(mode)&&hasBooking(w,id))return{ok:false,reason:'예정된 출산 이후 외부로 보낼 수 있습니다.'};
 if(mode==='place'&&(w.registrations||[]).some(x=>String(x.horseId)===String(id)))return{ok:false,reason:'출전 등록을 먼저 정리해야 합니다.'};
 if(mode==='place'){
  const L=opts.lifespan;
  const archive=L?.lineageRecord?L.lineageRecord(h,w.year,'외부 입양·보호시설',h.careerAchievements):{
   id:h.id,name:h.name,gender:h.gender,age:h.age,archive:true,parents:{...(h.parents||{})},
   fatherId:h.fatherId??null,motherId:h.motherId??null,starts:h.starts||0,wins:h.wins||0
  };
  archive.archive=true;archive.retired=true;archive.deceased=false;
  delete archive.deathYear;delete archive.deathReason;
  archive.lastRanch='외부 입양·보호시설';
  if(!Array.isArray(w.pedigreeArchive))w.pedigreeArchive=[];
  const i=w.pedigreeArchive.findIndex(x=>String(x.id)===String(id));
  if(i<0)w.pedigreeArchive.push(archive);else w.pedigreeArchive[i]={...w.pedigreeArchive[i],...archive};
  const target=L?.ensureHorse?L.ensureHorse(h).targetAge:h.lifeSpan?.targetAge;
  if(typeof opts.archiveLegend==='function')opts.archiveLegend(h);
  s.placed.push({id:h.id,name:h.name,yearPlaced:Number(w.year),ageAtPlacement:Number(h.age)||0,
   targetAge:Number.isFinite(Number(target))?Number(target):null,lastCheckedYear:Number(w.year),
   deceased:false,record:{...h,hrAftercare:{status:'place'}}});
  w.horses=w.horses.filter(x=>String(x.id)!==String(id));
 }else h.hrAftercare={...(h.hrAftercare||{}),status:mode};
 s.pending=s.pending.filter(x=>String(x.id)!==String(id));
 s.history.push({year:w.year,month:w.month,day:w.day,id:h.id,name:h.name,decision:mode});
 return{ok:true,mode,name:h.name};
}
function returnFromBoarding(w,id){
 const h=find(w,id);
 if(!h||h.hrAftercare?.status!=='board')return{ok:false,reason:'외부 위탁 중인 말이 아닙니다.'};
 if(siteCount(w)>=Number(w.stalls||0))return{ok:false,reason:'마방이 가득 찼습니다.'};
 h.hrAftercare.status='keep';
 ensure(w).history.push({year:w.year,month:w.month,day:w.day,id:h.id,name:h.name,decision:'return'});
 return{ok:true};
}
function advancePlaced(w,year){
 const s=ensure(w),y=Math.floor(Number(year)),events=[];
 if(!Number.isInteger(y))return events;
 for(const r of s.placed){
  if(r.deceased||y<=r.lastCheckedYear)continue;
  r.lastCheckedYear=y;
  const age=r.ageAtPlacement+y-r.yearPlaced,archived=(w.pedigreeArchive||[]).find(x=>String(x.id)===String(r.id));
  if(archived)archived.age=age;
  if(r.targetAge===null||!Number.isFinite(Number(r.targetAge))||age<Number(r.targetAge))continue;
  r.deceased=true;r.deathYear=y;
  if(archived){archived.deceased=true;archived.deathReason='자연사';archived.deathYear=y;}
  if(!Array.isArray(w.horseLifeEvents))w.horseLifeEvents=[];
  const event={year:y,id:r.id,name:r.name,age,owner:'외부 입양·보호시설',title:null};
  w.horseLifeEvents.push(event);w.horseLifeEvents=w.horseLifeEvents.slice(-20);
  if(w.horseLifespanClock)w.horseLifespanClock.totalDeaths=(w.horseLifespanClock.totalDeaths||0)+1;
  events.push(event);
 }
 return events;
}
const api=Object.freeze({ensure,siteCount,find,hasBooking,queue,decide,returnFromBoarding,advancePlaced});
root.HorseRanchLifeChoice=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
