import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,lstat,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim();
function relativeFile(p){
  assert.equal(typeof p,'string');assert.ok(p.length>0&&!p.includes('\\')&&!p.includes('\0'));
  assert.ok(!path.posix.isAbsolute(p)&&p.split('/').every(v=>v&&v!=='.'&&v!=='..'),'Bounded relative file required');return p;
}
async function files(root,prefix=''){
  const rows=[];
  for(const entry of (await readdir(path.join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const p=prefix?prefix+'/'+entry.name:entry.name;assert.equal(entry.isSymbolicLink(),false,'Symlink is not a bundle file');
    if(entry.isDirectory())rows.push(...await files(root,p));else{assert.ok(entry.isFile());rows.push(p);}
  }return rows;
}
function sameBinding(receipt,expected){
  assert.equal(receipt.schema,'v177-native-allunit-build/v1');
  for(const key of ['head','tree','repository','runId','runAttempt'])assert.equal(receipt.binding[key],expected[key],'Build owner differs: '+key);
  assert.match(expected.head,/^[0-9a-f]{40}$/u);assert.match(expected.tree,/^[0-9a-f]{40}$/u);
}
export async function buildBinding(root=process.cwd(),env=process.env){
  assert.equal(env.GITHUB_ACTIONS,'true');assert.ok(['pull_request','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME));assert.ok(['linux','darwin'].includes(process.platform),'Remote build/capture only');
  assert.match(env.V177_EXPECTED_HEAD_SHA??'',/^[0-9a-f]{40}$/u);
  for(const k of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])assert.match(env[k]??'',/^[1-9][0-9]{0,19}$/u);
  const event=JSON.parse(await readFile(env.GITHUB_EVENT_PATH,'utf8'));
  assertBuildEventHead(env,event);
  assert.equal(env.GITHUB_REPOSITORY?.toLowerCase(),'susano-ooo/zombieee');
  assert.equal(event.repository?.full_name?.toLowerCase(),env.GITHUB_REPOSITORY.toLowerCase());
  const head=git(root,['rev-parse','HEAD']);assert.equal(head,env.V177_EXPECTED_HEAD_SHA);
  git(root,['diff','--quiet','HEAD','--']);
  return{head,tree:git(root,['rev-parse','HEAD^{tree}']),repository:env.GITHUB_REPOSITORY.toLowerCase(),runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT};
}
export function assertBuildEventHead(env,event){
  assert.ok(['pull_request','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME));
  assert.match(env.V177_EXPECTED_HEAD_SHA??'',/^[0-9a-f]{40}$/u);
  const head=env.GITHUB_EVENT_NAME==='pull_request'?event.pull_request?.head?.sha:event.inputs?.expected_head;
  assert.equal(head,env.V177_EXPECTED_HEAD_SHA,'Build must bind to the original candidate request');
}
export function committedFiles(root){
  return new Map(git(root,['ls-tree','-r','--full-tree','HEAD','--','public']).split('\n').filter(Boolean).map(line=>{
    const [meta,file]=line.split('\t'),[mode,,gitBlob]=meta.split(' ');assert.equal(mode,'100644');return[file,gitBlob];
  }));
}
export async function packBuild({root,bundle,binding,sourceBlobs}){
  const before=await productionBuildIdentity(root);await mkdir(bundle,{recursive:false});
  const entries=[];
  for(const file of await files(path.join(root,'dist'))){
    relativeFile(file);const data=await readFile(path.join(root,'dist',file));
    const row={path:file,bytes:data.length,sha256:hash(data),kind:'built'};
    const sourceFile=file.startsWith('client/')?'public/'+file.slice(7):null;
    if(sourceFile&&sourceBlobs.has(sourceFile)){
      const source=await readFile(path.join(root,sourceFile));assert.equal(blob(source),sourceBlobs.get(sourceFile),'Public source changed after checkout');
      if(data.equals(source))Object.assign(row,{kind:'committed-public',sourceFile,gitBlob:sourceBlobs.get(sourceFile)});
    }
    if(row.kind==='built'){
      const dest=path.join(bundle,'payload',file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,data,{flag:'wx'});
    }entries.push(row);
  }
  assert.deepEqual(await productionBuildIdentity(root),before,'Build changed while packaging');
  const receipt={schema:'v177-native-allunit-build/v1',binding,producer:{node:process.version,platform:process.platform},build:before,entries};
  const bytes=Buffer.from(JSON.stringify(receipt)+'\n');await writeFile(path.join(bundle,'receipt.json'),bytes,{flag:'wx'});
  return{receiptSha256:hash(bytes),distSha256:before.combinedSha256,files:entries.length,payloadBytes:entries.filter(e=>e.kind==='built').reduce((s,e)=>s+e.bytes,0),sourceBytes:entries.filter(e=>e.kind==='committed-public').reduce((s,e)=>s+e.bytes,0)};
}
export async function restoreBuild({root,bundle,binding,sourceBlobs,expectedReceiptSha256,expectedDistSha256}){
  assert.match(expectedReceiptSha256??'',/^[0-9a-f]{64}$/u);assert.match(expectedDistSha256??'',/^[0-9a-f]{64}$/u);
  const bytes=await readFile(path.join(bundle,'receipt.json'));assert.equal(hash(bytes),expectedReceiptSha256,'Receipt differs from producer job output');
  const receipt=JSON.parse(bytes);sameBinding(receipt,binding);assert.equal(receipt.build.combinedSha256,expectedDistSha256);
  assert.ok(Array.isArray(receipt.entries)&&receipt.entries.length===receipt.build.fullDist.files);
  const wanted=[],seen=new Set();
  for(const e of receipt.entries){
    relativeFile(e.path);assert.equal(seen.has(e.path),false,'Duplicate dist entry');seen.add(e.path);
    assert.ok(Number.isSafeInteger(e.bytes)&&e.bytes>=0);assert.match(e.sha256,/^[0-9a-f]{64}$/u);
    if(e.kind==='built')wanted.push(e.path);else{
      assert.equal(e.kind,'committed-public');assert.equal(e.sourceFile,'public/'+e.path.slice(7));assert.ok(e.path.startsWith('client/'));
      relativeFile(e.sourceFile);assert.equal(sourceBlobs.get(e.sourceFile),e.gitBlob,'Source file belongs to a different checkout');
    }
  }
  assert.deepEqual((await files(path.join(bundle,'payload'))).sort(),wanted.sort(),'Payload files differ from the exact manifest');
  // The capture checkout is clean: never merge this build with an existing dist.
  await mkdir(path.join(root,'dist'),{recursive:false});
  for(const e of receipt.entries){
    const source=e.kind==='built'?path.join(bundle,'payload',e.path):path.join(root,e.sourceFile);
    assert.equal((await lstat(source)).isFile(),true);const data=await readFile(source);
    assert.equal(data.length,e.bytes);assert.equal(hash(data),e.sha256,'Build/source bytes differ: '+e.path);
    if(e.kind==='committed-public')assert.equal(blob(data),e.gitBlob);
    const dest=path.join(root,'dist',e.path);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,data,{flag:'wx'});
  }
  const actual=await productionBuildIdentity(root);assert.deepEqual(actual,receipt.build,'Restored recursive dist differs from producer');
  return{schema:'v177-native-allunit-build-consumption/v1',binding,consumer:{node:process.version,platform:process.platform},receiptSha256:hash(bytes),build:actual,sourceFiles:receipt.entries.filter(e=>e.kind==='committed-public').length,payloadFiles:wanted.length};
}
async function main(){
  const [mode,bundle,out]=process.argv.slice(2),root=process.cwd(),binding=await buildBinding(root),sourceBlobs=committedFiles(root);
  assert.ok(['pack','restore'].includes(mode));assert.ok(bundle);
  if(mode==='pack'){
    await mkdir(path.dirname(bundle),{recursive:true});const result=await packBuild({root,bundle,binding,sourceBlobs});
    assert.ok(process.env.GITHUB_OUTPUT);await writeFile(process.env.GITHUB_OUTPUT,'receipt_sha256='+result.receiptSha256+'\ndist_sha256='+result.distSha256+'\n',{flag:'a'});console.log(JSON.stringify(result));
  }else{
    assert.ok(out);const result=await restoreBuild({root,bundle,binding,sourceBlobs,expectedReceiptSha256:process.env.V177_EXPECTED_BUILD_RECEIPT_SHA256,expectedDistSha256:process.env.V177_EXPECTED_BUILD_SHA256});
    await mkdir(out,{recursive:true});await writeFile(path.join(out,'build-bundle-consumption.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    await copyFile(path.join(bundle,'receipt.json'),path.join(out,'build-bundle-receipt.json'));console.log(JSON.stringify(result));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error);process.exitCode=1;});
