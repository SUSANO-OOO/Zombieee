import {orderedNativePointer} from './ordered-native-pointer.mjs';

// Read-only observations guide ordinary UI inputs. This helper has no combat,
// save, time, actor or result setters and does not activate a QA scenario.
export async function nativeBattleTap(page,locator){
  // Live ability buttons can disappear or become unavailable between reads.
  // Observe the current match immediately; never wait for that old owner to return.
  const state=await locator.evaluateAll(els=>{const el=els.length===1?els[0]:null;return el&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'?{unitCard:el.matches('.unit-card')}:null;});
  if(!state)return false;
  if(state.unitCard)try{await locator.scrollIntoViewIfNeeded({timeout:750});}catch{return false;}
  const point=await locator.evaluateAll(els=>{const el=els.length===1?els[0]:null;if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return null;const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return document.elementFromPoint(x,y)?.closest('button')===el?{x,y}:null;});
  if(!point)return false;await orderedNativePointer(page,point);return true;
}

export async function normalTacticalInput(page,record,{observeSnapshot}={}){
  const s=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();if(!s)return null;return{time:s.time,running:s.running,over:s.over,won:s.won,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,energy:s.energy,supportGauge:s.supportGauge,airstrike:s.airstrike,objective:s.objective,escortMissionObject:s.escortMissionObject,deployQueue:s.deployQueue?.map(f=>({kind:f.kind})),fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,maxHp:f.maxHp,x:f.x,y:f.y,lane:f.lane,range:f.range,combatReady:f.combatReady}))};});
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
  const earlyCampaign = Number.isInteger(record.number) && record.number <= 26;
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
  const priorities = earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities;
  record.tacticalProfile ??= earlyCampaign ? 'early-roles' : 'late-precision';
  for(const kind of priorities){
    if(!target[kind]||count(kind)>=target[kind])continue;
    const candidates=page.locator('button.unit-card[data-kind="'+kind+'"]');let deployed=false;
    for(let i=0;i<await candidates.count();i++)if(await nativeBattleTap(page,candidates.nth(i))){record.inputs.push({time:s.time,action:'deploy',kind,command:s.energy});deployed=true;break;}
    if(deployed)break;
  }
  const cluster=enemies.map(e=>({center:e,members:enemies.filter(f=>Math.hypot(f.x-e.x,(f.y-e.y)*1.3)<115)})).sort((a,b)=>b.members.length-a.members.length)[0];
  const boss=bossPrecision?enemies.find(f=>f.kind==='takuya'):null;
  let airstrikeRequested=false;
  if(cluster?.members.length>=3||boss){
    const target=cluster?.members.length>=3
      ? {x:cluster.members.reduce((v,f)=>v+f.x,0)/cluster.members.length,y:cluster.members.reduce((v,f)=>v+f.y,0)/cluster.members.length}
      : {x:Math.min(805,Math.max(230,boss.x)),y:boss.y};
    const point=await page.locator('.game-shell canvas').evaluate((c,t)=>{const r=c.getBoundingClientRect(),scale=Number(c.dataset.worldScale),x=r.x+Number(c.dataset.worldOffsetX)+t.x*scale,y=r.y+Number(c.dataset.worldOffsetY)+t.y*scale;return document.elementFromPoint(x,y)===c?{x,y}:null;},target).catch(()=>null);
    if(point&&await nativeBattleTap(page,page.locator('button.support-btn.airstrike'))){await orderedNativePointer(page,point);record.inputs.push({time:s.time,action:'airstrike',target});airstrikeRequested=true;}
  }
  // When the boss fixture cannot afford another airstrike, use the crawler's
  // ordinary barrage control against enemies already threatening its front.
  if(!airstrikeRequested&&(bossPrecision||cluster?.members.length<3)
    &&enemies.some(f=>f.x<550)&&await nativeBattleTap(page,page.locator('button.support-btn.barrage')))record.inputs.push({time:s.time,action:'barrage'});
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
