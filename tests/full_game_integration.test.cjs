'use strict';
// Full script-order smoke test: node tests/full_game_integration.test.cjs
// Uses a minimal simulated DOM; this verifies integration logic, not pixel layout.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)]
  .map(m=>({path:m[1]||'index.html#inline',source:m[1]?fs.readFileSync(path.join(root,m[1]),'utf8'):m[2]}));
assert.ok(scripts.length>=20,'full game should include its extension scripts');
const KEY='horse_ranch_v193';
function boot(initial=null,seed=2786){
  const storage=new Map(initial||[]);
  const notices=[],errors=[];
  let random=seed>>>0;
  const math=Object.create(Math);
  math.random=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
  const document={
    head:{appendChild(){}},body:{appendChild(){},removeChild(){}},
    getElementById:id=>({value:id==='ranchName'?'통합테스트목장':'',
      get innerHTML(){return ''},set innerHTML(x){},
      scrollIntoView(){},style:{},appendChild(){}}),
    querySelectorAll:()=>[],
    createElement:()=>({style:{},appendChild(){},remove(){},innerHTML:''}),
    querySelector:()=>null
  };
  const world={
    window:null, document, Math:math,
    localStorage:{
      getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>storage.set(key,value),
      removeItem:key=>storage.delete(key)
    },
    alert:x=>notices.push(String(x)),confirm:()=>false,
    console:{log:()=>{},warn:()=>{},error:(...parts)=>errors.push(parts.join(' '))},
    location:{reload(){}},setTimeout:()=>0,clearTimeout:()=>{}
  };
  world.window=world;
  const ctx=vm.createContext(world);
  for(const script of scripts){
    try{vm.runInContext(script.source,ctx,{filename:script.path,timeout:20000})}
    catch(e){throw new Error('Game script failure in '+script.path+': '+e.stack)}
  }
  const run=s=>vm.runInContext(s,ctx,{timeout:20000});
  return {run,storage,errors,notices,snapshot:()=>run('JSON.stringify(state)')};
}
function start(game){
  game.run("setRanchName();goOpeningRace();hr2026SetRace('opening-1600');hr2026SetJockey('j1');registerOpeningRace();runOpeningRace();continueAfterOpeningRace()");
  assert.equal(game.run('state.openingStage'),'mares','opening race should lead to mare choice');
  game.run('state.openingMareChoices=hr2026AvailableMares().slice(0,2).map(h=>h.id);hr2026FinishMareChoice()');
  assert.equal(game.run('state.startDone'),true,'onboarding must complete');
  assert.equal(game.run('state.horses.length'),3,'new ranch should own starter and two mares');
  assert.equal(game.run('state.results.length'),1);
  assert.deepEqual(game.errors,[],'extension scripts must load without console errors');
}
{
  const a=boot();
  assert.equal(a.run('state.startDone'),false);
  start(a);
  const now=a.run('today()');
  const ids=JSON.stringify(a.run('state.horses.map(h=>h.id)'));
  const amount=a.run('state.money');
  const b=boot([...a.storage]);
  assert.equal(b.run('today()'),now);
  assert.equal(JSON.stringify(b.run('state.horses.map(h=>h.id)')),ids,'horse IDs must survive reload');
  assert.equal(b.run('state.money'),amount,'money must survive reload');
  assert.deepEqual(b.errors,[]);
  console.log('OK full-script opening and save/reload');
}
{
  const one=boot(),many=boot();
  start(one);start(many);
  for(let d=0;d<30;d++)one.run('advanceDay()');
  many.run('advanceMonth()');
  assert.equal(one.run('today()'),many.run('today()'));
  assert.equal(one.snapshot(),many.snapshot(),'daily 30-step and month batch must match with seeded RNG');
  assert.equal(one.run('HR_BATCH_DAY'),false);
  assert.equal(many.run('HR_BATCH_DAY'),false);
  assert.deepEqual(many.errors,[]);
  console.log('OK full-script 30 x daily equals 30-day batch');
}
{
  const a=boot();
  start(a);
  for(let m=0;m<24;m++)a.run('advanceMonth()');
  assert.equal(a.run('today()'),721);
  assert.equal(a.run('state.year'),3);
  assert.equal(a.run('state.month'),1);
  assert.equal(a.run('state.day'),1);
  assert.equal(a.run('new Set(allHorseObjects().map(h=>String(h.id))).size===allHorseObjects().length'),true,'horse IDs unique across all owners');
  assert.deepEqual(a.errors,[],'extension scripts must remain error-free');
  const b=boot([...a.storage]);
  assert.equal(b.run('today()'),721,'two-year game date should survive reload');
  assert.deepEqual(b.errors,[]);
  console.log('OK full-script 720-day simulation and save/reload');
}
console.log('PASS full game integration smoke');