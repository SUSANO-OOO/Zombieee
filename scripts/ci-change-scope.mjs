import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {immutablePrProvenance,readSingleTextArchive} from './ci-pr-provenance.mjs';

// These are existing acceptance lanes, not new quality criteria.
export const LANE_JOBS=Object.freeze({
 verify_full:['Build and Node Checks'],
 ranger:['Ranger Turn Regression'],
 normal:['V1 Representative Normal Play (chromium)','V1 Representative Normal Play (webkit)'],
 performance:['V1 WebKit Frame and Boss Performance'],
 phaseg:['V1 Phase G Production Matrix'],
 r9:['chromium','webkit'].flatMap(engine=>[
  ...['composition','bookends'].map(phase=>'R9 Story ('+engine+', '+phase+', )'),
  ...['1280x720','844x390','844x340'].map(view=>'R9 Story ('+engine+', full-story, '+view+')')]),
 combat:['V1.0.2 Combat (chromium)','V1.0.2 Combat (webkit desktop-phone)','V1.0.2 Combat (webkit phone-short)','V1.0.2 Combat (webkit)'],
 audio:['V1.0.3 Media Output (chromium)','V1.0.3 Media Output (webkit)'],
 legacy:['V1 Ordinary Enemy Contacts (chromium)','V1 Ordinary Enemy Contacts (webkit)',
  'V1 Native WebKit PWA Update and Recovery','WebKit Hosted Runner Evidence',
  ...['01','02','03','04','05','06'].map(n=>'WebKit Enemy Runtime Evidence ('+n+')'),
  ...['667x375','736x414','844x390','844x340','932x430','1280x720'].flatMap(v=>[
   'WebKit Deployment Viewport Evidence ('+v+')','WebKit Canonical Viewport Evidence ('+v+')']),
  ...['entrance-candidate','final-candidate','final-base'].map(n=>'WebKit Stage 3 Audio Route ('+n+')')],
 quality:['V1 Quality UI and Play (chromium)','V1 Quality UI and Play (webkit)'],
 allunit:['Native Motion Build',...Array.from({length:12},(_,i)=>'Native Motion (forms-'+(i+1)+')')],
 five:['desktop-1','desktop-2','mobile390','mobile340'].map(v=>'Five Corrections ('+v+')'),
 pages:['Pages Preview'],
});
export const JOB_LANES=Object.freeze({
 'ranger-turn-smoke':'ranger','r9-story':'r9','v102-combat':'combat','v102-combat-webkit-summary':'combat',
 'v103-audio-output':'audio','v102-enemy-contacts':'legacy','v177-normal-campaign':'normal',
 verify:'verify_full','v100-webkit-frame-control':'performance','v100-phase-g-production':'phaseg',
 'v100-native-webkit-pwa':'legacy','webkit-hosted':'legacy','webkit-enemy-runtime-shard':'legacy',
 'webkit-viewport':'legacy','webkit-deployment-viewport':'legacy','webkit-stage3-audio':'legacy',
 quality:'quality',allunit:'allunit',five:'five','pages-preview':'pages',
});
const lanes=Object.keys(LANE_JOBS);
const control=new Set(['AGENTS.md','README.md','.gitignore','.gitattributes','pnpm-lock.yaml',
 'scripts/ci-change-scope.mjs','scripts/ci-pr-provenance.mjs','scripts/ci-combat-qa-reuse.mjs',
 'scripts/ci-validation-result.mjs','scripts/check-development-docs.mjs','tests/helpers/ci-pr-provenance.mjs',
 'scripts/build-v104-combat-voices.py',
 '.github/workflows/ci.yml','.github/workflows/targeted-frame-performance.yml']);
const diagnostic=/^\.github\/workflows\/(?:native-(?:aac|audio|opus|pcm|capture|game)|normal-campaign-observation)/u;
export const isDocumentation=file=>/\.md$/u.test(file)&&!/^docs\/story\/v10\/STORY_SCRIPT/u.test(file)
 ||/^docs\/qa\/.+\.(?:png|webp|mp4|webm)$/u.test(file);
const isControl=file=>control.has(file)||/^docs\/qa\/.+\.json$/u.test(file)||/^tests\/[^/]+\.test\.mjs$/u.test(file);
const product=file=>/^(?:app\/|public\/|assets\/|reference\/|package(?:-lock)?\.json$)/u.test(file);
const fallbackRoots={
 ranger:['scripts/v177Ranger','app/v177Ranger'],
 normal:['scripts/v177-representative-','scripts/v100-normal-'],
 r9:['scripts/v100-r9-','scripts/v100-dialogue-composition','scripts/v100-story-bookends'],
 allunit:['.github/workflows/native-allunit-capture.yml','scripts/v177-native-allunit','scripts/v177-native-canvas','scripts/v177-native-encoded'],
 five:['.github/workflows/five-corrections-capture.yml','scripts/v105-five-corrections-'],performance:['scripts/v100-device-runtime','scripts/v177-ranger-performance'],
 audio:['scripts/v103-audio-output'],combat:['scripts/v102-combat'],quality:['.github/workflows/v1-quality-acceptance.yml','scripts/v101-quality-'],
 pages:['.github/workflows/github-pages-release.yml','.github/workflows/github-pages-public-qa.yml','scripts/build-github-pages.mjs','scripts/github-pages-smoke.mjs'],
};
export function ciChangeScope(paths,{draft=false,dependencies={}}={}){
 assert.equal(typeof draft,'boolean');
 assert.ok(Array.isArray(paths)&&paths.every(p=>typeof p==='string'&&p&&!p.includes('\\')&&!p.startsWith('/')));
 const required=Object.fromEntries(lanes.map(k=>[k,false]));let unknown=false;
 for(const file of paths){
  if(isDocumentation(file)||diagnostic.test(file))continue;
  if(file==='.github/workflows/ci.yml'&&dependencies[file]){
   for(const k of dependencies[file])required[k]=true;continue;
  }
  if(isControl(file))continue;
  const affected=dependencies[file]??Object.entries(fallbackRoots).filter(([,roots])=>roots.some(p=>file.startsWith(p))).map(([k])=>k);
  if(!product(file)&&affected.length){for(const k of affected){assert.ok(lanes.includes(k));required[k]=true;}}
  else {unknown=true;for(const k of lanes)required[k]=true;}
 }
 // Draft observations are not formal integration performance/Quality acceptance.
 if(draft){required.performance=false;required.quality=false;}
 const all=lanes.filter(k=>!draft||!['performance','quality'].includes(k));
 return {...required,full:unknown&&all.every(k=>required[k]),code_checks:paths.some(p=>!isDocumentation(p)),
  scope:unknown?'shared-or-product':Object.values(required).some(Boolean)?'affected-validation':'documentation-or-control',
  wholeGameAccepted:false};
}
export function framePerformanceRuntimes(paths){
 return paths.some(p=>product(p)||p==='.github/workflows/targeted-frame-performance.yml'
  ||p==='scripts/v100-device-runtime-browser.mjs'||p==='scripts/v177-ranger-performance-receipts.mjs')
  ?[{runtime:'formal',host:'macos-15'},{runtime:'native-recording-control',host:'macos-15-intel'}]:[];
}
const workflowLanes={quality:'v1-quality-acceptance',allunit:'native-allunit-capture',five:'five-corrections-capture'};
export function dependencyInputs(files,read){
 const sets=Object.fromEntries(lanes.map(k=>[k,new Set()])),queue=[];
 const add=(lane,file)=>{if(files.has(file)&&!sets[lane].has(file)){sets[lane].add(file);if(!file.endsWith('.yml'))queue.push([lane,file]);}};
 const references=(body,owner)=>{
  const found=new Set();
  for(const match of body.matchAll(/['"\x60]((?:\.{1,2}\/|scripts\/)[^'"\x60$\s]+)['"\x60]/gu)){
   const value=match[1],relative=value.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(owner),value)):value;
   for(const candidate of [relative,relative+'.mjs',relative+'.js',relative+'.json',relative+'.ts',relative+'.tsx'])if(files.has(candidate))found.add(candidate);
  }
  for(const match of body.matchAll(/\bscripts\/[\w./-]+\.(?:mjs|js|json|py|ts)\b/gu))if(files.has(match[0]))found.add(match[0]);
  const pkg=JSON.parse(read('package.json'));
  for(const match of body.matchAll(/\bnpm run ([\w:.-]+)/gu)){
   const command=pkg.scripts?.[match[1]]??'';
   for(const r of command.matchAll(/\bscripts\/[\w./-]+\.(?:mjs|js|json|py|ts)\b/gu))if(files.has(r[0]))found.add(r[0]);
  }
  return [...found];
 };
 const ci=read('.github/workflows/ci.yml');
 const blocks=[...ci.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|(?![\s\S]))/gmu)];
 for(const [,id,body] of blocks){
  const lane=JOB_LANES[id];if(!lane)continue;
  for(const file of references(body,'.github/workflows/ci.yml'))add(lane,file);
 }
 for(const [lane,name] of Object.entries(workflowLanes)){
  const file='.github/workflows/'+name+'.yml';add(lane,file);
  for(const ref of references(read(file),file))add(lane,ref);
 }
 while(queue.length){
  const [lane,file]=queue.shift();
  if(/\.(?:mjs|js|ts|tsx|json|py)$/u.test(file))for(const ref of references(read(file),file))add(lane,ref);
 }
 for(const f of ['.github/workflows/github-pages-release.yml','.github/workflows/github-pages-public-qa.yml'])add('pages',f);
 const dependencies={};
 for(const [lane,inputs] of Object.entries(sets))for(const file of inputs)(dependencies[file]??=[]).push(lane);
 return {sets,dependencies};
}
const digest=text=>createHash('sha256').update(text).digest('hex');
export function laneFingerprints(entries,sets,{base,workflowContracts={}}={}){
 const assigned=new Set(Object.values(sets).flatMap(s=>[...s]));
 const common=file=>!isDocumentation(file)&&file!=='.github/workflows/ci.yml'&&!diagnostic.test(file)&&!/^tests\/[^/]+\.test\.mjs$/u.test(file)
  &&(!/^(?:scripts\/|\.github\/workflows\/)/u.test(file)||!assigned.has(file));
 return Object.fromEntries(lanes.map(k=>[k,digest(JSON.stringify({base,
  workflow:workflowContracts[k],inputs:entries.filter(([file])=>common(file)||sets[k].has(file))}))]));
}
export async function previousLaneEvidence({repository,previousHead,base,prNumber,fingerprints,token,request=fetch}={}){
 const none=Object.fromEntries(lanes.map(k=>[k,null]));
 if(!/^[\w.-]+\/[\w.-]+$/u.test(repository??'')||!/^[a-f0-9]{40}$/u.test(previousHead??'')
  ||!/^[a-f0-9]{40}$/u.test(base??'')||!Number.isSafeInteger(prNumber)||prNumber<1||!token)return none;
 const cache=new Map();
 const get=async(suffix,binary=false)=>{
  const key=suffix+':'+binary;
  if(!cache.has(key))cache.set(key,(async()=>{
   const r=await request('https://api.github.com/repos/'+repository+'/'+suffix,{headers:{
    Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
   assert.equal(r.ok,true);return binary?r.arrayBuffer():r.json();
  })());return cache.get(key);
 };
 const owner=async id=>{
  const run=await get('actions/runs/'+id);
  assert.equal(run.id,id);assert.equal(run.status,'completed');assert.equal(run.event,'pull_request');assert.equal(run.run_attempt,1);
  assert.ok(['success','failure'].includes(run.conclusion));assert.ok(run.pull_requests?.some(p=>p.number===prNumber));
  const data=await get('actions/runs/'+id+'/artifacts?per_page=100');
  assert.equal(data.total_count,data.artifacts.length);assert.ok(data.total_count<=100);
  const matches=data.artifacts.filter(a=>a.name==='validation-scope');assert.equal(matches.length,1);
  const a=matches[0];assert.equal(a.expired,false);assert.equal(a.workflow_run?.id,id);assert.equal(a.workflow_run?.head_sha,run.head_sha);
  const bytes=Buffer.from(await get('actions/artifacts/'+a.id+'/zip',true));
  assert.equal(bytes.length,a.size_in_bytes);assert.equal('sha256:'+digest(bytes),a.digest);
  const plan=JSON.parse(readSingleTextArchive(bytes,'validation-scope.json'));
  assert.equal(plan.schema,'zombieee-validation-scope/v1');assert.equal(plan.head,run.head_sha);assert.equal(plan.base,base);
  const provenance=await immutablePrProvenance({get,runId:id,head:run.head_sha,base});
  assert.equal(plan.merge,provenance.merge);
  const jobs=await get('actions/runs/'+id+'/jobs?filter=latest&per_page=100');
  assert.equal(jobs.total_count,jobs.jobs.length);assert.ok(jobs.total_count<=100);
  return {run,plan,jobs:jobs.jobs,provenance};
 };
 try{
  const runs=await get('actions/workflows/ci.yml/runs?head_sha='+previousHead+'&event=pull_request&per_page=10');
  for(const r of runs.workflow_runs??[]){
   if(r.head_sha!==previousHead||r.status!=='completed'||r.run_attempt!==1)continue;
   let prior;try{prior=await owner(r.id);}catch{continue;}
   for(const k of lanes){
    try{
     const gate=prior.plan.gates[k];assert.equal(gate.required,true);assert.equal(gate.fingerprint,fingerprints[k]);
     const original=gate.state==='reused'?await owner(gate.owner.runId):prior;
     const originalGate=original.plan.gates[k];
     assert.equal(originalGate.state,'fresh');assert.equal(originalGate.required,true);
     assert.equal(originalGate.fingerprint,fingerprints[k]);
     if(gate.state==='reused'){assert.equal(gate.owner.head,original.run.head_sha);assert.equal(gate.owner.base,base);}
     const jobs=LANE_JOBS[k].map(name=>{
      const rows=original.jobs.filter(j=>j.name===name||j.name.endsWith(' / '+name));assert.equal(rows.length,1);
      const j=rows[0];assert.equal(j.status,'completed');assert.equal(j.conclusion,'success');
      assert.equal(j.run_id,original.run.id);assert.equal(j.run_attempt,1);assert.equal(j.head_sha,original.run.head_sha);
      assert.ok(Number.isSafeInteger(j.id)&&j.id>0);
      // The WebKit summary derives its result from all three proven combat jobs.
      if(name!=='V1.0.2 Combat (webkit)')assert.ok(j.steps?.some(s=>s.name==='Verify exact checkout'&&s.status==='completed'&&s.conclusion==='success'));
      return {id:j.id,name:j.name};
     });
     none[k]={runId:original.run.id,head:original.run.head_sha,base,fingerprint:fingerprints[k],jobs,
      provenance:original.provenance};
    }catch{/* Missing, failed, skipped or incompatible evidence must run fresh. */}
   }
   break;
  }
 }catch{/* Network and evidence failures never become reused success. */}
 return none;
}
export function validationPlan(scope,{head,base,merge,fingerprints,evidence={}}){
 const gates=Object.fromEntries(lanes.map(k=>[k,{required:scope[k],fingerprint:fingerprints[k],
  state:!scope[k]?'outside':evidence[k]?'reused':'fresh',...(scope[k]&&evidence[k]?{owner:evidence[k]}:{})}]));
 return {schema:'zombieee-validation-scope/v1',head,base,merge,gates,scope:scope.scope,
  code_checks:scope.code_checks,wholeGameAccepted:false};
}
export function assertValidationResults(plan,needs){
 assert.equal(plan.schema,'zombieee-validation-scope/v1');assert.equal(needs.scope?.result,'success');
 assert.equal(needs.verify?.result,'success','Build, tests and current provenance must succeed');
 for(const [id,job] of Object.entries(needs)){
  assert.ok(id==='scope'||Object.hasOwn(JOB_LANES,id),'Unclassified validation job: '+id);
  assert.ok(!['failure','cancelled'].includes(job.result),'Validation failed: '+id);
 }
 for(const k of lanes){
  const g=plan.gates[k];assert.equal(typeof g.required,'boolean');assert.match(g.fingerprint,/^[a-f0-9]{64}$/u);
  if(!g.required){assert.equal(g.state,'outside');
   for(const [id,lane] of Object.entries(JOB_LANES))if(lane===k&&id!=='verify')assert.equal(needs[id]?.result,'skipped','Outside job ran unexpectedly: '+id);
   continue;
  }
  if(g.state==='reused'){
   assert.equal(g.owner?.fingerprint,g.fingerprint);assert.equal(g.owner?.base,plan.base);
   assert.ok(Number.isSafeInteger(g.owner?.runId)&&g.owner.runId>0);
   assert.match(g.owner.head,/^[a-f0-9]{40}$/u);assert.equal(g.owner.provenance?.head,g.owner.head);
   assert.equal(g.owner.provenance?.base,plan.base);assert.equal(g.owner.jobs.length,LANE_JOBS[k].length);
   for(const [id,lane] of Object.entries(JOB_LANES))if(lane===k&&id!=='verify')assert.equal(needs[id]?.result,'skipped','Reused job ran unexpectedly: '+id);
   continue;
  }
  assert.equal(g.state,'fresh');
  for(const [id,lane] of Object.entries(JOB_LANES))if(lane===k)assert.equal(needs[id]?.result,'success',id+' was required');
 }
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const git=(args,{raw=false}={})=>{const value=execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});return raw?value:value.trim();};
 const {CI_SCOPE_HEAD:head,CI_SCOPE_PR_BASE:prBase,CI_SCOPE_BASE:fallbackBase,CI_SCOPE_DRAFT:draft,CI_SCOPE_PREVIOUS_HEAD:before}=process.env;
 const base=prBase||fallbackBase;
 for(const value of [head,base])assert.match(value??'',/^[a-f0-9]{40}$/u);
 assert.ok(['true','false'].includes(draft));
 const merge=git(['rev-parse','HEAD']);
 if(process.env.GITHUB_ACTIONS==='true'){
  git(['merge-base','--is-ancestor',head,merge]);git(['merge-base','--is-ancestor',base,merge]);
 }
 const paths=git(['diff','--no-renames','--name-only','-z',base+'...'+head],{raw:true}).split('\0').filter(Boolean);
 const entries=git(['ls-tree','-r','-z',head],{raw:true}).split('\0').filter(Boolean).map(line=>{const tab=line.indexOf('\t');return [line.slice(tab+1),line.slice(0,tab).split(' ')[2]];});
 const files=new Set(entries.map(([file])=>file)),cache=new Map();
 const read=file=>{if(!cache.has(file))cache.set(file,git(['show',head+':'+file]).replaceAll('\r\n','\n'));return cache.get(file);};
 const {sets,dependencies}=dependencyInputs(files,read),workflowContracts=workflowRuntimeContracts(read('.github/workflows/ci.yml')),
  fingerprints=laneFingerprints(entries,sets,{base,workflowContracts});
 dependencies['.github/workflows/ci.yml']=workflowJobChanges(git(['show',base+':.github/workflows/ci.yml']),read('.github/workflows/ci.yml'));
 const scope=ciChangeScope(paths,{draft:draft==='true',dependencies});
 let evidence={},previousIsAncestor=false;
 try{previousIsAncestor=/^[a-f0-9]{40}$/u.test(before??'')&&before!==head&&git(['merge-base',before,head])===before;}catch{/* Missing old objects require fresh gates. */}
 if(previousIsAncestor)
  evidence=await previousLaneEvidence({repository:process.env.GITHUB_REPOSITORY,previousHead:before,base,
   prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),fingerprints,token:process.env.CI_SCOPE_ACTIONS_TOKEN});
 const plan=validationPlan(scope,{head,base,merge,fingerprints,evidence});
 mkdirSync('outputs/ci-scope',{recursive:true});writeFileSync('outputs/ci-scope/validation-scope.json',JSON.stringify(plan,null,2)+'\n');
 const fresh=Object.fromEntries(lanes.map(k=>[k,plan.gates[k].state==='fresh']));
 const outputs={...fresh,full:lanes.every(k=>fresh[k]),code_checks:scope.code_checks,plan:JSON.stringify(plan)};
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(outputs).map(([k,v])=>k+'='+v+'\n').join(''));
 const states=Object.entries(plan.gates).map(([k,g])=>k+': '+g.state+(g.owner?' (run '+g.owner.runId+')':'')).join('\n');
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Whole PR validation: '+scope.scope+'\n\n'+states+'\n\nOutside is not a passed test. Failed/missing evidence runs fresh. Whole-game acceptance is not claimed.\n');
 console.log(JSON.stringify({...plan,changedPaths:paths}));
}



// Runtime contracts also feed reuse hashes, so changing one lane does not
// invalidate unrelated lanes, and global env/defaults cannot escape selection.
export function workflowRuntimeContracts(text){
 text=text.replaceAll('\r\n','\n');
 const header=text.split(/^jobs:\n/mu,1)[0];
 const global=header.replace(/^name:[^\n]*\n/gmu,'')
  .replace(/^(?:on|permissions|concurrency):\n[\s\S]*?(?=^[\w-]+:|(?![\s\S]))/gmu,'')
  .replace(/^\s*#.*\n/gmu,'').trim();
 const blocks=Object.fromEntries([...text.split(/^jobs:\n/mu)[1]?.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|(?![\s\S]))/gmu)??[]].map(m=>[m[1],m[2]]));
 const guardCommand="node --input-type=module -e 'import assert from \"node:assert/strict\";import{execFileSync}from\"node:child_process\";assert.match(process.env.EXPECTED_CHECKOUT??\"\",/^[a-f0-9]{40}$/u);assert.equal(execFileSync(\"git\",[\"rev-parse\",\"HEAD\"],{encoding:\"utf8\"}).trim(),process.env.EXPECTED_CHECKOUT);'";
 const normalize=(body,lane)=>{
  const ref=body.match(/^          ref: (.+)$/mu)?.[1];
  body=body.replace(/\n      - name: Verify exact checkout\n        env:\n          EXPECTED_CHECKOUT: ([^\n]+)\n        run: ([^\n]+)\n/gu,(all,expected,command)=>
   command===guardCommand&&(ref?expected===ref:/^\$\{\{ github\.sha \}\}$/u.test(expected))?'\n':all);
  if(lane==='legacy')body=body.replaceAll('needs.scope.outputs.full','needs.scope.outputs.legacy');
  return body.replace(/^    name:[^\n]*\n/gmu,'').replace(/^\s*#.*\n/gmu,'')
   .replace(/^        if: needs\.scope\.outputs\.code_checks == 'true'\n/gmu,'')
   .replace(/\n      - name: Check current documentation links\n        run: node scripts\/check-development-docs\.mjs\n/gu,'').trim();
 };
 const contracts=Object.fromEntries(lanes.map(k=>[k,{global,jobs:[]}]));
 const unknown=[];
 for(const [id,body] of Object.entries(blocks)){
  if(['scope','required-validation','v177-guardian-control-diagnostic','v177-webkit-shadow-diagnostic'].includes(id))continue;
  const lane=JOB_LANES[id];
  if(lane)contracts[lane].jobs.push([id,normalize(body,lane)]);else unknown.push([id,body]);
 }
 for(const c of Object.values(contracts))c.unknown=unknown;
 return contracts;
}
export function workflowJobChanges(before,after){
 const old=workflowRuntimeContracts(before),current=workflowRuntimeContracts(after);
 return lanes.filter(k=>JSON.stringify(old[k])!==JSON.stringify(current[k]));
}
