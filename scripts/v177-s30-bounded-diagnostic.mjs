import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Temporary, explicitly bounded recording control. Never a formal gate.
export async function runBrowserQa(){
  const recording=process.env.S30_DIAGNOSTIC_RECORDING;
  assert.ok(['on','off'].includes(recording));
  const stopAt=Date.parse(process.env.S30_DIAGNOSTIC_STOP_AT);
  assert.ok(Number.isFinite(stopAt)&&Date.now()<stopAt,'Authorized investigation window ended');
  const product='9eeb4b6700a363d6d533dd785b71714351c0e106';
  assert.equal(execFileSync('git',['diff','--name-only',product,'HEAD','--','app','public'],{encoding:'utf8'}),'');
  const original=await readFile(new URL('./v177-representative-battles.mjs',import.meta.url),'utf8');
  let source=original;
  const replace=(before,after)=>{assert.ok(source.includes(before),'Runner contract changed: '+before.slice(0,80));source=source.replace(before,after);};
  replace('async function main() {',`const diagnosticRecording=${recording==='on'};
const diagnosticStopAt=${stopAt};
async function main() {`);
  replace("    cases: [], status: 'running' };",`    cases: [], status: 'running',diagnosticOnly:true,formalAcceptance:false,
    diagnostic:{recording:diagnosticRecording,stopAt:diagnosticStopAt,productHead:'${product}',originalRunnerSha256:'${createHash('sha256').update(original).digest('hex')}',scope:'One recording-on/off pair, original S14/S25/S30 sequence, unchanged tactical/budget/30s protocol/120s observation controls. Debug stack probe only for a stalled S30 RPC. No physical-phone or formal acceptance.'} };`);
  replace("  const browser = await (await pwaBrowserType(engine)).launch({ headless: true });",`  const browser = await (await pwaBrowserType(engine)).launch({ headless: true });
  const authorizedStopTimer=setTimeout(()=>{report.authorizedDeadlineReached=true;void browser.close();},Math.max(1,diagnosticStopAt-Date.now()));`);
  replace("      const fixture = createV177RepresentativeBudget(number);",`      if(Date.now()+180000>diagnosticStopAt)throw new Error('Insufficient authorized time for another bounded case');
      const fixture = createV177RepresentativeBudget(number);`);
  replace("      const rpc=createNormalBrowserDeadline({onTimeout:",`      let cdp,debugAttempted=false;const urls=new Map(),probes=new Map();
      const diagnosticTimers={setTimeout(callback,ms){const id=setTimeout(callback,ms);const probe=setTimeout(()=>{if(!cdp||debugAttempted)return;debugAttempted=true;row.debugProbe={at:performance.now(),budgetMs:ms};cdp.send('Debugger.pause').catch(e=>{row.debugProbe.error=String(e);});},Math.max(1,ms-2000));probes.set(id,probe);return id;},clearTimeout(id){clearTimeout(id);clearTimeout(probes.get(id));probes.delete(id);}};
      const rpc=createNormalBrowserDeadline({timers:diagnosticTimers,onTimeout:`);
  replace("        recordVideo: { dir: path.join(out, 'videos'), size: report.viewport }", "        ...(diagnosticRecording?{recordVideo:{dir:path.join(out,'videos'),size:report.viewport}}:{})");
  replace("      requests = installRequestFailureAudit(page); row.requestAudit = requests.report;",`      requests = installRequestFailureAudit(page); row.requestAudit = requests.report;
      if(number===30){
        cdp=await context.newCDPSession(rawPage);
        cdp.on('Debugger.scriptParsed',e=>urls.set(e.scriptId,{url:e.url,sourceMapURL:e.sourceMapURL}));
        cdp.on('Debugger.paused',async event=>{
          row.debugPaused={at:performance.now(),reason:event.reason,frames:event.callFrames.map(f=>({functionName:f.functionName,url:f.url||urls.get(f.location.scriptId)?.url,location:f.location,scopeTypes:f.scopeChain.map(s=>s.type)}))};
          try{row.debugPaused.page=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression:"({phase:globalThis.document?.querySelector('.v100-shell')?.dataset.v100Phase,heartbeat:globalThis.__S30_DIAG_HEARTBEATS__?.slice(-8)})",returnByValue:true,silent:true});}catch(e){row.debugPaused.readError=String(e);}
          await writeFile(path.join(out,'debug-paused.json'),JSON.stringify(row.debugPaused,null,2));
          await cdp.send('Debugger.resume').catch(()=>{});
        });
        await cdp.send('Debugger.enable');
        await page.addInitScript(()=>{globalThis.__S30_DIAG_HEARTBEATS__=[];setInterval(()=>{const a=globalThis.__S30_DIAG_HEARTBEATS__;a.push({at:performance.now(),phase:document.querySelector('.v100-shell')?.dataset.v100Phase});if(a.length>16)a.shift();},250);});
      }`);
  replace("  assert.ok(row.videoBytes > 0);", "  if(diagnosticRecording)assert.ok(row.videoBytes>0);else assert.equal(row.videoOmittedForDiagnostic,true);");
  replace("try { await normalCleanupWithin(closeOwnedContext,'representative context'); row.video = await normalCleanupWithin(()=>video.path(),'representative video'); row.videoBytes = (await stat(row.video)).size; }", "try { await normalCleanupWithin(closeOwnedContext,'representative context');if(video){row.video=await normalCleanupWithin(()=>video.path(),'representative video');row.videoBytes=(await stat(row.video)).size;}else row.videoOmittedForDiagnostic=true; }");
  replace("finally { try{await normalCleanupWithin(()=>browser.close(),'representative browser');}","finally { clearTimeout(authorizedStopTimer);try{await normalCleanupWithin(()=>browser.close(),'representative browser');}");
  replace("if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();",'await main();');
  const generated=path.resolve(`scripts/.v177-s30-bounded-${recording}.mjs`);
  await writeFile(generated,source,{flag:'wx'});
  if(process.env.S30_DIAGNOSTIC_DRY_RUN==='1')return;
  await import(pathToFileURL(generated).href);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await runBrowserQa();
