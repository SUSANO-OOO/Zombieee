import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {isV100StoryBackdropReady} from '../scripts/v100-story-backdrop-ready.mjs';

const legacy='/art/v100/story-r9/cuts/original.webp',quality='/art/v100/quality-20261028/scenes/model-r1.webp';
function ready(background,change={}){
 const image={complete:true,naturalWidth:1920,naturalHeight:640,currentSrc:'https://game.test/Zombieee'+background,
  getBoundingClientRect:()=>({width:844,height:280}),...change.image};
 const imageStyle={display:'block',visibility:'visible',opacity:'1',objectFit:'contain',...change.imageStyle};
 const backdropStyle={backgroundImage:background===quality?'none':`url("${background}")`,...change.backdropStyle};
 const backdrop={querySelector:selector=>selector.includes(':not(')&&!change.previousOnly?image:null};
 const surface={querySelector:()=>backdrop};
 return runInNewContext(`(${isV100StoryBackdropReady.toString()})(args)`,{
  URL,args:{selector:'#event',background},document:{baseURI:'https://game.test/',querySelector:()=>surface},
  getComputedStyle:element=>element===image?imageStyle:backdropStyle,
 });
}
test('decoded visible legacy art and model panorama both qualify with their own decoration contract',()=>{
 assert.equal(ready(legacy),true);assert.equal(ready(quality),true);
});
test('wrong or previous images, missing decode and invisible images remain failures',()=>{
 for(const background of[legacy,quality]){
  for(const change of[
   {image:{currentSrc:'https://game.test/wrong.webp'}},{previousOnly:true},
   {image:{complete:false}},{image:{naturalWidth:0}},{image:{naturalHeight:0}},
   {image:{getBoundingClientRect:()=>({width:0,height:280})}},
   {imageStyle:{display:'none'}},{imageStyle:{visibility:'hidden'}},{imageStyle:{opacity:'0'}},
  ])assert.equal(ready(background,change),false,JSON.stringify({background,change}));
 }
});
test('missing legacy decoration, ghost model decoration and clipped model fitting remain failures',()=>{
 assert.equal(ready(legacy,{backdropStyle:{backgroundImage:'none'}}),false);
 assert.equal(ready(quality,{backdropStyle:{backgroundImage:`url("${legacy}")`}}),false);
 assert.equal(ready(quality,{imageStyle:{objectFit:'cover'}}),false);
});
