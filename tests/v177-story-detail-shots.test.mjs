import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import sharp from 'sharp';
import {V177_STORY_DETAIL_SHOTS,v177StoryDetailShotFor} from '../app/v177StoryDetailShots.js';

const source=fs.readFileSync(new URL('../app/V177StoryDetailShot.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('V177StoryDetailShot.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='V177StoryDetailShot');
const compiled=ts.transpileModule(fn.getText(tree).replace(/^export /u,'')+'\nV177StoryDetailShot;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React},
}).outputText;
const Component=vm.runInNewContext(compiled,{React,useId:React.useId,v177StoryDetailShotFor});

test('all six action close-ups refer to actual1280x720 art and stay within its original pixels',async()=>{
  assert.equal(Object.keys(V177_STORY_DETAIL_SHOTS).length,6);
  for(const shot of Object.values(V177_STORY_DETAIL_SHOTS)){
    const info=await sharp(`public/art/v100/story-r9/cuts/${shot.id}.webp`).metadata();
    assert.equal(info.width,1280);assert.equal(info.height,720);
    const [x,y,width,height]=shot.rect;
    assert.ok(shot.rect.every(Number.isInteger));assert.ok(x>=0&&y>=0&&width>0&&height>0);
    assert.ok(x+width<=info.width&&y+height<=info.height);
  }
});
test('asset selection keeps Pages prefixes and never attaches a close-up to unrelated art',()=>{
  for(const id of Object.keys(V177_STORY_DETAIL_SHOTS))for(const prefix of ['', '/Zombieee','https://susano-ooo.github.io/Zombieee']){
    assert.equal(v177StoryDetailShotFor(`${prefix}/art/v100/story-r9/cuts/${id}.webp?v=1`).id,id);
  }
  for(const src of [null,'','/art/other/s01-nao-rescue.webp','/art/v100/story-r9/cuts/s03-cold-retrieval.webp'])assert.equal(v177StoryDetailShotFor(src),null);
});
test('actual production SVG clips the original image to the authored crop rather than leaking adjacent action',()=>{
  for(const shot of Object.values(V177_STORY_DETAIL_SHOTS)){
    const src=`/Zombieee/art/v100/story-r9/cuts/${shot.id}.webp`;
    const html=renderToStaticMarkup(React.createElement(Component,{src}));
    assert.ok(html.includes(`viewBox="${shot.rect.join(' ')}"`));
    const clip=html.match(/clip-path="url\(#([^"()]+)\)"/u);assert.ok(clip);
    assert.ok(html.includes(`<clipPath id="${clip[1]}" clipPathUnits="userSpaceOnUse">`));
    assert.ok(html.includes(`href="${src}"`));assert.ok(html.includes('width="1280" height="720"'));
    assert.ok(!html.includes('<text'),'close-up contains no added player-visible instruction or debug label');
  }
});
test('simultaneous previous/current close-ups have independent clipping IDs and only the current one is accessible',()=>{
  const src='/art/v100/story-r9/cuts/s23-chiha-evidence-send.webp';
  const html=renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(Component,{src,previous:true}),React.createElement(Component,{src,arriving:true})));
  const ids=[...html.matchAll(/<clipPath id="([^"]+)"/gu)].map(match=>match[1]);assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
  assert.ok(html.includes('v177-story-detail-previous'));assert.ok(html.includes('v177-story-detail-arriving'));
  assert.ok(/<figure[^>]*v177-story-detail-previous[^>]*aria-hidden="true"/u.test(html));
});
test('an unrelated backdrop creates no extra element or controls',()=>{
  assert.equal(renderToStaticMarkup(React.createElement(Component,{src:'/art/v060/title-key-visual-v1.webp'})),'');
});
