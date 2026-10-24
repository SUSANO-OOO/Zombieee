import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {buildSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {V100_CREDITS_SONG} from '../app/v100StaffRoll.js';

const compiled=buildSync({entryPoints:['app/V100EndingRoll.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},write:false,logLevel:'silent'});
const compiledModule={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),compiledModule,compiledModule.exports);
const audioTag=(settings,props={})=>renderToStaticMarkup(createElement(compiledModule.exports.V100StaffRoll,{nodes:[{text:'credits'}],playerName:'test',settings,onComplete:()=>true,...props})).match(/<audio\b[^>]*>/u)?.[0];

// Re-render only the actual source-selection statements. This observes the
// component's state transitions without mounting a browser or audio device.
const source=fs.readFileSync('app/V100EndingRoll.tsx','utf8');
const parsed=ts.createSourceFile('V100EndingRoll.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const staff=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='V100StaffRoll');
const end=staff.body.statements.findIndex(n=>ts.isVariableStatement(n)
  &&n.declarationList.declarations.some(d=>d.name.getText(parsed)==='audioRef'));
assert.ok(end>0);
const renderSource=vm.runInNewContext('({settings,blocked,useState})=>{'
  +staff.body.statements.slice(0,end).map(n=>n.getText(parsed)).join('\n')+'\nreturn attachSong;}');
function sourceRenderer(){
  let initialized=false,value;
  return props=>{
    let pending,result,turns=0;
    do{
      pending=false;
      result=renderSource({...props,useState:initial=>{
        if(!initialized){initialized=true;value=initial;}
        return[value,next=>{if(next!==value){value=next;pending=true;}}];
      }});
      assert.ok(++turns<=2,'the source-selection render must converge');
    }while(pending);
    return result;
  };
}

test('The actual staff-roll render starts without a media source when BGM is disabled or its volume is zero',()=>{
  for(const settings of [{bgmEnabled:false,bgmVolume:.8},{bgmEnabled:true,bgmVolume:0}]){
    const tag=audioTag(settings);assert.ok(tag);assert.doesNotMatch(tag,/\bsrc=/u);assert.match(tag,/preload="none"/u);
  }
});

test('The actual enabled staff-roll render retains the licensed song and native metadata preload',()=>{
  for(const settings of [{bgmEnabled:true,bgmVolume:.8},{}]){
    const tag=audioTag(settings);assert.ok(tag?.includes('src="'+V100_CREDITS_SONG.src+'"'));assert.match(tag,/preload="metadata"/u);
  }
});

test('The actual staff-roll render defers its first enabled song while a blocking menu remains open',()=>{
  const tag=audioTag({bgmEnabled:true,bgmVolume:.8},{blocked:true});
  assert.ok(tag);assert.doesNotMatch(tag,/\bsrc=/u);assert.match(tag,/preload="none"/u);
});

test('Enabling BGM in the menu requests its first source only after the existing playback block is lifted',()=>{
  const render=sourceRenderer();
  assert.equal(render({settings:{bgmEnabled:false},blocked:false}),false);
  assert.equal(render({settings:{bgmEnabled:true},blocked:true}),false,'saving BGM in an open menu cannot start a metadata-only request');
  assert.equal(render({settings:{bgmEnabled:true},blocked:true}),false);
  assert.equal(render({settings:{bgmEnabled:true},blocked:false}),true,'returning to the game retains the enabled native source');

  const campaign=ts.createSourceFile('V100Campaign.tsx',fs.readFileSync('app/V100Campaign.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const blockers=[];function visit(n){
    if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(campaign)==='V100StaffRoll'
      &&n.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(campaign)==='initialNodeIndex'))
      blockers.push(n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(campaign)==='blocked')?.initializer?.getText(campaign));
    ts.forEachChild(n,visit);
  }visit(campaign);
  assert.equal(blockers.length,1,'exercise the saved campaign credits owner');
  assert.ok(blockers[0]?.includes('menuOpen'),'the actual campaign staff-roll owner passes the open-menu playback block');
});

test('A requested native song remains attached through menu, volume and BGM changes',()=>{
  const render=sourceRenderer();
  for(const props of [
    {settings:{bgmEnabled:true},blocked:false},
    {settings:{bgmEnabled:true},blocked:true},
    {settings:{bgmEnabled:false},blocked:true},
    {settings:{bgmEnabled:false},blocked:false},
    {settings:{bgmEnabled:true,bgmVolume:0},blocked:true},
    {settings:{bgmEnabled:true},blocked:false},
  ])assert.equal(render(props),true,'the same requested source must survive pauses and settings changes');
});
