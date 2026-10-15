const assert=require('node:assert/strict');
const {simulate,version}=require('../systems/race-engine.js');
function horse(i){return {id:i,name:'horse-'+i,speed:70+(i%5),stamina:72,power:74,condition:85,fatigue:0,hoof:100,style:['도주','선행','선입','추입'][i%4],distanceBand:'마일',surface:'잔디'};}
const race={id:'unit-1',dist:1600,surface:'잔디'};
const entrants=Array.from({length:12},(_,i)=>({horse:horse(i+1)}));
const x=simulate({race,entrants}), y=simulate({race,entrants});
assert.deepEqual(x,y,'deterministic result');
assert.equal(x.results.length,entrants.length);
assert.equal(new Set(x.results.map(r=>r.horseId)).size,12);
assert(x.frames.length>10);
assert(x.results.every((r,i,a)=>i===0||r.time>=a[i-1].time));
assert(x.frames.at(-1).p.every(p=>Math.abs(p-race.dist)<0.3));
for(let j=0;j<x.ids.length;j++){for(let i=1;i<x.frames.length;i++)assert(x.frames[i].p[j]>=x.frames[i-1].p[j]);}
console.log('RACE_ENGINE_UNIT_PASS',version);
