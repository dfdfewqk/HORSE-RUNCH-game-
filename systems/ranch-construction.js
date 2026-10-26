/* HORSE RANCH core — construction queue. Game-day based; no independent timers.
 * Proposed balance values live in PLANS and can be revised separately.
 * Does not touch breeding, race logic, or existing education ledgers.
 */
(function(root){
'use strict';
const PLANS=Object.freeze({
 stable:Object.freeze({label:'마방 4칸 증축',cost:12000000,days:30,upkeep:75000,plots:1,stalls:4}),
 // Pasture/health mechanics belong to the separate horse-rearing system.
 land:Object.freeze({label:'목장 부지 확장',cost:10000000,days:60,upkeep:20000,plots:0,capacity:6})
});
const INITIAL_PLOTS=12,USED_INITIAL_PLOTS=6,INITIAL_MONTHLY_UPKEEP=200000;
const dayIndex=s=>(Number(s.year)-1)*360+(Number(s.month)-1)*30+Number(s.day);
function ensure(world){
 if(Number(world.hrAgreedCoreVersion)!==1)return null; // legacy saved games remain unchanged
 if(!world.hrConstruction||typeof world.hrConstruction!=='object')
  world.hrConstruction={version:1,capacity:INITIAL_PLOTS,nextId:1,jobs:[],completed:[],lastBilledMonth:null,unpaid:0,totalPaid:0};
 const b=world.hrConstruction;
 b.jobs=Array.isArray(b.jobs)?b.jobs:[];
 b.completed=Array.isArray(b.completed)?b.completed:[];
 b.nextId=Math.max(1,Math.floor(Number(b.nextId)||1));
 b.capacity=Math.max(INITIAL_PLOTS,Number(b.capacity)||INITIAL_PLOTS);
 b.unpaid=Math.max(0,Number(b.unpaid)||0);
 b.totalPaid=Math.max(0,Number(b.totalPaid)||0);
 return b;
}
function occupied(world){
 const b=ensure(world);if(!b)return 0;
 return USED_INITIAL_PLOTS+
 b.completed.reduce((n,j)=>n+(PLANS[j.type]?.plots||0),0)+
 b.jobs.reduce((n,j)=>n+(PLANS[j.type]?.plots||0),0);
}
function available(world){const b=ensure(world);return b?Math.max(0,b.capacity-occupied(world)):0;}
function quote(world,type){
 const p=PLANS[type],b=ensure(world);
 if(!b||!p)return{ok:false,reason:'이 저장 데이터에서는 새 목장 건설을 사용할 수 없습니다.'};
 if(Number(world.money)<p.cost)return{ok:false,reason:'건설 자금이 부족합니다.'};
 if(available(world)<p.plots)return{ok:false,reason:'남은 목장 부지가 부족합니다.'};
 return{ok:true,plan:p,reason:''};
}
function begin(world,type,at){
 const q=quote(world,type);if(!q.ok)return{ok:false,reason:q.reason};
 const b=ensure(world),p=q.plan,day=Number.isInteger(at)?at:dayIndex(world);
 const job={id:b.nextId++,type,startedDay:day,dueDay:day+p.days,location:'자동 배치 '+(b.nextId-1)};
 b.jobs.push(job);world.money-=p.cost;
 return{ok:true,job,spent:p.cost};
}
function advance(world,at){
 const b=ensure(world);if(!b)return[];
 const day=Number.isInteger(at)?at:dayIndex(world),done=[];
 const pending=[];
 for(const job of b.jobs){
  if(job.dueDay>day){pending.push(job);continue;}
  const p=PLANS[job.type];if(!p)continue;
  const record={id:job.id,type:job.type,completedDay:job.dueDay,location:job.location};
  b.completed.push(record);done.push(record);
  if(p.stalls)world.stalls=(Number(world.stalls)||0)+p.stalls;
  if(p.capacity)b.capacity+=p.capacity;
 }
 b.jobs=pending;
 return done;
}
function monthStart(month){const a=String(month).split('-').map(Number);return (a[0]-1)*360+(a[1]-1)*30+1;}
function upkeepFor(world,month){
 const b=ensure(world);if(!b)return 0;
 const first=monthStart(month);
 return INITIAL_MONTHLY_UPKEEP+b.completed.reduce((n,j)=>
  n+(j.completedDay<first?(PLANS[j.type]?.upkeep||0):0),0);
}
function closeMonth(world,month){
 const b=ensure(world);if(!b||b.lastBilledMonth===month)return{applied:false};
 const bill=upkeepFor(world,month),due=bill+b.unpaid,paid=Math.min(Math.max(0,Number(world.money)||0),due);
 world.money=Math.max(0,Number(world.money)||0)-paid;
 b.unpaid=due-paid;b.totalPaid+=paid;b.lastBilledMonth=month;
 return{applied:true,bill,paid,unpaid:b.unpaid};
}
const api=Object.freeze({PLANS,INITIAL_PLOTS,INITIAL_MONTHLY_UPKEEP,dayIndex,ensure,occupied,available,quote,begin,advance,upkeepFor,closeMonth});
root.HorseRanchConstruction=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
