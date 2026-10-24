import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import { applyV100SaveMutation } from '../app/v100Save.js';
import { V100_UNITS,V100_VEHICLE,v100LevelCost } from '../app/v100Registry.js';
import { deferNormalRecruitOffer } from '../scripts/v100-normal-recruit-offer.mjs';

const earned=JSON.parse(fs.readFileSync('tests/fixtures/v177-earned-stage1-recruit.json','utf8')).save;
const source=fs.readFileSync('app/V100Campaign.tsx','utf8');
const app=ts.createSourceFile('V100Campaign.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const nodes=[],offers=[];
function visit(node){
  if(ts.isJsxElement(node))nodes.push(node);
  if(ts.isVariableDeclaration(node)&&node.name.getText(app)==='recruitOffer')offers.push(node.initializer);
  ts.forEachChild(node,visit);
}visit(app);assert.equal(offers.length,1);
const compile=(expression,bindings={})=>vm.runInNewContext(ts.transpileModule(expression,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React},
}).outputText,{React,V100_UNITS,V100_VEHICLE,applyV100SaveMutation,...bindings});
const attr=(node,name)=>node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(app)===name);
const buttonFor=handler=>{const found=nodes.filter(n=>n.openingElement.tagName.getText(app)==='button'
  &&attr(n,'onClick')?.initializer?.expression?.getText(app).includes(handler));assert.equal(found.length,1);return found[0].getText(app);};
const modal=nodes.find(n=>attr(n,'className')?.initializer?.text==='v100-modal v100-recruit-modal');assert.ok(modal);
const offerFor=compile('(flow,surface,save)=>('+offers[0].getText(app)+');');
const renderModal=compile('(save,recruitOffer,applySaveTransaction)=>('+modal.getText(app)+');',{
  formationCardForUnit:()=>null,v100RoleLabelFor:()=>'',unitDescriptionFor:()=>'',saveBusy:false,
});
const registerButton=compile('(save,info,selectedUnit,onPurchase)=>('+buttonFor('onPurchase(selectedUnit.id)')+');');
const levelButton=compile('(save,info,selectedUnit,onLevel)=>('+buttonFor('onLevel(selectedUnit.id, info.level)')+');');
const vehicleButton=compile('(save,vehicleLevel,nextCost,onUpgradeVehicle)=>('+buttonFor('onUpgradeVehicle')+');');
const descendants=node=>React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(descendants)]:[];

function prepare(file,bindings){
  const parsed=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const wanted=new Set(['button','preparationTab','selectPersonnel','plannedFormation','prepareEconomy']),declarations=[];
  for(const s of parsed.statements){
    if(ts.isFunctionDeclaration(s)&&wanted.has(s.name?.text))declarations.push(s.getText(parsed));
    if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)if(wanted.has(d.name.getText(parsed)))declarations.push('const '+d.getText(parsed)+';');
  }
  return vm.runInNewContext(declarations.join('\n')+'\nprepareEconomy;',bindings);
}

function fixture({modalType='recruit',badHeading=false,tamperCaps=false,labelCase=null}={}){
  let save=structuredClone(earned),selected=V100_UNITS.find(u=>u.id==='unit-nao');
  const before=structuredClone(save),events=[],report={transactions:[]},stop=new Error('Reached the verified next UI control');
  if(labelCase){save.supportPurchaseUnlockedIds=[];save.caps=1000;if(labelCase!=='register')save.ownedUnitIds=[...save.registeredUnitIds];}
  const offer=()=>modalType==='recruit'?offerFor({phase:'map'},'campaign',save):null;
  const dialog={
    isVisible:async()=>Boolean(offer()),
    getByRole(role,options){
      if(role==='heading'){assert.equal(options.level,2);return{textContent:async()=>badHeading?'unknown unit':offer()?.displayName};}
      assert.equal(role,'button');assert.equal(options.exact,true);
      return{async click(){
        const rendered=renderModal(save,offer(),result=>{assert.equal(result.applied,true);save=result.save;if(tamperCaps)save.caps-=1;});
        const found=descendants(rendered).filter(n=>n.type==='button'&&n.props.children===options.name);assert.equal(found.length,1,'use the actual production recruit button');
        events.push(options.name);found[0].props.onClick();
      }};
    },
    waitFor:async options=>{assert.equal(options.state,'hidden');assert.equal(options.timeout,15_000);assert.equal(offer(),null);events.push('offer-hidden');},
  };
  const page={
    locator(selector){
      if(selector==='.v100-recruit-modal[role="dialog"]')return dialog;
      assert.equal(selector,'button.v100-personnel-card');return{filter({has}){return{async click(){selected=V100_UNITS.find(u=>u.displayName===has.name);assert.ok(selected);}};}};
    },
    getByRole(role,options){
      if(role==='heading')return{name:options.name};
      assert.equal(options.exact,true);
      if(role==='navigation')return{getByRole(_role,tab){return{async click(){
        if(offer()||modalType==='other')throw new Error('The actual recruit or unrelated dialog obscures preparation');
        events.push(tab.name);if(!labelCase)throw stop;
      }};}};
      assert.equal(role,'button');
      if(options.name==='ユニット一覧へ')return{isVisible:async()=>false,async click(){assert.fail('This label fixture already shows the roster');}};
      return{async click(){
        let rendered;
        if(labelCase==='register')rendered=registerButton(save,{registrationCost:selected.registrationCostCaps},selected,()=>{});
        else if(labelCase==='level'){const level=save.unitLevels[selected.id];rendered=levelButton(save,{level,nextLevel:level+1,upgradeCost:v100LevelCost(level+1)},selected,()=>{});}
        else rendered=vehicleButton(save,save.vehicle.upgradeLevel,V100_VEHICLE.upgradeCosts[save.vehicle.upgradeLevel],()=>{});
        assert.equal(options.name,rendered.props.children,'normal UI selection must match the rendered production label');throw stop;
      }};
    },
  };
  const bindings={page,uiClick:locator=>locator.click(),saveAt:async()=>structuredClone(save),V100_UNITS,V100_VEHICLE,v100LevelCost,report,deferNormalRecruitOffer};
  return{bindings,before,events,stop,report,get save(){return save;}};
}

for(const file of ['scripts/v100-normal-campaign-playthrough.mjs','scripts/v100-final-normal-playthrough.mjs']){
  test(file+': the earned first-clear recruit dialog is deferred before preparation navigation',async()=>{
    const f=fixture();await assert.rejects(prepare(file,f.bindings)(2),e=>e===f.stop);
    assert.deepEqual(f.events,['後で決める','offer-hidden','ユニット']);
    assert.equal(f.save.caps,f.before.caps);assert.deepEqual(f.save.ownedUnitIds,f.before.ownedUnitIds);
    assert.deepEqual(f.save.completedStageIds,f.before.completedStageIds);
    assert.equal(f.report.transactions.length,1);assert.equal(f.report.transactions[0].action,'defer-recruit-offer');
  });
  for(const labelCase of ['register','level','vehicle'])test(file+': '+labelCase+' selects its actual production button',async()=>{
    const f=fixture({modalType:'none',labelCase});
    await assert.rejects(prepare(file,f.bindings)(labelCase==='vehicle'?5:2),e=>e===f.stop);
  });
}

test('the production defer callback adds one seen receipt and a second check does not interact again',async()=>{
  const f=fixture(),options={...f.bindings,stageNumber:2,transactions:f.report.transactions};
  const first=await deferNormalRecruitOffer(f.bindings.page,options);assert.equal(first.id,'unit-nao');
  assert.equal(await deferNormalRecruitOffer(f.bindings.page,options),null);
  assert.deepEqual(f.events,['後で決める','offer-hidden']);assert.equal(f.report.transactions.length,1);
});
test('a different blocking dialog is preserved rather than dismissed as a recruit offer',async()=>{
  const f=fixture({modalType:'other'});assert.equal(await deferNormalRecruitOffer(f.bindings.page,f.bindings),null);
  assert.deepEqual(f.save,f.before);assert.deepEqual(f.events,[]);
});
test('unknown recruit identity is rejected before any UI input',async()=>{
  const f=fixture({badHeading:true});await assert.rejects(deferNormalRecruitOffer(f.bindings.page,f.bindings),/registered unit/u);
  assert.deepEqual(f.save,f.before);assert.deepEqual(f.events,[]);
});
test('a defer callback that spends CAPS cannot be accepted as a harmless acknowledgment',async()=>{
  const f=fixture({tamperCaps:true});await assert.rejects(deferNormalRecruitOffer(f.bindings.page,f.bindings),/cannot spend CAPS/u);
  assert.deepEqual(f.report.transactions,[]);
});
