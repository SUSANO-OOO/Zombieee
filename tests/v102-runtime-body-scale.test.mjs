import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {spriteKinds,spriteFrameFor,spriteBattleDisplaySizeFor,fitSpriteBattleDisplaySize,COMPACT_BATTLE_SPRITE_SCALE} from '../app/spriteManifest.js';
import {sampleAnimationClip} from '../app/combatPresentation.js';
import {STAGE_VIEWPORT_IDS} from '../app/stageGeometry.js';
import {mugarianPresidentCompactScale} from '../app/v100BossPresentation.js';
import {v102BattleDisplaySize} from '../app/v102BattleScale.js';
import {v102BattleBodyScale,v102TravelCycleDistance} from '../app/v102CombatMotion.js';
import {v100UsesHumanWalk,v100HumanWalkCycleDistance} from '../app/v100HumanWalk.js';
import {v177JointCycleDistance} from '../app/v177JointPresentation.js';

const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=new Map();let corpseDeclarations;
function visit(node){
 if(ts.isFunctionDeclaration(node))declarations.set(node.name?.text,node.getText(ast));
 if(ts.isForOfStatement(node)&&ts.isBlock(node.statement)&&node.expression.getText(ast)==='g.corpses'){
  const spriteBranch=node.statement.statements.find(s=>ts.isIfStatement(s)&&s.expression.getText(ast).startsWith('sprite?.complete'));
  if(spriteBranch)corpseDeclarations=spriteBranch.thenStatement.statements.filter(s=>ts.isVariableStatement(s)).slice(0,7).map(s=>s.getText(ast)).join('\n');
 }
 ts.forEachChild(node,visit);
}visit(ast);
assert.ok(corpseDeclarations?.includes('const height ='));
const functions=['compactSpriteScale','v102GoreBodyHeight','articulatedCycleDistanceFor'].map(n=>{assert.ok(declarations.has(n));return declarations.get(n);}).join('\n');
function fixture(viewport,depth){
 const globals={activeStageViewportId:viewport,STAGE_VIEWPORT_IDS,COMPACT_BATTLE_SPRITE_SCALE,mugarianPresidentCompactScale,
  compactBattleViewport:()=>viewport!==STAGE_VIEWPORT_IDS.STANDARD,activeBattlefieldDepthScale:()=>depth,
  bossRenderKind:f=>f.kind,spriteFrameFor,spriteDisplaySize:spriteBattleDisplaySizeFor,fitSpriteBattleDisplaySize,
  v102BattleDisplaySize,v102BattleBodyScale,v102TravelCycleDistance,v100UsesHumanWalk,v100HumanWalkCycleDistance,v177JointCycleDistance};
 const code=ts.transpileModule(`${functions}\nfunction corpseSize(corpse,g){const corpseRenderKind=corpse.kind;${corpseDeclarations}\nreturn {width,height,bodyScale};}\n({compactSpriteScale,v102GoreBodyHeight,articulatedCycleDistanceFor,corpseSize})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(code,globals);
}

test('actual V1 corpse sizing keeps every original body scale, viewport crop and source-pixel scale',()=>{
 for(const viewport of Object.values(STAGE_VIEWPORT_IDS))for(const depth of [.8,1]){
  const f=fixture(viewport,depth);
  for(const kind of spriteKinds)for(const side of ['human','zombie']){
   const frame=spriteFrameFor(kind,'idle','right'),fitted=fitSpriteBattleDisplaySize(kind,frame,spriteBattleDisplaySizeFor(kind));
   const scale=fitted.h/frame.sourceRect.h*f.compactSpriteScale(kind)*depth*sampleAnimationClip(kind,'idle',0).bodyScale;
   const dead=f.corpseSize({kind,side,y:280},{definition:{missionConfig:{v100StageNumber:1}}});
   const death=spriteFrameFor(kind,'death',side==='human'?'right':'left');
   assert.ok(Math.abs(dead.height/death.sourceRect.h-scale)<1e-10,kind+'/'+viewport);
   assert.ok(Math.abs(dead.width/death.sourceRect.w-scale)<1e-10,kind+'/'+viewport);
   const visibleHeight=(frame.contentRect?.h??frame.sourceRect.h)*scale;
   assert.ok(Math.abs(f.v102GoreBodyHeight({kind,y:280})-visibleHeight)<1e-10,kind+' Gore origin');
  }
 }
});

test('actual V1 gait measures travel against the rendered body scale',()=>{
 const f=fixture(STAGE_VIEWPORT_IDS.MOBILE_844_340,.9);
 for(const kind of spriteKinds){
  const frame=spriteFrameFor(kind,'walk-a','right'),size=v102BattleDisplaySize(kind,frame,spriteBattleDisplaySizeFor(kind));
  const scale=size.w*f.compactSpriteScale(kind)*.9*sampleAnimationClip(kind,'idle',0).bodyScale/frame.sourceRect.w;
  const expected=v177JointCycleDistance(kind,scale)??(v100UsesHumanWalk(kind,{requestedState:'move'})?v100HumanWalkCycleDistance(kind,scale):v102TravelCycleDistance(kind,(frame.contentRect?.h??frame.sourceRect.h)*scale));
  assert.equal(f.articulatedCycleDistanceFor({kind,y:280},true),expected,kind);
 }
});

test('legacy corpse sizing preserves its existing fitting and compact scale',()=>{
 for(const viewport of Object.values(STAGE_VIEWPORT_IDS)){
  const f=fixture(viewport,.85);
  for(const kind of spriteKinds){
   const frame=spriteFrameFor(kind,'death','left'),fit=fitSpriteBattleDisplaySize(kind,frame,spriteBattleDisplaySizeFor(kind));
   const expected=fit.h*(viewport===STAGE_VIEWPORT_IDS.STANDARD?1:COMPACT_BATTLE_SPRITE_SCALE)*.85;
   const actual=f.corpseSize({kind,side:'zombie',y:280},{definition:{missionConfig:{}}});
   assert.equal(actual.height,expected,kind);assert.equal(actual.bodyScale,1);
  }
 }
});
