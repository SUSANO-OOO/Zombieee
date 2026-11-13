import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import { CHARACTER_PORTRAIT_ART } from '../app/spriteManifest.js';
import { inspectApprovedBattleCardPortraits } from '../scripts/approved-battle-card-portrait.mjs';

const source=fs.readFileSync('scripts/v100-card-resize-browser.mjs','utf8');
const parsed=ts.createSourceFile('card-resize.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const statement=name=>parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name
 ||ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(parsed)===name));
const names=['imageGeometry','cropPortrait','changedPixels'];
const functions=vm.runInNewContext(names.map(name=>{const node=statement(name);assert.ok(node,name);return node.getText(parsed);}).join('\n')+'\n({imageGeometry,cropPortrait,changedPixels})',{
 assert,sharp,Buffer,URL,CHARACTER_PORTRAIT_ART,inspectApprovedBattleCardPortraits,base:new URL('http://127.0.0.1/'),getComputedStyle:()=>({opacity:'1',imageRendering:'optimizeQuality'}),CSS:{supports:()=>true},
});
const rect=(x,y,width,height)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
async function observedGeometry(){
 // Immutable CI13500764150: the full source portrait extends below the
 // 844x340 bitmap; its actual card is entirely visible at396,258,136,64.
 const classes=names=>({contains:name=>names.includes(name)}),source=CHARACTER_PORTRAIT_ART.kumaverson;
 const frame={tagName:'SPAN',classList:classes(['portrait']),children:[]},camera={tagName:'SPAN',classList:classes(['v100-deploy-camera']),children:[]};
 const card={tagName:'BUTTON',classList:classes(['unit-card','v100-deploy-card']),children:[frame],dataset:{kind:'kumaverson',portrait:'approved',state:'ready'},getBoundingClientRect:()=>rect(396,258,136,64),querySelectorAll:()=>[]};
 class ImageElement{}
 let decodeCalls=0,helperCalls=0;
 const img=Object.assign(new ImageElement(),{decode:async()=>{decodeCalls++;},closest:selector=>selector==='button'?card:frame,parentElement:camera,complete:true,naturalWidth:512,naturalHeight:640,currentSrc:new URL(source,'http://127.0.0.1/').href,
  getAttribute:()=>source,getBoundingClientRect:()=>rect(334.05419921875,279.140625,164.875,206.09375)});
 camera.children=[img];frame.children=[{tagName:'I',classList:classes([])},camera];card.ownerDocument={defaultView:{HTMLImageElement:ImageElement}};
 const page={locator(selector){
  if(selector==='[data-battle-hud-layout="mobile"]')return {count:async()=>1};
  if(selector==='button.unit-card[data-kind="kumaverson"]')return {evaluateAll:async(callback,args)=>{assert.equal(callback,inspectApprovedBattleCardPortraits);helperCalls++;return callback([card],args);}};
  assert.equal(selector,'button.unit-card[data-kind="kumaverson"] .portrait > .v100-deploy-camera > img');return {evaluate:callback=>callback(img)};
 }};
 const geometry=await functions.imageGeometry(page,'kumaverson');assert.equal(helperCalls,1,'real strict inspector must run');assert.ok(decodeCalls>0,'actual portrait decode must have completed');return geometry;
}
const width=844,height=340;
const raw=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*4;raw[at]=x%256;raw[at+1]=y%256;raw[at+2]=(x+y)%256;raw[at+3]=255;}
const encode=bytes=>sharp(bytes,{raw:{width,height,channels:4}}).png().toBuffer();

test('visible portrait crop retains native pixels when the source image extends below the viewport',async()=>{
 const geometry=await observedGeometry();
 const cropped=await functions.cropPortrait(await encode(raw),geometry.clip,geometry.unroundedRects.card);
 assert.deepEqual([geometry.clip.x,geometry.clip.y,geometry.clip.width,geometry.clip.height],[399,283,99,36]);
 const decoded=await sharp(cropped).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(decoded.info.width,99);assert.equal(decoded.info.height,36);
 for(let y=0;y<36;y++)assert.ok(decoded.data.subarray(y*99*4,(y+1)*99*4).equals(raw.subarray(((283+y)*width+399)*4,((283+y)*width+498)*4)),'crop keeps every original visible RGBA byte');
});

test('portrait cropping rejects a clipped card even if its requested sample fits in the PNG',async()=>{
 const png=await encode(raw),clip={x:399,y:283,width:40,height:20};
 await assert.rejects(functions.cropPortrait(png,clip,rect(396,258,136,100)),/Card extends beyond native screenshot/);
 await assert.rejects(functions.cropPortrait(png,{...clip,x:-1},rect(396,258,136,64)),/Portrait crop extends beyond native screenshot/);
});

test('native crop comparison preserves the one-percent and twelve-channel-delta failure evidence',async()=>{
 const geometry=await observedGeometry(),first=await functions.cropPortrait(await encode(raw),geometry.clip,geometry.unroundedRects.card);
 const stable=await functions.changedPixels(first,first,geometry.masks);
 assert.equal(stable.fraction,0);assert.ok(stable.compared>300);
 const changed=Buffer.from(raw);
 for(let y=289;y<298;y++)for(let x=405;x<414;x++){const at=(y*width+x)*4;changed[at]=(changed[at]+64)%256;}
 const last=await functions.cropPortrait(await encode(changed),geometry.clip,geometry.unroundedRects.card);
 const difference=await functions.changedPixels(first,last,geometry.masks);
 assert.equal(difference.minimumChannelDelta,12);assert.equal(difference.maximumChangedFraction,.01);
 assert.ok(difference.fraction>.01,'visible degradation still exceeds the original unchanged gate');
});
