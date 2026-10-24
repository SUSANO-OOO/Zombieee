import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {packBuild,restoreBuild} from '../scripts/v177-native-allunit-build.mjs';
import {productionBuildIdentity} from '../scripts/browser-qa-build-identity.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const base=await mkdtemp(path.join(os.tmpdir(),'v177-build-shared-'));
const binding={head:'1'.repeat(40),tree:'2'.repeat(40),repository:'susano-ooo/zombieee',runId:'39085861430',runAttempt:'1'};
async function put(root,file,bytes){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),bytes);}
async function fixture(){
  const dir=await mkdtemp(path.join(base,'case-')),producer=path.join(dir,'producer'),consumer=path.join(dir,'consumer'),bundle=path.join(dir,'bundle');
  const source={'public/art/unit.webp':Buffer.from([82,73,70,70,1,2,3]),'public/sw.js':Buffer.from('source-public-sw')};
  const sourceBlobs=new Map(Object.entries(source).map(([p,b])=>[p,blob(b)]));
  for(const [p,b]of Object.entries(source)){await put(producer,p,b);await put(consumer,p,b);}
  for(const [p,b]of Object.entries({'server/index.js':'export const a=1;','client/.vite/manifest.json':'{}','client/assets/app.js':'export const a=2;','client/art/unit.webp':source['public/art/unit.webp'],'client/sw.js':'built-versioned-sw'}))await put(producer,'dist/'+p,b);
  const packed=await packBuild({root:producer,bundle,binding,sourceBlobs});
  return{dir,producer,consumer,bundle,sourceBlobs,packed,opts:{root:consumer,bundle,binding,sourceBlobs,expectedReceiptSha256:packed.receiptSha256,expectedDistSha256:packed.distSha256}};
}
test('shared build restores every original byte while transporting only files not identical to committed public sources',async()=>{
  const f=await fixture(),r=await restoreBuild(f.opts);
  assert.equal(r.sourceFiles,1);assert.equal(r.payloadFiles,4);assert.equal(f.packed.sourceBytes,7);
  assert.deepEqual(await productionBuildIdentity(f.consumer),await productionBuildIdentity(f.producer));
  assert.equal(await readFile(path.join(f.consumer,'dist/client/sw.js'),'utf8'),'built-versioned-sw');
});
test('wrong producer head, tree, run, receipt and recursive build hash cannot be adopted',async()=>{
  const f=await fixture();
  for(const key of ['head','tree','runId','runAttempt','repository'])await assert.rejects(restoreBuild({...f.opts,binding:{...binding,[key]:key==='head'||key==='tree'?'3'.repeat(40):'wrong'}}));
  await assert.rejects(restoreBuild({...f.opts,expectedReceiptSha256:'0'.repeat(64)}));
  await assert.rejects(restoreBuild({...f.opts,expectedDistSha256:'0'.repeat(64)}));
});
test('corrupted compiled files and modified committed sources fail rather than starting capture',async()=>{
  for(const kind of ['payload','source','gitBlob']){
    const f=await fixture();
    if(kind==='payload')await writeFile(path.join(f.bundle,'payload/client/assets/app.js'),'bad');
    else if(kind==='source')await writeFile(path.join(f.consumer,'public/art/unit.webp'),Buffer.from([82,73,70,70,9,9,9]));
    else f.sourceBlobs.set('public/art/unit.webp','0'.repeat(40));
    await assert.rejects(restoreBuild(f.opts));
  }
});
test('extra payload, duplicate paths and traversal cannot widen the restored build',async()=>{
  for(const kind of ['extra','duplicate','traversal']){
    const f=await fixture();
    if(kind==='extra')await put(f.bundle,'payload/unlisted.js','x');
    else{
      const p=path.join(f.bundle,'receipt.json'),r=JSON.parse(await readFile(p,'utf8'));
      if(kind==='duplicate')r.entries[1].path=r.entries[0].path;else r.entries[0].path='../escape';
      const b=Buffer.from(JSON.stringify(r)+'\n');await writeFile(p,b);f.opts.expectedReceiptSha256=hash(b);
    }await assert.rejects(restoreBuild(f.opts));
  }
});
