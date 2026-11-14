import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from '@babel/parser';

const source=await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
function findNamedProperty(root,name){
 if(!root||typeof root!=='object')return null;
 if(Array.isArray(root)){for(const n of root){const found=findNamedProperty(n,name);if(found)return found;}return null;}
 if(root.type==='ObjectProperty'&&root.key?.name===name)return root.value;
 for(const [key,value]of Object.entries(root)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;const found=findNamedProperty(value,name);if(found)return found;}
 return null;
}
test('the actual normal-treatment preparation is local and explicit, then leaves healing to the runtime',()=>{
 const method=findNamedProperty(ast,'prepareV100NaoTreatmentProof');assert.ok(method);
 function setup({host='127.0.0.1',search='?qaNaoTreatment=1',external=true,stage=2}={}){
  const game={definition:{missionConfig:{v100StageNumber:stage}},fighters:[
   {id:1,kind:'medic',side:'human',hp:68,maxHp:68,supportCooldown:99,x:300,y:240},
   {id:2,kind:'scout',side:'human',hp:19.2,maxHp:80,supportCooldown:99,x:354,y:240}]};
  let calls=0;const ctx={gameRef:{current:game},window:{location:{hostname:host,search}},URLSearchParams,
   externalSessionActive:external,bridge:{prepareManualAbilityProof(kind){assert.equal(kind,'medic');calls++;return{ownerIds:[1],kinds:['medic']};}}};
  const call=vm.runInNewContext('('+source.slice(method.start,method.end)+')',ctx),before=JSON.stringify(game);
  return {game,call,before,getCalls:()=>calls};
 }
 for(const options of [{host:'example.com'},{search:''},{external:false},{stage:0}]){
  const s=setup(options);assert.equal(s.call(),null);assert.equal(s.getCalls(),0);assert.equal(JSON.stringify(s.game),s.before);
 }
 const s=setup(),result=s.call();assert.equal(s.getCalls(),1);assert.equal(s.game.fighters[0].supportCooldown,0);
 const expected=JSON.parse(s.before);expected.fighters[0].supportCooldown=0;assert.equal(JSON.stringify(s.game),JSON.stringify(expected));
 assert.equal(result.healerId,1);assert.equal(result.patients.length,1);assert.equal(result.patients[0].hp,19.2);
});
