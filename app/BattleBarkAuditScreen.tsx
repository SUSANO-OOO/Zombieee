"use client";

import { CANONICAL_RANDOM_BATTLE_BARK_LINES } from "./battleBarks.js";

export function BattleBarkAuditScreen() {
  const speakers = [...new Set(CANONICAL_RANDOM_BATTLE_BARK_LINES.map((line) => line.speakerKind))];
  return <section className="bark-audit-screen" aria-label="戦闘中ランダム台詞監査">
    <header><div><small>LOCALHOST QA / PROLOGUE-V5</small><h1>戦闘中ランダム台詞</h1></div><p><b>{CANONICAL_RANDOM_BATTLE_BARK_LINES.length}</b> 本 / <b>{speakers.length}</b> 名　実戦triggerとstable speaker cooldownは自動テスト対象</p></header>
    <div className="bark-audit-grid">
      {speakers.map((speakerKind) => {
        const lines = CANONICAL_RANDOM_BATTLE_BARK_LINES.filter((line) => line.speakerKind === speakerKind);
        return <article key={speakerKind} data-speaker-kind={speakerKind}>
          <h2>{lines[0]?.speaker}<small>{speakerKind}</small></h2>
          {lines.map((line) => <p key={line.id} data-trigger={line.trigger}><em>{line.trigger}</em><span>{line.text}</span></p>)}
        </article>;
      })}
    </div>
  </section>;
}
