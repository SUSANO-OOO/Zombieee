import type {CSSProperties} from 'react';
import {MANUAL_ABILITY_REGISTRY} from './manualAbilities.js';
import {v100PortraitFraming} from './v100PortraitFraming.js';
import {v100StoryPortraitPath} from './v100StoryPortraitPaths.js';

type Entry = {ownerId:number;kind:string;name:string;abilityName:string;summary:string;status:string;available:boolean;targetLabel:string|null};
function TacticsPortrait({kind}:{kind:string}) {
 const unitId=MANUAL_ABILITY_REGISTRY[kind as keyof typeof MANUAL_ABILITY_REGISTRY]?.unitId;
 const art=unitId&&v100StoryPortraitPath(unitId);
 if(!art)return null;
 return <span className="v100-crew-portrait manual-tactics-portrait" data-portrait-mode="upper" data-portrait-owner={unitId} style={v100PortraitFraming(unitId) as CSSProperties} aria-hidden="true"><span className="v100-crew-camera"><img src={art} alt="" loading="lazy" decoding="async" onLoad={event=>{
  const image=event.currentTarget;
  const decoded=typeof image.decode==='function'?image.decode().catch(()=>{}):Promise.resolve();
  void decoded.then(()=>requestAnimationFrame(()=>{if(image.isConnected&&image.naturalWidth>0)image.dataset.loaded='true';}));
 }} /></span></span>;
}
export function ManualAbilityTactics({entries,campaignPortraits=false,onToggle}:{entries:Entry[];campaignPortraits?:boolean;onToggle?:(open:boolean)=>void}) {
 return <details className={'manual-tactics'+(campaignPortraits?' manual-tactics-fieldguide':'')} onToggle={event=>onToggle?.(event.currentTarget.open)}>
  <summary>出撃中の仲間の技 <span>{entries.length}人</span></summary>
  {entries.length>0 && <p className="manual-tactics-help">戦闘中、仲間の頭上にある技ボタンをタップすると発動します。</p>}
  {entries.length===0?<p>出撃中の仲間はいません。</p>:<div className="manual-tactics-roster">
   {entries.map(entry=><article key={entry.ownerId} data-tactics-owner={entry.ownerId} data-tactics-kind={entry.kind}>
    {campaignPortraits&&<TacticsPortrait kind={entry.kind} />}
    <header><h3>{entry.name}<span>{entry.abilityName}</span></h3><b className={entry.available?'ready':''}>{entry.status}</b></header>
    {entry.targetLabel&&<p className="manual-tactics-target">{entry.targetLabel}</p>}
    <p className="manual-tactics-summary">{entry.summary}</p>
   </article>)}
  </div>}
 </details>;
}
