import type {CSSProperties} from 'react';
import {MANUAL_ABILITY_REGISTRY} from './manualAbilities.js';
import {v100PortraitFraming} from './v100PortraitFraming.js';
import {v100StoryPortraitPath} from './v100StoryPortraitPaths.js';

type Entry = {ownerId:number;kind:string;name:string;abilityName:string;summary:string;tactic:string;status:string;available:boolean;targetLabel:string|null};
function TacticsPortrait({kind}:{kind:string}) {
 const unitId=MANUAL_ABILITY_REGISTRY[kind as keyof typeof MANUAL_ABILITY_REGISTRY]?.unitId;
 const art=unitId&&v100StoryPortraitPath(unitId);
 if(!art)return null;
 return <span className="v100-crew-portrait manual-tactics-portrait" data-portrait-mode="upper" data-portrait-owner={unitId} style={v100PortraitFraming(unitId) as CSSProperties} aria-hidden="true"><span className="v100-crew-camera"><img src={art} alt="" onLoad={event=>{
  const image=event.currentTarget;
  const decoded=typeof image.decode==='function'?image.decode().catch(()=>{}):Promise.resolve();
  void decoded.then(()=>requestAnimationFrame(()=>{if(image.isConnected&&image.naturalWidth>0)image.dataset.loaded='true';}));
 }} /></span></span>;
}
export function ManualAbilityTactics({entries,campaignPortraits=false,onToggle}:{entries:Entry[];campaignPortraits?:boolean;onToggle?:(open:boolean)=>void}) {
 return <details className={'manual-tactics'+(campaignPortraits?' manual-tactics-fieldguide':'')} onToggle={event=>onToggle?.(event.currentTarget.open)}>
  <summary>仲間の技を確かめる <span>{entries.length}人</span></summary>
  <p className="manual-tactics-help">再開したら、仲間の頭上の技ボタンで発動。狙い先は戦況に合わせて変わる。</p>
  {entries.length===0?<p>戦場に仲間がいません。再開後、カードから呼び出そう。</p>:<div className="manual-tactics-roster">
   {entries.map(entry=><article key={entry.ownerId} data-tactics-owner={entry.ownerId} data-tactics-kind={entry.kind}>
    {campaignPortraits&&<TacticsPortrait kind={entry.kind} />}
    <header><h3>{entry.name}<span>{entry.abilityName}</span></h3><b className={entry.available?'ready':''}>{entry.status}</b></header>
    {entry.targetLabel&&<p className="manual-tactics-target">{entry.targetLabel}</p>}
    <p className="manual-tactics-summary">{entry.summary}</p><p className="manual-tactics-use"><strong>使いどき</strong>{entry.tactic}</p>
   </article>)}
  </div>}
 </details>;
}
