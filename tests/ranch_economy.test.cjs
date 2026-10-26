'use strict';
const assert=require('node:assert/strict');
const E=require('../systems/ranch-economy.js');
const T=require('../systems/npc-training.js');
const F=require('../systems/foal-education.js');
function horse(id,v=70){return{id,name:'말'+id,age:4,rating:v,retired:false,condition:85,fatigue:0,hoof:100,genetic:{speed:94,stamina:94,power:94},caps:{speed:94,stamina:94,power:94},growthFoundation:{growthEfficiency:1},speed:v,stamina:v,power:v};}
const player=horse(1), weak=[horse(2,65),horse(3,68),horse(4,61),horse(5,66)];
const world={year:1,month:1,day:30,ranchName:'그랜드 스터드',money:2000000,horses:[player],npcs:[{name:'그랜드 스터드',named:true,funds:200000,horses:weak,stalls:50},{name:'부자',named:true,funds:90000000,horses:[horse(6,82)],stalls:50}],races:[]};
const econ=E.ensure(world);
assert.equal(E.status(200000,4).status,'회생');
assert.equal(E.trainingBudget(world.npcs[0],world),0,'insolvent farm cannot train');
assert.equal(E.trainingBudget(world.npcs[1],world)>0,true);
const startingPlayer=world.money;
const result=E.closeMonth(world,'1-1',1,{'그랜드 스터드':4,'부자':1},h=>5000000);
assert.ok(result.applied);assert.equal(world.money,startingPlayer-150000);
assert.equal(result.npcSales.length,1,'real NPC-to-NPC transfer should occur for distressed seller');
const sale=result.npcSales[0];assert.equal(sale.seller,'그랜드 스터드');assert.equal(sale.buyer,'부자');
assert.equal(world.npcs[0].horses.length,3);assert.equal(world.npcs[1].horses.length,2);
assert.equal(world.npcs[0].funds,sale.price);
assert.equal(world.npcs[1].funds,90000000-150000-sale.price);
assert.equal(E.closeMonth(world,'1-1',1,{},h=>5000000).applied,false,'exactly one month close');
const snap=JSON.parse(JSON.stringify(world));assert.equal(E.closeMonth(snap,'1-1',1,{},h=>5000000).applied,false,'saved and reloaded settlement is idempotent');
assert.equal(E.canRecruit(world.npcs[0],8000000),false,'cash shortage halts recruiting');
assert.equal(E.canRecruit(world.npcs[1],8000000),true);const beforeFunds=world.npcs[1].funds;
assert.equal(E.chargeRecruit(world,world.npcs[1],8000000),true);assert.equal(world.npcs[1].funds,beforeFunds-8000000);
const oldTotal=world.npcs.reduce((v,r)=>v+r.funds,0);world.races=[{id:'1-1-10-1',year:1,month:1,day:10,grade:'G3',prize:16000000,state:'finished',result:[{horseId:2,place:1},{horseId:6,place:2}]}];
const payout=E.creditFinishedRaces(world);assert.equal(payout.events,2);assert.equal(payout.paid,16000000+8800000);assert.equal(world.npcs.reduce((v,r)=>v+r.funds,0),oldTotal+payout.paid);assert.equal(E.creditFinishedRaces(world).events,0,'race prize can never be credited twice');
const poor=world.npcs[0];world.year=2;world.month=2;const plan=T.planFor(poor,world,'2-Q1');
const c=T.trainRanch(poor,plan,'2-2',F.trainingGain,0);assert.equal(c.sessions,0,'training respects budget cap');
const u={year:1,month:1,day:30,ranchName:'My Farm',money:100000,horses:[horse(51)],npcs:[],races:[]};E.ensure(u);
E.closeMonth(u,'1-1',1,{},()=>0);assert.equal(u.money,0);assert.equal(u.ranchEconomy.player.unpaid,50000);
u.money=400000;E.closeMonth(u,'1-2',1,{},()=>0);assert.equal(u.money,200000,'unpaid player care is eventually settled');assert.equal(u.ranchEconomy.player.unpaid,0);
const noBuyer={year:1,month:1,day:30,ranchName:'PLAYER',money:0,horses:[],npcs:[{name:'고립된 NPC',funds:0,horses:[horse(10),horse(11),horse(12),horse(13)],stalls:50}],races:[]};E.ensure(noBuyer);
E.closeMonth(noBuyer,'1-1',0,{'고립된 NPC':4},()=>4000000);
assert.equal(noBuyer.npcs[0].funds,0,'a sale without a real buyer must not create cash');
assert.equal(noBuyer.npcs[0].horses.length,4,'failed sale preserves horse ownership');
// 20.14: repeated insolvency does not wipe out named ranches.
const basic=[horse(70),horse(71),horse(72),horse(73)];
const crisis={year:1,month:1,day:30,ranchName:'PLAYER',money:0,horses:[],npcs:[{name:'그랜드 스터드',named:true,funds:0,horses:basic,stalls:100}],races:[]};
const meta=E.ensure(crisis).ranches['그랜드 스터드'];
for(let month=1;month<=3;month++){
 const done=E.closeMonth(crisis,`1-${month}`,0,{'그랜드 스터드':4},()=>4000000);
 assert.equal(done.applied,true);
}
assert.equal(crisis.npcs[0].horses.length,4,'named ranch survives even without buyers');
assert.equal(crisis.npcs[0].funds,4*4*E.CONFIG.monthlyUpkeep);
assert.equal(meta.totalSafetySupport,4*4*E.CONFIG.monthlyUpkeep);
assert.equal(E.closeMonth(crisis,'1-3',0,{},()=>0).applied,false,'support cannot be duplicated');
assert.equal(E.RESERVE_MONTHS['레드크라운 목장'],3);
assert.equal(E.RESERVE_MONTHS['그랜드 스터드'],6);
// A named farm with no active horses is allowed a modest rebuild only if it
// can actually afford the horse plus two months of care.
const rebuild={name:'레드크라운 목장',named:true,funds:10000000,horses:[{...horse(81),retired:true}],stalls:30};
assert.equal(E.canRecruit(rebuild,8000000),true);
assert.equal(E.canRecruit(rebuild,15000000),false);
const before=rebuild.funds;
assert.equal(E.chargeRecruit({year:1,month:1,day:1,npcs:[rebuild],horses:[]},rebuild,8000000),true);
assert.equal(rebuild.funds,before-8000000,'no free rookie horses');
console.log('HORSE_RANCH_20_14_NPC_SAFETY_PASS');
