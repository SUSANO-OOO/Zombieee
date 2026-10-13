import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,realpath,rm,stat,writeFile} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {chooseHumanDeploymentLane} from '../app/lanePlanner.js';

function prepareContactOutput(out) {
 const source=readFileSync(new URL('../scripts/v100-enemy-contact-motion-browser.mjs',import.meta.url),'utf8');
 const start=source.indexOf('const engine='),end=source.indexOf('\nconst report=');
 assert.ok(start>=0&&end>start);
 // Execute only the real directory setup, without importing or starting a browser.
 return vm.runInNewContext(`(async()=>{${source.slice(start,end)}\n})()`,{
  process:{env:{V100_ENEMY_MOTION_OUT:out}},assert,mkdir,dirname,
 });
}

async function withContactOutputFixture(run) {
 const parent=await realpath(tmpdir()),root=await mkdtemp(join(parent,'issue177-contact-output-'));
 try { await run(root); } finally {
  const resolved=await realpath(root);
  assert.equal(dirname(resolved),parent);
  assert.ok(basename(resolved).startsWith('issue177-contact-output-'));
  await rm(resolved,{recursive:true});
 }
}

test('standalone enemy contact QA prepares a missing output parent on a fresh runner',async()=>{
 await withContactOutputFixture(async root=>{
  const out=join(root,'outputs','v102-normal-contacts');
  await prepareContactOutput(out);
  assert.equal((await stat(out)).isDirectory(),true);
 });
});

test('enemy contact QA refuses an existing result directory without altering its evidence',async()=>{
 await withContactOutputFixture(async root=>{
  const out=join(root,'outputs','v102-normal-contacts'),sentinel=join(out,'report.json');
  await mkdir(out,{recursive:true});await writeFile(sentinel,'previous evidence\n');
  await assert.rejects(prepareContactOutput(out),{code:'EEXIST'});
  assert.equal(await readFile(sentinel,'utf8'),'previous evidence\n');
 });
});

function observerFixture() {
 const source=readFileSync(new URL('../scripts/v100-enemy-contact-motion-browser.mjs',import.meta.url),'utf8');
 const ast=ts.createSourceFile('observer.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let initializer;
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='page.addInitScript'&&node.arguments[0]?.getText(ast).includes('__ENEMY_CONTACT_MOTION__'))initializer=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}
 visit(ast);assert.ok(initializer);
 let next;
 const fighter={id:1,kind:'walker',hp:100,combatReady:true,attack:0,attackWindup:0,flash:0,renderDepthScale:1,renderAudit:{assetReady:true,renderSequence:0}};
 const snapshot={running:true,time:0,fighters:[fighter]};
 const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
 const canvas={width:844,height:340,getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/png;base64,AA=='};
 vm.runInNewContext(`(${initializer})();`,{window,document:{querySelector:()=>canvas,createElement:()=>({...canvas})},performance:{now:()=>snapshot.time*1000},requestAnimationFrame:callback=>{next=callback;}});
 return {audit:window.__ENEMY_CONTACT_MOTION__,fighter,tick(values={}){Object.assign(fighter,values);fighter.renderAudit.renderSequence++;snapshot.time+=1/60;next();}};
}

test('long movement and an already-proven enemy cannot consume the later enemy contact budget',()=>{
 const f=observerFixture();
 for(let i=0;i<6000;i++)f.tick();
 assert.equal(f.audit.rows.length,0);assert.equal(f.audit.skippedNonAttackSamples,6000);
 assert.equal(f.audit.timeline.length,90,'read-only battle diagnostics stay bounded');
 f.tick({attackWindup:.12});f.tick({attackWindup:0,attack:.12});f.tick({attack:.10});
 assert.equal(f.audit.rows.length,3);assert.equal(f.audit.completedKinds.join(','),'walker');
 for(let i=0;i<6000;i++)f.tick({attack:.1});
 assert.equal(f.audit.rows.length,3);
 f.tick({id:2,kind:'crusher',attack:0,attackWindup:.12});f.tick({attackWindup:0,attack:.12});f.tick({attack:.10});
 assert.equal(f.audit.rows.length,6);assert.equal(f.audit.completedKinds.join(','),'walker,crusher');
});

test('contacts from another individual or a flashed frame do not complete windup evidence',()=>{
 const f=observerFixture();
 f.tick({attackWindup:.12});
 f.tick({id:2,attackWindup:0,attack:.12});f.tick({attack:.10});
 assert.equal(f.audit.completedKinds.length,0);
 f.tick({attack:0,attackWindup:.12,flash:.2});f.tick({attackWindup:0,attack:.12,flash:0});
 assert.equal(f.audit.completedKinds.length,0);
 f.tick({attack:0,attackWindup:.12});
 assert.equal(f.audit.completedKinds.length,0);
 f.tick({attackWindup:0,attack:.12});f.tick({attack:.1});
 assert.equal(f.audit.completedKinds.join(','),'walker');
 assert.equal(f.audit.rows.length,8);
});

test('native contact deployment covers three lanes and counts pending launches in its limit',()=>{
 const source=readFileSync(new URL('../scripts/v100-enemy-contact-motion-browser.mjs',import.meta.url),'utf8');
 const ast=ts.createSourceFile('observer.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let stateReader,deployCondition;
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='page.evaluate'&&node.arguments[0]?.getText(ast).includes('humans:s.fighters'))stateReader=node.arguments[0].getText(ast);
  if(ts.isIfStatement(node)&&node.expression.getText(ast).includes('await nativeBattleTap'))deployCondition=node.expression.left.getText(ast);
  ts.forEachChild(node,visit);
 }
 visit(ast);assert.ok(stateReader);assert.ok(deployCondition);
 const snapshot={time:0,running:true,fighters:[],deployQueue:[]};
 const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot},__ENEMY_CONTACT_MOTION__:{completedKinds:['walker','crusher']}};
 const read=vm.runInNewContext(`(${stateReader})`,{window});
 const deploy=vm.runInNewContext(`(state)=>${deployCondition}`);
 assert.equal(deploy(read()),true);assert.equal(read().ready,true);
 const counts=[0,0,0],lanes=[];
 for(let id=1;id<=3;id++){const lane=chooseHumanDeploymentLane({laneCounts:counts});counts[lane]++;lanes.push(lane);snapshot.fighters.push({id,side:'human',hp:240});}
 assert.deepEqual(lanes,[1,0,2]);assert.equal(deploy(read()),false);
 snapshot.fighters[0].hp=0;assert.equal(deploy(read()),true);
 snapshot.deployQueue.push('guardian');assert.equal(deploy(read()),false,'a queued replacement reserves the third place');
 snapshot.deployQueue=[];snapshot.fighters.push({id:4,side:'zombie',hp:100});
 assert.equal(deploy(read()),true,'enemies and dead allies do not consume a deployment place');
 window.__ENEMY_CONTACT_MOTION__.completedKinds=['walker'];assert.equal(read().ready,false,'both same-owner attack proofs remain required');
});
