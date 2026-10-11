import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {V100_CREDITS_SONG} from '../app/v100StaffRoll.js';

const compiled=buildSync({entryPoints:['app/V100EndingRoll.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},write:false,logLevel:'silent'});
const compiledModule={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),compiledModule,compiledModule.exports);
const audioTag=settings=>renderToStaticMarkup(createElement(compiledModule.exports.V100StaffRoll,{nodes:[{text:'credits'}],playerName:'test',settings,onComplete:()=>true})).match(/<audio\b[^>]*>/u)?.[0];

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
