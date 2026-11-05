import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../scripts/v0995-visual-integrity-browser-smoke.mjs',import.meta.url),'utf8');
const helper=fs.readFileSync(new URL('../scripts/pwa-gate-qa.mjs',import.meta.url),'utf8');
const calls=source.match(/await dismissInstallOffer\(page[^\n]*\);/g);
assert.equal(calls?.length,2,'exercise the actual ready-case and fault-case entry calls');
function fixture(events){
 let now=0,forced=null;const clicks=[],waits=[];
 const state=()=>forced??events.filter(e=>e.at<=now).at(-1)?.state??'loading';
 const visible=name=>name==='notice'?state()==='notice':name==='battle'&&state()==='battle-loading'||state()===name;
 const locator=names=>({names,or(other){return locator([...names,...other.names]);},first(){return this;},
  getByRole(){return locator(['notice']);},async isVisible(){return names.some(visible);},async isEnabled(){return true;},
  async waitFor({state:expected='visible',timeout}){
   assert.ok(timeout>0&&timeout<=60000,'keep original 60-second entry budget');waits.push({names,timeout});
   const matches=()=>expected==='hidden'?names.every(n=>!visible(n)):names.some(visible);
   if(matches())return;const end=now+timeout;
   for(const e of events){if(e.at<=now||e.at>end)continue;now=e.at;if(matches())return;}
   now=end;throw Error('entry deadline exceeded');
  },async click(){const name=names.find(visible);assert.ok(name);clicks.push(name);if(name==='offer')forced='battle';else throw Error('notice exit must not leave a stale native click');},
 });
 const page={getByRole:()=>locator(['offer']),locator:s=>locator([s==='.fiction-notice'?'notice':s===".game-shell[data-screen='battle']"?'battle':'wrong-destination'])};
 const dismiss=vm.runInNewContext(helper.replace(/^export /gm,'')+'\n dismissInstallOffer;',{Date:{now:()=>now}});
 return {page,dismiss,clicks,waits,get now(){return now;},get state(){return state();}};
}
for(const [index,call]of calls.entries()){
 const run=new (async function(){}).constructor('page','dismissInstallOffer',call);
 test(`visual entry ${index}: already running battle is not abandoned while waiting for an absent offer`,async()=>{
  const f=fixture([{at:0,state:'battle'},{at:40000,state:'defeat'}]);await run(f.page,f.dismiss);
  assert.equal(f.now,0);assert.equal(f.state,'battle');assert.deepEqual(f.clicks,[]);
 });
 test(`visual entry ${index}: missing battle remains a failure`,async()=>{
  const f=fixture([]);await assert.rejects(run(f.page,f.dismiss),/entry deadline exceeded/);assert.equal(f.now,60000);
 });
 test(`visual entry ${index}: asset loading stays owned by the subsequent unchanged asset deadline`,async()=>{
  const f=fixture([{at:0,state:'battle-loading'}]);await run(f.page,f.dismiss);assert.equal(f.now,0);assert.equal(f.state,'battle-loading');
 });
 test(`visual entry ${index}: a real installation choice still requires its native button`,async()=>{
  const f=fixture([{at:0,state:'offer'}]);await run(f.page,f.dismiss);assert.deepEqual(f.clicks,['offer']);assert.equal(f.state,'battle');
 });
 test(`visual entry ${index}: fiction exit may reveal the battle directly`,async()=>{
  const f=fixture([{at:0,state:'notice'},{at:6500,state:'battle'},{at:40000,state:'defeat'}]);await run(f.page,f.dismiss);
  assert.equal(f.now,6500);assert.equal(f.state,'battle');assert.deepEqual(f.clicks,[]);
 });
}
