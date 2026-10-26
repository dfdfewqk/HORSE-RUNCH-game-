/* node tests/horse_life_choice_agreed.test.cjs */
const assert=require('node:assert/strict');
const C=require('../systems/horse-life-choice.js');
function world(){return{year:1,month:1,day:1,stalls:2,horses:[
 {id:1,name:'A',age:9,gender:'수',retired:false,starts:12,wins:2,parents:{sire:'B',dam:'C'},fatherId:9,motherId:10},
 {id:2,name:'D',age:7,gender:'암',retired:false}
],breedings:[],registrations:[],pedigreeArchive:[],horseLifeEvents:[]};}
{
 const w=world();
 assert.equal(C.queue(w,1).ok,true);assert.equal(C.queue(w,1).ok,true);
 assert.equal(C.ensure(w).pending.length,1);
 assert.equal(C.decide(w,1,'breeding').ok,true);
 assert.equal(w.horses[0].retired,true);
 assert.equal(w.horses[0].hrAftercare.status,'breeding');
 assert.equal(C.ensure(w).pending.length,0);
}
{
 const w=world();C.queue(w,1);
 assert.equal(C.decide(w,1,'board').ok,true);
 assert.equal(C.siteCount(w),1);
 assert.equal(C.returnFromBoarding(w,1).ok,true);
 assert.equal(C.siteCount(w),2);
}
{
 const w=world();C.queue(w,1);
 w.breedings=[{mareId:2,sireId:1}];
 assert.equal(C.decide(w,1,'place').ok,false);
 w.breedings=[];
 const L={ensureHorse:()=>({targetAge:11}),lineageRecord:(h,y)=>({id:h.id,name:h.name,age:h.age,parents:h.parents,fatherId:h.fatherId,motherId:h.motherId})};
 assert.equal(C.decide(w,1,'place',{lifespan:L}).ok,true);
 assert.equal(w.horses.length,1);
 assert.equal(w.pedigreeArchive[0].deceased,false);
 assert.equal(w.pedigreeArchive[0].fatherId,9);
 assert.equal(C.advancePlaced(w,2).length,0);
 assert.equal(C.advancePlaced(w,3).length,1);
 assert.equal(C.advancePlaced(w,3).length,0);
 assert.equal(w.pedigreeArchive[0].deceased,true);
}
{
 const w=world();C.queue(w,1);
 assert.equal(C.decide(w,1,'keep').ok,true);
 assert.equal(C.siteCount(w),2);
}
{
 const w=world();w.registrations=[{raceId:'R1',horseId:1}];
 C.queue(w,1);
 assert.equal(w.registrations.length,0,'retirement clears prior race booking');
 assert.equal(C.decide(w,1,'board').ok,true);
 C.queue(w,1);
 assert.equal(C.siteCount(w),1,'redecision keeps external horse offsite');
 assert.equal(C.decide(w,1,'keep').ok,false,'cannot exceed stable capacity');
 assert.equal(C.decide(w,1,'board').ok,true);
}
console.log('horse life decisions: OK');
