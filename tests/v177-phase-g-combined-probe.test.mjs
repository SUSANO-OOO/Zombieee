import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('scripts/v100-phase-g-production-matrix.mjs','utf8');
const tree=ts.createSourceFile('matrix.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declaration=name=>tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(tree);
function browserReader({cards=[{}],patch={}}={}){
 let reads=0,rafCount=0;const pending=new Map();
 class Element{
  constructor(options={}){Object.assign(this,{kind:'scout',state:'ready',cost:25,x:10,disabled:false,hidden:false,ariaDisabled:'false'},options);}
  getBoundingClientRect(){return{x:this.x,y:10,width:80,height:40};}
  closest(selector){return selector==='button.unit-card'?this:null;}
  getAttribute(name){return({'data-kind':this.kind,'data-slot-index':'0','data-state':this.state,'aria-label':this.cost==null?'Scout':`Scout ${this.costLabel??'指揮'} ${this.cost}`,'aria-disabled':this.ariaDisabled})[name]??null;}
  getAnimations(){return[];}
 }
 const elements=cards.map(c=>new Element(c));
 const snapshot={screen:'battle',running:true,paused:false,over:false,won:false,energy:100,deployQueue:[],deployCooldowns:{scout:0,medic:0},fighters:[],...patch};
 const window={innerWidth:1280,innerHeight:720,getComputedStyle:e=>({display:e.hidden?'none':'block',visibility:'visible',opacity:'1',pointerEvents:'auto'}),__ASHFALL_BATTLE_QA__:{getPhaseGCombatSnapshot:()=>snapshot}};
 const document={visibilityState:'visible',hidden:false,readyState:'complete',hasFocus:()=>true,
  querySelectorAll:selector=>selector==='button.unit-card'?elements:[],querySelector:()=>null,
  elementFromPoint:(x,y)=>elements.find(e=>x>=e.x&&x<e.x+80&&y>=10&&y<50)??null};
 const browserGlobals={window,document,location:{href:'http://local/'},Element,Date,performance:{now:()=>123},
  requestAnimationFrame:callback=>{const id=++rafCount;pending.set(id,callback);return id;},cancelAnimationFrame:id=>pending.delete(id),
 };
 const api=vm.runInNewContext(['deploymentEligibilityForCard','readBattleDeploymentDiagnostics','removeDeploymentSchedulerProbe'].map(declaration).join('\n')+'\n({readBattleDeploymentDiagnostics,removeDeploymentSchedulerProbe})',{DEPLOYMENT_QUEUE_CAPACITY:3,Date});
 const page={isClosed:()=>false,evaluate:async(fn,arg)=>{reads++;return vm.runInNewContext('('+fn.toString()+')(argument)',{...browserGlobals,argument:structuredClone(arg)});}};
 return{...api,page,window,reads:()=>reads,rafCount:()=>rafCount,frame:()=>{for(const [id,callback]of pending){pending.delete(id);callback(140);}}};
}

test('the initial browser read installs one pending probe in the same RPC and only a real RAF can observe it',async()=>{
 const b=browserReader({cards:[{x:3000}]});
 const first=await b.readBattleDeploymentDiagnostics(b.page,{requestedKind:'scout',schedulerProbeId:'probe',installSchedulerProbe:true});
 assert.equal(b.reads(),1);assert.equal(b.rafCount(),1);assert.equal(first.cards[0].actionability.eligible,true);
 assert.equal(first.cards[0].centerInViewport,false,'offscreen eligible cards still proceed to original centering');
 assert.equal(first.schedulerProbe.status,'pending');assert.equal(first.schedulerProbe.callbackTimestamp,null);
 b.frame();
 const second=await b.readBattleDeploymentDiagnostics(b.page,{schedulerProbeId:'probe'});
 assert.equal(second.schedulerProbe.status,'observed');assert.equal(second.schedulerProbe.callbackTimestamp,140);assert.equal(b.rafCount(),1);
 assert.equal((await b.removeDeploymentSchedulerProbe(b.page,'probe')).status,'removed');
 assert.equal(b.window.__V100_PHASE_G_DEPLOYMENT_SCHEDULER_PROBES__.size,0);
});

test('browser probe eligibility exactly matches the original host eligibility and first-kind selection',async()=>{
 const cases=[{}, {cards:[{state:'blocked'},{}]}, {cards:[{ariaDisabled:'true'}]}, {cards:[{disabled:true}]},
  {cards:[{hidden:true}]}, {cards:[{cost:null}]}, {cards:[{kind:null}]}, {patch:{energy:24}},
  {patch:{deployCooldowns:{scout:1}}},{patch:{deployCooldowns:{}}},{patch:{deployQueue:['a','b','c']}},
  {patch:{deployQueue:'invalid'}},{patch:{screen:'result'}},{patch:{running:false}}, {patch:{paused:true}},
  {patch:{over:true}},{patch:{won:true}},{cards:[{state:'blocked'},{kind:'medic'}]},
  {cards:[{cost:0}],patch:{energy:null}},{cards:[{cost:0}],patch:{energy:undefined}}];
 for(const options of cases)for(const requestedKind of ['scout',null]){
  const b=browserReader(options),d=await b.readBattleDeploymentDiagnostics(b.page,{requestedKind,schedulerProbeId:'probe',installSchedulerProbe:true});
  const candidate=requestedKind?d.cards.find(c=>c.kind===requestedKind):d.cards.find(c=>c.actionability.eligible);
  assert.equal(b.rafCount(),candidate?.actionability.eligible?1:0,JSON.stringify({options,requestedKind}));
  assert.equal(b.reads(),1);
 }
});

test('current 指揮 and legacy コスト prices remain readable while missing prices fail closed',async()=>{
 for(const costLabel of ['指揮','コスト']){
  const b=browserReader({cards:[{costLabel,cost:55}]}),d=await b.readBattleDeploymentDiagnostics(b.page);
  assert.equal(d.cards[0].cost,55,costLabel);
  assert.equal(d.cards[0].actionability.eligible,true,costLabel);
 }
 for(const card of [{cost:null},{costLabel:'費用',cost:55}]){
  const b=browserReader({cards:[card]}),d=await b.readBattleDeploymentDiagnostics(b.page);
  assert.equal(d.cards[0].cost,null);
  assert.equal(d.cards[0].actionability.eligible,false);
  assert.ok(d.cards[0].actionability.reasons.includes('cost-not-finite'));
 }
});

test('the controller adopts probe cleanup ownership before any host-side early return',async()=>{
 const calls=[],attempts=[];
 const input=vm.runInNewContext(declaration('performVerifiedDeploymentPointer')+'\nperformVerifiedDeploymentPointer',{
  withPhaseGPageInputLock:async(_p,fn)=>fn(),checkpointRecorderFor:()=>({recordDeploymentAttempt:e=>attempts.push(e),setLatestReadableState(){}}),
  DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS:5000,DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS:1000,
  withDeploymentPreinputDeadline:async(_p,operation,budget)=>{assert.ok(budget>0&&budget<=1000);return operation;},
  readBattleDeploymentDiagnostics:async(_p,options)=>{calls.push('combined-read');assert.equal(options.installSchedulerProbe,true);return{pageClosed:false,
   schedulerProbe:{probeId:options.schedulerProbeId,status:'pending'},cards:[{kind:'scout',actionability:{eligible:false}}]};},
  deploymentCandidatesFromDiagnostics:d=>d.cards.filter(c=>c.actionability.eligible),
  removeDeploymentSchedulerProbe:async()=>{calls.push('cleanup');return{status:'removed'};},
 });
 const result=await input({}, {requestedKind:'scout',phase:'fixture'});
 assert.equal(result.status,'candidate-invalidated-before-pointer');assert.equal(result.pointerCount,0);
 assert.deepEqual(calls,['combined-read','cleanup']);assert.equal(attempts.length,1);
 assert.equal(result.evidence.preflight.schedulerProbe.cleanup.status,'removed');
});
