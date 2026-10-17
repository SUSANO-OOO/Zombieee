import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {V100_STORY_EVENTS,V100_STORY_SCRIPT_VERSION,V100_STORY_SOURCE_SHA256} from '../app/v100StoryEvents.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {V100_AUDIO_MANIFEST} from '../app/productionAudio.js';
import {V100_R9_INSERTS,v100StoryInsertFor} from '../app/v100StoryInserts.js';
import {V100_R9_SCENE_ASSETS} from '../app/v100R9SceneAssets.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {createV100StoryFlowState,shouldAutoSkipV100StoryEvent,v100StoryFlowCheckpoint} from '../app/v100StoryFlow.js';
import {createDefaultV100Save,markV100EventRead,normalizeV100Save,validateV100SavePayload} from '../app/v100Save.js';

const sourcePath='docs/story/v10/STORY_SCRIPT_V100_PRODUCER_R9.md';
const nodes=Object.values(V100_STORY_EVENTS).flatMap(event=>event.nodes);
test('R9 round-trips all 1116 narrative source lines exactly once and in order',async()=>{
 const source=await readFile(sourcePath),lines=source.toString('utf8').split(/\r?\n/u);
 assert.equal(createHash('sha256').update(source).digest('hex'),'e4e01bef66d518e5c97f2b7de04b6a3607a3a9ee30619675b15e1c4a89ee7c34');
 assert.equal(V100_STORY_SOURCE_SHA256,createHash('sha256').update(source).digest('hex'));
 const current=nodes.filter(node=>node.sourceDocument==='STORY_SCRIPT_V100_PRODUCER_R9.md');
 assert.equal(current.length,1115);
 const consumed=current.flatMap(node=>node.sourceLines);
 const expected=lines.flatMap((line,i)=>line.trim()&&!line.startsWith('#')?[i+1]:[]);
 assert.equal(expected.length,1116);assert.deepEqual(consumed,expected);assert.equal(new Set(consumed).size,consumed.length);
 for(const node of current){
  const original=node.sourceLines.map(line=>lines[line-1].trim()).join('\n');
  const reconstructed=node.kind==='dialogue'?`**${node.speaker}**「${node.text}」`:node.kind==='action'?node.text:
   `**${node.kind==='system'?'案内表示':node.kind==='boss-marker'?'ボス名表示':'戦闘開始表示'}**　${node.text}`;
  assert.equal(reconstructed.replace(/\*\*\s+/gu,'** '),original.replace(/\*\*\s+/gu,'** '),node.sourceKey);
 }
 assert.equal(V100_STORY_EVENTS['v100:event:ending'].nodes.at(-1).sourceLine,2417);
 assert.equal(V100_STORY_EVENTS['v100:event:epilogue'].nodes.length,0);
});

test('R9 importer is deterministic and malformed revisions preserve the previous artifact',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'v100-r9-')),input=path.join(dir,'story.md'),output=path.join(dir,'events.js');
 const source=await readFile(sourcePath,'utf8');
 const run=()=>spawnSync(process.execPath,['scripts/import-v100-producer-r9.mjs',input,output],{encoding:'utf8'});
 await writeFile(input,source);const positive=run();assert.equal(positive.status,0,positive.stderr);
 const generated=await readFile(output,'utf8');assert.equal(generated,await readFile('app/v100StoryEvents.js','utf8'));
 for(const malformed of [source.replace('## プロローグ','## 未知の場面'),source+'\n## プロローグ\n再登場\n',source.slice(0,source.indexOf('## エンディング')),source.replace('## エンディング','## エンディング\n**未対応マークアップ**'),source.replace('**パイセン**「','**パイセン**「\n\n')]){
  await writeFile(input,malformed);const result=run();assert.notEqual(result.status,0,result.stdout);assert.equal(await readFile(output,'utf8'),generated);
 }
});

test('all R9 stage scenes own valid foley and every authored insert has an accessible physical explanation',()=>{
 const used=new Set();
 for(const [id,event] of Object.entries(V100_STORY_EVENTS)){
  for(const node of event.nodes){
   if(node.cueId){
    const target=V100_AUDIO_MANIFEST.aliasById[node.cueId]?.targetId??node.cueId;
    const asset=V100_AUDIO_MANIFEST.assetById[target],pool=V100_AUDIO_MANIFEST.poolById[target];
    assert.ok(asset||pool,`${id}/${node.sourceKey}: ${node.cueId}`);
    if(pool) for(const assetId of pool.assetIds)assert.ok(V100_AUDIO_MANIFEST.assetById[assetId],assetId);
    assert.equal(node.kind,'action',`${node.sourceKey}: foley belongs to a physical action`);assert.doesNotMatch(node.cueId,/confirm|radio-open|terminal|return-marker/u);
   }
   if(node.insertId){assert.ok(V100_R9_INSERTS[node.insertId]);assert.ok(v100StoryInsertFor(node.insertId,node.sourceLine).alt.length>20);used.add(node.insertId);}
  }
  if(/^v100:event:s\d{2}:(pre|post)$/u.test(id)) assert.ok(event.nodes.some(node=>node.cueId),`${id} needs scene-bound physical sound`);
 }
 assert.deepEqual([...used].sort(),Object.keys(V100_R9_INSERTS).sort());
 assert.equal(v100StoryInsertFor('message-backlog',604).dated,false);assert.equal(v100StoryInsertFor('message-backlog',610).dated,true);
 assert.equal(v100StoryInsertFor('message-backlog',602).messageVisible,false);assert.equal(v100StoryInsertFor('message-backlog',604).messageVisible,true);
 assert.equal(v100StoryInsertFor('medical-observation',2351).observed,false);assert.equal(v100StoryInsertFor('medical-observation',2353).observed,true);
});

test('each new R9 illustration reaches its source action without being covered by a schematic',async()=>{
 const provenance=JSON.parse(await readFile('assets/source/v100/story-r9/runtime-provenance.json','utf8'));
 assert.equal(provenance.records.length,17);
 for(const record of provenance.records){
  const uses=nodes.filter(node=>node.cutId===record.id);
  assert.ok(uses.length,`${record.id}: unreachable scene`);
  assert.equal(uses[0].kind,'action',`${record.id}: first appearance belongs to the action`);
  for(const node of uses){
   assert.ok(!node.insertId,`${record.id}: illustration hidden by an insert`);
   const direction=v100StoryDirectionFor(null,0,node);
   assert.equal(direction.backgroundPath,V100_R9_SCENE_ASSETS[record.id].path);
   assert.equal(direction.backgroundAlt,record.alt);
  }
  const bytes=await readFile('public'+record.path);
  assert.equal(bytes.length,record.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),record.hash);
 }
 const at=line=>nodes.find(node=>node.sourceLine===line);
 for(const [line,cut] of [[125,'prologue-extinguisher-escape'],[271,'s01-nao-rescue'],[507,'s04-monkey-shutter'],[918,'s11-oxygen-rescue'],[1395,'s17-chiha-baba-reunion'],[1614,'s19-seven-second-crossing'],[1844,'s22-zakimiya-holds-son'],[1919,'s23-chiha-evidence-send'],[2148,'s27-takuya-conditioning'],[2320,'s30-three-samples'],[2385,'ending-chiha-baba-distance'],[2415,'ending-plates-and-karaage']])assert.equal(at(line).cutId,cut,`${line}`);
 for(const line of [123,261,499,916,1385,1838,1917,2144,2318,2383,2413])assert.equal(at(line)?.cutId??null,null,`${line}: do not reveal the action early`);
});

test('pagination cannot swallow an authored sound or cross a new cut boundary',()=>{
 for(const id of ['v100:event:prologue','v100:event:s01:pre']){
  const event=V100_STORY_EVENTS[id];let index=0;
  while(index<event.nodes.length){const page=v100StoryPageFor(id,event.nodes,index);assert.ok(page.leadingActions.every(node=>!node.cueId));assert.ok(page.leadingActions.every(node=>node.cutId===page.node?.cutId&&node.insertId===page.node?.insertId));index=page.endIndex+1;}
 }
});

test('R5 cursors and read receipts migrate without changing progression, settings or rewards',()=>{
 const save=createDefaultV100Save({playerName:'テスト'}),id='v100:event:s02:pre';
 Object.assign(save,{campaignStarted:true,caps:537,completedStageIds:[V100_STAGE_IDS[0]],availableStageIds:V100_STAGE_IDS.slice(0,2),readStoryEventIds:[id],receipts:['v100:existing-receipt'],
  flowState:{phase:'event',eventId:id,stageId:V100_STAGE_IDS[1],stageNumber:2,nodeIndex:8},eventCursor:{eventId:id,phase:'event',nodeIndex:8,nodeKey:id+':8'}});
 const before=structuredClone(save);assert.deepEqual(validateV100SavePayload(save).errors,[]);
 const normalized=normalizeV100Save(save),flow=createV100StoryFlowState({...normalized});
 assert.equal(flow.eventId,id);assert.equal(flow.nodeIndex,0);assert.equal(shouldAutoSkipV100StoryEvent(flow,{enabled:true}),false,'old read receipts cannot skip revised dialogue');
 for(const key of ['caps','receipts','completedStageIds','ownedUnitIds','formationSlots','settings','readStoryEventIds'])assert.deepEqual(normalized[key],before[key],key);
 const checkpoint=v100StoryFlowCheckpoint(flow,4),reopened=createV100StoryFlowState({...normalized,...checkpoint});assert.equal(reopened.nodeIndex,4);assert.equal(checkpoint.eventCursor.scriptVersion,V100_STORY_SCRIPT_VERSION);
 const read=markV100EventRead(normalized,id);assert.equal(read.applied,true);assert.deepEqual(read.save.readStoryEventIds,[id]);assert.equal(read.save.readStoryVersions[id],V100_STORY_SCRIPT_VERSION);assert.equal(markV100EventRead(read.save,id).duplicate,true);
});
