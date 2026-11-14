import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {V100_BOSS_ATTACK_ART as ART} from '../app/v100BossAttackArt.js';
import {bossAttackReleaseSource,drawV100BossAftermath} from '../app/v100BossAftermath.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const image=(id,width=1536,height=1024)=>({id,complete:true,naturalWidth:width,naturalHeight:height});
const fallback=()=>image('v100-ground-impact');

test('each boss selects its own decoded paint and leaves the real owner untouched',()=>{
 for(const [kind,art]of Object.entries(ART)){
  const owner={id:21,hp:140,stationAbility:{phase:'active',remainingSeconds:1}},before=structuredClone(owner);
  const preferred=image(art.id),objects={'v100-ground-impact':fallback(),[art.id]:preferred};
  assert.equal(bossAttackReleaseSource(objects,kind,owner).image,preferred);
  delete objects[art.id];
  assert.equal(bossAttackReleaseSource(objects,kind,owner).image,preferred,'running boss keeps its chosen source');
  assert.deepEqual(owner,before);
 }
});

test('late optional decode waits for a new real owner, including owners with the same numeric id',()=>{
 const art=ART.mother,old=fallback(),objects={'v100-ground-impact':old},owner={id:7};
 assert.equal(bossAttackReleaseSource(objects,'mother',owner).image,old);
 objects[art.id]=image(art.id);
 assert.equal(bossAttackReleaseSource(objects,'mother',owner).image,old);
 assert.equal(bossAttackReleaseSource(objects,'mother',{id:7}).image,objects[art.id]);
});

test('missing, undecoded and malformed optional sheets use the existing release',()=>{
 const art=ART.gairen;
 for(const candidate of [undefined,{...image(art.id),complete:false},image(art.id,0,0),image(art.id,1535,1024),image(art.id,1536,512),image(art.id,Infinity,1024)]){
  const old=fallback(),objects={'v100-ground-impact':old,[art.id]:candidate};
  assert.equal(bossAttackReleaseSource(objects,'gairen',{}).image,old);
 }
});

test('only the actual stage boss and explicitly permitted paths enter optional loading',()=>{
 const paths=Object.values(ART).map(a=>a.path),stageId=V100_STAGE_IDS[10];
 const plan=requiredBattleAssetPlan({stageId,enemyKinds:['mother'],verifiedBossAttackPaths:paths});
 const selected=plan.stageObjects.filter(a=>a.id.startsWith('v100-boss-attack-'));
 assert.deepEqual(selected.map(a=>a.id),[ART.mother.id]);
 assert.equal(selected[0].optional,true);
 for(const options of [{enemyKinds:['mother']},{enemyKinds:['walker'],verifiedBossAttackPaths:paths}]){
  assert.equal(requiredBattleAssetPlan({stageId,...options}).stageObjects.filter(a=>a.id.startsWith('v100-boss-attack-')).length,0);
 }
});

test('an old committed pack cannot fetch the new effects, even with browser play accepted',()=>{
 for(const art of Object.values(ART)){
  const facts={artwork:art,gameBlocked:false,storedHashes:new Set([art.hash]),browserPlayAccepted:true};
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[]}}),false);
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:art.path,hash:'old'}]}}),false);
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:art.path,hash:art.hash}]},storedHashes:new Set()}),false);
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:art.path,hash:art.hash}]}}),true);
 }
});

test('a preferred release blends adjacent painted cells and preserves the existing end and recovery',()=>{
 const art=ART['takuya-omega'],calls=[],stack=[],ctx={globalAlpha:1,globalCompositeOperation:'screen',shadowBlur:3,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(){},rotate(){},scale(){},drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
 const objects=Object.fromEntries(['v100-ground-impact','v100-dust','v100-smoke-a','v100-smoke-b'].map(id=>[id,image(id)]));
 objects[art.id]=image(art.id);const owner={},entry={kind:'takuya-omega',x:400,y:250,elapsed:.1,duration:1.1,phase:'active',seed:17,owner};
 assert.equal(drawV100BossAftermath(ctx,objects,entry),true);
 const painted=calls.filter(c=>c.args[0]===objects[art.id]);assert.equal(painted.length,2);
 assert.ok(painted.every(c=>c.args.slice(1).every(Number.isFinite)&&c.alpha>0&&c.alpha<=1));
 assert.ok(Math.abs(painted.reduce((n,c)=>n+c.alpha,0)-1)<1e-9);
 assert.equal(ctx.globalAlpha,1);assert.equal(ctx.globalCompositeOperation,'screen');assert.equal(ctx.shadowBlur,3);assert.equal(stack.length,0);
 for(const patch of [{elapsed:.7},{phase:'recovery',elapsed:.1}]){
  calls.length=0;drawV100BossAftermath(ctx,objects,{...entry,...patch});
  assert.equal(calls.filter(c=>c.args[0]===objects[art.id]).length,0,'release does not restart in the same active/recovery interval');
 }
});

test('PwaGate imports only the generated data leaf for this family',async()=>{
 const leaf=await readFile(new URL('../app/v100BossAttackArt.js',import.meta.url),'utf8');
 assert.doesNotMatch(leaf,/^\s*import(?:\s|\{)/mu);
 const gate=await readFile(new URL('../app/PwaGate.tsx',import.meta.url),'utf8');
 assert.match(gate,/import \{V100_BOSS_ATTACK_ART\} from "\.\/v100BossAttackArt\.js"/u);
 assert.match(gate,/artworks: V100_BOSS_ATTACK_ART/u);
});
