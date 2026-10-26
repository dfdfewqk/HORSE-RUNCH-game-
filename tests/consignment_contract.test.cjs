'use strict';
// Full script-order smoke test: node tests/consignment_contract.test.cjs
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
    location:{reload(){}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}
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
  const g=boot();start(g);
  const options=g.run('HorseRanchConsignment.offers().map(o=>({name:o.owner.name,id:o.horse.id,horse:o.horse.name}))');
  assert.ok(options.length,'NPC should offer at least one second-string horse');
  const o=options[0],beforeMoney=g.run('state.money'),ownerBefore=g.run('state.npcs.find(n=>n.name==='+JSON.stringify(o.name)+').funds');
  g.run('hrConsignmentAccept('+JSON.stringify(o.name)+','+o.id+',"development")');
  assert.equal(g.run('HorseRanchConsignment.active().length'),1);
  assert.equal(g.run('state.horses.length'),3,'NPC loan never becomes owned horse');
  assert.equal(g.run('state.npcs.find(n=>n.name==='+JSON.stringify(o.name)+').funds'),ownerBefore-900000);
  assert.equal(g.run('state.money'),beforeMoney,'advance-payment escrow is not an instant player windfall');
  assert.equal(g.run('HorseRanchConsignment.active()[0].specialRemaining'),300000);
  assert.equal(g.run('state.npcs.find(n=>n.name==='+JSON.stringify(o.name)+').horses.some(h=>h.id==='+o.id+')'),false);
  const ref=boot([...g.storage]);
  assert.equal(ref.run('HorseRanchConsignment.active().length'),1,'active contracts should reload');
  ref.run('advanceWeek()');
  const c=ref.run('HorseRanchConsignment.active()[0]');
  assert.equal(c.feePaid,140000,'7 days of a 30-day agreement should release 7/30');
  assert.equal(ref.run('HorseRanchConsignment.active().length'),1);
  assert.equal(ref.run('HorseRanchConsignment.active()[0].lastTickDay'),ref.run('today()'));
  const afterWeek=ref.run('state.money');
  const snapshot=ref.snapshot();
  // A same-day tick must not pay anything twice.
  ref.run('HorseRanchConsignment.tick()');
  assert.equal(ref.run('state.money'),afterWeek);
  assert.equal(ref.snapshot(),snapshot);
  for(let d=0;d<23;d++)ref.run('advanceDay()');
  assert.equal(ref.run('HorseRanchConsignment.active().length'),0);
  assert.equal(ref.run('state.hrConsignment.contracts[0].feePaid'),600000);
  assert.equal(ref.run('state.hrConsignment.contracts[0].status'),'completed');
  assert.equal(ref.run('state.npcs.find(n=>n.name==='+JSON.stringify(o.name)+').horses.some(h=>h.id==='+o.id+')'),true);
  assert.equal(ref.run('Number.isFinite(state.npcs.find(n=>n.name==='+JSON.stringify(o.name)+').funds)'),true,'owner balance remains valid after autonomous racing and month-end spending');
  assert.deepEqual(ref.errors,[]);
  console.log('OK consignment NPC funds, paid weeks, contract expiration, reload and no duplicate ticks');
}
{
  const g=boot();start(g);
  const offer=g.run('HorseRanchConsignment.offers()[0]');
  assert.ok(offer);
  const owner=offer.owner.name,hid=offer.horse.id;
  g.run('hrConsignmentAccept('+JSON.stringify(owner)+','+hid+',"care")');
  const c=g.run('HorseRanchConsignment.active()[0]');
  const r=g.run("state.races.find(r=>r.month===1&&r.day===10&&r.grade==='일반')");
  assert.ok(r);
  assert.equal(g.run('HorseRanchConsignment.racePermission(HorseRanchConsignment.active()[0],state.races.find(r=>r.id==='+JSON.stringify(r.id)+'))'),'계약에 경주 출전 권한이 없습니다.');
  assert.equal(g.run("HorseRanchConsignment.school(HorseRanchConsignment.active()[0],'race',7).ok"),false);
  assert.deepEqual(g.errors,[]);
  console.log('OK ordinary consignment forbids racing and special training');
}
{
  const g=boot();start(g);
  const offer=g.run('HorseRanchConsignment.offers()[0]');
  const owner=offer.owner.name,hid=offer.horse.id;
  g.run('hrConsignmentAccept('+JSON.stringify(owner)+','+hid+',"development")');
  const cash=g.run('state.money'),budget=g.run('HorseRanchConsignment.active()[0].specialRemaining');
  // Race-special schooling is 7 days and should use ONLY the owner's reserved budget.
  const output=g.run("HorseRanchConsignment.school(HorseRanchConsignment.active()[0],'race',7)");
  assert.equal(output.ok,true,output.reason);
  assert.equal(g.run('state.money'),cash);
  assert.equal(g.run('HorseRanchConsignment.active()[0].specialRemaining'),budget-120000);
  assert.equal(g.run('HorseRanchConsignment.school(HorseRanchConsignment.active()[0],"race",7).ok'),false,'double booking must fail');
  g.run('save()');
  const reloaded=boot([...g.storage]);
  assert.equal(reloaded.run('HorseRanchConsignment.active()[0].specialRemaining'),budget-120000);
  reloaded.run('advanceWeek()');
  assert.equal(reloaded.run('HorseRanchConsignment.active()[0].specialJobs[0].status'),'completed','a seven-day special-training contract should finish');
  assert.deepEqual(reloaded.errors,[]);
  console.log('OK owner-funded facility course, duplicate booking blocked, school completion');
}
{
  const g=boot();start(g);
  const offer=g.run('HorseRanchConsignment.offers()[0]');
  const owner=offer.owner.name,hid=offer.horse.id;
  g.run('hrConsignmentAccept('+JSON.stringify(owner)+','+hid+',"race")');
  const rr=g.run('state.races.find(r=>r.month===1&&r.day===10&&r.grade==="일반")');
  assert.ok(rr);
  // Selected NPC horse may be too recently raced; use supported test state to make it eligible.
  g.run('HorseRanchConsignment.active()[0].horse.lastRaceIndex=-999');
  const reg=g.run('HorseRanchConsignment.register(HorseRanchConsignment.active()[0],'+JSON.stringify(rr.id)+',"j1")');
  assert.equal(reg.ok,true,reg.reason);
  assert.equal(g.run('state.horses.length'),3,'registration may not transfer ownership');
  for(let d=0;d<9;d++)g.run('advanceDay()');
  const balance=g.run('state.money'),npc=g.run('state.npcs.find(n=>n.name==='+JSON.stringify(owner)+').funds');
  const run=g.run('HorseRanchConsignment.race(HorseRanchConsignment.active()[0],'+JSON.stringify(rr.id)+',"j1")');
  assert.equal(run.ok,true,run.reason);
  const split=g.run('state.results.slice(-1)[0].consignmentSplit');
  assert.ok(split.owner>=0 && split.ranch>=0 && split.jockey>=0);
  assert.equal(split.owner+split.ranch+split.jockey,run.result.payout);
  assert.equal(g.run('state.money'),balance+split.ranch);
  assert.ok(g.run('state.npcs.find(n=>n.name==='+JSON.stringify(owner)+').funds')>=npc+split.owner,'NPC may also win other places in the same race');
  assert.equal(g.run('HorseRanchConsignment.active()[0].prizeForOwner'),split.owner,'loan prize credited exactly once');
  assert.equal(g.run('state.horses.length'),3);
  assert.equal(g.run('state.results.slice(-1)[0].consignmentSettlementId'),'hc-1');
  const second=g.run('HorseRanchConsignment.race(HorseRanchConsignment.active()[0],'+JSON.stringify(rr.id)+',"j1")');
  assert.equal(second.ok,false,'a completed race cannot be paid twice');
  assert.deepEqual(g.errors,[]);
  console.log('OK authorized entry, prize distribution 80:15:5, no duplicate reward');
}
console.log('PASS consignment contract integration');
