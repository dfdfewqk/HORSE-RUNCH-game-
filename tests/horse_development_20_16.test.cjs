'use strict';
const assert=require('node:assert/strict');
const I=require('../systems/horse-interaction.js');
const A=require('../systems/horse-lifecycle.js');
const L=require('../systems/horse-lifespan.js');

function specimen(id,age,temperament=null){
  return {id,name:'혈통'+id,age,gender:'수',fatherId:null,motherId:null,
    parents:{sire:'정보 없음',dam:'정보 없음'},speed:85,stamina:83,power:81,
    caps:{speed:95,stamina:94,power:93},genetic:{speed:95,stamina:94,power:93},
    hoof:90,condition:90,fatigue:4,starts:0,wins:0,retired:false,
    history:[],hrTemperament:temperament};
}
const known={schema:1,source:'ancestry-and-individual',sensitivity:95,
  excitability:40,independence:75,sociability:35,compliance:65};
const grandsire=specimen('G1',28,known);
const world={year:1,ranchName:'시험목장',horses:[grandsire],
  npcs:[],breedings:[],registrations:[],pedigreeArchive:[],
  horseLifespanClock:{version:1,lastYear:1,totalDeaths:0}};
grandsire.lifeSpan={version:1,targetAge:29};
L.ensureWorld(world);
world.year=2;grandsire.age=29;
assert.equal(L.advanceYear(world).deaths,1,'natural departure should happen only during year update');
const archivedGrand=world.pedigreeArchive.find(x=>x.id==='G1');
assert.equal(archivedGrand.hrTemperament.sensitivity,95,'a known grandparent temperament must survive natural death');
assert.equal(archivedGrand.deceased,true);
assert.equal(archivedGrand.fatherId,null,'unknown historical parent stays unknown');
assert.equal(L.advanceYear(world).applied,false,'reloading or double-ticking does not produce another death');

const sire=specimen('S',4,{...known,sensitivity:80});
sire.fatherId='G1';sire.motherId=null;
sire.parents={sire:'혈통G1',dam:'정보 없음'};
const dam=specimen('D',4,{...known,sensitivity:20});
dam.gender='암';
const sold=L.archivePedigree(world,sire,'판매',2,'시험목장');
assert.equal(sold.deceased,false,'a sold horse must not be labelled deceased');
assert.equal(sold.retired,false,'a sold active horse must not be labelled retired');
assert.equal(sold.fatherId,'G1');
assert.equal(sold.hrTemperament.sensitivity,80);
assert.equal(L.archivePedigree(world,sire,'판매',2,'시험목장'),sold,'duplicate snapshots forbidden');

const unknown=specimen('U',4,null);
const unknownRecord=L.archivePedigree(world,unknown,'판매',2,'시험목장');
assert.equal(unknownRecord.hrTemperament,null,'no fictional observed temperament on legacy horse');
assert.equal(unknownRecord.fatherId,null);

let grandparentInfluence=0;const seen=new Set();
for(let id=1000;id<2200;id++){
 const kid=specimen(id,0,null);
 kid.fatherId=sire.id;kid.motherId=dam.id;
 const withGrand=I.bornTemperament(kid,sire,dam,[archivedGrand]).sensitivity;
 const withoutGrand=I.bornTemperament({id},sire,dam,[]).sensitivity;
 if(withGrand!==withoutGrand)grandparentInfluence++;
 seen.add(withGrand);
}
assert.ok(grandparentInfluence>900,'recorded grandparent contributes to inheritance');
assert.ok(seen.size>=10,'siblings have measurable inherited individual variation');

const mare=specimen('M',3);
world.breedings.push({mareId:'M',sireId:'S',due:900});
assert.equal(L.hasPendingBreeding(world,sire),true,'pending sire may not be sold');
assert.equal(L.hasPendingBreeding(world,mare),true,'pending dam protected');
world.breedings=[];

const hooves=specimen('C',6);
hooves.hoof=70;
assert.equal(I.routineCare(hooves,7),true);
const after=hooves.hoof;
assert.equal(I.routineCare(hooves,7),false,'care must be idempotent on the same day');
assert.equal(hooves.hoof,after);
assert.equal(I.routineCare(hooves,8),false,'care only happens weekly');
// Long-run: apply the existing clock's 1-2 daily hoof drain and periodic race wear.
const runner=specimen('RUN',6);
const decade={year:1,ranchName:'10년 목장',horses:[runner],npcs:[],breedings:[],
  registrations:[],pedigreeArchive:[],horseLifeClock:{lastYear:1},
  horseLifespanClock:{version:1,lastYear:1,totalDeaths:0}};
A.ensureWorld(decade);L.ensureWorld(decade);
let lowest=100,age11=null;
for(let day=1;day<=3600;day++){
 runner.hoof=Math.max(0,runner.hoof-(day%2?1:2));
 if(day%30===0)runner.hoof=Math.max(0,runner.hoof-8);
 I.routineCare(runner,day);
 if(day>90)lowest=Math.min(lowest,runner.hoof);
 if(day%360===0){
   decade.year++;
   runner.age++;
   const prior=runner.speed;
   A.advanceYear(decade);
   L.advanceYear(decade);
   if(runner.age===11)age11=runner.speed;
   if(runner.age>11)assert.ok(runner.speed<=prior,'aging must not restore physical performance');
 }
}
assert.equal(decade.year,11,'ten game years were simulated');
assert.ok(lowest>=45,'normal weekly hoof care prevents inexorable collapse, lowest='+lowest);
assert.ok(runner.lifeCycle.lastProcessedAge>=16,'annual life cycle advances');
assert.ok(runner.speed<age11+1,'aged physical stats are not silently restored');
const restored=JSON.parse(JSON.stringify(decade));
assert.equal(A.advanceYear(restored).applied,false,'loaded annual aging cannot repeat');
assert.equal(L.advanceYear(restored).applied,false,'loaded mortality cannot repeat');

function setCalendar(w,absolute){
 w.year=Math.floor((absolute-1)/360)+1;
 w.month=Math.floor(((absolute-1)%360)/30)+1;
 w.day=((absolute-1)%30)+1;
}
const schoolHorse=specimen('INJ',1,{...known,sensitivity:80});
schoolHorse.foalEducation={bornAtDay:0};
const schoolWorld={year:1,month:1,day:1,horses:[schoolHorse],npcs:[],registrations:[],races:[]};
setCalendar(schoolWorld,600);
const contract=I.enroll(schoolWorld,schoolHorse,'ground',30);
assert.equal(contract.ok,true);
setCalendar(schoolWorld,601);
I.schoolAdvance(schoolWorld,()=>schoolHorse);
const progressBeforeInjury=contract.contract.progress;
schoolHorse.injury=4;
setCalendar(schoolWorld,602);
I.schoolAdvance(schoolWorld,()=>schoolHorse);
assert.equal(contract.contract.progress,progressBeforeInjury,'injury halts scheduled education');
assert.ok(contract.contract.report,'the training facility reports an injury');
assert.equal(I.decide(schoolWorld,schoolHorse.id,'return').ok,true);
I.schoolAdvance(schoolWorld,()=>schoolHorse);
assert.equal(contract.contract.progress,progressBeforeInjury,'early return never awards a phantom lesson');
assert.equal(contract.contract.status,'done');
assert.equal(schoolHorse.hrSchooling.courseHistory.at(-1).returnedEarly,true);

let incomplete30=0;
for(let id=4500;id<4900;id++){
 const x=specimen(id,1,{...known,sensitivity:50,independence:50,excitability:50,compliance:50});
 x.foalEducation={bornAtDay:0};
 const w={year:1,month:1,day:1,horses:[x],npcs:[],registrations:[],races:[]};
 setCalendar(w,600);
 const result=I.enroll(w,x,'ground',30);
 assert.equal(result.ok,true);
 for(let d=601;d<=630;d++){setCalendar(w,d);I.schoolAdvance(w,()=>x);}
 if(x.hrSchooling.courseHistory.at(-1).result!=='수료')incomplete30++;
}
assert.ok(incomplete30>5&&incomplete30<200,'30-day course is not guaranteed, observed non-completions='+incomplete30);
assert.ok(I.fee('ground',30)>I.fee('ground',14),'longer contracts retain a real cost trade-off');

console.log('HORSE_RANCH_20_16_DEVELOPMENT_PASS',JSON.stringify({grandparentInfluence,individualVariation:seen.size,lowestHoof:lowest,tenYearAge:runner.age,incomplete30}));
