import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {drawV100CorpseAtmosphere,clearV100CorpseAtmosphere} from '../app/v100CorpseAtmosphere.js';
import {restorePreCorpseAtmosphereSource} from './helpers/guard-spectacle-source.mjs';
const img=(tag,w=64,h=64)=>({tag,complete:true,naturalWidth:w,naturalHeight:h});
const art=()=>({'v100-ground-fire-bed':img('fire',768,512),'v100-ground-fire':img('fallback',768,640),'v100-smoke-a':img('smoke-a'),'v100-smoke-b':img('smoke-b'),'v100-dust':img('dust')});
const corpse=(id=1,state='burning',side='human')=>({id,state,side,kind:'ranger',x:410,y:180,life:8,phaseElapsed:.3,deathClass:'normal',variant:0});
const world=(corpses=[corpse()])=>({time:12,battleAudioGeneration:1,corpses,random(){throw Error('Simulation randomness is forbidden in paint');}});
function context(){
 const ctx={globalAlpha:.37,globalCompositeOperation:'multiply',shadowBlur:3,filter:'sepia(1)',stack:[],calls:[],x:0,y:0,flip:1,
 save(){this.stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.filter,this.x,this.y,this.flip]);},
 restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.filter,this.x,this.y,this.flip]=this.stack.pop();},
 translate(x,y){this.x+=x;this.y+=y;},scale(x){this.flip*=x;},
 drawImage(image,...args){this.calls.push({image,args,x:this.x,y:this.y,flip:this.flip,alpha:this.globalAlpha});}};
 for(const key of ['beginPath','ellipse','arc','fillRect','stroke','fill','quadraticCurveTo'])ctx[key]=()=>{throw Error('No geometric corpse effects: '+key);};
 return ctx;
}
test('burning uses all six painted cells on game time, restores canvas and does not mutate corpses',()=>{
 const g=world(),objects=art(),before=JSON.stringify(g),ctx=context();Object.freeze(g.corpses[0]);Object.freeze(g.corpses);
 const cells=new Set();for(let i=0;i<120;i++){g.time=12+i/60;const n=ctx.calls.length;drawV100CorpseAtmosphere(ctx,objects,g);assert(ctx.calls.length-n<=2);for(const c of ctx.calls.slice(n)){assert.equal(c.image.tag,'fire');cells.add(c.args[0]/256+c.args[1]/256*3);assert(c.alpha>=0&&c.alpha<=1);}}
 assert.equal(cells.size,6);g.time=12;assert.equal(JSON.stringify(g),before);assert.deepEqual([ctx.globalAlpha,ctx.globalCompositeOperation,ctx.shadowBlur,ctx.filter,ctx.stack.length],[.37,'multiply',3,'sepia(1)',0]);
});
test('phase, size and flip vary by owner but remain stable for repeated game time',()=>{
 const g=world([corpse(1),corpse(2)]),objects=art(),a=context(),b=context();drawV100CorpseAtmosphere(a,objects,g);drawV100CorpseAtmosphere(b,objects,g);assert.deepEqual(a.calls,b.calls);
 const first=a.calls.filter(c=>c.x===410);assert(first.length>=2);assert(new Set(first.map(c=>c.args[6]+':'+c.flip+':'+c.args[0])).size>1);
});
test('infection smoke and ash are painted textures and disappear at lifecycle boundaries',()=>{
 const objects=art(),g=world([corpse(1,'infection-warning'),corpse(2,'ash'),corpse(3,'ashing','zombie')]);g.corpses[0].warningLevel='strong';
 const ctx=context();drawV100CorpseAtmosphere(ctx,objects,g,{enemyTimings:{normal:{ashingSeconds:2}}});assert(ctx.calls.some(c=>c.image.tag.startsWith('smoke')));assert(ctx.calls.some(c=>c.image.tag==='dust'));assert(ctx.calls.every(c=>c.image.tag!=='fire'));
 g.corpses=[];ctx.calls=[];assert.equal(drawV100CorpseAtmosphere(ctx,objects,g),0);assert.equal(ctx.calls.length,0);
 g.corpses=[corpse(4,'ally-corpse'),corpse(5,'removed')];assert.equal(drawV100CorpseAtmosphere(ctx,objects,g),0);
});
test('one effect keeps its selected fallback and new owners or battle generations can use ready new art',()=>{
 const objects=art();objects['v100-ground-fire-bed'].complete=false;const g=world(),ctx=context();drawV100CorpseAtmosphere(ctx,objects,g);assert(ctx.calls.every(c=>c.image.tag==='fallback'));
 objects['v100-ground-fire-bed'].complete=true;ctx.calls=[];g.time+=.1;drawV100CorpseAtmosphere(ctx,objects,g);assert(ctx.calls.every(c=>c.image.tag==='fallback'));
 g.corpses=[corpse(2)];ctx.calls=[];drawV100CorpseAtmosphere(ctx,objects,g);assert(ctx.calls.every(c=>c.image.tag==='fire'));
 g.corpses=[corpse(1)];g.battleAudioGeneration=2;ctx.calls=[];drawV100CorpseAtmosphere(ctx,objects,g);assert(ctx.calls.every(c=>c.image.tag==='fire'));clearV100CorpseAtmosphere(g);
});
test('missing art and invalid world data never substitute circles or crash',()=>{
 const ctx=context();assert.equal(drawV100CorpseAtmosphere(ctx,{},world()),0);assert.equal(drawV100CorpseAtmosphere(ctx,art(),null),0);assert.equal(drawV100CorpseAtmosphere(ctx,art(),world([corpse(NaN)])),0);assert.equal(ctx.calls.length,0);
});
test('a canvas exception unwinds paint state rather than leaking opacity or transform',()=>{
 const ctx=context();ctx.drawImage=()=>{throw Error('Canvas sentinel');};assert.throws(()=>drawV100CorpseAtmosphere(ctx,art(),world()),/Canvas sentinel/);assert.equal(ctx.stack.length,0);assert.equal(ctx.globalAlpha,.37);assert.equal(ctx.x,0);assert.equal(ctx.filter,'sepia(1)');
});
test('declared corpse paint edits alone restore the whole original app and preserve the eye cue and warning order',()=>{
 const file='app/AshfallGame.tsx',source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),base=execFileSync('git',['show','b228ee4a6ae944af4cec62524a4b2dd5b1205946:'+file],{maxBuffer:4e6}).toString().replaceAll('\r\n','\n');
 assert.equal(restorePreCorpseAtmosphereSource(file,source),base);
 assert(source.indexOf('drawV100CorpseAtmosphere(ctx, stageObjects, g,')<source.indexOf('for (const hazard of g.stationHazards) drawStationHazard'));
 assert(source.includes('if (allyCue.eyeGlint) {'));
});
