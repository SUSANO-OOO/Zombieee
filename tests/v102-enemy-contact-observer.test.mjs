import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

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
