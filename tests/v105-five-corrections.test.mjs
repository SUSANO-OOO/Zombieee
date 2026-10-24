import test from 'node:test';
import assert from 'node:assert/strict';
import {MANUAL_ABILITY_REGISTRY as definitions,createManualAbilityRuntime,beginManualAbility,advanceManualAbility,manualAbilityCheckpointCooldown} from '../app/manualAbilities.js';
import {queueV105FistWave,resolveV105FistWavePaint,advanceV105FistWaves,v105FistWaveSnapshot} from '../app/v105PaisenFistWave.js';
import {startV105AbilityName,updateV105AbilityNames,v105AbilityNameSnapshot,layoutV105AbilityNames,v105EnemyAbilityName} from '../app/v105AbilityNames.js';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v105BipedFootPlan,v177CaptureJointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
import {v105CurrentAbilitySample,v105AbilityFacing} from '../app/v105CurrentAbilityPose.js';
import {V105_GROUND_STRIKES} from '../app/v105GroundStrikeData.js';
import {STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {V090_INFECTED_DEFINITIONS} from '../app/v090Infected.js';
const definition=definitions.brawler;
function caster(){return {id:1,kind:'brawler',side:'human',hp:100,combatReady:true,x:100,y:300,
  manualAbility:beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:240,y:300,direction:1}).runtime};}
const victim=()=>({id:9,side:'zombie',hp:1000,combatReady:true,bodyRadius:16,x:240,y:300});

test('Paisen replaces the five timed hits with one real release and retains total cast/cooldown/damage/range budget',()=>{
  const owner=caster(),result=advanceManualAbility(owner.manualAbility,.26);
  assert.deepEqual(result.events.map(e=>e.type),['fist-wave-release']);
  assert.equal(result.runtime.phase,'recovery');assert.equal(result.runtime.sequentialBrawler,false);
  assert.equal(definition.impactDamage,56*5);assert.equal(definition.hitCount,1);
  assert.equal(definition.range,150);assert.equal(definition.cooldownSeconds,12);
  assert.equal(definition.windupSeconds+definition.recoverySeconds,.78);
  assert.equal(manualAbilityCheckpointCooldown(advanceManualAbility(owner.manualAbility,.4).runtime),12.38);
  assert.deepEqual(advanceManualAbility(result.runtime,100).events,[]);
});
test('only the current activation painted fist launches; flight hits once on actual swept contact, never on release',()=>{
  const owner=caster(),target=victim(),world={time:.26,fighters:[owner,target]},step=advanceManualAbility(owner.manualAbility,.26);
  owner.manualAbility=step.runtime;
  assert.equal(queueV105FistWave(world,owner,step.events[0],definition),true);
  assert.equal(queueV105FistWave(world,owner,step.events[0],definition),false);
  assert.deepEqual(advanceV105FistWaves(world,world.fighters),[]);assert.equal(target.hp,1000);
  assert.equal(resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:0,paintedAt:.26}),false);
  assert.equal(resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:1,paintedAt:.25}),false);
  assert.equal(resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:1,paintedAt:.26,sourceAtlas:atlases.brawler.path}),true);
  world.time=.28;assert.deepEqual(advanceV105FistWaves(world,world.fighters).map(e=>e.type),['launch']);
  assert.equal(target.hp,1000);world.time=.46;
  const contacts=advanceV105FistWaves(world,world.fighters);assert.equal(contacts.length,1);
  assert.equal(contacts[0].type,'contact');assert.equal(contacts[0].target,target);assert.equal(contacts[0].damage,280);
  assert.ok(contacts[0].x>145&&contacts[0].x<240);assert.deepEqual(advanceV105FistWaves(world,world.fighters),[]);
  assert.equal(v105FistWaveSnapshot(world).receipts.filter(r=>r.type==='contact').length,1);
});
test('fist wave can miss, strike an intervening enemy, and cancels an unpainted interrupted release',()=>{
  for(const mode of ['miss','intervening','interrupt']){
    const owner=caster(),target=victim(),step=advanceManualAbility(owner.manualAbility,.26);owner.manualAbility=step.runtime;
    const block={...victim(),id:10,x:190},world={time:.26,fighters:[owner,mode==='intervening'?block:target]};
    queueV105FistWave(world,owner,step.events[0],definition);
    if(mode==='interrupt'){
      owner.stunned=.2;advanceV105FistWaves(world,world.fighters);
      assert.equal(v105FistWaveSnapshot(world).pending,0);continue;
    }
    resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:1,paintedAt:.26,sourceAtlas:atlases.brawler.path});
    if(mode==='miss')target.y+=90;
    world.time=.9;const events=advanceV105FistWaves(world,world.fighters);
    assert.equal(events.filter(e=>e.type==='contact').length,mode==='miss'?0:1);
    if(mode==='intervening')assert.equal(events.find(e=>e.type==='contact').target,block);
    else assert.equal(v105FistWaveSnapshot(world).receipts.at(-1).type,'miss');
  }
});
test('area-effect fighter copies retain the pending fist, following label, and a distinct next enemy activation',()=>{
  const owner=caster(),target=victim(),world={time:.26,fighters:[owner,target]};
  startV105AbilityName(world,owner,{name:definition.displayName,activationId:1});
  const step=advanceManualAbility(owner.manualAbility,.26);owner.manualAbility=step.runtime;
  queueV105FistWave(world,owner,step.events[0],definition);
  world.fighters=world.fighters.map(f=>({...f,x:f.x+1}));
  const current=world.fighters[0];updateV105AbilityNames(world);
  assert.equal(v105AbilityNameSnapshot(world).active[0].ownerX,101);
  assert.equal(resolveV105FistWavePaint(world,current,{x:146,y:268},{activationId:1,paintedAt:.26,sourceAtlas:atlases.brawler.path}),true);
  world.time=.5;assert.equal(advanceV105FistWaves(world,world.fighters).find(e=>e.type==='contact').target,world.fighters[1]);
  const enemy={...victim(),kind:'grappler',stationAbility:{phase:'windup'}};world.fighters=[enemy];
  assert.equal(startV105AbilityName(world,enemy,{name:v105EnemyAbilityName(enemy.kind),source:'enemy'}),true);
  world.fighters=[{...enemy}];world.time+=.5;updateV105AbilityNames(world);
  assert.equal(startV105AbilityName(world,world.fighters[0],{name:v105EnemyAbilityName(enemy.kind),source:'enemy'}),true);
  const starts=v105AbilityNameSnapshot(world).starts.filter(r=>r.source==='enemy');
  assert.deepEqual(starts.map(r=>r.activationId),[1,2]);
});
test('actual starts own one Japanese label; phases/hits do not re-register, and death/end/reload remove presentation',()=>{
  const owner=caster(),world={time:1,fighters:[owner]};
  assert.equal(startV105AbilityName(world,owner,{name:definition.displayName,activationId:0}),false);
  assert.equal(startV105AbilityName(world,owner,{name:definition.displayName,activationId:1}),true);
  assert.equal(startV105AbilityName(world,owner,{name:definition.displayName,activationId:1}),false);
  owner.manualAbility=advanceManualAbility(owner.manualAbility,.26).runtime;world.time=1.5;owner.x+=30;
  updateV105AbilityNames(world);assert.equal(v105AbilityNameSnapshot(world).active[0].ownerX,130);
  assert.equal(v105AbilityNameSnapshot(world).starts.length,1);
  owner.hp=0;updateV105AbilityNames(world);assert.equal(v105AbilityNameSnapshot(world).active.length,0);
  assert.equal(v105AbilityNameSnapshot({...world}).active.length,0);
  owner.hp=100;owner.manualAbility={...owner.manualAbility,phase:'windup',activationId:2};
  startV105AbilityName(world,owner,{name:definition.displayName,activationId:2});world.over=true;
  updateV105AbilityNames(world);assert.equal(v105AbilityNameSnapshot(world).active.length,0);
  for(const kind of ['grappler','ooze','sprinter',...Object.keys(V090_INFECTED_DEFINITIONS),'takuya','gate-eater','kurome','mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'])assert.ok(v105EnemyAbilityName(kind),kind);
});
test('simultaneous ability names stay inside the mobile battle and remain distinct',()=>{
  const rows=Array.from({length:8},(_,i)=>({ownerId:i,name:i%2?'Ω大剣薙ぎ払い':'気合拳波',headX:i<4?8:835,headY:130+i%4*4}));
  const layout=layoutV105AbilityNames(rows,{width:844,height:340,fontSize:26,measure:text=>text.length*26});
  for(const row of layout){assert.ok(row.x-row.width/2>=0);assert.ok(row.x+row.width/2<=844);assert.ok(row.y-row.height/2>=0);assert.ok(row.y+row.height/2<=340);}
  for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
    const a=layout[i],b=layout[j];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,JSON.stringify({a,b}));
  }
});

const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const ctx=new Proxy({},{get:(_target,key)=>key==='drawImage'?()=>{}:()=>{},set:()=>true});
test('ground strikes move original held weapons to the actual boot floor and recover with attached original limbs',()=>{
  for(const kind of ['brute','takuya']){
    const atlas=atlases[kind],data=V105_GROUND_STRIKES[kind],owner={id:1,kind,hp:100,side:kind==='brute'?'human':'zombie',combatReady:true,x:300,y:300,knock:0},world={time:0};
    owner.animationPresentation={moving:false,locomotionPhase:0,locomotionSettle:1,direction:'right'};
    for(let n=0;n<=200;n++){
      const p=n/200;world.time=n/60;
      const state=p<.28?'wind-up':p<.7?'active':'recovery',progress=p<.28?p/.28:p<.7?(p-.28)/.42:(p-.7)/.3;
      const sample={requestedState:state,clipProgress:progress,abilityPresentation:kind==='brute'?'ground-slam':'slam'};
      let plan=v177JointPose(kind,sample,owner.animationPresentation,{grounded:true,actor:owner,world});
      plan=v105BipedFootPlan(kind,plan,{actor:owner,world,width:100,frame:{anchorX:.5},direction:'right'});
      const capture=v177CaptureJointPose(kind,plan),floor=Math.max(...data.soles.flatMap(s=>s.hull.map(v=>point(capture.lower[s.bone],v)[1])));
      const weaponBottom=Math.max(...data.weaponHull.map(v=>point(capture.upper[atlas.weaponBone],v)[1]));
      assert.ok(weaponBottom<=floor+.002,`${kind} phase ${p} actual weapon cannot pierce floor`);
      if(p>=.28&&p<=.55){assert.ok(plan.groundStrike?.contactReady,`${kind} phase ${p} real alpha contact required`);assert.ok(Math.abs(floor-weaponBottom)<.002);}
      for(const c of [...atlas.armConstraints,...atlas.legConstraints]){
        const leg=Boolean(c.hip),group=leg?'lower':'upper',parent=capture[leg&&c.parentUpper===false?'lower':'upper'][c.parentBone],a=c.hip??c.shoulder,b=c.knee??c.elbow,z=c.ankle??c.wrist;
        const pairs=[[point(parent,a),point(capture[group][c.upperBone],a)],[point(capture[group][c.upperBone],b),point(capture[group][c.lowerBone],b)],
          [point(capture[group][c.lowerBone],z),point(capture[group][c.effectorBone],c.effectorWrist??z)]];
        for(const [a,b]of pairs)assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.002,kind+' original chain attachment');
      }
      drawV177JointPose(ctx,{naturalWidth:100},kind,plan,0,0,100,100,{actor:owner,world});
    }
  }
});
test('station abilities retain their actual locked direction independently of the retired bitmap selector',()=>{
  for(const kind of ['grappler','gate-eater']){
    assert.equal(v105AbilityFacing({kind,animationPresentation:{direction:'left'},stationAbility:{phase:'windup',direction:1}}),'right');
    assert.equal(v105AbilityFacing({kind,stationAbility:{phase:'idle',direction:1}}),null);
  }
  assert.equal(v105AbilityFacing({kind:'sprinter',stationAbility:{phase:'burst'}}),'left');
});
test('a painted ground strike enters living stun and another stun without replacing its ability arms',()=>{
  const difference=(a,b)=>Math.max(...['lower','upper'].flatMap(g=>Object.keys(a[g]).flatMap(bone=>a[g][bone].map((v,i)=>Math.abs(v-b[g][bone][i])))));
  for(const kind of ['brute','takuya']){
    const owner={id:1,kind,hp:100,side:kind==='brute'?'human':'zombie',combatReady:true,x:300,y:300,knock:0,attackSequence:1,stunned:0},world={time:0};
    const runtime={moving:false,locomotionPhase:0,locomotionSettle:1,direction:'right',elapsedSeconds:0,transitionCount:0};owner.animationPresentation=runtime;
    let first=v177JointPose(kind,{requestedState:'active',clipProgress:(.4-.28)/.42,abilityPresentation:kind==='brute'?'ground-slam':'slam'},runtime,{grounded:true,actor:owner,world});
    first=v105BipedFootPlan(kind,first,{actor:owner,world,width:100,frame:{anchorX:.5},direction:'right'});
    const paint=plan=>{drawV177JointPose(ctx,{naturalWidth:100},kind,plan,0,0,100,100,{actor:owner,world});return v177CaptureJointPose(kind,plan);};
    let previous=paint(first);
    for(const epoch of [1,2]){
      Object.assign(runtime,{state:'incapacitated',transitionCount:epoch,elapsedSeconds:0});owner.stunned=.4;
      for(const t of [0,1e-8,.02,.07]){
        world.time+=t;runtime.elapsedSeconds=t;owner.stunned=.4-t;
        const next=v177JointPose(kind,{requestedState:'incapacitated'},runtime,{grounded:true,actor:owner,world,stunRemaining:owner.stunned});
        const captured=v177CaptureJointPose(kind,next);
        if(t<=1e-8)assert.ok(difference(previous,captured)<.002,`${kind} epoch${epoch} entry/epsilon must keep actual painted anatomy: ${difference(previous,captured)}`);
        previous=paint(next);
      }
    }
  }
});
test('shared biped walk-stop-turn-attack return keeps original leg identities and fixed knee/ankle attachments',()=>{
  for(const kind of ['brute','guardian','tky','takuya','takuya-omega','crazy-king','kumaverson','babayaga','brawler']){
    const atlas=atlases[kind],owner={id:1,kind,hp:100,side:'human',combatReady:true,x:300,y:300,knock:0},world={time:0};
    let previous;
    for(let n=0;n<150;n++){
      world.time=n/60;const moving=n<30,phase=moving?n/80:.37,direction=n<65?'right':'left';
      owner.x=300+(moving?n*.7:21);owner.animationPresentation={moving,locomotionPhase:phase,locomotionSettle:moving?0:1,direction};
      const state=n>=105&&n<125?'active':'move',sample={requestedState:state,clipProgress:state==='active'?(n-105)/20:phase};
      let plan=v177JointPose(kind,sample,owner.animationPresentation,{grounded:true,actor:owner,world});
      plan=v105BipedFootPlan(kind,plan,{actor:owner,world,width:100,frame:{anchorX:.5},direction});
      assert.ok(plan?.bipedFeet,kind);
      const captured=v177CaptureJointPose(kind,plan);
      for(const leg of atlas.legConstraints){
        const parent=captured[leg.parentUpper===false?'lower':'upper'][leg.parentBone];
        const pairs=[[point(parent,leg.hip),point(captured.lower[leg.upperBone],leg.hip)],
          [point(captured.lower[leg.upperBone],leg.knee),point(captured.lower[leg.lowerBone],leg.knee)],
          [point(captured.lower[leg.lowerBone],leg.ankle),point(captured.lower[leg.effectorBone],leg.ankle)]];
        for(const [a,b]of pairs)assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.002,JSON.stringify({kind,n,leg:leg.effectorBone,a,b}));
      }
      if(previous&&n===65)for(let i=0;i<2;i++)if(plan.bipedFeet.feet[i].height===0&&previous.feet[i].height===0)
        assert.ok(Math.abs(plan.bipedFeet.feet[i].x-previous.feet[i].x)<.0001,'turn retains its ground support');
      if(moving)assert.ok(plan.bipedFeet.feet.some(f=>f.height<1e-7),kind+' walking retains a support boot');
      if(n===104)assert.equal(plan.bipedFeet.facing,-1,kind+' stationary turn completes before the next attack');
      drawV177JointPose(ctx,{naturalWidth:100},kind,plan,0,0,100,100,{actor:owner,world});previous=plan.bipedFeet;
    }
  }
});
test('current rig samples advance the affected manual and station windup/release/recovery clocks',()=>{
  const base={requestedState:'special',clipProgress:0,bodyScale:1.12};
  for(const kind of ['brute','guardian','kumaverson','medic','tky','mrs-chiha','zakimiya','miyamoto-musashi','babayaga','engineer']){
    const d=definitions[kind],owner={kind,side:'human',hp:100,combatReady:true};
    for(const p of [0,.5,1]){
      owner.manualAbility={kind,phase:'windup',windupRemaining:d.windupSeconds*(1-p)};
      const sample=v105CurrentAbilitySample(owner,base,{manualDefinition:d});
      assert.equal(sample.bodyScale,1.12,'ability retains the current person scale');
      if(kind==='zakimiya'){
        assert.equal(sample.requestedState,p*d.windupSeconds<.4?'wind-up':'active');
        const expected=p*d.windupSeconds<.4?p*d.windupSeconds/.4:(p*d.windupSeconds-.4)/(d.windupSeconds-.4);
        assert.ok(Math.abs(sample.clipProgress-expected)<1e-9);
      }else{assert.equal(sample.requestedState,'wind-up');assert.equal(sample.clipProgress,p);}
      assert.ok(v177JointPose(kind,sample,{locomotionPhase:0,locomotionSettle:1},{grounded:true}),kind);
    }
  }
  const enemy={kind:'grappler',side:'zombie',hp:100,combatReady:true,stationAbility:{phase:'windup',remainingSeconds:STATION_ENEMY_TUNING.karamite.windupSeconds*.5}};
  assert.equal(v105CurrentAbilitySample(enemy,base).clipProgress,.5);
  const gunner={kind:'gunner',side:'human',hp:100,combatReady:true};
  const d=definitions.gunner;
  for(let i=0;i<d.burstCount;i++){
    const elapsed=d.aimSeconds+i*d.burstIntervalSeconds+.001;
    gunner.manualAbility={kind:'gunner',phase:'windup',abilityElapsed:elapsed,windupRemaining:d.windupSeconds-elapsed};
    assert.equal(v105CurrentAbilitySample(gunner,base,{manualDefinition:d}).requestedState,'active',`actual muzzle ${i}`);
  }
  for(const kind of ['gunner','zakimiya']){
    const d=definitions[kind],owner={kind,side:'human',hp:100,combatReady:true,
      manualAbility:{kind,phase:'recovery',windupRemaining:d.recoverySeconds-.00000001}};
    const next=v105CurrentAbilitySample(owner,base,{manualDefinition:d});
    assert.equal(next.requestedState,'recovery',kind+' returns directly after the actual last release');
    assert.ok(next.clipProgress<1e-6);
  }
});
