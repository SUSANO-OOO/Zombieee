import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {spriteFrameFor,spriteBattleDisplaySizeFor,COMPACT_BATTLE_SPRITE_SCALE} from '../app/spriteManifest.js';
import {v102BattleDisplaySize} from '../app/v102BattleScale.js';
import {sampleAnimationClip} from '../app/combatPresentation.js';
import {mugarianPresidentCompactScale} from '../app/v100BossPresentation.js';
import {restorePreLateBossScaleSource} from './helpers/guard-spectacle-source.mjs';

const file='app/AshfallGame.tsx',source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
function actualScale(viewport){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='compactSpriteScale');
 assert.ok(node,'Exercise the real production function');
 return vm.runInNewContext(ts.transpileModule(node.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText+'\ncompactSpriteScale',{
  compactBattleViewport:()=>viewport!=='standard',activeStageViewportId:viewport,
  STAGE_VIEWPORT_IDS:{MOBILE_844_340:'844x340'},mugarianPresidentCompactScale,COMPACT_BATTLE_SPRITE_SCALE,
 });
}
function standingHeight(kind,scale){
 const frame=spriteFrameFor(kind,'idle','right'),size=v102BattleDisplaySize(kind,frame,spriteBattleDisplaySizeFor(kind));
 return frame.contentRect.h*size.h/frame.sourceRect.h*sampleAnimationClip(kind,'idle',0).bodyScale*scale(kind);
}
test('on both phone heights, the president dominates early bosses and Omega is visibly larger again',()=>{
 for(const viewport of ['844x340','844x390']){
  const scale=actualScale(viewport),president=standingHeight('mugarian-president-mutated',scale),omega=standingHeight('takuya-omega',scale);
  const early=Math.max(...['takuya','gate-eater','mother','gairen'].map(k=>standingHeight(k,scale)));
  assert.ok(president>early,`${viewport}: president ${president} must exceed ${early}`);
  assert.ok(omega>president*1.2,`${viewport}: Omega ${omega} must dominate president ${president}`);
  assert.ok(president>standingHeight('brawler',scale)*2.4,'President is a giant beside the same-ground ally');
 }
});
test('short phone correction preserves other actors and the existing non-phone path',()=>{
 for(const viewport of ['844x340','844x390','standard']){
  const scale=actualScale(viewport),compact=viewport!=='standard';
  for(const kind of ['brawler','takuya','gate-eater','gairen','kurome','futago-separated-a'])assert.equal(scale(kind),compact?COMPACT_BATTLE_SPRITE_SCALE:1);
  assert.equal(scale('mother'),compact?1.06:1);
 }
 assert.equal(actualScale('standard')('takuya-omega'),.8);
});
test('only the declared phone scale block differs from the accepted App, and unlisted edits are rejected',()=>{
 const before=execFileSync('git',['show','198a8851327084edf986d8ccd4875269e1d4d0c9:'+file],{maxBuffer:4e6}).toString().replaceAll('\r\n','\n');
 assert.equal(restorePreLateBossScaleSource(file,source),before);
 for(const bad of [source.replace('MOBILE_844_340 ? .9 : 1','MOBILE_844_340 ? .52 : .6'),source+'\nclearV100MayoFeralVfx(g);\n',source.replace('drawAreaEffect(ctx, effect, g.time, stageObjects','drawAreaEffect(ctx, effect, g.time + 1, stageObjects')]){
  assert.notEqual(bad,source);
  assert.throws(()=>assert.equal(restorePreLateBossScaleSource(file,bad),before));
 }
});
