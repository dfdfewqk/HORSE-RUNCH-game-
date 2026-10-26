'use strict';
const assert=require('node:assert/strict');
const I=require('../systems/horse-interaction.js');
const race=require('../systems/race-engine.js');
function worldAt(day, horses=[]){return{year:Math.floor((day-1)/360)+1,month:Math.floor(((day-1)%360)/30)+1,day:((day-1)%30)+1,horses,npcs:[],registrations:[],races:[]};}
function setDay(w,day){Object.assign(w,{year:Math.floor((day-1)/360)+1,month:Math.floor(((day-1)%360)/30)+1,day:((day-1)%30)+1});}
function horse(id,t={}){return{id,name:'망아지'+id,age:1,gender:'암',foalEducation:{bornAtDay:0},hrTemperament:{sensitivity:50,excitability:50,independence:50,sociability:50,compliance:50,...t},fatigue:4,condition:95,lastRaceIndex:-999,starts:0,wins:0,history:[],speed:70,stamina:70,power:70,hoof:100,distanceBand:'마일',surface:'잔디',style:'선행'};}
function train(w,h,course,days){const c=I.enroll(w,h,course,days);assert.equal(c.ok,true,c.reason);for(let d=c.contract.starts+1;d<=c.contract.ends;d++){setDay(w,d);I.schoolAdvance(w,x=>String(x)===String(h.id)?h:null);}return c;}
assert.equal(I.legacy({age:5}),true);
const old={id:1,age:5,growthFoundation:{innateTemperament:'예민'}};
assert.equal(I.ensureSchool(old),null,'legacy cannot acquire invented school credentials');
assert.equal(I.ensureLegacyTemperament(old).source,'legacy-observed-not-pedigree');
assert.equal(I.ensureLegacyTemperament({id:1,age:5}),null,'no invented ancestry from missing temperament');
const father=horse(2,{sensitivity:90}),mother=horse(3,{sensitivity:10});
const gp=[horse(4,{sensitivity:95}),horse(5,{sensitivity:80}),horse(6,{sensitivity:10}),horse(7,{sensitivity:15})];
const kid=horse(9);delete kid.hrTemperament;
I.bornTemperament(kid,father,mother,gp);const k1=kid.hrTemperament.sensitivity;
I.bornTemperament(kid,father,mother,gp);assert.equal(kid.hrTemperament.sensitivity,k1,'inherited traits stable');
assert.equal(I.bornTemperament(horse(10),null,null).source,'ancestry-and-individual');
const h=horse(30),w=worldAt(600,[h]);
assert.match(I.canEnroll(w,h,'ride',30),/기초 순치/);
const g=train(w,h,'ground',14);assert.equal(g.contract.status,'done');
const r=train(w,h,'ride',30);assert.equal(r.contract.status,'done');
assert.equal(I.canEnroll(w,h,'gate',14),null);
const a=I.enroll(w,h,'gate',14);assert.equal(a.ok,true);
const dup=I.enroll(w,h,'gate',14);assert.equal(dup.ok,false,'only one facility contract');
for(let d=a.contract.starts+1;d<=a.contract.ends;d++){setDay(w,d);I.schoolAdvance(w,id=>id===h.id?h:null);const done=a.contract.progress;I.schoolAdvance(w,id=>id===h.id?h:null);assert.equal(a.contract.progress,done,'no duplicate schooling per day');}
assert.equal(I.ensureSchool(h).safe,true,'gate safety requires two observed assessments');
assert.ok(I.ensureSchool(h).gateProofDays.length>=2);
const temp=I.ensureSchool(h).skills.entry;
setDay(w,740);assert.equal(I.ensureSchool(h).skills.entry,temp,'schooling does not decay automatically');
const school2=I.enroll(w,h,'gate',7);assert.equal(school2.ok,true);
const defer=I.decide(w,h.id,'gentle');assert.equal(defer.ok,false,'mid-course adjustment needs an actual report');
const partial=horse(41,{sensitivity:95,excitability:92,independence:94,compliance:9});let p=worldAt(600,[partial]);
train(p,partial,'ground',14);const bp=I.ensureSchool(partial).skills.handling;
const c=I.enroll(p,partial,'ground',30);assert.equal(c.ok,true);
setDay(p,c.contract.starts+5);I.decide(p,partial.id,'return');I.schoolAdvance(p,()=>partial);
assert.ok(I.ensureSchool(partial).skills.handling>=bp,'return preserves prior progress');
const j={id:'J1',pace:80,corner:78,style:['선행']};const rel={friendship:null};I.ensureRelation(rel,h,j);
const cap=rel.hr15.cap;assert.ok(cap>=0&&cap<=100);
const before=h.hrTemperament.sensitivity;for(let d=800;d<830;d++)I.observe(rel,h,j,d,'조교');
assert.equal(h.hrTemperament.sensitivity,before,'relationship never mutates inherited temperament');
assert.ok(rel.friendship<=rel.hr15.cap,'hidden relationship cap');
const nospawn={friendship:null};I.ensureRelation(nospawn,{id:66},j);assert.equal(nospawn.hr15.unknown,true);
const worst={hr15:{version:1,compatibility:0,tier:4,cap:20,observations:0,history:[],totalPositive:0},friendship:10};
let minor=0,strong=0;for(let i=0;i<100000;i++){const x=I.raceReaction(h,j,worst,'check'+i);if(x.type==='minor')minor++;if(x.type==='strong')strong++;}
assert.ok(strong>520&&strong<1200,`strong refusal sampled ${strong}/100000 expected ~0.8%`);
assert.ok(minor>13500&&minor<21000,`minor sampled ${minor}/100000 expected ~18%`);
const pHorse={...h,id:900,foalEducation:null,hrSchooling:null};
const raceDef={id:'test20_15',dist:1600,surface:'잔디'};
const ordinary=race.simulate({race:raceDef,entrants:[{horse:pHorse,jockey:j},{horse:{...pHorse,id:901},jockey:j}],seed:23});
const disrupted=race.simulate({race:raceDef,entrants:[{horse:pHorse,jockey:j,response:{type:'strong',delay:1.2,paceWaste:.09}},{horse:{...pHorse,id:901},jockey:j}],seed:23});
assert.equal(disrupted.behaviorEvents[0].type,'strong');
assert.ok(disrupted.results.find(x=>x.horseId==='900').time>ordinary.results.find(x=>x.horseId==='900').time,'response delay worsens race without stat loss');
assert.equal(pHorse.speed,h.speed,'horse base stats untouched');
// Long-run baseline: regularly enrolled age-eligible foals can obtain safety by 840 days.
let eligibleCount=0,delayed=0;
for(let i=1000;i<11000;i++){
 const x=horse(i,{sensitivity:(i*13)%101,independence:(i*17)%101,excitability:(i*23)%101,compliance:(i*31)%101});
 const s=worldAt(600,[x]);train(s,x,'ground',14);train(s,x,'ride',30);train(s,x,'gate',14);
 for(let attempt=0;attempt<2&&!I.ensureSchool(x).safe;attempt++)train(s,x,'gate',14);
 if(I.ensureSchool(x).safe && I.dayOf(s)<=840)eligibleCount++;else delayed++;
}
assert.ok(eligibleCount>=8500,`2yo readiness ${eligibleCount}/10000 should exceed 85%`);
console.log('HORSE_RANCH_20_15_PASS',JSON.stringify({strong,minor,eligibleCount,delayed}));
