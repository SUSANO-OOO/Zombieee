import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {V100_R9_SCENE_ASSETS} from '../app/v100R9SceneAssets.js';
import {V100_R5_STORY_CUTS} from '../app/v100StoryDirection.js';
import {V177_PAISEN_STORY_REPLACEMENTS} from '../scripts/v177-paisen-story-asset-contract.mjs';
import {createV100DialogueFixture} from '../scripts/v100-dialogue-fixture.mjs';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {serializeV100Save} from '../app/v100Save.js';
const source=fs.readFileSync(new URL('../scripts/v100-dialogue-composition-browser.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('composition.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declaration=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='revisedLegacyCutCases');
const all=Object.entries(V100_STORY_EVENTS).flatMap(([eventId,event])=>event.nodes.map((node,nodeIndex)=>({eventId,nodeIndex,node})));
const build=vm.runInNewContext('('+declaration.getText(tree)+')',{assert,all,V100_R5_STORY_CUTS,V177_PAISEN_STORY_REPLACEMENTS});

test('the actual new legacy fixtures bind both revised R5 images to current R9 nodes and valid durable saves',()=>{
 const cases=Array.from(build());assert.equal(cases.length,2);
 assert.deepEqual(cases.map(c=>c.id).sort(),['revised-chiha-confession','revised-ending-tky-transport']);
 for(const fixture of cases){
  const nodes=V100_STORY_EVENTS[fixture.eventId].nodes,node=nodes[fixture.nodeIndex],page=v100StoryPageFor(fixture.eventId,nodes,fixture.nodeIndex);
  assert.equal(node.cutId,page.node.cutId);assert.equal(V100_R5_STORY_CUTS[node.cutId],fixture.backdrop);
  assert.ok(V177_PAISEN_STORY_REPLACEMENTS.some(r=>r.path===fixture.backdrop));
  assert.doesNotThrow(()=>serializeV100Save(createV100DialogueFixture(fixture)));
 }
});

function caseExpression(text) {
 const parsed=ts.createSourceFile('composition.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 for(const n of parsed.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(parsed)==='cases')return d.initializer.getText(parsed).replace(/\s/gu,'');
 throw new Error('Missing production fixture list');
}
test('the same composition lane retains every original fixture and now covers all nine revised painted sources',()=>{
 const prior=execFileSync('git',['show','a92a48c81b76307d2095a9771f7a7bed16ac8177:scripts/v100-dialogue-composition-browser.mjs'],{encoding:'utf8',maxBuffer:2e6});
 const expression=caseExpression(source);assert.ok(expression.includes('...revisedLegacyCases,'));
 assert.equal(expression.replace('...revisedLegacyCases,',''),caseExpression(prior),'No original new cut, insert, owner or boundary case may be removed');
 const revised=Array.from(build()),covered=new Set([...Object.values(V100_R9_SCENE_ASSETS).map(a=>a.path),...revised.map(c=>c.backdrop)]);
 assert.equal(V177_PAISEN_STORY_REPLACEMENTS.length,9);assert.ok(V177_PAISEN_STORY_REPLACEMENTS.every(r=>covered.has(r.path)));
});
