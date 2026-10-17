import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {V100_UNITS} from '../app/v100Registry.js';

// Offline component-state checks execute the actual production controls and
// driver call sites. The failed native screenshots establish the hidden roster;
// this does not launch a game/browser or claim native acceptance.
const source=fs.readFileSync(new URL('../app/V100Campaign.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('V100Campaign.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const controls=[];
function visit(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(parsed)==='button'){
    const classes=node.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(parsed)==='className');
    if(classes?.getText(parsed).includes('v100-personnel-card')||classes?.initializer?.text==='v100-personnel-detail-back')controls.push(node);
  }
  ts.forEachChild(node,visit);
}
visit(parsed);
const card=controls.find(n=>n.getText(parsed).includes('v100-personnel-card'));
const back=controls.find(n=>n.openingElement.attributes.properties.some(a=>a.initializer?.text==='v100-personnel-detail-back'));
assert.ok(card&&back);
const compile=(text,bindings)=>vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,{React,...bindings});
const renderCard=compile(`(unit,selectedUnit,save,setSelectedUnitId,setDetailOpen)=>{const owned=true,registered=true,art=null;return (${card.getText(parsed)});};`,{v100RoleLabelFor:role=>role,V100LockChain:()=>null});
const renderBack=compile(`(setDetailOpen)=>{const focusedUnitId=null,onBack=()=>{throw new Error('Unexpected surface exit');};return (${back.getText(parsed)});};`,{});
const polish=fs.readFileSync(new URL('../app/v100CommandPolish.css',import.meta.url),'utf8');
assert.match(polish,/\.detail-open \.v100-personnel-roster\s*\{\s*display:\s*none/u);
assert.match(polish,/\.detail-open \.v100-personnel-detail-back\s*\{\s*display:\s*block/u);
const earned=JSON.parse(fs.readFileSync(new URL('./fixtures/v177-earned-stage2-personnel.json',import.meta.url),'utf8'));
assert.equal(earned.source.head,'89763bc9d51fbf09d8ffc4c9ab2a80a835b60a08');
assert.equal(earned.save.caps,66);
assert.equal(earned.save.unitLevels['unit-nao'],2);
assert.equal(earned.save.completedStageIds.length,2);

function descendants(element){
  return [element,...React.Children.toArray(element?.props?.children).flatMap(child=>React.isValidElement(child)?descendants(child):[])];
}
function fixture({detailOpen=true,missingBack=false}={}){
  const save=structuredClone(earned.save),before=structuredClone(save),clicks=[];
  let selectedId='unit-nao',detail=detailOpen;
  const setSelected=id=>{selectedId=id;},setDetail=value=>{detail=value;};
  const page={
    getByRole(role,{name,exact}){
      assert.equal(exact,true);
      if(role==='heading')return {name};
      assert.equal(role,'button');
      const control=renderBack(setDetail);
      assert.equal(name,control.props.children,'use the actual production return label');
      return {isVisible:async()=>detail&&!missingBack,async click(){
        assert.ok(detail&&!missingBack,'a missing native control cannot pass');
        clicks.push(control.props.children);control.props.onClick();
      }};
    },
    locator(selector){
      assert.equal(selector,'button.v100-personnel-card');
      return {filter({has}){
        const unit=V100_UNITS.find(unit=>unit.displayName===has.name);
        return {async click(){
          assert.equal(detail,false,'the real roster is hidden while production detail-open is set');
          assert.ok(unit,'the exact native unit heading must exist');
          const control=renderCard(unit,V100_UNITS.find(unit=>unit.id===selectedId),save,setSelected,setDetail);
          const heading=descendants(control).find(node=>node.type==='h3');
          assert.equal(heading.props.children,has.name);
          clicks.push(heading.props.children);control.props.onClick();
        }};
      }};
    },
  };
  return {page,clicks,save,before,get selectedId(){return selectedId;},get detailOpen(){return detail;}};
}

function selectionCalls(file,bindings){
  const text=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const names=new Set(['button','selectPersonnel']),declarations=[],calls=[];
  for(const statement of tree.statements){
    if(ts.isFunctionDeclaration(statement)&&names.has(statement.name?.text))declarations.push(statement.getText(tree));
    if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(names.has(d.name.getText(tree)))declarations.push('const '+d.getText(tree)+';');
    if(ts.isFunctionDeclaration(statement)&&statement.name?.text==='prepareEconomy'){
      const find=node=>{if(ts.isExpressionStatement(node)&&node.getText(tree).includes('selectPersonnel(unit)'))calls.push(node.getText(tree));ts.forEachChild(node,find);};
      find(statement);
    }
  }
  assert.equal(calls.length,2,'both registration and level-up keep the normal selection route');
  return calls.map(call=>vm.runInNewContext(declarations.join('\n')+'\n(async(unit)=>{'+call+'});',{...bindings}));
}
for(const file of ['scripts/v100-normal-campaign-playthrough.mjs','scripts/v100-final-normal-playthrough.mjs']){
  for(const callIndex of [0,1]){
    const run=(f,unit)=>selectionCalls(file,{page:f.page,uiClick:locator=>locator.click()})[callIndex](unit);
    const baba=V100_UNITS.find(unit=>unit.id==='unit-babayaga'),hachi=V100_UNITS.find(unit=>unit.id==='unit-hachi');
    test(`${file} selection ${callIndex}: native earned Nao detail returns to the roster before selecting Baba`,async()=>{
      const f=fixture();await run(f,baba);
      assert.deepEqual(f.clicks,['ユニット一覧へ',baba.displayName]);
      assert.equal(f.selectedId,baba.id);assert.equal(f.detailOpen,true);assert.deepEqual(f.save,f.before);
    });
    test(`${file} selection ${callIndex}: a visible list selects directly, then the next selection uses the real return control`,async()=>{
      const f=fixture({detailOpen:false});await run(f,baba);await run(f,hachi);
      assert.deepEqual(f.clicks,[baba.displayName,'ユニット一覧へ',hachi.displayName]);
      assert.equal(f.selectedId,hachi.id);assert.deepEqual(f.save,f.before);
    });
    test(`${file} selection ${callIndex}: missing actual return control rejects a hidden roster without force or save mutation`,async()=>{
      const f=fixture({missingBack:true});await assert.rejects(run(f,baba));assert.deepEqual(f.save,f.before);assert.deepEqual(f.clicks,[]);
    });
  }
}
