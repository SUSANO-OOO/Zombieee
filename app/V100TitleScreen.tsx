"use client";

import { RELEASE_VERSION } from "./releaseIdentity.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import "./v100TitleScreen.css";

type Props = {
  canContinue: boolean; canOpenModes: boolean; busy: boolean; reducedMotion: boolean;
  onNew: () => void; onContinue: () => void; onSettings: () => void;
  onCredits: () => void; onModes: () => void; onData: () => void;
};

export function V100TitleScreen({ canContinue, canOpenModes, busy, reducedMotion, onNew, onContinue, onSettings, onCredits, onModes, onData }: Props) {
  return <section className="v100-start-screen" data-v100-surface="title" data-reduced-motion={reducedMotion} aria-labelledby="v100-start-title">
    <img className="v100-start-art" src={PRODUCTION_VISUALS.title} alt="" fetchPriority="high" />
    <div className="v100-start-shade" aria-hidden="true" />
    <div className="v100-start-haze" aria-hidden="true" />
    <div className="v100-start-content">
      <header className="v100-start-heading">
        <h1 id="v100-start-title">西新世紀末物語</h1>
        <p className="v100-start-version">Ver {RELEASE_VERSION}</p>
      </header>
      <nav className="v100-start-menu" aria-label="スタートメニュー">
        <button type="button" className="v100-start-primary" disabled={busy || !canContinue} onClick={onContinue}>続きから</button>
        <button type="button" disabled={busy} onClick={onNew}>初めから</button>
        <div className="v100-start-secondary">
          <button type="button" disabled={busy} onClick={onSettings}>設定</button>
          <button type="button" disabled={busy} onClick={onCredits}>クレジット</button>
        </div>
        <button type="button" className="v100-start-modes" disabled={busy || !canOpenModes} onClick={onModes}><span>モード選択</span><small>異常発生・サバイバル</small></button>
        {!canOpenModes && <small className="v100-start-mode-note">物語の作戦地図から利用できます</small>}
      </nav>
    </div>
    <button type="button" className="v100-start-data" disabled={busy} onClick={onData}>データ管理</button>
  </section>;
}
