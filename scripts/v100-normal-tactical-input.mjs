import {orderedNativePointer} from './ordered-native-pointer.mjs';

// Read-only observations guide ordinary UI inputs. This helper has no combat,
// save, time, actor or result setters and does not activate a QA scenario.
export async function nativeBattleTap(page,locator){
  if(!await locator.count()||!await locator.evaluate(el=>!el.disabled&&el.getAttribute('aria-disabled')!=='true').catch(()=>false))return false;
  if(await locator.evaluate(el=>el.matches('.unit-card')))try{await locator.scrollIntoViewIfNeeded({timeout:750});}catch{return false;}
  const point=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return document.elementFromPoint(x,y)?.closest('button')===el?{x,y}:null;}).catch(()=>null);
  if(!point)return false;await orderedNativePointer(page,point);return true;
}

export async function normalTacticalInput(page,record){
  const s=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();if(!s)return null;return{time:s.time,over:s.over,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,energy:s.energy,objective:s.objective,escortMissionObject:s.escortMissionObject,deployQueue:s.deployQueue?.map(f=>({kind:f.kind})),fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,maxHp:f.maxHp,x:f.x,y:f.y,range:f.range}))};});if(!s||s.over)return;
  const humans=s.fighters.filter(f=>f.side==='human'&&f.hp>0),enemies=s.fighters.filter(f=>f.side==='zombie'&&f.hp>0),queue=s.deployQueue??[];
  const cards=page.locator('button.unit-card[data-kind]'),kinds=await cards.evaluateAll(els=>els.map(el=>el.dataset.kind));
  const target=Object.fromEntries([...new Set(kinds)].map(kind=>[kind,kinds.filter(k=>k===kind).length]));
  const count=kind=>humans.filter(f=>f.kind===kind).length+queue.filter(f=>f.kind===kind).length;
  const front=target.guardian?'guardian':'brawler',healer=target.medic?'medic':'scout',ranged=target.ranger?'ranger':'kumaverson';
  const priorities=count(front)===0?[front]:count(healer)===0?[healer]:count('babayaga')+count(ranged)===0?['babayaga',ranged]:count(front)<(target[front]??0)?[front]:count(healer)<Math.min(2,target[healer]??0)?[healer]:count('babayaga')<(target.babayaga??0)?['babayaga']:count(ranged)<(target[ranged]??0)?[ranged]:kinds;
  for(const kind of priorities){
    if(!target[kind]||count(kind)>=target[kind])continue;
    const candidates=page.locator('button.unit-card[data-kind="'+kind+'"]');let deployed=false;
    for(let i=0;i<await candidates.count();i++)if(await nativeBattleTap(page,candidates.nth(i))){record.inputs.push({time:s.time,action:'deploy',kind,command:s.energy});deployed=true;break;}
    if(deployed)break;
  }
  const cluster=enemies.map(e=>({center:e,members:enemies.filter(f=>Math.hypot(f.x-e.x,(f.y-e.y)*1.3)<115)})).sort((a,b)=>b.members.length-a.members.length)[0];
  if(cluster?.members.length>=3){
    const target={x:cluster.members.reduce((v,f)=>v+f.x,0)/cluster.members.length,y:cluster.members.reduce((v,f)=>v+f.y,0)/cluster.members.length};
    const point=await page.locator('.game-shell canvas').evaluate((c,t)=>{const r=c.getBoundingClientRect(),scale=Number(c.dataset.worldScale),x=r.x+Number(c.dataset.worldOffsetX)+t.x*scale,y=r.y+Number(c.dataset.worldOffsetY)+t.y*scale;return document.elementFromPoint(x,y)===c?{x,y}:null;},target).catch(()=>null);
    if(point&&await nativeBattleTap(page,page.locator('button.support-btn.airstrike'))){await orderedNativePointer(page,point);record.inputs.push({time:s.time,action:'airstrike',target});}
  }else if(enemies.some(f=>f.x<550)&&await nativeBattleTap(page,page.locator('button.support-btn.barrage')))record.inputs.push({time:s.time,action:'barrage'});
  const icons=await page.locator('button.manual-ability-ready.available[aria-disabled="false"]').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,kind:el.dataset.abilityKind};}));
  for(const icon of icons)if(humans.some(h=>h.kind===icon.kind&&enemies.some(e=>Math.abs(e.x-h.x)<h.range+70))&&await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('button.manual-ability-ready'),icon)){
    await orderedNativePointer(page,icon);record.inputs.push({time:s.time,action:'ability',kind:icon.kind});
  }
  if(humans.some(f=>f.hp/f.maxHp<.65)){
    const anchors=await page.locator('button.manual-ability-ready').evaluateAll(els=>els.map(el=>({x:Number(el.dataset.ownerAnchorX),y:Number(el.dataset.ownerAnchorY)})));
    anchors.sort((a,b)=>a.x-b.x);const anchor=anchors[Math.floor(anchors.length/2)],box=await page.locator('.game-shell canvas').boundingBox({timeout:750}).catch(()=>null);
    if(anchor&&box){const point={x:box.x+anchor.x,y:box.y+anchor.y+20};if(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==='CANVAS',point)&&await nativeBattleTap(page,page.locator('button[data-support-id="support-healing"]'))){await orderedNativePointer(page,point);record.inputs.push({time:s.time,action:'healing-supply',point});}}
  }
  if(!record.lastObservedTime||s.time-record.lastObservedTime>=2){record.lastObservedTime=s.time;(record.samples??=[]).push({time:s.time,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,command:s.energy,humanCount:humans.length,enemyCount:enemies.length,objective:s.objective,escort:s.escortMissionObject});}
}
