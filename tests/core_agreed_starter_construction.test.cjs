'use strict';
// Run: node tests/core_agreed_starter_construction.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const C=require('../systems/ranch-construction.js');
function fresh(){
 return {hrAgreedCoreVersion:1,year:1,month:1,day:1,money:50000000,stalls:8};
}
{
 const w=fresh();
 assert.equal(C.available(w),6);
 assert.equal(C.begin(w,'stable',1).ok,true);
 assert.equal(C.begin(w,'land',1).ok,true);
 assert.equal(w.money,28000000);
 assert.equal(C.ensure(w).jobs.length,2,'parallel construction must be allowed');
 assert.equal(C.advance(w,30).length,0);
 assert.equal(C.advance(w,31).length,1);
 assert.equal(w.stalls,12,'stable capacity activates only at completion');
 assert.equal(C.advance(w,31).length,0,'completion is idempotent');
 assert.equal(C.advance(w,61).length,1);
 assert.equal(C.ensure(w).capacity,18,'land expansion activates on completion');
 assert.equal(C.ensure(w).completed.length,2);
 assert.equal(C.upkeepFor(w,'1-1'),200000,'old facilities charged without incomplete expansion');
 assert.equal(C.upkeepFor(w,'1-3'),275000,'new stable cost starts in next full month');
 assert.equal(C.closeMonth(w,'1-1').paid,200000);
 assert.equal(C.closeMonth(w,'1-1').applied,false,'same month never charged twice');
 console.log('OK parallel queue, completion, land, monthly charge');
}
{
 const legacy={year:1,month:1,day:1,money:20000000,stalls:8};
 assert.equal(C.ensure(legacy),null);
 assert.equal(C.closeMonth(legacy,'1-1').applied,false);
 assert.equal(legacy.money,20000000);
 console.log('OK legacy saves remain unchanged');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(inline,'expected game bootstrap script');
function game(seed=42){
 const data=new Map(),alerts=[];
 let random=seed>>>0;
 const math=Object.create(Math);math.random=()=>{
  random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;
 };
 const dom={};
 const document={
  getElementById:id=>dom[id]||(dom[id]={value:id==='ranchName'?'테스트목장':'',innerHTML:'',style:{}}),
  querySelectorAll:()=>[],createElement:()=>({style:{}})
 };
 const world={document,Math:math,console,alert:s=>alerts.push(String(s)),confirm:()=>false,
  setTimeout:()=>0,clearTimeout:()=>{},location:{reload(){}},
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
 };
 world.window=world;
 const context=vm.createContext(world);
 const sources=['systems/horse-growth-foundation.js','systems/foal-education.js']
  .map(file=>fs.readFileSync(path.join(root,file),'utf8'));
 sources.push(inline[1]);
 for(const file of ['systems/ranch-construction.js','systems/ranch-construction-integration.js','systems/core-starter-alignment.js'])
  sources.push(fs.readFileSync(path.join(root,file),'utf8'));
 sources.forEach((source,i)=>vm.runInContext(source,context,{filename:'bootstrap-'+i,timeout:20000}));
 const exec=code=>vm.runInContext(code,context,{timeout:20000});
 return {exec,alerts,data};
}
{
 const g=game();
 assert.equal(g.exec('openingStarter().age'),4);
 assert.equal(g.exec('openingStarter().startingRaceTier'),'OP');
 assert.equal(g.exec('state.hrAgreedCoreVersion'),1);
 g.exec("setRanchName();goOpeningRace();hr2026SetRace('opening-1600');hr2026SetJockey('j1');registerOpeningRace();runOpeningRace();");
 assert.equal(g.exec('state.openingStage'),'race_result');
 const funds=g.exec('state.money');
 g.exec('continueAfterOpeningRace()');
 assert.equal(g.exec('state.startDone'),true);
 assert.equal(g.exec('state.horses.length'),3);
 assert.equal(g.exec('state.money'),funds,'free mares cannot debit the player');
 assert.equal(g.exec("state.horses.filter(h=>h.gender==='암'&&h.starterRole==='gift-mare').length"),2);
 assert.equal(g.exec('new Set(state.horses.map(h=>h.id)).size'),3);
 assert.equal(g.exec('new Set(state.horses.slice(1).map(h=>h.distanceBand)).size'),2);
 assert.equal(g.exec('state.horses.slice(1).every(h=>h.age>=4&&h.age<=5&&h.initialPrice<=3400000)'),true);
 const owned=g.exec('state.horses.map(h=>h.id).join(",")');
 g.exec('continueAfterOpeningRace()');
 assert.equal(g.exec('state.horses.map(h=>h.id).join(",")'),owned,'gift is idempotent');
 assert.equal(g.alerts.length,0,'opening must not fail with blocking alerts');
 console.log('OK four-year-old OP starter and two unique, free, distinct mares');
}
{
 const g=game(77);
 g.exec("setRanchName();goOpeningRace();hr2026SetRace('opening-1600');hr2026SetJockey('j1');registerOpeningRace();runOpeningRace();continueAfterOpeningRace();");
 assert.equal(g.exec("startRanchConstruction('stable');state.hrConstruction.jobs.length"),1);
 assert.equal(g.exec('state.stalls'),8);
 g.exec('advanceMonth()');
 assert.equal(g.exec('state.stalls'),12);
 assert.equal(g.exec('state.hrConstruction.jobs.length'),0);
 assert.equal(g.exec('state.hrConstruction.completed.length'),1);
 console.log('OK browser-integrated construction and 30-day passage');
}
console.log('PASS agreed starter/construction tests');
