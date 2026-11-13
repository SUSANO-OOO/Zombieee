import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectApprovedBattleCardPortraits} from '../scripts/approved-battle-card-portrait.mjs';
const {CHARACTER_PORTRAIT_ART}=await import(pathToFileURL(path.resolve('app/spriteManifest.js')).href);
const baseUrl='http://127.0.0.1:49248/';
const kinds=['guardian','medic','kumaverson','brawler'];
const expectedByKind=Object.fromEntries(kinds.map(k=>[k,CHARACTER_PORTRAIT_ART[k]]));
class Element{
 constructor(tagName,classes=[],children=[]){this.tagName=tagName;this.children=children;this.classList={contains:name=>classes.includes(name)};this.dataset={};for(const c of children)c.parentElement=this;}
}
class ImageElement extends Element{
 constructor(source){super('IMG');this.source=source;this.currentSrc=new URL(source,baseUrl).href;this.complete=true;this.naturalWidth=512;this.naturalHeight=640;this.decoded=0;}
 getAttribute(name){return name==='src'?this.source:null;}
 async decode(){this.decoded++;}
 getBoundingClientRect(){return {width:120,height:150};}
}
function fixture(kind='guardian',{direct=false,source=expectedByKind[kind]}={}){
 const img=new ImageElement(source),camera=new Element('SPAN',['v100-deploy-camera'],[img]);
 // Exact relevant JSX branch at a61/base1cb: .portrait has decorative i then camera>img.
 // CI did not save HTML; this is source-derived DOM structure, not captured CI DOM.
 const frame=new Element('SPAN',['portrait'],[new Element('I'),direct?img:camera]);
 const card=new Element('BUTTON',['unit-card','v100-deploy-card'],[frame]);card.dataset={kind,portrait:'approved',state:'ready'};card.ownerDocument={defaultView:{HTMLImageElement:ImageElement}};
 return {card,img,camera,frame};
}
const inspect=cards=>inspectApprovedBattleCardPortraits(cards,{expectedByKind,baseUrl,mobileCamera:true});
test('the four real approved identity/source pairs decode through their exact current cameras',async()=>{
 const fixtures=kinds.map(k=>fixture(k));const rows=await inspect(fixtures.map(f=>f.card));assert.deepEqual(rows.map(r=>r.kind),kinds);for(let i=0;i<rows.length;i++){assert.equal(rows[i].src,expectedByKind[kinds[i]]);assert.equal(rows[i].currentSrc,new URL(expectedByKind[kinds[i]],baseUrl).href);assert.equal(fixtures[i].img.decoded,1);assert.equal(rows[i].decoded,true);}
});
test('old direct-child portrait shape, absent portrait, nested arbitrary image and icon-only camera are rejected',async()=>{
 const old=fixture('guardian',{direct:true});await assert.rejects(inspect([old.card]),/direct current camera/);assert.equal(old.img.decoded,0);
 const empty=fixture();empty.camera.children=[];await assert.rejects(inspect([empty.card]),/exactly its portrait img/);
 const nested=fixture();nested.camera.children=[new Element('SPAN',[],[nested.img])];await assert.rejects(inspect([nested.card]),/exactly its portrait img/);
 const icon=fixture();icon.camera.children=[new Element('SVG')];await assert.rejects(inspect([icon.card]),/exactly its portrait img/);
});
test('wrong person, unapproved source, unrelated icon image and duplicate identity cannot satisfy the portrait probe',async()=>{
 for(const source of [expectedByKind.medic,'/art/not-approved.webp','/icons/shield.svg']){const f=fixture('guardian',{source});await assert.rejects(inspect([f.card]),/Unapproved portrait source/);assert.equal(f.img.decoded,0);}
 const unknown=fixture();unknown.card.dataset.kind='not-approved';await assert.rejects(inspect([unknown.card]),/Unexpected or duplicate/);
 const a=fixture(),b=fixture();await assert.rejects(inspect([a.card,b.card]),/Unexpected or duplicate/);
 const extra=fixture();extra.camera.children.push(new ImageElement('/icons/shield.svg'));await assert.rejects(inspect([extra.card]),/exactly its portrait img/);
});
test('decode rejection or a changed actual source never produces a successful portrait observation',async()=>{
 const f=fixture(),failure=new Error('Native decode rejected');f.img.decode=async()=>{throw failure;};await assert.rejects(inspect([f.card]),e=>e===failure);
 const redirected=fixture();redirected.img.currentSrc='http://127.0.0.1:49248/art/wrong-person.webp';await assert.rejects(inspect([redirected.card]),/Decoded portrait source differs/);
});


test("Pages-prefixed approved sources remain exact and a missing base prefix is rejected",async()=>{
 const scopedBase="http://127.0.0.1:49248/Zombieee/",f=fixture("guardian",{source:"/Zombieee"+expectedByKind.guardian});
 const rows=await inspectApprovedBattleCardPortraits([f.card],{expectedByKind,baseUrl:scopedBase,mobileCamera:true});
 assert.equal(rows[0].src,"/Zombieee"+expectedByKind.guardian);assert.equal(rows[0].currentSrc,new URL(expectedByKind.guardian.slice(1),scopedBase).href);
 await assert.rejects(inspectApprovedBattleCardPortraits([fixture().card],{expectedByKind,baseUrl:scopedBase,mobileCamera:true}),/Unapproved portrait source/);
});


test("the existing unmarked HUD keeps its strict direct-image branch and layouts cannot be interchanged",async()=>{
 const direct=fixture("guardian",{direct:true});const rows=await inspectApprovedBattleCardPortraits([direct.card],{expectedByKind,baseUrl,mobileCamera:false});assert.equal(rows[0].src,expectedByKind.guardian);
 await assert.rejects(inspectApprovedBattleCardPortraits([fixture().card],{expectedByKind,baseUrl,mobileCamera:false}),/direct approved portrait/);
 await assert.rejects(inspectApprovedBattleCardPortraits([fixture().card],{expectedByKind,baseUrl}),/Explicit production HUD layout marker/);
});
