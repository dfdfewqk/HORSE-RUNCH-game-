'use strict';
const assert=require('node:assert/strict');
const R=require('../systems/ranch-ranking.js');
const A=require('../systems/ranch-auction.js');
const make=(id,rating,age=4)=>({id,age,rating,speed:rating,stamina:rating,power:rating,retired:false,history:[]});
const world={year:1,month:1,day:5,ranchName:'My Ranch',money:300000000,stalls:10,
  horses:[make(1,83),make(2,83),make(3,83)],npcs:[
    {name:'Elite',horses:[make(11,100),make(12,100),make(13,100)],stalls:100,funds:300000000},
    {name:'Runner',horses:[make(21,95),make(22,95),make(23,95)],stalls:100,funds:300000000},
    {name:'Other',horses:[make(31,90),make(32,90),make(33,90)],stalls:100,funds:300000000},
    {name:'More',horses:[make(41,88),make(42,88),make(43,88)],stalls:100,funds:300000000},
    {name:'Lowest',horses:[make(51,86),make(52,86),make(53,86)],stalls:100,funds:300000000},
  ],results:[]};
let me=R.ranking(world).find(x=>x.player);assert.equal(me.rank,6);assert.equal(me.qualified,false);
assert.equal(R.points('G1',1),24);assert.equal(R.points('G2',1),15);assert.equal(R.points('G3',1),10);
assert.equal(R.points('특별',1),6);assert.equal(R.points('일반',1),4);assert.equal(R.points('G1',2),12);
assert.equal(R.points('G1',4),0);
function record(id,grade,horseId,place){const race={id,state:'finished',year:1,month:1,day:5,grade,result:[{horseId,place}]};return R.recordRace(world,race).added;}
assert.equal(record('r1','G1',1,1),1);
me=R.ranking(world).find(x=>x.player);assert.ok(me.rank<6);assert.equal(me.g1Wins,1);assert.ok(me.meritScore>=23);
assert.equal(record('r1','G1',1,1),0,'race outcome cannot be double counted');
assert.equal(R.ranking(world).find(x=>x.player).g1Wins,1);
const moneyBefore=world.money;const priceFn=()=>1000000;
const a=A.openAuction(world,A.dayOf(world),priceFn);
assert.equal(a.eligiblePlayer,true,'qualifying player may consign on Friday');
assert.equal(A.consign(world,3,priceFn).ok,true);
const before=R.ranking(world).find(x=>x.player).meritScore;
world.horses=world.horses.filter(h=>h.id!==1);
world.npcs[4].horses.push(make(1,83));
assert.equal(R.ranking(world).find(x=>x.player).meritScore,before,'selling horse does not move ranch achievement');
assert.equal(R.ranking(world).find(x=>x.name==='Lowest').g1Wins,0,'buyer is not assigned seller historical achievement');
assert.equal(world.money,moneyBefore,'scoring does not modify money');
assert.equal(world.ranchMerit.events.filter(e=>e.key==='r1|1').length,1);
const restored=JSON.parse(JSON.stringify(world));assert.equal(R.ranking(restored).find(x=>x.player).g1Wins,1,'saving/restoring must preserve records');
restored.year=2;restored.month=1;restored.day=5;
assert.equal(R.ranking(restored).find(x=>x.player).meritScore,0,'merit expires after 360 days');
const oldWorld={year:2,month:1,day:5,ranchName:'Legacy',horses:[make(5,70)],npcs:[],results:[{raceId:'legacy',year:1,month:12,day:20,horseId:5,grade:'G1',place:1}]};
assert.equal(R.ranking(oldWorld)[0].g1Wins,1,'owned historical save result is migrated');
assert.equal(R.ranking(oldWorld)[0].g1Wins,1,'historical result migration only once');
assert.equal(R.recordRace(oldWorld,{id:'legacy',state:'finished',year:1,month:12,day:20,grade:'G1',result:[{horseId:5,place:1}]}).added,0);
assert.equal(R.ranking(oldWorld)[0].g1Wins,1);
const anon={...world,ranchName:'Elite'};let x=R.ranking(anon);assert.equal(x.filter(i=>i.name==='Elite').length,2);assert.equal(x.filter(i=>i.player).length,1);
console.log('RANCH_RANKING_UNIT_PASS');
