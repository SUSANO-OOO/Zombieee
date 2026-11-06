import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {v100QualityScenePathFor} from '../app/v100QualitySceneAssets.js';
import {V177_PAISEN_STORY_REPLACEMENTS} from '../scripts/v177-paisen-story-asset-contract.mjs';
import {createV100DialogueFixture} from '../scripts/v100-dialogue-fixture.mjs';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {serializeV100Save} from '../app/v100Save.js';
const source=fs.readFileSync(new URL('../scripts/v100-dialogue-composition-browser.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('composition.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const all=Object.entries(V100_STORY_EVENTS).flatMap(([eventId,event])=>event.nodes.map((node,nodeIndex)=>({eventId,nodeIndex,node})));
const declares=(statement,name)=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(d=>d.name.getText(tree)===name);
const first=tree.statements.findIndex(n=>declares(n,'currentCuts'));
const last=tree.statements.findIndex(n=>declares(n,'cutCases'));
assert.ok(first>=0&&last>first,'Missing production active-cut fixture collection');
const build=()=>vm.runInNewContext(tree.statements.slice(first,last+1).map(n=>n.getText(tree)).join('\n')+'\nArray.from(cutCases)',{all,v100StoryDirectionFor});

test('the actual composition fixtures bind all 23 active cuts, including both R5 scenes, to current nodes and valid durable saves',()=>{
 const cases=Array.from(build());assert.equal(cases.length,23);
 assert.equal(new Set(cases.map(c=>c.id)).size,23);
 for(const id of ['chiha-confession','ending-tky-transport'])assert.ok(cases.some(c=>c.id===id),id);
 for(const fixture of cases){
  const nodes=V100_STORY_EVENTS[fixture.eventId].nodes,node=nodes[fixture.nodeIndex],page=v100StoryPageFor(fixture.eventId,nodes,fixture.nodeIndex);
  assert.equal(node.cutId,page.node.cutId);
  assert.equal(v100StoryDirectionFor(fixture.eventId,fixture.nodeIndex,node).backgroundPath,fixture.backdrop);
  assert.match(fixture.backdrop,/^\/art\/v100\/quality-20261028\/scenes\/[a-z0-9-]+-r1\.webp$/u);
  assert.doesNotThrow(()=>serializeV100Save(createV100DialogueFixture(fixture)));
 }
});

function caseExpression(text) {
 const parsed=ts.createSourceFile('composition.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 for(const n of parsed.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(parsed)==='cases')return d.initializer.getText(parsed).replace(/\s/gu,'');
 throw new Error('Missing production fixture list');
}
test('the same composition lane retains the original owner, insert and boundary fixtures and every active revised source',()=>{
 const prior=execFileSync('git',['show','a92a48c81b76307d2095a9771f7a7bed16ac8177:scripts/v100-dialogue-composition-browser.mjs'],{encoding:'utf8',maxBuffer:2e6});
 assert.equal(caseExpression(source),caseExpression(prior),'No original insert, owner or boundary fixture may be removed');
 const covered=new Set(Array.from(build()).map(c=>c.backdrop));
 const active=new Set(all.map(({eventId,nodeIndex,node})=>v100StoryDirectionFor(eventId,nodeIndex,node).backgroundPath).filter(p=>p?.includes('/quality-20261028/scenes/')));
 assert.deepEqual([...covered].sort(),[...active].sort());
 assert.equal(V177_PAISEN_STORY_REPLACEMENTS.length,9);
 for(const row of V177_PAISEN_STORY_REPLACEMENTS){const path=v100QualityScenePathFor(row.path);if(active.has(path))assert.ok(covered.has(path),path);}
});
