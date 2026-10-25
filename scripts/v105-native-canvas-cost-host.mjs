import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{mkdir,readFile,writeFile,realpath}from'node:fs/promises';
import{parseIndexingStatus,restoreEnabledVolumes}from'./v100-macos-indexing-control.mjs';
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
for(const [key,value]of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_JOB:'capture'}))assert.equal(process.env[key],value,key);
for(const key of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])assert.match(process.env[key]??'',/^\d+$/u);
assert.equal(await realpath(process.cwd()),await realpath(process.env.GITHUB_WORKSPACE));
const expected=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')).inputs.expected_head;
assert.match(expected,/^[a-f0-9]{40}$/u);assert.equal(process.env.GITHUB_SHA,expected);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),expected);
const dir='outputs/canvas-native-cost',file=dir+'/host-indexing.json',mode=process.argv[2];assert.ok(['prepare','restore'].includes(mode));
const options={encoding:'utf8',timeout:30000,maxBuffer:65536,env:{...process.env,LC_ALL:'C'}},status=()=>parseIndexingStatus(execFileSync('/usr/bin/mdutil',['-a','-s'],options));
if(mode==='prepare'){
 await mkdir(dir,{recursive:true});const record={run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,head:expected,purpose:'canvas-native-cost-diagnostic',diagnosticOnly:true,releaseAcceptance:false,before:status(),state:'pause-attempted'};
 await writeFile(file,JSON.stringify(record,null,2),{flag:'wx'});execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-a','-i','off'],options);
 record.after=status();assert.deepEqual(record.after.map(v=>v.mount).sort(),record.before.map(v=>v.mount).sort());assert.ok(record.after.every(v=>!v.enabled));record.state='paused';await writeFile(file,JSON.stringify(record,null,2));
}else{
 const record=JSON.parse(await readFile(file,'utf8'));assert.equal(record.run,process.env.GITHUB_RUN_ID);assert.equal(record.attempt,process.env.GITHUB_RUN_ATTEMPT);assert.equal(record.head,expected);assert.equal(record.purpose,'canvas-native-cost-diagnostic');assert.equal(record.diagnosticOnly,true);
 record.state='restoration-attempted';await writeFile(file,JSON.stringify(record,null,2));
 const {attempts,errors}=restoreEnabledVolumes(record.before,mount=>execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-i','on',mount],options));record.restoreAttempts=attempts;
 try{record.restored=status();const normalized=a=>a.map(v=>({mount:v.mount,enabled:v.enabled})).sort((a,b)=>a.mount.localeCompare(b.mount));assert.deepEqual(normalized(record.restored),normalized(record.before));}catch(e){errors.push(e);}
 record.state=errors.length?'restoration-incomplete':'restored';await writeFile(file,JSON.stringify(record,null,2));if(errors.length)throw new AggregateError(errors,'Host restoration incomplete');
}
