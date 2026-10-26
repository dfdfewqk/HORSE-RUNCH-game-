/* Run: node tests/horse_health_agreed.test.cjs */
const assert=require('node:assert/strict');
const H=require('../systems/horse-health.js');
function horse(id=1){return{id,name:'테스트말',age:3,injury:0,profileTraits:{weaknessText:'장거리 부담'}};}
{
 const a=horse(),dad=horse(2),mom=horse(3);
 dad.profileTraits.weaknessText='다리 부담에 취약';
 mom.profileTraits.weaknessText='회복이 느림';
 H.inheritedCandidates(a,dad,mom);
 assert.deepEqual(a.hrHealth.familyCandidates,['leg_load','slow_recovery']);
 assert.deepEqual(H.displayWeaknesses(a),['장거리 부담'],'possible family risk is never automatically revealed');
 assert.equal(H.observe(a,'leg_load').ok,true);
 assert.deepEqual(H.displayWeaknesses(a),['장거리 부담','다리 부담에 취약']);
 assert.equal(H.observe(a,'slow_recovery').ok,false,'only two visible weaknesses total');
}
{
 const h=horse();
 assert.equal(H.start(h,{diagnosis:'tendon',severity:'moderate',site:'좌전지',
  treatmentDays:2,rehabilitationDays:2,gradualReturnDays:1,returnAllowed:true},10).ok,true);
 assert.equal(h.injury>=2,true);
 assert.equal(H.tick(h,10).changed,false);
 assert.equal(H.tick(h,11).completed,undefined);
 assert.equal(H.tick(h,11).changed,false,'duplicate day ignored');
 assert.equal(H.tick(h,12).transitions[0].to,'rehabilitation');
 assert.equal(H.tick(h,13).completed,undefined);
 assert.equal(H.tick(h,14).transitions[0].to,'gradual_return');
 assert.equal(H.tick(h,15).completed,true);
 assert.equal(h.injury,0);
 assert.equal(H.ensure(h).active,null);
 assert.equal(H.ensure(h).history.length,1);
 assert.equal(H.tick(h,15).changed,false);
}
{
 const h=horse();h.injury=3;
 assert.equal(H.importLegacy(h,42).created,true);
 assert.equal(H.importLegacy(h,42).created,false);
 assert.equal(H.tick(h,45).completed,true);
 assert.equal(H.ensure(h).history[0].source,'legacy-injury-duration');
}
{
 const h=horse();
 assert.equal(H.start(h,{diagnosis:'severe_fracture',severity:'severe',
  treatmentDays:1,rehabilitationDays:1,gradualReturnDays:0},20).ok,false,
  'severe injury requires actual medical clearance judgment');
 assert.equal(H.start(h,{diagnosis:'severe_fracture',severity:'severe',site:'뒷다리',
  treatmentDays:1,rehabilitationDays:1,gradualReturnDays:0,returnAllowed:false},20).ok,true);
 assert.equal(H.tick(h,21).completed,undefined);
 const report=H.tick(h,22);
 assert.equal(report.completed,true);
 assert.equal(report.retirementRequired,true);
 assert.equal(!!h.retired,false,'health module never silently chooses player retirement destination');
}
{
 const h=horse();h.profileTraits.weaknessText='기존 단점';
 assert.equal(H.start(h,{diagnosis:'wound',severity:'minor',treatmentDays:-1,
  rehabilitationDays:0,gradualReturnDays:0},1).ok,false);
 assert.equal(H.start(h,{diagnosis:'wound',severity:'minor',treatmentDays:1,
  rehabilitationDays:0,gradualReturnDays:0,returnAllowed:true},1).ok,true);
 assert.equal(H.start(h,{diagnosis:'wound',severity:'minor',treatmentDays:1,
  rehabilitationDays:0,gradualReturnDays:0,returnAllowed:true},1).ok,false);
}
console.log('horse health: OK');
