import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import {V100_BOSS_DEFEAT_ART} from '../app/v100BossDefeatArt.js';
import {V100_COMBAT_VFX_ART} from '../app/v100CombatVfx.js';
import {V100_BOSSES,V100_STAGE_IDS} from '../app/v100Registry.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {selectBattleArtworkPolicy} from '../app/pwaBattleArtworkContext.js';
import {bossDefeatFinaleSource,drawV100BossDefeatFinales} from '../app/v100BossDefeatFinaleVfx.js';
import {drawV100BossDefeat} from '../app/v100BossDefeatVfx.js';
import {V099_BOSS_DEFEAT_TIMELINE as timeline} from '../app/battlePresentationV099.js';

const art=V100_BOSS_DEFEAT_ART['gate-eater'];
const stage=V100_STAGE_IDS[V100_BOSSES.find(b=>b.id==='boss-gate-eater').stageNumber-1];
const plan=(paths=[],enemyKinds=['gate-eater'],extra={})=>requiredBattleAssetPlan({stageId:stage,formationKinds:['scout'],enemyKinds,verifiedBossDefeatPaths:paths,...extra});
const permitted=facts=>verifiedPwaArtworkPaths({artworks:V100_BOSS_DEFEAT_ART,gameBlocked:false,...facts});
const paths=value=>value.split('\n').filter(Boolean);

test('old, partial, wrong and unconsented generations create no new asset job; exact verified generation or explicit browser play can',()=>{
  const installedManifest={assets:[{path:art.path,hash:art.hash}]},storedHashes=new Set([art.hash]);
  const negative=[{}, {installedManifest:{assets:[]},storedHashes,browserPlayAccepted:true},
    {installedManifest,storedHashes:new Set()}, {installedManifest:{assets:[{path:art.path,hash:'old'}]},storedHashes},
    {installedManifest,storedHashes,gameBlocked:true}];
  for(const facts of negative){const value=permitted(facts);assert.equal(value,'');assert.equal(plan(paths(value)).stageObjects.some(o=>o.id===art.id),false);assert.equal(plan(paths(value)).paths.includes(art.path),false);}
  for(const facts of [{installedManifest,storedHashes},{browserPlayAccepted:true}]){
    const value=permitted(facts),result=plan(paths(value));assert.equal(value,art.path);
    assert.equal(result.stageObjects.filter(o=>o.id===art.id).length,1);assert.equal(result.paths.filter(p=>p===art.path).length,1);
  }
  assert.equal(permitted({installedManifest,storedHashes,baseUrl:'https://example.test/Zombieee/'}),art.path);
});

test('the optional atlas belongs only to actual prepared enemies, not all-sprite QA, every stage or the common VFX list',()=>{
  assert.equal(Object.values(V100_COMBAT_VFX_ART).includes(art.path),false);
  const enabled=plan([art.path]),baseline=plan();
  assert.equal(enabled.paths.length,baseline.paths.length+1);
  assert.deepEqual(enabled.sprites,baseline.sprites);assert.deepEqual(enabled.cards,baseline.cards);assert.deepEqual(enabled.persistent,baseline.persistent);
  for(const extra of [{},{includeAllSprites:true},{includeV100Sprites:false}])assert.equal(plan([art.path],['walker'],extra).paths.includes(art.path),false);
  assert.equal(plan([art.path],['gate-eater'],{includeV100Sprites:false}).paths.includes(art.path),false);
  const other=plan([art.path],['mother'],{stageId:V100_STAGE_IDS[10]});assert.equal(other.paths.includes(art.path),false);
});

test('same-battle retry never expands artwork on a late grant; a new selection can use it and revoked permission removes it',()=>{
  const original=selectBattleArtworkPolicy(null,'battle-a','');
  const retry=selectBattleArtworkPolicy(original,'battle-a',art.path);assert.equal(retry,original);
  assert.equal(plan(paths(retry.paths)).paths.includes(art.path),false);
  const next=selectBattleArtworkPolicy(retry,'battle-b',art.path);assert.equal(plan(paths(next.paths)).paths.includes(art.path),true);
  const revoked=selectBattleArtworkPolicy(next,'battle-b','');assert.equal(revoked.paths,'');assert.equal(plan(paths(revoked.paths)).paths.includes(art.path),false);
  assert.equal(next.paths,art.path,'Earlier policy was not mutated');assert.equal(selectBattleArtworkPolicy(revoked,'battle-b',art.path).paths,'');
});

function world(elapsed=1.6,label='gate-eater'){
  return {definition:{missionConfig:{v100StageNumber:6}},fighters:[{id:4,hp:0}],caps:87,
    battlePresentation:{effects:[{kind:'boss-defeat',label,x:640,y:280,elapsed,duration:timeline.durationSeconds,seed:73,ownerId:4,receiptId:'fighter:4'}]}};
}
function paint(width=844,height=340){
  const scale=Math.max(width/960,height/540),stack=[],calls=[];
  const ctx={matrix:[scale,0,0,scale,0,0],globalAlpha:.6,globalCompositeOperation:'multiply',shadowBlur:5,
    save(){stack.push({matrix:[...this.matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur});},
    restore(){const s=stack.pop();assert.ok(s);this.matrix=s.matrix;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;this.shadowBlur=s.shadow;},
    translate(x,y){const m=this.matrix;m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;},
    scale(x,y){this.matrix[0]*=x;this.matrix[1]*=x;this.matrix[2]*=y;this.matrix[3]*=y;},
    rotate(angle){assert.ok(Number.isFinite(angle));},
    drawImage(image,...args){assert.ok(image?.complete&&Number.isFinite(image.naturalWidth));assert.ok(args.every(Number.isFinite));
      const [x,y,w,h]=args.slice(-4),m=this.matrix,points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([a,b])=>[m[0]*a+m[2]*b+m[4],m[1]*a+m[3]*b+m[5]]);
      calls.push({id:image.id,args,alpha:this.globalAlpha,bounds:{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))}});}};
  const objects=Object.fromEntries([[art.id,1536,1024],['quality-boss-blast',1536,1024],['v100-dust',128,128],['v100-smoke-a',128,128],['v100-smoke-b',128,128]].map(([id,w,h])=>[id,{id,complete:true,naturalWidth:w,naturalHeight:h}]));
  return {ctx,calls,stack,objects,options:{viewportWidth:width,viewportHeight:height,worldScale:scale,density:.7}};
}

test('the actual early renderer advances all six painted cells, pauses on the existing clock and restores canvas and world',()=>{
  const cells=new Set();
  for(const elapsed of [1.03,1.11,1.28,1.55,1.9,2.24,2.59]){
    const g=world(elapsed),before=structuredClone(g),p=paint(),state={...p.ctx,matrix:[...p.ctx.matrix]};
    assert.equal(drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options),1);assert.deepEqual(g,before);
    assert.ok(p.calls.length>0&&p.calls.length<=2);for(const call of p.calls){assert.equal(call.id,art.id);assert.equal(call.args[2],512);assert.equal(call.args[3],512);assert.equal(call.args[6],call.args[7]);cells.add(call.args[0]/512+3*call.args[1]/512);}
    const first=structuredClone(p.calls);p.calls.length=0;drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options);assert.deepEqual(p.calls,first,'Repeated paused state paints the same frame');
    assert.deepEqual(p.ctx,state);assert.equal(p.stack.length,0);
  }
  assert.deepEqual([...cells].sort(),[0,1,2,3,4,5]);
});

test('missing/failed art keeps the old painted finale, while ready art paints once behind bodies without a second late major or smoke tail',()=>{
  const g=world(2),e=g.battlePresentation.effects[0];
  for(const mode of ['absent','failed','bad-grid']){
    const p=paint();if(mode==='absent')delete p.objects[art.id];else if(mode==='failed')p.objects[art.id].complete=false;else p.objects[art.id].naturalWidth=1535;
    assert.equal(bossDefeatFinaleSource(p.objects,'gate-eater'),null);assert.equal(drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options),0);
    drawV100BossDefeat(p.ctx,p.objects,e,.7);assert.ok(p.calls.some(c=>c.id==='quality-boss-blast'));
  }
  const p=paint();drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options);assert.ok(p.calls.some(c=>c.id===art.id));const count=p.calls.length;
  drawV100BossDefeat(p.ctx,p.objects,e,.7);assert.equal(p.calls.length,count,'No duplicate late major or old smoke tail');
  const a=paint(),b=paint();delete b.objects[art.id];drawV100BossDefeat(a.ctx,a.objects,{...e,label:'mother'},.7);drawV100BossDefeat(b.ctx,b.objects,{...e,label:'mother'},.7);assert.deepEqual(a.calls,b.calls,'Unrelated boss remains unchanged');
});

test('the actual transformed image rectangle stays within18% for phone viewports, mirrors and two separate bosses',()=>{
  for(const [width,height]of [[640,340],[740,220],[844,340],[844,390]])for(const x of [290,670]){
    const p=paint(width,height),g=world();g.battlePresentation.effects[0].x=x;drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options);
    for(const c of p.calls)assert.ok((c.bounds.right-c.bounds.left)*(c.bounds.bottom-c.bounds.top)/(width*height)<=.18+1e-9);
    assert.equal(p.stack.length,0);
  }
  const p=paint(740,220),g=world();
  g.battlePresentation.effects[0].x=290;g.battlePresentation.effects.push({...g.battlePresentation.effects[0],x:670,ownerId:5,receiptId:'fighter:5'});
  assert.equal(drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options),2);
  assert.ok(p.calls.length<=4);assert.equal(p.stack.length,0);
});

test('invalid event and viewport boundaries do not draw or consume the existing simulation event',()=>{
  for(const change of [{elapsed:1},{elapsed:2.6},{elapsed:NaN},{duration:1},{kind:'explosion'},{label:'mother'},{x:NaN},{seed:NaN}]){
    const p=paint(),g=world();Object.assign(g.battlePresentation.effects[0],change);const before=structuredClone(g);
    assert.equal(drawV100BossDefeatFinales(p.ctx,p.objects,g,p.options),0);assert.equal(p.calls.length,0);assert.deepEqual(g,before);
  }
  for(const change of [{viewportWidth:0},{viewportHeight:NaN},{worldScale:0},{density:0}]){const p=paint();assert.equal(drawV100BossDefeatFinales(p.ctx,p.objects,world(),{...p.options,...change}),0);assert.equal(p.calls.length,0);}
});

test('the source-bound runtime image is in the pack and the real world pass draws it before bodies and the late presentation pass',async()=>{
  const bytes=fs.readFileSync('public'+art.path),meta=await sharp(bytes).metadata();assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[1536,1024,true]);
  assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),art.hash);
  const manifest=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8'));assert.equal(manifest.assets.find(a=>a.path===art.path)?.hash,art.hash);
  const source=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const draw=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawWorld');assert.ok(draw);
  const calls=[];function visit(n){if(ts.isCallExpression(n))calls.push({name:n.expression.getText(tree),at:n.getStart(tree)});ts.forEachChild(n,visit);}visit(draw);
  const early=calls.filter(c=>c.name==='drawV100BossDefeatFinales');assert.equal(early.length,1);
  for(const name of ['drawCrawler','drawEnemyBase','drawSpriteFighter','drawBattlePresentationEffects'])assert.ok(early[0].at<calls.find(c=>c.name===name).at,name+' remains in front');
});
