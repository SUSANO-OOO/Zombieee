type Entry = {ownerId:number;kind:string;name:string;abilityName:string;summary:string;tactic:string;status:string;available:boolean;targetLabel:string|null};
export function ManualAbilityTactics({entries}:{entries:Entry[]}) {
 return <details className="manual-tactics">
  <summary>仲間の技を確かめる <span>{entries.length}人</span></summary>
  <p className="manual-tactics-help">再開したら、仲間の頭上の技ボタンで発動。狙い先は戦況に合わせて変わる。</p>
  {entries.length===0?<p>戦場に仲間がいません。再開後、カードから呼び出そう。</p>:<div className="manual-tactics-roster">
   {entries.map(entry=><article key={entry.ownerId} data-tactics-owner={entry.ownerId} data-tactics-kind={entry.kind}>
    <header><h3>{entry.name}<span>{entry.abilityName}</span></h3><b className={entry.available?'ready':''}>{entry.status}</b></header>
    {entry.targetLabel&&<p className="manual-tactics-target">{entry.targetLabel}</p>}
    <p>{entry.summary}</p><p className="manual-tactics-use"><strong>使いどき</strong>{entry.tactic}</p>
   </article>)}
  </div>}
 </details>;
}
