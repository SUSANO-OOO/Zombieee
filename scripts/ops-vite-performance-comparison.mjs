import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseIndexingStatus,pauseEnabledVolumes,restoreEnabledVolumes} from './v100-macos-indexing-control.mjs';

export function comparisonPlan(base,candidate,changed){
  assert.match(base??'',/^[a-f0-9]{40}$/u);assert.match(candidate??'',/^[a-f0-9]{40}$/u);assert.notEqual(base,candidate);
  assert.deepEqual([...changed].sort(),['package-lock.json','package.json']);
  return [{label:'A',head:base,vite:'8.0.13'},{label:'B',head:candidate,vite:'8.1.6'},
    {label:'B',head:candidate,vite:'8.1.6'},{label:'A',head:base,vite:'8.0.13'}];
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',
    GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_JOB:'dependency-frame-comparison'}))assert.equal(process.env[key],value,key);
  assert.equal(await realpath(process.cwd()),await realpath(process.env.GITHUB_WORKSPACE));
  const git=args=>execFileSync('git',args,{encoding:'utf8',timeout:30000}).trim();
  assert.match(process.env.EXPECTED_HEAD??'',/^[a-f0-9]{40}$/u);assert.equal(git(['rev-parse','HEAD']),process.env.EXPECTED_HEAD);
  const out=path.resolve('outputs/ops-vite-performance-comparison'),reportFile=path.join(out,'report.json');
  await mkdir(out,{recursive:true});
  const mdOptions={encoding:'utf8',timeout:30000,env:{...process.env,LC_ALL:'C'}};
  const status=(timeout=30000)=>parseIndexingStatus(execFileSync('/usr/bin/mdutil',['-a','-s'],{...mdOptions,timeout}));
  const restore=async report=>{
    if(!report.host){console.log('No host mutation was started');return;}
    assert.equal(report.run,process.env.GITHUB_RUN_ID);assert.equal(report.head,process.env.EXPECTED_HEAD);
    const host=report.host,result=restoreEnabledVolumes(host.before,mount=>execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-i','on',mount],mdOptions));
    host.restoration=result.attempts;host.state=result.errors.length?'restoration-incomplete':'restored';
    try{host.restored=status();assert.deepEqual(host.restored,host.before);}catch(error){result.errors.push(error);host.state='restoration-incomplete';}
    report.errors.push(...result.errors.map(String));await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
    if(result.errors.length)throw new AggregateError(result.errors,'Original host restoration failed');
  };
  if(process.argv[2]==='restore'){
    let report;try{report=JSON.parse(await readFile(reportFile,'utf8'));}catch(error){if(error.code==='ENOENT'){console.log('No diagnostic report or host mutation');return;}throw error;}
    await restore(report);return;
  }
  const base=process.env.COMPARISON_BASE,candidate=process.env.COMPARISON_CANDIDATE;
  const plan=comparisonPlan(base,candidate,git(['diff','--no-renames','--name-only',base,candidate]).split('\n').filter(Boolean));
  git(['merge-base','--is-ancestor',base,candidate]);
  const report={diagnosticOnly:true,accepted:false,head:git(['rev-parse','HEAD']),run:process.env.GITHUB_RUN_ID,
    base,candidate,plan,node:process.version,image:process.env.ImageVersion,
    conditions:{viewport:'844x340',dpr:1,seconds:30,p95LimitMs:33,minimumMedianFps:50,
      renderCadence:'Original resolved graphicsProfile.renderHz with max(3Hz,10%) tolerance; retain actual expectedRenderHz in every source report',
      runtime:'Original formal Playwright1.56.1; exact WebKit version/revision retained in formal-runtime.json',callbackDiagnostic:false,blankBeforeAfter:true},
    question:'One host, identical product and inspection sources; compare old and new dependency builds in fixed ABBA order. Existing first34ms failure is retained.',
    interpretation:'Diagnostic only, no retry or formal acceptance. Shared host removes host identity differences but does not remove time, order, thermal or build-codegen uncertainty. Preserve every window.',
    builds:[],windows:[],errors:[],status:'preparing'};
  const persist=()=>writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  const workspaceRoot=path.resolve(process.env.RUNNER_TEMP,'issue182-vite-'+process.env.GITHUB_RUN_ID);
  assert.ok(workspaceRoot.startsWith(path.resolve(process.env.RUNNER_TEMP)+path.sep));
  await mkdir(workspaceRoot); // Never overwrite or reuse another job's modules.
  const roots=new Map();
  const command=(file,args,{cwd=process.cwd(),env=process.env,timeout=180000}={})=>execFileSync(file,args,
    {cwd,env,timeout,maxBuffer:32*1024*1024,encoding:'utf8',killSignal:'SIGKILL'});
  for(const item of plan.slice(0,2)){
    const root=path.join(workspaceRoot,item.label);git(['worktree','add','--detach',root,item.head]);roots.set(item.label,root);
    const build={...item,root,status:'installing'};report.builds.push(build);await persist();
    await writeFile(path.join(out,item.label+'-npm-ci.log'),command('npm',['ci'],{cwd:root}));
    assert.equal(JSON.parse(await readFile(path.join(root,'node_modules/vite/package.json'),'utf8')).version,item.vite);
    const env={...process.env,GITHUB_PAGES_RELEASE_SHA:item.head};
    await writeFile(path.join(out,item.label+'-build.log'),command('npm',['run','build'],{cwd:root,env}));
    build.status='built';await persist();
  }
  const first=roots.get('A');
  await writeFile(path.join(out,'formal-install.log'),command(process.execPath,['node_modules/playwright/cli.js','install','webkit'],{cwd:first}));
  await writeFile(path.join(out,'formal-runtime.json'),command(process.execPath,['scripts/verify-playwright-container-runtime.mjs','--macos-arm64'],{cwd:first,timeout:60000}));
  report.host={before:status(),state:'pause-attempted'};await persist();
  try{
    const host=report.host;
    host.pause=await pauseEnabledVolumes(host.before,(mount,timeout)=>execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-i','off',mount],{...mdOptions,timeout}),status);
    host.after=status();host.state='paused';assert.ok(host.after.every(v=>!v.enabled));await persist();
    for(const [index,item] of plan.entries()){
      const root=roots.get(item.label),directory=path.join(out,index+'-'+item.label);
      const row={index,...item,status:'running',startedAt:new Date().toISOString()};report.windows.push(row);await persist();
      const env={...process.env,GITHUB_PAGES_RELEASE_SHA:item.head,V100_DEVICE_RUNTIME_ENGINE:'webkit',
        V100_DEVICE_RUNTIME_VIEWPORT:'844x340',V100_DEVICE_RUNTIME_DPR:'1',V100_DEVICE_RUNTIME_OUT:directory,
        V100_DEVICE_RUNTIME_ROLE:'formal',V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC:'0',V100_DEVICE_RUNTIME_BLANK_BASELINE:'1',
        V100_DEVICE_RUNTIME_HOST_CONTROL:'spotlight-indexing-paused'};
      // Existing diagnostic label keeps original clocks, renderer, CPU receipts
      // and thresholds, while preventing promotion to formal acceptance.
      delete env.V100_DEVICE_RUNTIME_BENCHMARK_PREPARATION;
      try{
        const output=command(process.execPath,['scripts/run-browser-qa-with-server.mjs','scripts/v100-device-runtime-browser.mjs'],{cwd:root,env,timeout:180000});
        row.exitCode=0;await writeFile(path.join(out,index+'-'+item.label+'.log'),output);
      }catch(error){
        row.exitCode=error.status??null;row.error=String(error);report.errors.push('Window'+index+': '+String(error));
        await writeFile(path.join(out,index+'-'+item.label+'.log'),String(error.stdout??'')+'\n'+String(error.stderr??''));
        if(error.signal||error.code==='ETIMEDOUT')throw error; // Do not overlap an unconfirmed server with the next window.
      }
      try{
        const bytes=await readFile(path.join(directory,'report.json')),original=JSON.parse(bytes);
        assert.equal(original.provenance.head,item.head);assert.equal(original.measurement.diagnosticOnly,true);
        row.originalReportSha256=sha(bytes);row.p95RafMs=original.results[0]?.performance?.p95RafMs??null;
        row.windowStatus=original.results[0]?.status;row.status='retained';
      }catch(error){row.status='missing-or-invalid';row.readbackError=String(error);report.errors.push(row.readbackError);}
      row.finishedAt=new Date().toISOString();await persist();console.log(JSON.stringify(row));
    }
  }finally{await restore(report);}
  report.status=report.errors.length?'diagnostic-with-failures':'diagnostic-complete';await persist();
  if(report.errors.length)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error);process.exitCode=1;});
