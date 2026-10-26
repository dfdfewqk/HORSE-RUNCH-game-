'use strict';
// Run with: node tests/core_game_loop.test.cjs
// Only the base game and its two pre-bootstrap dependencies are loaded here.
// Other teams' individual rules are covered by their own systems/*.test.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(inline,'base game inline script must exist');
const source=[
  fs.readFileSync(path.join(root,'systems/horse-growth-foundation.js'),'utf8'),
  fs.readFileSync(path.join(root,'systems/foal-education.js'),'utf8'),
  inline[1]
];
const KEY='horse_ranch_v193', BACKUP='horse_ranch_v193_backup';
function launch(initial={},seed=42){
  const data=new Map(Object.entries(initial));
  const alerts=[];
  let rng=seed>>>0,renders=0,htmlOutput='',reloads=0;
  const math=Object.create(Math);
  math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
  const document={
    getElementById:id=>({
      get value(){return id==='ranchName'?'자동테스트목장':'';},
      get innerHTML(){return htmlOutput;},
      set innerHTML(v){htmlOutput=v;renders++;}
    }),
    querySelectorAll:()=>[],
    createElement:()=>({style:{}})
  };
  const world={document,Math:math,console,
    localStorage:{
      getItem:key=>data.get(key)??null,
      setItem:(key,value)=>data.set(key,value),
      removeItem:key=>data.delete(key)
    },
    alert:text=>alerts.push(String(text)),confirm:()=>false,
    setTimeout:()=>0,clearTimeout:()=>{},
    location:{reload(){reloads++}}
  };
  world.window=world;
  const context=vm.createContext(world);
  source.forEach((code,i)=>vm.runInContext(code,context,{filename:['horse-growth-foundation.js','foal-education.js','index.html'][i]}));
  return{world,data,alerts,exec:code=>vm.runInContext(code,context,{timeout:15000}),
    getUI:()=>htmlOutput,getRenders:()=>renders,getReloads:()=>reloads,
    snapshot:()=>vm.runInContext('JSON.stringify(state)',context)};
}
function openGame(game){
  const previousAlerts=game.alerts.length;
  game.exec("setRanchName();goOpeningRace();hr2026SetRace('opening-1600');hr2026SetJockey('j1');registerOpeningRace();runOpeningRace();continueAfterOpeningRace();");
  assert.equal(game.exec("state.openingStage"),'mares');
  game.exec("state.openingMareChoices=hr2026AvailableMares().slice(0,2).map(h=>h.id);hr2026FinishMareChoice()");
  assert.equal(game.exec("state.startDone"),true);
  assert.equal(game.exec("state.horses.length"),3);
  assert.equal(game.exec("state.results.length"),1);
  assert.equal(game.alerts.length,previousAlerts,'opening should not show new blocking alerts');
}
const invalid='{broken save data';
{
  const a=launch({[KEY]:invalid});
  assert.equal(a.data.get(KEY),invalid,'boot must not overwrite damaged save');
  assert.equal(a.world.__hrSaveRecoveryNeeded,true);
  assert.match(a.getUI(),/자동 덮어쓰기/);
  a.exec('resetGame()');
  assert.equal(a.data.get(KEY),invalid,'unconfirmed reset must preserve data');
  assert.equal(a.getReloads(),0);
  console.log('OK save corruption protection and reset confirmation');
}
{
  const old={startDone:true,year:1,month:1,day:1,money:35000000,ranchName:'기존목장',
    horses:[],npcs:[],races:[],training:null,log:null};
  const a=launch({[KEY]:invalid,[BACKUP]:JSON.stringify(old)});
  assert.equal(a.world.__hrSaveRecovered,true);
  assert.equal(a.exec('state.money'),35000000);
  assert.equal(a.exec('Array.isArray(state.log)'),true);
  assert.equal(a.exec('typeof state.training.used'), 'object');
  console.log('OK backup recovery and legacy defaults');
}
{
  const a=launch();
  assert.equal(a.exec('state.startDone'),false);
  assert.equal(a.exec('state.openingStage'),'ranch');
  a.exec('advanceDay()');
  assert.equal(a.exec('today()'),1,'time is locked until onboarding');
  openGame(a);
  const ids=JSON.stringify(a.exec('state.horses.map(h=>h.id)'));
  const cash=a.exec('state.money');
  const b=launch({[KEY]:a.data.get(KEY)});
  assert.equal(b.exec('state.startDone'),true);
  assert.equal(JSON.stringify(b.exec('state.horses.map(h=>h.id)')),ids);
  assert.equal(b.exec('state.money'),cash);
  console.log('OK opening flow, ownership, save/reload');
}
{
  const one=launch(),many=launch();
  openGame(one);openGame(many);
  for(let i=0;i<30;i++)one.exec('advanceDay()');
  many.exec('advanceMonth()');
  assert.equal(many.exec('today()'),31);
  assert.equal(one.snapshot(),many.snapshot(),'30 daily steps must equal month batch with fixed RNG');
  assert.equal(many.exec('HR_BATCH_DAY'),false);
  console.log('OK 30 x 1-day versus 30-day batch');
}
{
  const a=launch();openGame(a);
  a.exec('state.month=12;state.day=27;save();advanceWeek()');
  assert.equal(a.exec('state.year'),2);
  assert.equal(a.exec('state.month'),1);
  assert.equal(a.exec('state.day'),4);
  assert.equal(a.exec('HR_BATCH_DAY'),false);
  console.log('OK 7-day rollover and batch flag');
}
{
  const a=launch();openGame(a);
  for(let i=0;i<24;i++)a.exec('advanceMonth()');
  assert.equal(a.exec('state.year'),3);
  assert.equal(a.exec('state.month'),1);
  assert.equal(a.exec('state.day'),1);
  assert.equal(a.exec('today()'),721);
  const ids=a.exec('state.horses.map(h=>h.id)');
  assert.equal(new Set(ids).size,ids.length,'horse IDs must stay distinct');
  console.log('OK 720-day core simulation');
}
console.log('PASS core game-loop regression');