import {orderedNativePointer} from './ordered-native-pointer.mjs';

export function projectRepresentativeAirstrikeCanvases(canvases,target){
  const trace=(stage,detail={})=>console.info('V105_S25_RPC '+JSON.stringify({stage,at:performance.now(),...detail}));
  trace('entry',{canvasCount:canvases.length});
  const canvas=canvases.length===1?canvases[0]:null;if(!canvas){trace('return-no-canvas');return null;}
  const rect=canvas.getBoundingClientRect();trace('rect',{width:rect.width,height:rect.height});
  const scale=Number(canvas.dataset.worldScale),
    x=rect.x+Number(canvas.dataset.worldOffsetX)+target.x*scale,y=rect.y+Number(canvas.dataset.worldOffsetY)+target.y*scale;
  if(!(rect.width>0&&rect.height>0&&scale>0)||![x,y,scale].every(Number.isFinite)){trace('return-invalid');return null;}
  trace('before-hit',{x,y});const hit=document.elementFromPoint(x,y);trace('after-hit',{matches:hit===canvas});
  trace('return');return hit===canvas?{x,y}:null;
}

// Read-only observations guide ordinary UI inputs. This helper has no combat,
// save, time, actor or result setters and does not activate a QA scenario.
export function readNativeBattleControl(els){
  // A known CSS selection can be read in one browser-protocol call. Keep
  // the same first/nth selection and fresh geometry/hit test as the locator.
  if(els&&typeof els.selector==='string'&&Number.isInteger(els.index)&&els.index>=0){
    const selected=document.querySelectorAll(els.selector)[els.index];els=selected?[selected]:[];
  }
  const el=els.length===1?els[0]:null;
  if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return null;
  const mark=()=>globalThis.performance?.now?.()??null;
  const started=mark();
  const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  const geometryEnded=mark();
  const ownsPoint=r.width>0&&r.height>0&&document.elementFromPoint(x,y)?.closest('button')===el;
  const hitEnded=mark();
  const browserReadTimings=started===null||geometryEnded===null||hitEnded===null?null:
    {geometryMs:geometryEnded-started,hitTestMs:hitEnded-geometryEnded,totalMs:hitEnded-started};
  return{unitCard:el.matches('.unit-card'),point:ownsPoint?{x,y}:null,
    fighterId:el.dataset?.fighterId??null,abilityKind:el.dataset?.abilityKind??null,
    ariaLabel:el.getAttribute('aria-label'),browserReadTimings};
}

export async function nativeBattleTap(page,locator,phases=[],selection=null,{skipVisibleCardScroll=false}={}){
  if(typeof skipVisibleCardScroll!=='boolean')throw new TypeError('Invalid visible card scroll option');
  if(selection!==null&&!(typeof selection?.selector==='string'&&selection.selector.length>0
    &&Number.isInteger(selection.index)&&selection.index>=0))throw new TypeError('Invalid native control selection');
  // Live ability buttons can disappear or become unavailable between reads.
  // Observe the current match immediately; never wait for that old owner to return.
  const observe=async name=>{
    const phase={name,startedAt:Date.now(),status:'pending'};phases.push(phase);
    try{const state=selection===null?await locator.evaluateAll(readNativeBattleControl)
      :await page.evaluate(readNativeBattleControl,selection);phase.observation=state;phase.status='completed';return state;}
    catch(error){phase.status='error';phase.error=String(error);throw error;}
    finally{phase.endedAt=Date.now();}
  };
  let state=await observe('observe-control');
  if(!state)return false;
  // Portrait probes opt in after the fresh centre hit has already established
  // the actual button owner. Other callers keep their original scroll/read.
  if(state.unitCard&&(!skipVisibleCardScroll||!state.point)){
    const phase={name:'scroll-control',startedAt:Date.now(),status:'pending'};phases.push(phase);
    try{await locator.scrollIntoViewIfNeeded({timeout:750});phase.status='completed';}
    catch(error){phase.status='error';phase.error=String(error);return false;}
    finally{phase.endedAt=Date.now();}
    state=await observe('refresh-control');
  }
  if(!state?.point)return false;await orderedNativePointer(page,state.point,phases);return true;
}

// This opt-in S25 comparison changes only the order of ordinary card taps.
// Actor observations, not pointer requests, satisfy the one-per-kind trial.
export function s25FireDeploymentPriorities(snapshot, observedHumans, baseline) {
  const controls=snapshot?.s25DeploymentObservation;
  if(!controls||!Array.isArray(observedHumans))throw new Error('S25 comparison requires actual deployment observations');
  const queued=controls.queuedKinds;
  if(!Array.isArray(queued)||queued.some(kind=>typeof kind!=='string'))throw new Error('S25 comparison requires the original queue kinds');
  const humans=snapshot.fighters.filter(f=>f.side==='human'&&f.hp>0);
  if(!humans.some(f=>f.kind==='guardian')&&!queued.includes('guardian'))return ['guardian'];
  if(!observedHumans.some(f=>f.kind==='medic'))return queued.includes('medic')?[]:['medic'];
  const missing=['gunner','brute','zakimiya'].filter(kind=>!observedHumans.some(f=>f.kind===kind));
  if(!missing.length)return baseline;
  const next=missing.find(kind=>!queued.includes(kind)&&controls.cards.filter(card=>card.kind===kind).length===1
    &&controls.cards.some(card=>card.kind===kind&&!card.disabled&&card.ariaDisabled!=='true'));
  // Reserve command while all missing fire cards are blocked. Their real cost,
  // cooldown, capacity, hit test and the final native tap remain production-owned.
  return next?[next]:[];
}

export async function normalTacticalInput(page,record,{observeSnapshot,frameOwner,observeFrameChunk,rangerDrawObservation=false,awaitInitialRangerPaint=false,s25DeploymentObservation=false,s25FireComparison=false,barrageWhenOverwhelmed=false,barrageEnabled=true,airstrikeAfterSeconds=0,bossAirstrikePriority=false,reserveSecondAirstrikeForBoss=false,holdRedeploymentUntilBoss=false}={}){
  if(s25FireComparison&&(record.number!==25||!s25DeploymentObservation))throw new Error('S25 fire input is opt-in and Stage 25 only');
  if(awaitInitialRangerPaint&&!rangerDrawObservation)throw new Error('Initial Ranger paint wait requires draw observations');
  const observed=await page.evaluate(async({owner,rangerDrawObservation,awaitInitialRangerPaint,s25DeploymentObservation})=>{
    if(awaitInitialRangerPaint){
      const state=window.__V100_DEVICE_RAF__,qa=window.__ASHFALL_BATTLE_QA__;
      if(!state?.active||!Number.isFinite(state.startedAt)||!qa)throw new Error('Missing active original Ranger measurement');
      if(!state.rangerFirstPaintFence){
        const before=qa.getPerformanceSnapshot?.()?.renderFrames,original=state.performanceBefore?.renderFrames;
        if(!Number.isSafeInteger(before)||!Number.isSafeInteger(original)||original<0||before<original)throw new Error('Missing original actual render counter');
        const fence={status:'pending',requestedAt:performance.now(),beforeRenderFrames:before,observedAt:null,observedRenderFrames:null,rafCallbacks:0,timeoutMs:2000};
        state.rangerFirstPaintFence=fence;
        // Simulation can advance on a skipped paint frame. Wait for the next
        // actual drawWorld completion, regardless of its Ranger success/failure.
        // Capture the first raw snapshot in this same browser task; never seek
        // an older successful tail or change the original measurement window.
        await new Promise((resolve,reject)=>{
          let handle=0;
          const fail=message=>{fence.status='failed';fence.error=message;cancelAnimationFrame(handle);clearTimeout(timer);reject(new Error(message));};
          const timer=setTimeout(()=>fail('Timed out waiting for initial actual Ranger paint'),fence.timeoutMs);
          const tick=()=>{
            fence.rafCallbacks++;
            if(window.__V100_DEVICE_RAF__!==state||!state.active||window.__ASHFALL_BATTLE_QA__!==qa)return fail('Original Ranger measurement owner stopped or changed');
            const current=qa.getPerformanceSnapshot?.()?.renderFrames;
            if(!Number.isSafeInteger(current)||current<before)return fail('Actual render counter is missing or regressed');
            if(current>before){fence.status='completed';fence.observedAt=performance.now();fence.observedRenderFrames=current;clearTimeout(timer);resolve();}
            else handle=requestAnimationFrame(tick);
          };
          handle=requestAnimationFrame(tick);
        });
      }else if(state.rangerFirstPaintFence.status!=='completed')throw new Error('Initial Ranger paint observation did not complete');
    }
    const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();const snapshot=!s?null:{time:s.time,running:s.running,over:s.over,won:s.won,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,energy:s.energy,supportGauge:s.supportGauge,airstrike:s.airstrike,objective:s.objective,escortMissionObject:s.escortMissionObject,deployQueue:s.deployQueue?.map(f=>({kind:f.kind})),fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,maxHp:f.maxHp,x:f.x,y:f.y,lane:f.lane,range:f.range,combatReady:f.combatReady}))};
    if(snapshot&&rangerDrawObservation)snapshot.rangerDraws={readAt:performance.now(),simulationTime:s.time,
      renderBoundary:s.rangerRenderObservation??null,
      firstPaintFence:window.__V100_DEVICE_RAF__?.rangerFirstPaintFence??null,
      measurementStart:{startedAt:window.__V100_DEVICE_RAF__?.startedAt,active:window.__V100_DEVICE_RAF__?.active===true,
        boundary:window.__V100_DEVICE_RAF__?.performanceBefore?.rangerDrawBoundary??null},
      actors:s.fighters.filter(f=>f.kind==='ranger'&&f.side==='human'&&f.hp>0).map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,maxHp:f.maxHp,x:f.x,y:f.y,lane:f.lane,
        speed:f.speed,laneSpeed:f.laneSpeed,damage:f.damage,range:f.range,attackEvery:f.attackEvery,
        objectRender:f.renderAudit,
        renderSource:{kind:'same-snapshot-unfiltered-tail',fighterId:f.id,historyLength:f.renderAuditHistory?.length??null},
        render:f.renderAuditHistory?.at(-1)??null}))};
    if(snapshot&&s25DeploymentObservation)snapshot.s25DeploymentObservation={readAt:performance.now(),simulationTime:s.time,
      queuedKinds:[...(s.deployQueue??[])],deployCooldowns:{...s.deployCooldowns},
      cards:[...document.querySelectorAll('button.unit-card[data-kind]')].map(el=>({kind:el.dataset.kind,slot:el.dataset.slotIndex,
        disabled:el.disabled,ariaDisabled:el.getAttribute('aria-disabled'),state:el.dataset.state,blockReason:el.dataset.blockReason,
        costText:el.querySelector('.cost')?.textContent??null,ariaLabel:el.getAttribute('aria-label')})),
      support:[...document.querySelectorAll('button.support-btn')].map(el=>({supportId:el.dataset.supportId??null,
        className:el.className,disabled:el.disabled,ariaDisabled:el.getAttribute('aria-disabled'),state:el.dataset.state,
        cooldown:el.dataset.cooldown??null,ariaLabel:el.getAttribute('aria-label')}))};
    return owner?{snapshot,frames:globalThis.__V177_READ_NORMAL_FRAMES__?.(owner,'drain')??null}:snapshot;
  },{owner:frameOwner??null,rangerDrawObservation,awaitInitialRangerPaint,s25DeploymentObservation});
  const s=frameOwner?observed?.snapshot:observed;
  if(frameOwner)await observeFrameChunk?.(observed?.frames);
  observeSnapshot?.(s);
  if(!s?.running||s.over)return;
  const humans=s.fighters.filter(f=>f.side==='human'&&f.hp>0),enemies=s.fighters.filter(f=>f.side==='zombie'&&f.hp>0),queue=s.deployQueue??[];
  const cards=page.locator('button.unit-card[data-kind]'),kinds=await cards.evaluateAll(els=>els.map(el=>el.dataset.kind));
  const target=Object.fromEntries([...new Set(kinds)].map(kind=>[kind,kinds.filter(k=>k===kind).length]));
  const count=kind=>humans.filter(f=>f.kind===kind).length+queue.filter(f=>f.kind===kind).length;
  const available = candidates => candidates.find(kind => target[kind]) ?? null;
  const front=available(['guardian','brawler']), healer=available(['medic','scout']);
  // Prefer the precision unit with the deliberate 58-command cost whenever it
  // exists; only fall back to the cheaper ranged card when it is unavailable.
  const ranged=available(['babayaga','ranger','kumaverson']);
  const secondaryRanged=available(['babayaga','ranger','kumaverson'].filter(kind=>kind!==ranged));
  // The earned early-campaign route needs a medic before spending command on
  // the precision unit. Stage 11 lost with the late-game priority while the
  // same levels and formation had won with this role order in earlier runs.
  // Keep the precision-first profile for the later stages it was added for.
  const earlyCampaign = Number.isInteger(record.number) && record.number <= 26
    && record.tacticalProfile !== 'late-precision';
  const earlyRanged = available(['ranger','kumaverson']);
  const earlyPriorities = front && count(front)===0 ? [front]
    : healer && count(healer)===0 ? [healer]
      : count('babayaga')+count(earlyRanged)===0 ? ['babayaga',earlyRanged].filter(Boolean)
        : front && count(front)<target[front] ? [front]
          : healer && count(healer)<Math.min(2,target[healer]) ? [healer]
            : count('babayaga')<(target.babayaga??0) ? ['babayaga']
              : earlyRanged && count(earlyRanged)<target[earlyRanged] ? [earlyRanged]
                : kinds;
  // Select exactly one unmet role per call. This keeps an unavailable preferred
  // card reserved instead of spending its command on a cheaper fallback.
  const latePriorities = front && count(front)<1 ? [front]
    : ranged && count(ranged)<1 ? [ranged]
      : healer && count(healer)<1 ? [healer]
        : secondaryRanged && count(secondaryRanged)<1 ? [secondaryRanged]
          : front && count(front)<target[front] ? [front]
            : ranged && count(ranged)<target[ranged] ? [ranged]
              : secondaryRanged && count(secondaryRanged)<target[secondaryRanged] ? [secondaryRanged]
                : healer && count(healer)<target[healer] ? [healer]
                  : kinds.find(kind=>count(kind)<target[kind]) ? [kinds.find(kind=>count(kind)<target[kind])]:[];
  // The fixed four-unit boss/music fixture needs to reserve command for its
  // only precision attacker. Ordinary campaign runs keep their established
  // stage-dependent role order.
  const bossPrecision = record.tacticalProfile==='boss-precision';
  const priorities = s25FireComparison ? s25FireDeploymentPriorities(s, record.s25ObservedHumans, earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities) : earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities;
  record.tacticalProfile ??= earlyCampaign ? 'early-roles' : 'late-precision';
  const deployedKinds=new Set(record.inputs.filter(input=>input.action==='deploy').map(input=>input.kind));
  const holdRedeployment=holdRedeploymentUntilBoss&&kinds.every(kind=>deployedKinds.has(kind))&&!record.boss;
  for(const kind of holdRedeployment?[]:priorities){
    if(!target[kind]||count(kind)>=target[kind])continue;
    // Formation cards are fixed during a battle and were counted in kinds.
    // Re-read each actual nth owner immediately before and after scrolling;
    // do not add a separate locator-count round trip for the same card list.
    const selector='button.unit-card[data-kind="'+kind+'"]',candidates=page.locator(selector);let deployed=false;
    for(let i=0;i<target[kind];i++)if(await nativeBattleTap(page,candidates.nth(i),[],{selector,index:i})){record.inputs.push({time:s.time,action:'deploy',kind,command:s.energy});deployed=true;break;}
    if(deployed)break;
  }
  const cluster=enemies.map(e=>({center:e,members:enemies.filter(f=>Math.hypot(f.x-e.x,(f.y-e.y)*1.3)<115)})).sort((a,b)=>b.members.length-a.members.length)[0];
  const reserveForBoss=reserveSecondAirstrikeForBoss&&!record.bossDefeatedAt&&record.inputs.some(input=>input.action==='airstrike');
  const boss=bossPrecision?enemies.find(f=>f.kind==='takuya'):bossAirstrikePriority||reserveForBoss?enemies.find(f=>f.kind==='takuya'&&f.combatReady):null;
  let airstrikeRequested=false;
  if(s.time>=airstrikeAfterSeconds&&(bossAirstrikePriority||reserveForBoss?boss:cluster?.members.length>=3||boss)){
    const target=(bossAirstrikePriority||reserveForBoss)&&boss
      ? {x:Math.min(805,Math.max(230,boss.x)),y:boss.y}
      : cluster?.members.length>=3
      ? {x:cluster.members.reduce((v,f)=>v+f.x,0)/cluster.members.length,y:cluster.members.reduce((v,f)=>v+f.y,0)/cluster.members.length}
      : {x:Math.min(805,Math.max(230,boss.x)),y:boss.y};
    const point=await page.locator('.game-shell canvas').evaluateAll(projectRepresentativeAirstrikeCanvases,target).catch(()=>null);
    if(point&&await nativeBattleTap(page,page.locator('button.support-btn.airstrike'))){await orderedNativePointer(page,point);record.inputs.push({time:s.time,action:'airstrike',target});airstrikeRequested=true;}
  }
  // Keep the airstrike-first representative route. At the large-viewport
  // stress fixture, a crowd of eight is already an immediate vehicle threat;
  // use the ordinary barrage button before that crowd reaches the front.
  const overwhelmingCrowd=barrageWhenOverwhelmed&&enemies.length>=8;
  if(barrageEnabled&&!airstrikeRequested&&(bossPrecision||cluster?.members.length<3||overwhelmingCrowd)
    &&(overwhelmingCrowd||enemies.some(f=>f.x<550))
    &&await nativeBattleTap(page,page.locator('button.support-btn.barrage')))record.inputs.push({time:s.time,action:'barrage'});
  // Each enabled button already uses the production ability's target/range.
  // Normal attack range would wrongly exclude long-range precision abilities.
  const icons=await page.locator('button.manual-ability-ready.available[aria-disabled="false"]').evaluateAll(els=>els.map(el=>({ownerId:el.dataset.fighterId,kind:el.dataset.abilityKind})));
  for(const icon of icons){
    const locator=page.locator('button.manual-ability-ready[data-fighter-id="'+icon.ownerId+'"][aria-disabled="false"]');
    if(await nativeBattleTap(page,locator))record.inputs.push({time:s.time,action:'ability',kind:icon.kind,ownerId:icon.ownerId});
  }
  if(humans.some(f=>f.hp/f.maxHp<.65)){
    const anchors=await page.locator('button.manual-ability-ready').evaluateAll(els=>els.map(el=>({x:Number(el.dataset.ownerAnchorX),y:Number(el.dataset.ownerAnchorY)})));
    anchors.sort((a,b)=>a.x-b.x);const anchor=anchors[Math.floor(anchors.length/2)],box=await page.locator('.game-shell canvas').boundingBox({timeout:750}).catch(()=>null);
    if(anchor&&box){const point={x:box.x+anchor.x,y:box.y+anchor.y+20};if(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==='CANVAS',point)&&await nativeBattleTap(page,page.locator('button[data-support-id="support-healing"]'))){await orderedNativePointer(page,point);record.inputs.push({time:s.time,action:'healing-supply',point});}}
  }
  if(!record.lastObservedTime||s.time-record.lastObservedTime>=2){record.lastObservedTime=s.time;(record.samples??=[]).push({time:s.time,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,command:s.energy,supportGauge:s.supportGauge,airstrikePhase:s.airstrike?.phase,airstrikeCooldownRemaining:s.airstrike?.cooldownRemaining,humanCount:humans.length,enemyCount:enemies.length,objective:s.objective,escort:s.escortMissionObject});}
}
